import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { agents, messages, tags, ticketTags, tickets } from "./schema";

const ACTIVE_STATUSES = ["new", "open", "pending"] as const;

export type DashboardMetrics = {
  active: {
    total: number;
    new: number;
    open: number;
    pending: number;
    unassigned: number;
  };
  today: {
    created: number;
    closed: number;
  };
  responseSeconds: {
    avg30d: number | null;
    median30d: number | null;
    sampleSize: number;
  };
  created14d: Array<{ date: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  byAgent: Array<{
    agentId: number | null;
    name: string;
    open: number;
    pending: number;
  }>;
  topTags: Array<{ id: number; name: string; color: string; count: number }>;
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  // Cover 14 buckets including today
  const fourteenDaysAgo = new Date(
    startOfToday.getTime() - 13 * 24 * 60 * 60 * 1000,
  );

  const excludeMerged = isNull(tickets.mergedIntoTicketId);

  const [
    statusCounts,
    unassignedRows,
    createdTodayRows,
    closedTodayRows,
    responseRows,
    createdSeriesRows,
    byAgentRows,
    topTagRows,
  ] = await Promise.all([
    // 1. status distribution
    db
      .select({
        status: tickets.status,
        count: sql<number>`count(*)::int`,
      })
      .from(tickets)
      .where(excludeMerged)
      .groupBy(tickets.status),

    // 2. unassigned active
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(
        and(
          excludeMerged,
          isNull(tickets.assigneeId),
          inArray(tickets.status, [...ACTIVE_STATUSES]),
        ),
      ),

    // 3. created today
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(and(excludeMerged, gte(tickets.createdAt, startOfToday))),

    // 4. closed today
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(
        and(
          excludeMerged,
          inArray(tickets.status, ["resolved", "closed"]),
          gte(tickets.closedAt, startOfToday),
        ),
      ),

    // 5. first response time samples (last 30 days) — first inbound → first outbound
    db
      .select({
        seconds: sql<number>`extract(epoch from (
          (select min(m.created_at) from ${messages} m
             where m.ticket_id = ${tickets.id} and m.direction = 'outbound')
          -
          (select min(m.created_at) from ${messages} m
             where m.ticket_id = ${tickets.id} and m.direction = 'inbound')
        ))::float8`,
      })
      .from(tickets)
      .where(
        and(
          excludeMerged,
          gte(tickets.createdAt, thirtyDaysAgo),
          sql`(select min(m.created_at) from ${messages} m
                where m.ticket_id = ${tickets.id} and m.direction = 'inbound') is not null`,
          sql`(select min(m.created_at) from ${messages} m
                where m.ticket_id = ${tickets.id} and m.direction = 'outbound') is not null`,
          sql`(select min(m.created_at) from ${messages} m
                where m.ticket_id = ${tickets.id} and m.direction = 'outbound')
              >=
              (select min(m.created_at) from ${messages} m
                where m.ticket_id = ${tickets.id} and m.direction = 'inbound')`,
        ),
      ),

    // 6. created per day (last 14 days)
    db
      .select({
        day: sql<string>`date_trunc('day', ${tickets.createdAt})::date::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(tickets)
      .where(and(excludeMerged, gte(tickets.createdAt, fourteenDaysAgo)))
      .groupBy(sql`1`)
      .orderBy(sql`1`),

    // 7. tickets per agent (active load)
    db
      .select({
        agentId: tickets.assigneeId,
        name: agents.name,
        status: tickets.status,
        count: sql<number>`count(*)::int`,
      })
      .from(tickets)
      .leftJoin(agents, eq(tickets.assigneeId, agents.id))
      .where(
        and(excludeMerged, inArray(tickets.status, [...ACTIVE_STATUSES])),
      )
      .groupBy(tickets.assigneeId, agents.name, tickets.status),

    // 8. top tags by ticket count (active tickets)
    db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
        count: sql<number>`count(*)::int`,
      })
      .from(ticketTags)
      .innerJoin(tags, eq(ticketTags.tagId, tags.id))
      .innerJoin(tickets, eq(ticketTags.ticketId, tickets.id))
      .where(
        and(
          isNull(tickets.mergedIntoTicketId),
          inArray(tickets.status, [...ACTIVE_STATUSES]),
        ),
      )
      .groupBy(tags.id, tags.name, tags.color)
      .orderBy(sql`count(*) desc`)
      .limit(8),
  ]);

  // Aggregate status counts
  const statusMap = new Map<string, number>();
  let activeTotal = 0;
  for (const row of statusCounts) {
    statusMap.set(row.status, row.count);
    if ((ACTIVE_STATUSES as readonly string[]).includes(row.status)) {
      activeTotal += row.count;
    }
  }

  // First response time aggregate
  const seconds = responseRows
    .map((r) => Number(r.seconds))
    .filter((n) => Number.isFinite(n));
  let avgSeconds: number | null = null;
  let medianSeconds: number | null = null;
  if (seconds.length > 0) {
    avgSeconds = seconds.reduce((a, b) => a + b, 0) / seconds.length;
    const sorted = [...seconds].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianSeconds =
      sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  // Created series — fill missing days with zero
  const seriesByDay = new Map<string, number>();
  for (const r of createdSeriesRows) {
    const key = String(r.day).slice(0, 10);
    seriesByDay.set(key, Number(r.count));
  }
  const created14d: Array<{ date: string; count: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    created14d.push({ date: key, count: seriesByDay.get(key) ?? 0 });
  }

  // Per-agent aggregation
  const agentBuckets = new Map<
    string,
    { agentId: number | null; name: string; open: number; pending: number }
  >();
  for (const row of byAgentRows) {
    const key = row.agentId == null ? "unassigned" : String(row.agentId);
    const entry = agentBuckets.get(key) ?? {
      agentId: row.agentId ?? null,
      name: row.name ?? (row.agentId == null ? "Unassigned" : "Unknown"),
      open: 0,
      pending: 0,
    };
    if (row.status === "pending") {
      entry.pending += row.count;
    } else {
      entry.open += row.count;
    }
    agentBuckets.set(key, entry);
  }
  const byAgent = [...agentBuckets.values()].sort(
    (a, b) => b.open + b.pending - (a.open + a.pending),
  );

  return {
    active: {
      total: activeTotal,
      new: statusMap.get("new") ?? 0,
      open: statusMap.get("open") ?? 0,
      pending: statusMap.get("pending") ?? 0,
      unassigned: unassignedRows[0]?.count ?? 0,
    },
    today: {
      created: createdTodayRows[0]?.count ?? 0,
      closed: closedTodayRows[0]?.count ?? 0,
    },
    responseSeconds: {
      avg30d: avgSeconds,
      median30d: medianSeconds,
      sampleSize: seconds.length,
    },
    created14d,
    byStatus: [
      { status: "new", count: statusMap.get("new") ?? 0 },
      { status: "open", count: statusMap.get("open") ?? 0 },
      { status: "pending", count: statusMap.get("pending") ?? 0 },
      { status: "resolved", count: statusMap.get("resolved") ?? 0 },
      { status: "closed", count: statusMap.get("closed") ?? 0 },
    ],
    byAgent,
    topTags: topTagRows.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      count: t.count,
    })),
  };
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(0)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}
