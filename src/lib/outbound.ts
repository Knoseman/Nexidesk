import { eq, and, inArray, lte, asc, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  outboundQueue,
  tickets,
  agents,
  messages,
  emailEvents,
  attachments,
} from "@/lib/schema";
import { r2Configured, r2Get } from "@/lib/r2";
import {
  getGraphAccessToken,
  graphMailboxUser,
  graphMailboxFromAddress,
  graphMailboxFromName,
  graphSendConfigured,
} from "@/lib/graph-access-token";
function textToHtml(text: string): string {
  const urlRegex = /(\b(?:https?:\/\/|www\.)[^\s<]+)/gi;
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const linked = escaped.replace(urlRegex, (raw) => {
    const trailing = raw.match(/[.,;:!?\)\]]+$/);
    const url = trailing ? raw.slice(0, -trailing[0].length) : raw;
    const suffix = trailing ? trailing[0] : "";
    const href = url.startsWith("www.") ? `https://${url}` : url;
    return `<a href="${href}">${url}</a>${suffix}`;
  });
  return linked
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => (line === "" ? "<br/>" : line))
    .join("<br/>");
}

const BATCH = 8;
const MAX_ATTEMPTS = 3;
const SCAN_MS = parseInt(process.env.OUTBOUND_SCAN_MS ?? "30000", 10);
/** Reclaim rows stuck in `sending` after a crash mid-send. */
const STALE_SENDING_MS = 15 * 60 * 1000;
/** After Graph accepts send, allow this long before scanning the mailbox for X-Outbound-Id. */
const RECONCILE_MIN_AGE_MS = 90 * 1000;
/** Stop scanning before stale reclaim kicks in (leave margin). */
const RECONCILE_MAX_AGE_MS = 14 * 60 * 1000;

export function backoffSeconds(attempts: number): number {
  return Math.min(300, 15 * 2 ** Math.max(0, attempts - 1));
}

export function buildReplySubject(
  ticketNumber: string,
  subjectNormalized: string,
): string {
  const token = `[${ticketNumber}]`;
  const lower = subjectNormalized.toLowerCase();
  if (lower.includes("cid-") || lower.includes("tkt-")) {
    return `Re: ${subjectNormalized}`;
  }
  return `Re: ${token} ${subjectNormalized}`;
}

type QueueRow = typeof outboundQueue.$inferSelect;

type GraphAttachment = {
  "@odata.type": string;
  name: string;
  contentType: string;
  contentBytes: string;
};

async function sendMailJson(opts: {
  accessToken: string;
  subject: string;
  html: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  saveToSentItems: boolean;
  fromAddress: string;
  fromName?: string;
  idempotencyKey: string;
  attachments?: GraphAttachment[];
  extraHeaders?: Array<{ name: string; value: string }>;
}): Promise<void> {
  const toRecipients = opts.to.map((address) => ({
    emailAddress: { address },
  }));
  const ccRecipients = (opts.cc ?? [])
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address } }));
  const bccRecipients = (opts.bcc ?? [])
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address } }));

  const fromRecipient = {
    emailAddress: {
      address: opts.fromAddress,
      ...(opts.fromName ? { name: opts.fromName } : {}),
    },
  };

  const body = {
    message: {
      subject: opts.subject,
      body: {
        contentType: "HTML",
        content: opts.html,
      },
      from: fromRecipient,
      sender: fromRecipient,
      toRecipients,
      ...(ccRecipients.length ? { ccRecipients } : {}),
      ...(bccRecipients.length ? { bccRecipients } : {}),
      internetMessageHeaders: [
        { name: "X-Outbound-Id", value: opts.idempotencyKey },
        ...(opts.extraHeaders ?? []),
      ],
      ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
    },
    saveToSentItems: opts.saveToSentItems,
  };

  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 202 || res.status === 200) return;

  const errText = await res.text().catch(() => "");
  throw new Error(
    `Graph sendMail failed HTTP ${res.status}: ${errText.slice(0, 500)}`,
  );
}

