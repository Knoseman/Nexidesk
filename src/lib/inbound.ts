import { randomUUID, createHash } from "crypto";
import { eq, and } from "drizzle-orm";
import { simpleParser, AddressObject } from "mailparser";
import { db } from "@/lib/db";
import {
  tickets,
  messages,
  emailEvents,
  attachments,
  contacts,
} from "@/lib/schema";
import { normalizeSubject, resolveInboundThread } from "@/lib/threading";
import { r2Configured, r2Put } from "@/lib/r2";
import { isAutoSubmittedMail, enqueueAutoResponse } from "@/lib/autoresponse";

type ParsedMail = Awaited<ReturnType<typeof simpleParser>>;

export { normalizeSubject };

export function stripMessageId(id: string | undefined | null): string | null {
  if (!id) return null;
  const s = id.replace(/[<>]/g, "").trim();
  return s || null;
}

export function deriveCompanyName(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  const common = [
    "gmail.com",
    "outlook.com",
    "hotmail.com",
    "yahoo.com",
    "icloud.com",
    "me.com",
    "live.com",
    "msn.com",
    "aol.com",
    "protonmail.com",
  ];
  if (common.includes(domain)) return null;
  const parts = domain.split(".");
  if (parts.length < 2) return null;
  // handle e.g. company.co.uk
  const name =
    parts[parts.length - 2] === "co" || parts[parts.length - 2] === "com"
      ? parts[parts.length - 3]
      : parts[parts.length - 2];
  if (!name) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function parseReferences(raw: ParsedMail["references"]): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((r) => stripMessageId(String(r))!).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .trim()
      .split(/\s+/)
      .map((s) => stripMessageId(s))
      .filter((x): x is string => Boolean(x));
  }
  return [];
}

/**
 * Extracts structured addresses from mailparser fields (to, from, cc, bcc).
 */
export function getAddresses(
  field:
    | ParsedMail["to"]
    | ParsedMail["from"]
    | ParsedMail["cc"]
    | ParsedMail["bcc"],
): string[] {
  if (!field) return [];
  const addrs = field as AddressObject;
  if (Array.isArray(addrs.value)) {
    return addrs.value
      .map((a) => a.address?.toLowerCase().trim())
      .filter((a): a is string => !!a);
  }
  return [];
}

