import { NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { auth, getAgentIdFromSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  tickets,
  messages,
  outboundQueue,
  ticketReads,
  auditLogs,
  ticketTags,
} from "@/lib/schema";

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
  const sourceId = Number(id);
  if (Number.isNaN(sourceId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const targetId =
    typeof raw.targetTicketId === "number" ? raw.targetTicketId : NaN;
  if (Number.isNaN(targetId))
    return NextResponse.json(
      { error: "targetTicketId required" },
      { status: 400 },
    );

  if (sourceId === targetId)
    return NextResponse.json(
      { error: "Cannot merge a ticket into itself" },
      { status: 400 },
    );

  try {
    const result = await db.transaction(async (tx) => {
      // Lock both tickets to prevent races
      const [source] = await tx
        .select({
          id: tickets.id,
          number: tickets.number,
          mergedIntoTicketId: tickets.mergedIntoTicketId,
        })
        .from(tickets)
        .where(eq(tickets.id, sourceId))
        .for("update");

      const [target] = await tx
        .select({
          id: tickets.id,
          number: tickets.number,
          status: tickets.status,
          mergedIntoTicketId: tickets.mergedIntoTicketId,
        })
        .from(tickets)
        .where(eq(tickets.id, targetId))
        .for("update");

      if (!source || !target)
        throw new Error("NOT_FOUND");

      if (source.mergedIntoTicketId != null)
        throw new Error("ALREADY_MERGED");

      if (target.mergedIntoTicketId != null)
        throw new Error("TARGET_MERGED");

      // Block if source has pending outbound
      const pending = await tx
        .select({ id: outboundQueue.id })
        .from(outboundQueue)
        .where(
          and(
            eq(outboundQueue.ticketId, sourceId),
            inArray(outboundQueue.status, ["pending", "sending"]),
          ),
        )
        .limit(1);

      if (pending.length > 0)
        throw new Error("PENDING_OUTBOUND");

      // Move messages
      await tx
        .update(messages)
        .set({ ticketId: targetId })
        .where(eq(messages.ticketId, sourceId));

      // Merge tags: copy source tags missing on target
      const sourceTagRows = await tx
        .select({ tagId: ticketTags.tagId })
        .from(ticketTags)
        .where(eq(ticketTags.ticketId, sourceId));

      if (sourceTagRows.length > 0) {
        const sourceTagIds = sourceTagRows.map((r) => r.tagId);
        const targetTagRows = await tx
          .select({ tagId: ticketTags.tagId })
          .from(ticketTags)
          .where(eq(ticketTags.ticketId, targetId));
        const targetTagIds = new Set(targetTagRows.map((r) => r.tagId));
        const missingTagIds = sourceTagIds.filter((id) => !targetTagIds.has(id));
        if (missingTagIds.length > 0) {
          await tx.insert(ticketTags).values(
            missingTagIds.map((tagId) => ({ ticketId: targetId, tagId })),
          );
        }
      }

      // Clear reads on source
      await tx.delete(ticketReads).where(eq(ticketReads.ticketId, sourceId));

      // Update source ticket
      await tx
        .update(tickets)
        .set({
          mergedIntoTicketId: targetId,
          status: "closed",
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, sourceId));

      // Update target ticket (bump updatedAt, auto-reopen if needed)
      const targetUpdates: Partial<typeof tickets.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (target.status === "closed" || target.status === "resolved") {
        targetUpdates.status = "open";
        targetUpdates.closedAt = null;
      }
      await tx
        .update(tickets)
        .set(targetUpdates)
        .where(eq(tickets.id, targetId));

      // Audit logs
      await tx.insert(auditLogs).values({
        ticketId: sourceId,
        agentId,
        action: "merged_into",
        metadata: { targetTicketId: targetId, targetNumber: target.number },
      });

      await tx.insert(auditLogs).values({
        ticketId: targetId,
        agentId,
        action: "merged_from",
        metadata: { sourceTicketId: sourceId, sourceNumber: source.number },
      });

      return { targetTicketId: targetId, targetNumber: target.number };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_FOUND")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (msg === "ALREADY_MERGED")
      return NextResponse.json(
        { error: "Ticket already merged" },
        { status: 409 },
      );
    if (msg === "TARGET_MERGED")
      return NextResponse.json(
        { error: "Cannot merge into a merged ticket" },
        { status: 400 },
      );
    if (msg === "PENDING_OUTBOUND")
      return NextResponse.json(
        { error: "Pending sends on this ticket" },
        { status: 409 },
      );
    console.error("[merge]", err);
    return NextResponse.json({ error: "Merge failed" }, { status: 500 });
  }
}