async function findGraphMessageIdByOutboundHeader(
  accessToken: string,
  idempotencyKey: string,
): Promise<string | null> {
  const url = new URL("https://graph.microsoft.com/v1.0/me/messages");
  url.searchParams.set("$top", "50");
  url.searchParams.set("$orderby", "sentDateTime desc");
  url.searchParams.set("$select", "id,internetMessageHeaders");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    value?: Array<{
      id?: string;
      internetMessageHeaders?: { name?: string; value?: string }[];
    }>;
  };
  const needle = idempotencyKey.toLowerCase();
  for (const m of data.value ?? []) {
    const headers = m.internetMessageHeaders ?? [];
    for (const h of headers) {
      if (
        h.name?.toLowerCase() === "x-outbound-id" &&
        h.value?.toLowerCase() === needle
      ) {
        return m.id ?? null;
      }
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * After send, the Graph message id is not the draft id; locate the sent copy via X-Outbound-Id.
 */
async function resolveGraphMessageIdByOutboundHeader(
  accessToken: string,
  idempotencyKey: string,
  opts?: { attempts?: number; delayMs?: number },
): Promise<string | null> {
  const attempts = opts?.attempts ?? 6;
  const delayMs = opts?.delayMs ?? 400;
  for (let i = 0; i < attempts; i++) {
    const id = await findGraphMessageIdByOutboundHeader(
      accessToken,
      idempotencyKey,
    );
    if (id) return id;
    if (i + 1 < attempts) await sleep(delayMs);
  }
  return null;
}

/**
 * createReply → PATCH draft → send. Draft id is not the persisted sent message id.
 */
async function sendViaCreateReply(opts: {
  accessToken: string;
  graphParentMessageId: string;
  html: string;
  subject: string;
  idempotencyKey: string;
  fromAddress: string;
  fromName?: string;
  attachments?: GraphAttachment[];
}): Promise<void> {
  const {
    accessToken,
    graphParentMessageId,
    html,
    subject,
    idempotencyKey,
    fromAddress,
    fromName,
  } = opts;

  const parentEnc = encodeURIComponent(graphParentMessageId);
  const cr = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${parentEnc}/createReply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  );
  if (!cr.ok) {
    const t = await cr.text();
    throw new Error(`createReply failed HTTP ${cr.status}: ${t.slice(0, 400)}`);
  }
  const draft = (await cr.json()) as { id?: string };
  if (!draft.id) throw new Error("createReply: missing draft id");
  const draftId = draft.id;

  const patchBody: Record<string, unknown> = {
    body: { contentType: "HTML", content: html },
    subject,
    internetMessageHeaders: [{ name: "X-Outbound-Id", value: idempotencyKey }],
    from: fromName
      ? { emailAddress: { address: fromAddress, name: fromName } }
      : { emailAddress: { address: fromAddress } },
    ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
  };

  const draftEnc = encodeURIComponent(draftId);
  const patch = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${draftEnc}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patchBody),
    },
  );
  if (!patch.ok) {
    await fetch(`https://graph.microsoft.com/v1.0/me/messages/${draftEnc}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {});
    const t = await patch.text();
    throw new Error(
      `patch draft failed HTTP ${patch.status}: ${t.slice(0, 400)}`,
    );
  }

  const send = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${draftEnc}/send`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (send.status !== 202 && send.status !== 200) {
    const t = await send.text();
    throw new Error(
      `send draft failed HTTP ${send.status}: ${t.slice(0, 400)}`,
    );
  }
}

async function finalizeOutboundSuccess(opts: {
  queueId: number;
  ticketId: number;
  stagedMessageId: number;
  subject: string;
  sentAt: Date;
  graphMessageId?: string | null;
}): Promise<void> {
  const {
    queueId,
    ticketId,
    stagedMessageId,
    subject,
    sentAt,
    graphMessageId,
  } = opts;
  const externalId = `outbound_queue:${queueId}`;

  await db.transaction(async (tx) => {
    const [q0] = await tx
      .select({ status: outboundQueue.status })
      .from(outboundQueue)
      .where(eq(outboundQueue.id, queueId))
      .limit(1);
    if (q0?.status === "sent") return;

    const [dup] = await tx
      .select({ id: emailEvents.id })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.source, "outbound_send"),
          eq(emailEvents.eventType, "outbound_sent"),
          eq(emailEvents.externalId, externalId),
        ),
      )
      .limit(1);
    if (dup) return;

    const updated = await tx
      .update(outboundQueue)
      .set({
        status: "sent",
        sentAt,
        lastError: null,
        processingStartedAt: null,
        ...(graphMessageId ? { sentMessageId: graphMessageId } : {}),
      })
      .where(
        and(eq(outboundQueue.id, queueId), eq(outboundQueue.status, "sending")),
      )
      .returning({ id: outboundQueue.id });

    if (updated.length === 0) {
      const [cur] = await tx
        .select({ status: outboundQueue.status })
        .from(outboundQueue)
        .where(eq(outboundQueue.id, queueId))
        .limit(1);
      if (cur?.status === "sent") return;
      return;
    }

    await tx
      .update(messages)
      .set({
        sentAt,
        subject,
        ...(graphMessageId ? { graphMessageId } : {}),
      })
      .where(eq(messages.id, stagedMessageId));

    await tx.insert(emailEvents).values({
      source: "outbound_send",
      eventType: "outbound_sent",
      externalId,
      payload: { queueId, ticketId, stagedMessageId },
      messageId: stagedMessageId,
      ticketId,
    });
  });

  await db
    .update(tickets)
    .set({ updatedAt: sentAt })
    .where(eq(tickets.id, ticketId));
}

