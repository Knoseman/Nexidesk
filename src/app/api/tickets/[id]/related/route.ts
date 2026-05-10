import { NextResponse } from "next/server";
import { eq, sql, and, ne, isNull } from "drizzle-orm";
import { auth, getAgentIdFromSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { tickets, messages } from "@/lib/schema";
import type { TicketStatus } from "@/types/ticket";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agentId = await getAgentIdFromSession(session);
  if (agentId == null)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const ticketId = Number(id);
  if (Number.isNaN(ticketId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [ticketRow] = await db
    .select({
      requesterId: tickets.requesterId,
      requesterEmail: tickets.requesterEmail,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticketRow)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const requesterMatch =
    ticketRow.requesterId != null
      ? eq(tickets.requesterId, ticketRow.requesterId)
      : eq(tickets.requesterEmail, ticketRow.requesterEmail);

  const raw = await db
    .select({
      id: tickets.id,
      number: tickets.number,
      status: tickets.status,
      subjectNormalized: tickets.subjectNormalized,
      createdAt: tickets.createdAt,
      lastMessageAt: sql<Date | null>`(select max(${messages.createdAt}) from ${messages} where ${messages.ticketId} = ${tickets.id})`,
    })
    .from(tickets)
    .where(
      and(
        requesterMatch,
        ne(tickets.id, ticketId),
        isNull(tickets.mergedIntoTicketId),
      ),
    );

  const related = raw
    .map((r) => ({
      ...r,
      status: r.status as TicketStatus,
      createdAt: r.createdAt.toISOString(),
      lastMessageAt:
        r.lastMessageAt != null
          ? new Date(r.lastMessageAt as Date | string).toISOString()
          : null,
      _sortAt:
        r.lastMessageAt != null
          ? new Date(r.lastMessageAt as Date | string).getTime()
          : r.createdAt.getTime(),
    }))
    .sort((a, b) => b._sortAt - a._sortAt)
    .slice(0, 4);

  return NextResponse.json(related.map(({ _sortAt, ...rest }) => rest));
}
