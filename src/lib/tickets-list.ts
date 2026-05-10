import { and, desc, eq, isNull, or, sql, lt, ilike, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  agents,
  messages,
  ticketReads,
  tickets,
  contacts,
  ticketTags,
  tags,
} from "@/lib/schema";
import type { TicketFilter } from "@/types/ticket";

export type { TicketFilter };

export async function listTicketsForAgent(
  agentId: number,
  options: {
    filter?: TicketFilter;
    unreadOnly?: boolean;
    q?: string;
    bodySearch?: boolean;
    tagIds?: number[];
    requesterId?: number;
    statusFilter?: string[];
    priorityFilter?: string[];
    assigneeFilter?: "me" | "unassigned" | number;
    limit?: number;
  } = {},
) {
  const filter = options.filter ?? "my_open";
  const unreadOnly = options.unreadOnly === true;
  const qTrim = options.q?.trim() ?? "";
  const limit = options.limit ?? 100;
  const bodySearch = options.bodySearch === true;

  const baseSelect = {
    id: tickets.id,
    number: tickets.number,
    subjectNormalized: tickets.subjectNormalized,
    status: tickets.status,
    priority: tickets.priority,
    requesterEmail: tickets.requesterEmail,
    requesterId: tickets.requesterId,
    requesterName: contacts.name,
    requesterCompanyName: contacts.companyName,
    updatedAt: tickets.updatedAt,
    lastMessageAt: sql<Date | null>`(select max(${messages.createdAt}) from ${messages} where ${messages.ticketId} = ${tickets.id})`,
    assigneeId: tickets.assigneeId,
    assigneeName: agents.name,
    assigneeColorBg: agents.labelColorBg,
    assigneeColorText: agents.labelColorText,
    isUnread: sql<boolean>`(${ticketReads.lastReadAt} is null or ${ticketReads.lastReadAt} < (select max(${messages.createdAt}) from ${messages} where ${messages.ticketId} = ${tickets.id}))`,
    mergedIntoTicketId: tickets.mergedIntoTicketId,
  };

  const likePat = qTrim ? "%" + qTrim + "%" : "";

  // Fast metadata search — subject FTS + ilike on all identifier/name fields
  const fastSearchPredicate = qTrim
    ? sql`(
        ${tickets.tsSubject} @@ websearch_to_tsquery('english', ${qTrim})
        or ${ilike(tickets.number, likePat)}
        or ${ilike(tickets.subjectNormalized, likePat)}
        or exists (
          select 1 from ${ticketTags} tt
          join ${tags} tg on tg.id = tt.tag_id
          where tt.ticket_id = ${tickets.id}
          and lower(tg.name) like lower(${likePat})
        )
        or lower(${tickets.requesterEmail}) like lower(${likePat})
        or lower(${contacts.name}) like lower(${likePat})
        or lower(${contacts.email}) like lower(${likePat})
        or lower(${contacts.companyName}) like lower(${likePat})
        or lower(${agents.name}) like lower(${likePat})
        or lower(${agents.email}) like lower(${likePat})
      )`
    : undefined;

  // Body search — opt-in FTS on message bodies (slower)
  const bodySearchPredicate =
    qTrim && bodySearch
      ? sql`exists (
          select 1 from ${messages} m
          where m.ticket_id = ${tickets.id}
          and m.ts_body @@ websearch_to_tsquery('english', ${qTrim})
        )`
      : undefined;

  const searchPredicate =
    fastSearchPredicate && bodySearchPredicate
      ? sql`(${fastSearchPredicate} or ${bodySearchPredicate})`
      : fastSearchPredicate;

  // Tab filter
  const ACTIVE = ["new", "open", "pending"] as const;
  const OPEN_STATUSES = ["new", "open"] as const;
  let tabPredicate;
  if (filter === "my_open") {
    tabPredicate = and(
      eq(tickets.assigneeId, agentId),
      inArray(tickets.status, [...OPEN_STATUSES]),
    );
  } else if (filter === "unassigned") {
    tabPredicate = and(
      isNull(tickets.assigneeId),
      inArray(tickets.status, [...ACTIVE]),
    );
  } else if (filter === "all_open") {
    tabPredicate = inArray(tickets.status, [...OPEN_STATUSES]);
  } else if (filter === "new") {
    tabPredicate = eq(tickets.status, "new");
  }
  // "all" has no tab predicate

  const statusPredicate = options.statusFilter?.length
    ? inArray(tickets.status, options.statusFilter)
    : undefined;

  const priorityPredicate = options.priorityFilter?.length
    ? inArray(tickets.priority, options.priorityFilter)
    : undefined;

  let assigneePredicate;
  if (options.assigneeFilter === "me") {
    assigneePredicate = eq(tickets.assigneeId, agentId);
  } else if (options.assigneeFilter === "unassigned") {
    assigneePredicate = isNull(tickets.assigneeId);
  } else if (typeof options.assigneeFilter === "number") {
    assigneePredicate = eq(tickets.assigneeId, options.assigneeFilter);
  }

  const unreadPredicate = unreadOnly
    ? or(
        isNull(ticketReads.lastReadAt),
        lt(
          ticketReads.lastReadAt,
          sql`(select max(${messages.createdAt}) from ${messages} where ${messages.ticketId} = ${tickets.id})`,
        ),
      )
    : undefined;

  const tagPredicate = options.tagIds?.length
    ? inArray(
        tickets.id,
        db
          .select({ id: ticketTags.ticketId })
          .from(ticketTags)
          .where(inArray(ticketTags.tagId, options.tagIds)),
      )
    : undefined;

  const requesterPredicate =
    options.requesterId != null
      ? eq(tickets.requesterId, options.requesterId)
      : undefined;

  // Hide merged tickets unless the user is actively searching
  const excludeMerged = qTrim ? undefined : isNull(tickets.mergedIntoTicketId);

  const whereClause = and(
    tabPredicate,
    searchPredicate,
    statusPredicate,
    priorityPredicate,
    assigneePredicate,
    unreadPredicate,
    tagPredicate,
    excludeMerged,
    requesterPredicate,
  );

  let qb = db
    .select(baseSelect)
    .from(tickets)
    .leftJoin(agents, eq(tickets.assigneeId, agents.id))
    .leftJoin(contacts, eq(tickets.requesterId, contacts.id))
    .leftJoin(
      ticketReads,
      and(
        eq(ticketReads.agentId, agentId),
        eq(ticketReads.ticketId, tickets.id),
      ),
    )
    .$dynamic();

  if (whereClause) {
    qb = qb.where(whereClause);
  }

  return qb
    .orderBy(
      desc(
        sql`coalesce(
          (select max(${messages.createdAt}) from ${messages} where ${messages.ticketId} = ${tickets.id}),
          ${tickets.createdAt}
        )`,
      ),
    )
    .limit(limit);
}

export async function getInboxCounts() {
  const ACTIVE = ["new", "open", "pending"] as const;
  const [unassignedResult, newResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(
        and(
          isNull(tickets.assigneeId),
          isNull(tickets.mergedIntoTicketId),
          inArray(tickets.status, [...ACTIVE]),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(
        and(eq(tickets.status, "new"), isNull(tickets.mergedIntoTicketId)),
      ),
  ]);
  return {
    unassigned: unassignedResult[0]?.count ?? 0,
    new: newResult[0]?.count ?? 0,
  };
}

export async function listActiveAgents() {
  return db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(isNull(agents.deletedAt))
    .orderBy(agents.name);
}

export async function markTicketRead(agentId: number, ticketId: number) {
  await db
    .insert(ticketReads)
    .values({
      agentId,
      ticketId,
      lastReadAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [ticketReads.agentId, ticketReads.ticketId],
      set: { lastReadAt: new Date() },
    });
}