async function reconcileSendingRows(): Promise<void> {
  if (!graphSendConfigured()) return;

  const now = Date.now();
  const minStarted = new Date(now - RECONCILE_MAX_AGE_MS);
  const maxStarted = new Date(now - RECONCILE_MIN_AGE_MS);

  const rows = await db
    .select()
    .from(outboundQueue)
    .where(
      and(
        eq(outboundQueue.status, "sending"),
        lte(outboundQueue.processingStartedAt, maxStarted),
        gte(outboundQueue.processingStartedAt, minStarted),
      ),
    );

  if (rows.length === 0) return;

  let accessToken: string;
  try {
    accessToken = await getGraphAccessToken();
  } catch {
    return;
  }

  for (const row of rows) {
    const graphId = await findGraphMessageIdByOutboundHeader(
      accessToken,
      row.idempotencyKey,
    );
    if (!graphId) continue;

    const [ticket] = await db
      .select({
        number: tickets.number,
        subjectNormalized: tickets.subjectNormalized,
      })
      .from(tickets)
      .where(eq(tickets.id, row.ticketId))
      .limit(1);
    if (!ticket) continue;

    const subject = buildReplySubject(ticket.number, ticket.subjectNormalized);
    const stagedId = row.stagedMessageId;
    if (!stagedId) continue;

    await finalizeOutboundSuccess({
      queueId: row.id,
      ticketId: row.ticketId,
      stagedMessageId: stagedId,
      subject,
      sentAt: new Date(),
      graphMessageId: graphId,
    });
  }
}

async function reclaimStaleSending(): Promise<void> {
  const staleBefore = new Date(Date.now() - STALE_SENDING_MS);
  await db
    .update(outboundQueue)
    .set({
      status: "failed",
      processingStartedAt: null,
      lastError: "sending lease expired — will retry",
      nextAttemptAt: new Date(),
    })
    .where(
      and(
        eq(outboundQueue.status, "sending"),
        lte(outboundQueue.processingStartedAt, staleBefore),
      ),
    );
}

/**
 * Claim a batch with row locks so concurrent workers skip rows already claimed.
 */
