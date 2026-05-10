import { NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { auth, getAgentIdFromSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { tags, ticketTags, tickets } from "@/lib/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ticketId = Number(id);
  if (Number.isNaN(ticketId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(ticketTags)
    .innerJoin(tags, eq(ticketTags.tagId, tags.id))
    .where(eq(ticketTags.ticketId, ticketId))
    .orderBy(asc(tags.sortOrder), asc(tags.createdAt));

  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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

  const tagId = typeof body.tagId === "number" ? body.tagId : null;
  if (tagId == null)
    return NextResponse.json({ error: "tagId required" }, { status: 400 });

  await db.insert(ticketTags).values({ ticketId, tagId }).onConflictDoNothing();

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
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

  const { searchParams } = new URL(req.url);
  const tagIdParam = searchParams.get("tagId");
  const tagId = tagIdParam ? Number(tagIdParam) : null;
  if (tagId == null || Number.isNaN(tagId))
    return NextResponse.json({ error: "tagId required" }, { status: 400 });

  const [ticketRowDel] = await db
    .select({ mergedIntoTicketId: tickets.mergedIntoTicketId })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);
  if (!ticketRowDel)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticketRowDel.mergedIntoTicketId != null) {
    return NextResponse.json(
      {
        error: "Ticket merged",
        mergedIntoTicketId: ticketRowDel.mergedIntoTicketId,
      },
      { status: 409 },
    );
  }

  await db
    .delete(ticketTags)
    .where(and(eq(ticketTags.ticketId, ticketId), eq(ticketTags.tagId, tagId)));

  return NextResponse.json({ ok: true });
}
