import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth, getAgentIdFromSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { messages, tickets } from "@/lib/schema";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agentId = await getAgentIdFromSession(session);
  if (agentId == null)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, messageId: msgIdStr } = await params;
  const ticketId = Number(id);
  const messageId = Number(msgIdStr);

  if (Number.isNaN(ticketId) || Number.isNaN(messageId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [ticketRow] = await db
    .select({ mergedIntoTicketId: tickets.mergedIntoTicketId })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);
  if (!ticketRow)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticketRow.mergedIntoTicketId != null) {
    return NextResponse.json(
      {
        error: "Ticket merged",
        mergedIntoTicketId: ticketRow.mergedIntoTicketId,
      },
      { status: 409 },
    );
  }

  // Only allow deleting internal notes
  const [msg] = await db
    .select({ direction: messages.direction })
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.ticketId, ticketId)))
    .limit(1);

  if (!msg)
    return NextResponse.json({ error: "Message not found" }, { status: 404 });

  if (msg.direction !== "internal_note") {
    return NextResponse.json(
      { error: "Only internal notes can be deleted" },
      { status: 400 },
    );
  }

  await db
    .delete(messages)
    .where(and(eq(messages.id, messageId), eq(messages.ticketId, ticketId)));

  return NextResponse.json({ ok: true });
}
