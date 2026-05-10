import { NextResponse } from "next/server";
import { eq, desc, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  tickets,
  messages,
  outboundQueue,
  auditLogs,
  attachments,
  attachmentUploads,
} from "@/lib/schema";

async function requireTicketNotMerged(ticketId: number) {
  const [ticket] = await db
    .select({
      mergedIntoTicketId: tickets.mergedIntoTicketId,
      number: tickets.number,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);
  if (!ticket) return { error: "Not found", status: 404 } as const;
  if (ticket.mergedIntoTicketId != null) {
    return {
      error: `Ticket merged into #${ticket.number}`,
      status: 409,
      mergedIntoTicketId: ticket.mergedIntoTicketId,
    } as const;
  }
  return null;
}
import {
  graphMailboxFromAddress,
  graphSendConfigured,
} from "@/lib/graph-access-token";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmails(list: string[] | null | undefined, label: string) {
  if (!list) return;
  for (const e of list) {
    if (!emailRe.test(e) || e.length > 254) {
      throw new Error(`Invalid ${label}: ${e}`);
    }
  }
}

function validateRecipients(
  toEmails: string[] | null | undefined,
  ccEmails: string[] | null | undefined,
  bccEmails: string[] | null | undefined,
) {
  const total =
    (toEmails?.length ?? 0) +
    (ccEmails?.length ?? 0) +
    (bccEmails?.length ?? 0);
  if (total > 50) throw new Error("Too many recipients (max 50)");
  validateEmails(ccEmails, "CC");
  validateEmails(bccEmails, "BCC");
}

export type PostTicketMessageBody = {
  type: "reply" | "internal_note";
  bodyText: string;
  bodyHtml?: string | null;
  inReplyToMessageId?: number | null;
  /** Reserved for M11/M12; ignored for M4 (no audit trail yet). */
  snippet_id?: number | null;
  attachments?: Array<{
    uploadId: number;
    filename?: string | null;
  }> | null;
  ccEmails?: string[] | null;
  bccEmails?: string[] | null;
};

/**
 * Shared helper to persist a message and its attachments within a transaction.
 */
async function persistMessage(
  tx: any,
  {
    ticketId,
    direction,
    bodyText,
    bodyHtml,
    agentId,
    fromEmail,
    toEmails,
    ccEmails,
    bccEmails,
    inReplyTo,
    attachments: bodyAttachments,
  }: {
    ticketId: number;
    direction: "inbound" | "outbound" | "internal_note";
    bodyText: string;
    bodyHtml: string | null;
    agentId: number;
    fromEmail?: string | null;
    toEmails?: string[] | null;
    ccEmails?: string[] | null;
    bccEmails?: string[] | null;
    inReplyTo?: string | null;
    attachments?: PostTicketMessageBody["attachments"];
  },
) {
  const [msg] = await tx
    .insert(messages)
    .values({
      ticketId,
      direction,
      bodyText,
      bodyHtml,
      agentId,
      fromEmail,
      toEmails,
      ccEmails,
      bccEmails,
      inReplyTo,
      referencesIds: [],
    })
    .returning({ id: messages.id });

  for (const a of bodyAttachments ?? []) {
    const [upload] = await tx
      .select()
      .from(attachmentUploads)
      .where(
        and(
          eq(attachmentUploads.id, a.uploadId),
          eq(attachmentUploads.agentId, agentId),
          isNull(attachmentUploads.consumedByMessageId),
        ),
      )
      .limit(1);

    if (!upload) {
      throw new Error(`Invalid or already consumed upload: ${a.uploadId}`);
    }

    await tx.insert(attachments).values({
      messageId: msg.id,
      filename: a.filename ?? upload.filename ?? "attachment",
      contentType: upload.contentType,
      sizeBytes: upload.sizeBytes,
      storageKey: upload.storageKey,
      sha256: upload.sha256,
      contentId: null,
    });

    await tx
      .update(attachmentUploads)
      .set({ consumedByMessageId: msg.id })
      .where(eq(attachmentUploads.id, upload.id));
  }

  await tx
    .update(tickets)
    .set({ updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));

  return msg.id;
}

/**
 * §8 — POST /api/tickets/:id/messages (reply enqueues outbound; internal_note inserts only).
 */
export async function handlePostTicketMessage(
  agentId: number,
  ticketId: number,
  raw: unknown,
): Promise<NextResponse> {
  if (typeof raw !== "object" || raw === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = raw as PostTicketMessageBody;
  const type = body.type;
  if (type !== "reply" && type !== "internal_note") {
    return NextResponse.json(
      { error: 'type must be "reply" or "internal_note"' },
      { status: 400 },
    );
  }

  const bodyText =
    typeof body.bodyText === "string" ? body.bodyText.trim() : "";
  if (!bodyText) {
    return NextResponse.json({ error: "bodyText required" }, { status: 400 });
  }
  const bodyHtml =
    typeof body.bodyHtml === "string" ? body.bodyHtml.trim() || null : null;

  const mergeCheck = await requireTicketNotMerged(ticketId);
  if (mergeCheck) {
    return NextResponse.json(
      {
        error: mergeCheck.error,
        mergedIntoTicketId: mergeCheck.mergedIntoTicketId,
      },
      { status: mergeCheck.status },
    );
  }

  const [ticket] = await db
    .select({ id: tickets.id, requesterEmail: tickets.requesterEmail })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);
  if (!ticket)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    validateRecipients([ticket.requesterEmail], body.ccEmails, body.bccEmails);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid recipients";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (type === "internal_note") {
    try {
      const messageId = await db.transaction(async (tx) => {
        const msgId = await persistMessage(tx, {
          ticketId,
          direction: "internal_note",
          bodyText,
          bodyHtml,
          agentId,
          attachments: body.attachments,
        });

        await tx.insert(auditLogs).values({
          ticketId,
          agentId,
          action: "note_added",
          metadata: { messageId: msgId, snippetId: body.snippet_id ?? null },
        });

        return msgId;
      });

      return NextResponse.json({ ok: true, messageId });
    } catch (e) {
      console.error("[api/messages note]", e);
      const msg = e instanceof Error ? e.message : "Insert failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  if (!graphSendConfigured()) {
    return NextResponse.json(
      {
        error: "Outbound mail not configured (Graph Mail.Send + refresh token)",
      },
      { status: 503 },
    );
  }

  let inReplyToDbId: number | null =
    body.inReplyToMessageId === undefined || body.inReplyToMessageId === null
      ? null
      : Number(body.inReplyToMessageId);
  if (inReplyToDbId != null && Number.isNaN(inReplyToDbId)) {
    return NextResponse.json(
      { error: "Invalid inReplyToMessageId" },
      { status: 400 },
    );
  }

  let parentMessageId: string | null = null;
  if (inReplyToDbId != null) {
    const [parent] = await db
      .select({
        id: messages.id,
        ticketId: messages.ticketId,
        messageId: messages.messageId,
      })
      .from(messages)
      .where(
        and(eq(messages.id, inReplyToDbId), eq(messages.ticketId, ticketId)),
      )
      .limit(1);
    if (!parent) {
      return NextResponse.json(
        { error: "inReplyToMessageId not on this ticket" },
        { status: 400 },
      );
    }
    parentMessageId = parent.messageId ?? null;
  } else {
    const [latestInbound] = await db
      .select({ id: messages.id, messageId: messages.messageId })
      .from(messages)
      .where(
        and(eq(messages.ticketId, ticketId), eq(messages.direction, "inbound")),
      )
      .orderBy(desc(messages.createdAt))
      .limit(1);
    inReplyToDbId = latestInbound?.id ?? null;
    parentMessageId = latestInbound?.messageId ?? null;
  }

  const toEmail = ticket.requesterEmail;
  if (!toEmail)
    return NextResponse.json(
      { error: "Ticket missing requester" },
      { status: 400 },
    );

  const fromMailbox = graphMailboxFromAddress() || "unknown@invalid";

  try {
    const result = await db.transaction(async (tx) => {
      const msgId = await persistMessage(tx, {
        ticketId,
        direction: "outbound",
        bodyText,
        bodyHtml,
        agentId,
        fromEmail: fromMailbox,
        toEmails: [toEmail],
        ccEmails: body.ccEmails,
        bccEmails: body.bccEmails,
        inReplyTo: parentMessageId,
        attachments: body.attachments,
      });

      const [q] = await tx
        .insert(outboundQueue)
        .values({
          ticketId,
          inReplyToMessageId: inReplyToDbId,
          agentId,
          bodyText,
          bodyHtml,
          toEmails: [toEmail],
          ccEmails: body.ccEmails,
          bccEmails: body.bccEmails,
          stagedMessageId: msgId,
        })
        .returning({ id: outboundQueue.id });

      await tx.insert(auditLogs).values({
        ticketId,
        agentId,
        action: "reply_enqueued",
        metadata: {
          queueId: q.id,
          messageId: msgId,
          snippetId: body.snippet_id ?? null,
        },
      });

      return { stagedId: msgId, queueId: q.id };
    });

    return NextResponse.json({
      ok: true,
      queueId: result.queueId,
      messageId: result.stagedId,
    });
  } catch (e) {
    console.error("[api/messages reply]", e);
    const msg = e instanceof Error ? e.message : "Enqueue failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
