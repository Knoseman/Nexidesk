import { redirect } from "next/navigation";
import { inArray, eq, asc } from "drizzle-orm";
import { auth, getAgentIdFromSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { tags, ticketTags } from "@/lib/schema";
import {
  listTicketsForAgent,
  getInboxCounts,
  listActiveAgents,
} from "@/lib/tickets-list";
import type {
  TicketRow,
  TicketStatus,
  TicketPriority,
  TicketFilter,
} from "@/types/ticket";
import { TicketWorkspace } from "@/components/nexidesk/TicketWorkspace";

type PageProps = {
  searchParams: Promise<{
    unread?: string;
    q?: string;
    requesterId?: string;
    filter?: string;
    status?: string;
    priority?: string;
    tag?: string;
    assignee?: string;
    bodySearch?: string;
    ticket?: string;
  }>;
};

const VALID_FILTERS = new Set<TicketFilter>([
  "my_open",
  "unassigned",
  "all_open",
  "new",
  "all",
]);

export default async function TicketsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/");

  const sp = await searchParams;
  const unreadOnly = sp.unread === "true" || sp.unread === "1";
  const q = sp.q ?? "";
  const qTrim = q.trim();
  const requesterId = sp.requesterId ? Number(sp.requesterId) : undefined;
  const requesterIdNum =
    requesterId && !Number.isNaN(requesterId) ? requesterId : undefined;

  const rawFilter = sp.filter ?? "my_open";
  const currentFilter: TicketFilter = VALID_FILTERS.has(
    rawFilter as TicketFilter,
  )
    ? (rawFilter as TicketFilter)
    : "my_open";

  const statusFilter = sp.status ? sp.status.split(",").filter(Boolean) : [];
  const priorityFilter = sp.priority
    ? sp.priority.split(",").filter(Boolean)
    : [];
  const tagFilter = sp.tag
    ? sp.tag
        .split(",")
        .map(Number)
        .filter((n) => !Number.isNaN(n) && n > 0)
    : [];
  const assigneeParam = sp.assignee ?? "";
  const bodySearch = sp.bodySearch === "1";
  const ticketParam = sp.ticket ? Number(sp.ticket) : undefined;
  const initialTicketId =
    ticketParam && !Number.isNaN(ticketParam) ? ticketParam : null;

  // "All" tab with no active search or filters shows an empty gated state — skip DB
  const isAllGated =
    currentFilter === "all" &&
    !qTrim &&
    !statusFilter.length &&
    !priorityFilter.length &&
    !assigneeParam &&
    !requesterIdNum;

  let rows: TicketRow[] = [];
  let currentAgentId: number | null = null;
  let counts = { unassigned: 0, new: 0 };
  let agentsList: Array<{ id: number; name: string }> = [];
  let tagsList: Array<{ id: number; name: string; color: string }> = [];

  try {
    const agentId = await getAgentIdFromSession(session);
    currentAgentId = agentId ?? null;

    [counts, agentsList, tagsList] = await Promise.all([
      getInboxCounts(),
      listActiveAgents(),
      db
        .select({ id: tags.id, name: tags.name, color: tags.color })
        .from(tags)
        .orderBy(asc(tags.sortOrder), asc(tags.createdAt)),
    ]);

    if (agentId != null && !isAllGated) {
      let assigneeFilter: "me" | "unassigned" | number | undefined;
      if (assigneeParam === "me") {
        assigneeFilter = "me";
      } else if (assigneeParam === "unassigned") {
        assigneeFilter = "unassigned";
      } else if (assigneeParam && !Number.isNaN(Number(assigneeParam))) {
        assigneeFilter = Number(assigneeParam);
      }

      const raw = await listTicketsForAgent(agentId, {
        filter: currentFilter,
        unreadOnly,
        q,
        bodySearch,
        requesterId: requesterIdNum,
        statusFilter,
        priorityFilter,
        tagIds: tagFilter,
        assigneeFilter,
      });

      const ticketIds = raw.map((r) => r.id);
      const tagRows = ticketIds.length
        ? await db
            .select({
              ticketId: ticketTags.ticketId,
              id: tags.id,
              name: tags.name,
              color: tags.color,
            })
            .from(ticketTags)
            .innerJoin(tags, eq(ticketTags.tagId, tags.id))
            .where(inArray(ticketTags.ticketId, ticketIds))
            .orderBy(asc(tags.sortOrder), asc(tags.createdAt))
        : [];

      const tagsByTicket = new Map<number, typeof tagRows>();
      for (const t of tagRows) {
        const list = tagsByTicket.get(t.ticketId) ?? [];
        list.push(t);
        tagsByTicket.set(t.ticketId, list);
      }

      rows = raw.map((r) => ({
        ...r,
        status: r.status as TicketStatus,
        priority: r.priority as TicketPriority,
        updatedAt: r.updatedAt.toISOString(),
        lastMessageAt:
          r.lastMessageAt != null
            ? new Date(r.lastMessageAt as Date | string).toISOString()
            : null,
        assigneeId: r.assigneeId ?? null,
        assigneeName: r.assigneeName ?? null,
        isUnread: r.isUnread ?? false,
        tags: tagsByTicket.get(r.id) ?? [],
      }));
    }
  } catch (err) {
    console.error("[tickets] failed to load ticket list:", err);
  }

  const requesterFilter = requesterIdNum
    ? {
        id: requesterIdNum,
        name:
          rows.find((r) => r.requesterId === requesterIdNum)?.requesterName ||
          "Requester",
      }
    : null;

  const hasMore = rows.length >= 100;

  return (
    <TicketWorkspace
      tickets={rows}
      currentAgentId={currentAgentId}
      requesterFilter={requesterFilter}
      initialQuery={q}
      currentFilter={currentFilter}
      counts={counts}
      agentsList={agentsList}
      tagsList={tagsList}
      currentStatus={statusFilter}
      currentPriority={priorityFilter}
      currentTagIds={tagFilter.map(String)}
      currentAssignee={assigneeParam}
      bodySearch={bodySearch}
      hasMore={hasMore}
      initialTicketId={initialTicketId}
    />
  );
}