async function claimOutboundBatch(now: Date): Promise<QueueRow[]> {
  return db.transaction(async (tx) => {
    const locked = await tx
      .select({ id: outboundQueue.id })
      .from(outboundQueue)
      .where(
        and(
          inArray(outboundQueue.status, ["pending", "failed"]),
          lte(outboundQueue.nextAttemptAt, now),
        ),
      )
      .orderBy(asc(outboundQueue.nextAttemptAt))
      .limit(BATCH)
      .for("update", { skipLocked: true });

    const ids = locked.map((r) => r.id);
    if (ids.length === 0) return [];

    return tx
      .update(outboundQueue)
      .set({
        status: "sending",
        processingStartedAt: new Date(),
      })
      .where(inArray(outboundQueue.id, ids))
      .returning();
  });
}

export async function processOutboundQueueOnce(): Promise<void> {
  if (!graphSendConfigured()) return;

  await reconcileSendingRows();
  await reclaimStaleSending();

  const now = new Date();
  const rows = await claimOutboundBatch(now);

  for (const row of rows) {
    try {
      await processOneWithRetry(row);
    } catch (e) {
      console.error("[outbound] row %s:", row.id, e);
    }
  }
}

async function processOne(row: QueueRow): Promise<void> {
  console.log(
    `[outbound] Processing queue row ${row.id} (ticket ${row.ticketId})`,
  );
  const mailboxUser = graphMailboxUser();
  if (!mailboxUser) throw new Error("GRAPH_MAILBOX_USER / IMAP_USER missing");

  const fromAddress = graphMailboxFromAddress();
  if (!fromAddress)
    throw new Error(
      "GRAPH_MAILBOX_FROM / GRAPH_MAILBOX_USER / IMAP_USER missing",
    );

  const [ticket] = await db
    .select({
      id: tickets.id,
      number: tickets.number,
      subjectNormalized: tickets.subjectNormalized,
    })
    .from(tickets)
    .where(eq(tickets.id, row.ticketId))
    .limit(1);
  if (!ticket) {
    await markDead(row.id, "ticket not found");
    return;
  }

  let agentSignatureHtml: string | null = null;
  if (row.agentId != null) {
    const [agent] = await db
      .select({ signatureHtml: agents.signatureHtml })
      .from(agents)
      .where(eq(agents.id, row.agentId))
      .limit(1);
    if (!agent) {
      await markDead(row.id, "agent not found");
      return;
    }
    agentSignatureHtml = agent.signatureHtml ?? null;
  }

  const stagedId = row.stagedMessageId;
  if (!stagedId) {
    await markDead(row.id, "missing staged_message_id");
    return;
  }

  const [stagedMsg] = await db
    .select({ kind: messages.kind })
    .from(messages)
    .where(eq(messages.id, stagedId))
    .limit(1);
  const isAutoReply = stagedMsg?.kind === "auto_reply";

  const bodyContent = row.bodyHtml?.trim()
    ? row.bodyHtml
    : textToHtml(row.bodyText ?? "");
  const sigSnippet = agentSignatureHtml?.trim()
    ? `<br/><br/>${agentSignatureHtml}`
    : "";

  let htmlBody: string;
  if (sigSnippet) {
    // Splice signature before the quoted history so it appears above the
    // "show trimmed content" fold in the recipient's email client.
    const quoteIdx = bodyContent.search(/<div\s+class="nexidesk-quote"|<blockquote\b/i);
    htmlBody = quoteIdx >= 0
      ? bodyContent.slice(0, quoteIdx) + sigSnippet + bodyContent.slice(quoteIdx)
      : bodyContent + sigSnippet;
  } else {
    htmlBody = bodyContent;
  }

  const subject = buildReplySubject(ticket.number, ticket.subjectNormalized);

  const graphAttachments: GraphAttachment[] = [];
  if (row.stagedMessageId && r2Configured()) {
    const attRows = await db
      .select()
      .from(attachments)
      .where(eq(attachments.messageId, row.stagedMessageId));

    for (const a of attRows) {
      const stream = await r2Get(a.storageKey);
      if (!stream) continue;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer),
        );
      }
      graphAttachments.push({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: a.filename,
        contentType: a.contentType ?? "application/octet-stream",
        contentBytes: Buffer.concat(chunks).toString("base64"),
      });
    }
  }

  const accessToken = await getGraphAccessToken();
  const fromName = graphMailboxFromName();

  let outboundGraphId: string | null = null;
  let usedCreateReply = false;

  if (row.inReplyToMessageId) {
    const [parent] = await db
      .select({ graphMessageId: messages.graphMessageId })
      .from(messages)
      .where(eq(messages.id, row.inReplyToMessageId))
      .limit(1);
    const graphParentId = parent?.graphMessageId?.trim();
    if (graphParentId) {
      try {
        await sendViaCreateReply({
          accessToken,
          graphParentMessageId: graphParentId,
          html: htmlBody,
          subject,
          idempotencyKey: row.idempotencyKey,
          fromAddress,
          fromName,
          attachments: graphAttachments,
        });
        usedCreateReply = true;
        outboundGraphId = await resolveGraphMessageIdByOutboundHeader(
          accessToken,
          row.idempotencyKey,
        );
      } catch (e) {
        console.warn(
          "[outbound] createReply failed, falling back to sendMail:",
          e,
        );
      }
    }
  }

  if (!usedCreateReply) {
    await sendMailJson({
      accessToken,
      subject,
      html: htmlBody,
      to: row.toEmails,
      cc: row.ccEmails ?? undefined,
      bcc: row.bccEmails ?? undefined,
      saveToSentItems: false,
      fromAddress,
      fromName,
      idempotencyKey: row.idempotencyKey,
      attachments: graphAttachments,
      extraHeaders: isAutoReply
        ? [
            { name: "X-Auto-Response-Suppress", value: "All" },
            { name: "X-Auto-Submitted", value: "auto-replied" },
          ]
        : undefined,
    });
  }

  await finalizeOutboundSuccess({
    queueId: row.id,
    ticketId: row.ticketId,
    stagedMessageId: stagedId,
    subject,
    sentAt: new Date(),
    graphMessageId: outboundGraphId,
  });
}

