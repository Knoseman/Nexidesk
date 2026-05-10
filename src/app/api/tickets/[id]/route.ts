import { NextResponse } from "next/server";
import { eq, asc, inArray } from "drizzle-orm";
import { auth, getAgentIdFromSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  tickets,
  messages,
  agents,
  outboundQueue,
  attachments,
  contacts,
  tags,
  ticketTags,
  mailboxConfig,
  emailEvents,
  ticketReads,
  auditLogs,
} from "@/lib/schema";
import { markTicketRead } from "@/lib/tickets-list";
import type { TicketStatus, MessageDirection } from "@/types/ticket";

export async function PATCH(
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

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;
  const updates: Partial<{
    status: string;
    priority: string;
    assigneeId: number | null;
    requesterId: number | null;
    closedAt: Date | null;
    subjectNormalized: string;
  }> = {};

  if ("status" in body) {
    const valid = ["new", "open", "pending", "resolved", "closed"];
    if (!valid.includes(body.status as string))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    updates.status = body.status as string;
    updates.closedAt = body.status === "closed" ? new Date() : null;
  }

  if ("priority" in body) {
    const valid = ["low", "normal", "high", "urgent"];
    if (!valid.includes(body.priority as string))
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    updates.priority = body.priority as string;
  }

  if ("assigneeId" in body) {
    const val = body.assigneeId;
    if (val !== null && typeof val !== "number")
      return NextResponse.json(
        { error: "assigneeId must be a number or null" },
        { status: 400 },
      );
    updates.assigneeId = val as number | null;

    // Auto-transition: new → open when an agent is assigned
    if (val !== null) {
      const [cur] = await db
        .select({ status: tickets.status })
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);
      if (cur?.status === "new") updates.status = "open";
    }
  }

  if ("subjectNormalized" in body) {
    const val = body.subjectNormalized;
    if (typeof val !== "string" || !val.trim())
      return NextResponse.json(
        { error: "subjectNormalized must be a non-empty string" },
        { status: 400 },
      );
    updates.subjectNormalized = val.trim();
  }

  if ("requesterId" in body) {
    const val = body.requesterId;
    if (val !== null && typeof val !== "number")
      return NextResponse.json(
        { error: "requesterId must be a number or null" },
        { status: 400 },
      );

    const reqId = val as number | null;
    updates.requesterId = reqId;

    if (reqId !== null) {
      const [contact] = await db
        .select({ email: contacts.email })
        .from(contacts)
        .where(eq(contacts.id, reqId))
        .limit(1);
      if (contact) {
        (updates as any).requesterEmail = contact.email;
      }
    }
  }

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });

  await db.update(tickets).set(updates).where(eq(tickets.id, ticketId));

  // Changing to "new" means the ticket needs fresh attention — clear read markers
  if (updates.status === "new") {
    await db.delete(ticketReads).where(eq(ticketReads.ticketId, ticketId));
  }

  return NextResponse.json({ ok: true });
}

