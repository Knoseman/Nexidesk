import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, tickets } from "@/lib/schema";

/**
 * Monotonic-ish fingerprint of inbox-affecting DB changes (IMAP ingest, outbound rows,
 * ticket updates). Used so the tickets UI can poll and only refresh when data changed.
 */
export async function getInboxDataRevMs(): Promise<number> {
  const [[msgRow], [ticketRow]] = await Promise.all([
    db
      .select({ d: sql<Date | null>`max(${messages.createdAt})` })
      .from(messages),
    db.select({ d: sql<Date | null>`max(${tickets.updatedAt})` }).from(tickets),
  ]);
  const a = msgRow?.d ? new Date(msgRow.d).getTime() : 0;
  const b = ticketRow?.d ? new Date(ticketRow.d).getTime() : 0;
  return Math.max(a, b);
}