async function markDead(queueId: number, err: string): Promise<void> {
  await db
    .update(outboundQueue)
    .set({
      status: "dead",
      lastError: err.slice(0, 2000),
      nextAttemptAt: new Date(),
      processingStartedAt: null,
    })
    .where(eq(outboundQueue.id, queueId));
}

async function scheduleRetry(
  queueId: number,
  attempts: number,
  err: string,
): Promise<void> {
  const delaySec = backoffSeconds(attempts + 1);
  const next = new Date(Date.now() + delaySec * 1000);
  const newAttempts = attempts + 1;
  const status = newAttempts >= MAX_ATTEMPTS ? "dead" : "failed";
  await db
    .update(outboundQueue)
    .set({
      status,
      attempts: newAttempts,
      lastError: err.slice(0, 2000),
      nextAttemptAt: next,
      processingStartedAt: null,
    })
    .where(eq(outboundQueue.id, queueId));
}

async function processOneWithRetry(row: QueueRow): Promise<void> {
  if (row.status === "dead" || row.status === "sent") return;

  const terminal = await db
    .select({ status: outboundQueue.status })
    .from(outboundQueue)
    .where(eq(outboundQueue.id, row.id))
    .limit(1);
  const st = terminal[0]?.status;
  if (st === "dead" || st === "sent") return;

  try {
    await processOne(row);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await scheduleRetry(row.id, row.attempts, msg);
  }
}

export function startOutboundWorker(): void {
  void processOutboundQueueOnce().catch((err) =>
    console.error("[outbound] process error:", err),
  );
  setInterval(() => {
    void processOutboundQueueOnce().catch((err) =>
      console.error("[outbound] process error:", err),
    );
  }, SCAN_MS);
  console.log(
    "[workers] Outbound queue processor scheduled every %d s",
    SCAN_MS / 1000,
  );
}
