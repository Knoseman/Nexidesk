import type { ParsedMail } from "mailparser";
import { db } from "@/lib/db";
import {
  autoresponderConfig,
  messages,
  outboundQueue,
  auditLogs,
} from "@/lib/schema";
import {
  graphMailboxFromAddress,
  graphSendConfigured,
} from "@/lib/graph-access-token";

const AUTO_SENDER_PREFIXES = [
  "noreply",
  "no-reply",
  "mailer-daemon",
  "postmaster",
  "bounce",
  "notifications",
  "do-not-reply",
  "donotreply",
];

export function isAutoSubmittedMail(parsed: ParsedMail): boolean {
  const headers = parsed.headers;

  const autoSubmitted = headers.get("auto-submitted");
  if (autoSubmitted && autoSubmitted !== "no") return true;

  const xAutoSubmitted = headers.get("x-auto-submitted");
  if (xAutoSubmitted && xAutoSubmitted !== "no") return true;

  const precedence = headers.get("precedence");
  if (
    typeof precedence === "string" &&
    ["bulk", "list", "junk", "auto_reply"].includes(precedence.toLowerCase())
  )
    return true;

  const suppress = headers.get("x-auto-response-suppress");
  if (typeof suppress === "string" && /\b(all|oof|autoreply)\b/i.test(suppress))
    return true;

  const fromObj = parsed.from?.value?.[0];
  const fromEmail = fromObj?.address?.toLowerCase() ?? "";
  const localPart = fromEmail.split("@")[0] ?? "";
  if (
    AUTO_SENDER_PREFIXES.some(
      (p) =>
        localPart === p ||
        localPart.startsWith(`${p}-`) ||
        localPart.startsWith(`${p}+`),
    )
  )
    return true;

  const subject =
    typeof parsed.subject === "string" ? parsed.subject.toLowerCase() : "";
  if (
    subject.startsWith("auto:") ||
    subject.startsWith("automatic reply:") ||
    subject.startsWith("out of office:") ||
    subject.startsWith("autoreply:")
  )
    return true;

  return false;
}

function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(
    /\{\{([^}]+)\}\}/g,
    (_, key: string) => vars[key.trim()] ?? "",
  );
}

export async function getAutoresponderConfig() {
  const [row] = await db.select().from(autoresponderConfig).limit(1);
  return row ?? null;
}

export async function enqueueAutoResponse(opts: {
  ticketId: number;
  ticketNumber: string;
  ticketSubject: string;
  toEmail: string;
  requesterName: string | null;
  inboundMessageDbId: number;
  inboundMessageId: string | null;
}): Promise<void> {
  if (!graphSendConfigured()) return;

  const config = await getAutoresponderConfig();
  if (!config?.enabled) return;

  const vars: Record<string, string> = {
    "ticket.number": opts.ticketNumber,
    "ticket.subject": opts.ticketSubject,
    "requester.name": opts.requesterName ?? opts.toEmail.split("@")[0],
    "requester.email": opts.toEmail,
  };

  const bodyHtml = renderTemplate(config.bodyHtml, vars);
  const bodyText = renderTemplate(config.bodyText, vars);
  const fromMailbox = graphMailboxFromAddress();

  await db.transaction(async (tx) => {
    const [msg] = await tx
      .insert(messages)
      .values({
        ticketId: opts.ticketId,
        direction: "outbound",
        kind: "auto_reply",
        bodyText,
        bodyHtml,
        fromEmail: fromMailbox,
        toEmails: [opts.toEmail],
        inReplyTo: opts.inboundMessageId,
        referencesIds: opts.inboundMessageId ? [opts.inboundMessageId] : [],
      })
      .returning({ id: messages.id });

    const [q] = await tx
      .insert(outboundQueue)
      .values({
        ticketId: opts.ticketId,
        inReplyToMessageId: opts.inboundMessageDbId,
        stagedMessageId: msg.id,
        toEmails: [opts.toEmail],
        bodyText,
        bodyHtml,
      })
      .returning({ id: outboundQueue.id });

    await tx.insert(auditLogs).values({
      ticketId: opts.ticketId,
      action: "auto_reply_enqueued",
      metadata: { queueId: q.id, messageId: msg.id },
    });
  });
}
