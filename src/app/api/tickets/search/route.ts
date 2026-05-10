import { NextResponse } from "next/server";
import { and, eq, isNull, or, sql, ilike } from "drizzle-orm";
import { auth, getAgentIdFromSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { tickets, contacts, agents, ticketTags, tags } from "@/lib/schema";

export async function GET(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agentId = await getAgentIdFromSession(session);
  if (agentId == null)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const excludeId = Number(searchParams.get("excludeId") ?? "NaN");

  const likePat = "%" + q + "%";

  const results = await db
    .select({
      id: tickets.id,
      number: tickets.number,
      subjectNormalized: tickets.subjectNormalized,
      status: tickets.status,
      requesterEmail: tickets.requesterEmail,
      requesterName: contacts.name,
      assigneeName: agents.name,
    })
    .from(tickets)
    .leftJoin(agents, eq(tickets.assigneeId, agents.id))
    .leftJoin(contacts, eq(tickets.requesterId, contacts.id))
    .where(
      and(
        isNull(tickets.mergedIntoTicketId),
        Number.isNaN(excludeId)
          ? undefined
          : sql`${tickets.id} <> ${excludeId}`,
        q
          ? or(
              ilike(tickets.number, likePat),
              ilike(tickets.subjectNormalized, likePat),
              ilike(tickets.requesterEmail, likePat),
              ilike(contacts.name, likePat),
              ilike(contacts.companyName, likePat),
              sql`exists (
                select 1 from ${ticketTags} tt
                join ${tags} tg on tg.id = tt.tag_id
                where tt.ticket_id = ${tickets.id}
                and lower(tg.name) like lower(${likePat})
              )`,
            )
          : undefined,
      ),
    )
    .orderBy(sql`${tickets.updatedAt} desc`)
    .limit(20);

  return NextResponse.json(results);
}