function mapDirection(dbDir: string): MessageDirection {
  if (dbDir === "internal_note") return "note";
  return dbDir as MessageDirection;
}

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
      id: tickets.id,
      number: tickets.number,
      subjectNormalized: tickets.subjectNormalized,
      status: tickets.status,
      priority: tickets.priority,
      requesterEmail: tickets.requesterEmail,
      requesterId: tickets.requesterId,
      requesterName: contacts.name,
      requesterPhone: contacts.phone,
      requesterTitle: contacts.title,
      requesterCompanyName: contacts.companyName,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      closedAt: tickets.closedAt,
      assigneeId: tickets.assigneeId,
      assigneeName: agents.name,
      assigneeColorBg: agents.labelColorBg,
      assigneeColorText: agents.labelColorText,
      mergedIntoTicketId: tickets.mergedIntoTicketId,
    })
    .from(tickets)
    .leftJoin(agents, eq(tickets.assigneeId, agents.id))
    .leftJoin(contacts, eq(tickets.requesterId, contacts.id))
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticketRow)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let mergedIntoTicketNumber: string | null = null;
  if (ticketRow.mergedIntoTicketId != null) {
    const [targetRow] = await db
      .select({ number: tickets.number })
      .from(tickets)
      .where(eq(tickets.id, ticketRow.mergedIntoTicketId))
      .limit(1);
    mergedIntoTicketNumber = targetRow?.number ?? null;
  }

  const msgRows =
    ticketRow.mergedIntoTicketId != null
      ? []
      : await db
          .select({
            id: messages.id,
            ticketId: messages.ticketId,
            direction: messages.direction,
            kind: messages.kind,
            fromEmail: messages.fromEmail,
            toEmails: messages.toEmails,
            ccEmails: messages.ccEmails,
            bccEmails: messages.bccEmails,
            bodyText: messages.bodyText,
            bodyHtml: messages.bodyHtml,
            sentAt: messages.sentAt,
            receivedAt: messages.receivedAt,
            agentName: agents.name,
            queueStatus: outboundQueue.status,
          })
          .from(messages)
          .leftJoin(agents, eq(messages.agentId, agents.id))
          .leftJoin(
            outboundQueue,
            eq(outboundQueue.stagedMessageId, messages.id),
          )
          .where(eq(messages.ticketId, ticketId))
          .orderBy(asc(messages.createdAt));

  const msgIds = msgRows.map((m) => m.id);
  const attRows = msgIds.length
    ? await db
        .select({
          id: attachments.id,
          messageId: attachments.messageId,
          filename: attachments.filename,
          contentType: attachments.contentType,
          sizeBytes: attachments.sizeBytes,
        })
        .from(attachments)
        .where(inArray(attachments.messageId, msgIds))
    : [];

  const attsByMessage = new Map<number, typeof attRows>();
  for (const a of attRows) {
    const list = attsByMessage.get(a.messageId) ?? [];
    list.push(a);
    attsByMessage.set(a.messageId, list);
  }

  const tagRows =
    ticketRow.mergedIntoTicketId != null
      ? []
      : await db
          .select({ id: tags.id, name: tags.name, color: tags.color })
          .from(ticketTags)
          .innerJoin(tags, eq(ticketTags.tagId, tags.id))
          .where(eq(ticketTags.ticketId, ticketId))
          .orderBy(asc(tags.sortOrder), asc(tags.createdAt));

  const [mailboxRow] = await db
    .select({ address: mailboxConfig.mailboxAddress })
    .from(mailboxConfig)
    .limit(1);

  await markTicketRead(agentId, ticketId);

  return NextResponse.json({
    ...ticketRow,
    mailboxAddress: mailboxRow?.address ?? null,
    status: ticketRow.status as TicketStatus,
    priority: ticketRow.priority as any,
    createdAt: ticketRow.createdAt.toISOString(),
    updatedAt: ticketRow.updatedAt.toISOString(),
    closedAt: ticketRow.closedAt?.toISOString() ?? null,
    assigneeId: ticketRow.assigneeId ?? null,
    assigneeName: ticketRow.assigneeName ?? null,
    assigneeColorBg: ticketRow.assigneeColorBg ?? null,
    assigneeColorText: ticketRow.assigneeColorText ?? null,
    mergedIntoTicketId: ticketRow.mergedIntoTicketId,
    mergedIntoTicketNumber,
    tags: tagRows,
    messages: msgRows.map((m) => ({
      ...m,
      direction: mapDirection(m.direction),
      kind: m.kind ?? null,
      sentAt: m.sentAt?.toISOString() ?? null,
      receivedAt: m.receivedAt?.toISOString() ?? null,
      agentName: m.agentName ?? null,
      queueStatus: m.queueStatus ?? null,
      attachments: attsByMessage.get(m.id) ?? [],
    })),
  });
}

export async function DELETE(
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

  // Verify the ticket exists
  const [ticketRow] = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);
  if (!ticketRow)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Audit log before deletion
  await db.insert(auditLogs).values({
    ticketId,
    agentId,
    action: "ticket_deleted",
    metadata: {},
  });

  // Delete related rows that don't have cascade onDelete
  await db.delete(emailEvents).where(eq(emailEvents.ticketId, ticketId));
  await db.delete(outboundQueue).where(eq(outboundQueue.ticketId, ticketId));

  // Unmerge any tickets that were merged into this one (FK has no onDelete action)
  await db
    .update(tickets)
    .set({ mergedIntoTicketId: null })
    .where(eq(tickets.mergedIntoTicketId, ticketId));

  // Delete the ticket — cascades to messages, attachments, ticketTags, auditLogs, ticketReads
  await db.delete(tickets).where(eq(tickets.id, ticketId));

  return NextResponse.json({ ok: true });
}
