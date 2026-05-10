import {
  and,
  arrayOverlaps,
  eq,
  desc,
  gt,
  inArray,
  max,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { auditLogs, messages, tickets } from "@/lib/schema";
import type * as schema from "@/lib/schema";

export type NexideskTx = PostgresJsDatabase<typeof schema>;

/**
 * §6 threading: Re:/Fwd: strip, lowercase, collapse whitespace (matches DB subject_normalized).
 */
export function normalizeSubject(subject: string | undefined): string {
  if (!subject) return "(no subject)";
  let s = subject.trim().toLowerCase().replace(/\s+/g, " ");
  const prefix = /^(re|fw|fwd|aw|sv)\s*:\s*/i;
  while (prefix.test(s)) {
    s = s.replace(prefix, "").trim();
  }
  return s || "(no subject)";
}

export function uniqRefs(
  inReplyTo: string | null,
  referencesIds: string[],
): string[] {
  const set = new Set<string>();
  if (inReplyTo) set.add(inReplyTo);
  for (const r of referencesIds) {
    if (r) set.add(r);
  }
  return [...set];
}

export async function resolveInboundThread(
  tx: NexideskTx,
  input: {
    subject: string;
    subjectNormalized: string;
    fromEmail: string;
    inReplyTo: string | null;
    referencesIds: string[];
  },
): Promise<{ kind: "existing"; ticketId: number } | { kind: "new" }> {
  const refs = uniqRefs(input.inReplyTo, input.referencesIds);

  if (refs.length > 0) {
    const candidates = await tx
      .select({
        ticketId: messages.ticketId,
        lastSeen: max(messages.createdAt).as("last_seen"),
      })
      .from(messages)
      .where(
        or(
          inArray(messages.messageId, refs),
          arrayOverlaps(messages.referencesIds, refs),
        ),
      )
      .groupBy(messages.ticketId)
      .orderBy(desc(max(messages.createdAt)))
      .limit(2);

    if (candidates.length > 0) {
      const ticketId = candidates[0].ticketId;
      if (candidates.length > 1) {
        await tx.insert(auditLogs).values({
          ticketId,
          agentId: null,
          action: "threading_collision_header",
          metadata: {
            refs,
            candidateTicketIds: candidates.map((c) => c.ticketId),
          },
        });
      }
      return { kind: "existing", ticketId };
    }
  }

  const tokenMatch = input.subject.match(/\[(CID|TKT)-(\d+)\]/i);
  if (tokenMatch) {
    const prefix = tokenMatch[1].toUpperCase();
    const n = BigInt(tokenMatch[2]);
    const [byToken] = await tx
      .select({ id: tickets.id })
      .from(tickets)
      .where(
        sql`regexp_replace(${tickets.number}, '^(CID|TKT)-', '')::bigint = ${n} AND ${tickets.number} LIKE ${prefix + "-%"}`,
      )
      .limit(1);
    if (byToken) {
      return { kind: "existing", ticketId: byToken.id };
    }
  }

  const [cand] = await tx
    .select({ id: tickets.id })
    .from(tickets)
    .where(
      and(
        eq(tickets.subjectNormalized, input.subjectNormalized),
        eq(tickets.requesterEmail, input.fromEmail),
        ne(tickets.status, "closed"),
        gt(tickets.createdAt, sql`now() - interval '14 days'`),
      ),
    )
    .orderBy(desc(tickets.createdAt))
    .limit(1);

  if (cand) {
    return { kind: "existing", ticketId: cand.id };
  }

  return { kind: "new" };
}
