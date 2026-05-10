import { createHash } from 'crypto';
import { and, eq, isNull, lt, ne } from 'drizzle-orm';
import { db } from './db';
import { tickets, messages, auditLogs } from './schema';

const RETENTION_DAYS = parseInt(process.env.GDPR_RETENTION_DAYS ?? '730', 10);

export async function anonymiseRequester(
  ticketId: number,
): Promise<{ alreadyDone: boolean }> {
  const [ticket] = await db
    .select({
      id: tickets.id,
      requesterEmail: tickets.requesterEmail,
      anonymisedAt: tickets.anonymisedAt,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) throw new Error(`Ticket ${ticketId} not found`);
  if (ticket.anonymisedAt) return { alreadyDone: true };

  const originalEmail = ticket.requesterEmail.toLowerCase();
  const hash = createHash('sha256').update(originalEmail).digest('hex');
  const anonEmail = `anon-${hash.slice(0, 12)}@redacted.invalid`;

  await db.transaction(async (tx) => {
    await tx
      .update(tickets)
      .set({
        requesterEmail: anonEmail,
        requesterEmailHash: hash,
        requesterId: null,
        anonymisedAt: new Date(),
      })
      .where(eq(tickets.id, ticketId));

    // Inbound messages: null all PII (headers + body contain requester content)
    await tx
      .update(messages)
      .set({
        fromEmail: null,
        toEmails: null,
        ccEmails: null,
        bodyText: null,
        bodyHtml: null,
        anonymisedAt: new Date(),
      })
      .where(and(eq(messages.ticketId, ticketId), eq(messages.direction, 'inbound')));

    // Outbound messages: null email headers only (body is agent-authored)
    await tx
      .update(messages)
      .set({
        toEmails: null,
        ccEmails: null,
        anonymisedAt: new Date(),
      })
      .where(and(eq(messages.ticketId, ticketId), eq(messages.direction, 'outbound')));

    await tx.insert(auditLogs).values({
      ticketId,
      agentId: null,
      action: 'gdpr_anonymise',
      metadata: { requesterEmailHash: hash },
    });
  });

  return { alreadyDone: false };
}

export async function runRetentionPurge(): Promise<{
  eligible: number;
  processed: number;
  errors: number;
}> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(
      and(
        ne(tickets.status, 'open'),
        ne(tickets.status, 'new'),
        lt(tickets.closedAt, cutoff),
        isNull(tickets.anonymisedAt),
      ),
    );

  let processed = 0;
  let errors = 0;

  for (const { id } of rows) {
    try {
      await anonymiseRequester(id);
      processed++;
    } catch (err) {
      console.error(`[gdpr] purge failed for ticket ${id}:`, err);
      errors++;
    }
  }

  if (rows.length > 0) {
    console.log(
      `[gdpr] retention purge complete — eligible: ${rows.length}, anonymised: ${processed}, errors: ${errors}`,
    );
  }

  return { eligible: rows.length, processed, errors };
}