export async function ingestInboundMime(
  source: Buffer,
  imapUid: number,
): Promise<"ingested" | "duplicate" | "skipped"> {
  const parsed = await simpleParser(source);

  const rawMid = stripMessageId(
    typeof parsed.messageId === "string" ? parsed.messageId : undefined,
  );
  const externalId = rawMid ?? `imap:${imapUid}`;

  const [dup] = await db
    .select({ id: emailEvents.id })
    .from(emailEvents)
    .where(
      and(
        eq(emailEvents.source, "imap_poll"),
        eq(emailEvents.externalId, externalId),
      ),
    )
    .limit(1);
  if (dup) return "duplicate";

  const messageId = rawMid;
  const inReplyTo = stripMessageId(
    typeof parsed.inReplyTo === "string" ? parsed.inReplyTo : undefined,
  );
  const referencesIds = parseReferences(parsed.references);
  const subject = typeof parsed.subject === "string" ? parsed.subject : "";
  const subjectNormalized = normalizeSubject(subject);

  const fromObj = (parsed.from as AddressObject)?.value?.[0];
  const fromEmail = fromObj?.address?.toLowerCase().trim() || "unknown@invalid";
  const requesterName = fromObj?.name || null;

  const toEmails = getAddresses(parsed.to);
  const ccEmails = getAddresses(parsed.cc);
  const bccEmails = getAddresses(parsed.bcc);

  const bodyText = typeof parsed.text === "string" ? parsed.text : null;
  const bodyHtml = typeof parsed.html === "string" ? parsed.html : null;
  const receivedAt = parsed.date ? new Date(parsed.date) : new Date();
  const companyName = deriveCompanyName(fromEmail);

  // Hoisted out of the transaction so we can trigger autoresponse after commit
  let autoRespTicketId = 0;
  let autoRespTicketNumber = "";
  let autoRespTicketSubject = "";
  let autoRespInboundDbId = 0;
  let isNewTicket = false;

  type PendingAttachment = {
    filename: string;
    contentType: string;
    sizeBytes: number;
    storageKey: string;
    sha256buf: Buffer;
    contentId: string | null;
  };

  const pendingAttachments: PendingAttachment[] = [];

  for (const att of parsed.attachments ?? []) {
    if (!att.content || !att.size) continue;
    const buf = Buffer.isBuffer(att.content)
      ? att.content
      : Buffer.from(att.content as ArrayBuffer);
    const sha256buf = createHash("sha256").update(buf).digest();
    const sha256hex = sha256buf.toString("hex");
    const storageKey = `at/${sha256hex}`;
    if (r2Configured()) {
      await r2Put(
        storageKey,
        buf,
        att.contentType ?? "application/octet-stream",
      );
    }
    pendingAttachments.push({
      filename: att.filename ?? "attachment",
      contentType: att.contentType ?? "application/octet-stream",
      sizeBytes: att.size,
      storageKey,
      sha256buf,
      contentId: (att as { cid?: string }).cid ?? null,
    });
  }

  try {
    await db.transaction(async (tx) => {
      // Find or create contact
      let [contact] = await tx
        .select()
        .from(contacts)
        .where(eq(contacts.email, fromEmail))
        .limit(1);

      if (!contact) {
        [contact] = await tx
          .insert(contacts)
          .values({
            email: fromEmail,
            name: requesterName,
            companyName: companyName,
          })
          .returning();
      } else if (requesterName && !contact.name) {
        // Update name if we didn't have it before
        await tx
          .update(contacts)
          .set({ name: requesterName })
          .where(eq(contacts.id, contact.id));
      }

      const resolved = await resolveInboundThread(tx, {
        subject,
        subjectNormalized,
        fromEmail,
        inReplyTo,
        referencesIds,
      });

      let ticketId = 0;
      let needNewTicket = resolved.kind === "new";

      if (resolved.kind === "existing") {
        ticketId = resolved.ticketId;
        const [cur] = await tx
          .select({ status: tickets.status })
          .from(tickets)
          .where(eq(tickets.id, ticketId))
          .limit(1);

        if (!cur) {
          // Ticket was hard-deleted; treat this email as a new thread
          needNewTicket = true;
        } else {
          const reopening =
            cur.status === "pending" ||
            cur.status === "resolved" ||
            cur.status === "closed";
          const newStatus = reopening ? "open" : cur.status;

          await tx
            .update(tickets)
            .set({
              updatedAt: new Date(),
              requesterId: contact.id,
              status: newStatus,
              // Clear closedAt so the RightRail doesn't show a stale close date
              ...(reopening ? { closedAt: null } : {}),
            })
            .where(eq(tickets.id, ticketId));
        }
      }

      if (needNewTicket) {
        const placeholder = `tmp-${randomUUID()}`;
        const [t] = await tx
          .insert(tickets)
          .values({
            number: placeholder,
            subjectNormalized,
            requesterEmail: fromEmail,
            requesterId: contact.id,
          })
          .returning({ id: tickets.id });
        ticketId = t.id;
        const ticketNumber = `CID-${String(ticketId).padStart(5, "0")}`;
        await tx
          .update(tickets)
          .set({
            number: ticketNumber,
            updatedAt: new Date(),
          })
          .where(eq(tickets.id, ticketId));
        isNewTicket = true;
        autoRespTicketId = ticketId;
        autoRespTicketNumber = ticketNumber;
        autoRespTicketSubject = subjectNormalized;
      }

      const [msg] = await tx
        .insert(messages)
        .values({
          ticketId,
          direction: "inbound",
          messageId,
          inReplyTo,
          referencesIds,
          fromEmail,
          toEmails: toEmails.length ? toEmails : null,
          ccEmails: ccEmails.length ? ccEmails : null,
          bccEmails: bccEmails.length ? bccEmails : null,
          subject: subject || null,
          bodyText,
          bodyHtml,
          receivedAt,
        })
        .returning({ id: messages.id });

      if (isNewTicket) {
        autoRespInboundDbId = msg.id;
      }

      for (const a of pendingAttachments) {
        await tx
          .insert(attachments)
          .values({
            messageId: msg.id,
            filename: a.filename,
            contentType: a.contentType,
            sizeBytes: a.sizeBytes,
            storageKey: a.storageKey,
            sha256: a.sha256buf,
            contentId: a.contentId,
          })
          .onConflictDoNothing();
      }

      await tx.insert(emailEvents).values({
        source: "imap_poll",
        eventType: "inbound_received",
        externalId,
        payload: { imapUid, subject, messageId },
        messageId: msg.id,
        ticketId,
      });
    });
  } catch (e) {
    const asObj = e && typeof e === "object" ? e as Record<string, unknown> : null;
    const code = (asObj?.["code"] ?? (asObj?.["cause"] as Record<string, unknown> | null)?.["code"]) as string | undefined;
    if (code === "23505") return "duplicate";
    throw e;
  }

  if (isNewTicket && !isAutoSubmittedMail(parsed)) {
    try {
      await enqueueAutoResponse({
        ticketId: autoRespTicketId,
        ticketNumber: autoRespTicketNumber,
        ticketSubject: autoRespTicketSubject,
        inboundMessageDbId: autoRespInboundDbId,
        toEmail: fromEmail,
        requesterName,
        inboundMessageId: messageId,
      });
    } catch (e) {
      console.error("[inbound] autoresponse enqueue failed:", e);
    }
  }

  return "ingested";
}
