import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Inbox,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Users,
  Tag as TagIcon,
} from "lucide-react";
import { auth, requireAdmin } from "@/lib/auth";
import {
  getDashboardMetrics,
  formatDuration,
} from "@/lib/dashboard-metrics";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  new: "#8b5cf6",
  open: "#10b981",
  pending: "#f59e0b",
  resolved: "#3b82f6",
  closed: "#94a3b8",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  open: "Open",
  pending: "Pending",
  resolved: "Resolved",
  closed: "Closed",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/");
  const admin = await requireAdmin(session);
  if (!admin) redirect("/app/tickets");

  const metrics = await getDashboardMetrics();

  const peakCreated = Math.max(1, ...metrics.created14d.map((d) => d.count));
  const totalByStatus = metrics.byStatus.reduce((s, x) => s + x.count, 0);
  const peakAgent = Math.max(
    1,
    ...metrics.byAgent.map((a) => a.open + a.pending),
  );
  const peakTag = Math.max(1, ...metrics.topTags.map((t) => t.count));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b border-zinc-200 px-6 py-4 dark:border-slate-700">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-slate-100">Dashboard</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-slate-400">
          Helpdesk health at a glance — updated on load.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 bg-zinc-50/60 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* KPI row */}
          <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Kpi
              label="Active tickets"
              value={metrics.active.total}
              icon={<Inbox size={16} />}
              accent="indigo"
              hint={`${metrics.active.new} new · ${metrics.active.open} open · ${metrics.active.pending} pending`}
              href="/app/tickets?filter=all_open"
            />
            <Kpi
              label="Unassigned"
              value={metrics.active.unassigned}
              icon={<AlertCircle size={16} />}
              accent="amber"
              hint="Active tickets awaiting pickup"
              href="/app/tickets?filter=unassigned"
            />
            <Kpi
              label="Closed today"
              value={metrics.today.closed}
              icon={<CheckCircle2 size={16} />}
              accent="emerald"
              hint={`${metrics.today.created} created today`}
            />
            <Kpi
              label="Avg first response"
              value={formatDuration(metrics.responseSeconds.avg30d)}
              icon={<Clock size={16} />}
              accent="blue"
              hint={
                metrics.responseSeconds.sampleSize > 0
                  ? `Median ${formatDuration(metrics.responseSeconds.median30d)} · last 30 d (${metrics.responseSeconds.sampleSize} tickets)`
                  : "No responses in last 30 d"
              }
            />
          </section>

          {/* Created sparkline + Status donut */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card
              title="Tickets created · last 14 days"
              icon={<TrendingUp size={14} />}
              className="lg:col-span-2"
            >
              <div className="flex h-44 items-end gap-1.5 px-1">
                {metrics.created14d.map((d) => {
                  const h = (d.count / peakCreated) * 100;
                  const isToday =
                    d.date === new Date().toISOString().slice(0, 10);
                  return (
                    <div
                      key={d.date}
                      className="group relative flex flex-1 flex-col items-center justify-end"
                    >
                      <div
                        className="w-full rounded-t-md transition-colors"
                        style={{
                          height: `${Math.max(h, 2)}%`,
                          backgroundColor: isToday ? "#6366f1" : "#c7d2fe",
                        }}
                        aria-label={`${d.count} on ${d.date}`}
                      />
                      <div className="pointer-events-none absolute -top-7 hidden whitespace-nowrap rounded bg-zinc-900 px-2 py-0.5 text-[10px] text-white group-hover:block">
                        {d.count} · {d.date.slice(5)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-zinc-400 px-1 dark:text-slate-500">
                <span>{metrics.created14d[0]?.date.slice(5)}</span>
                <span>Today</span>
              </div>
            </Card>

            <Card title="Status breakdown">
              <ul className="space-y-2.5">
                {metrics.byStatus.map((s) => {
                  const pct =
                    totalByStatus === 0
                      ? 0
                      : (s.count / totalByStatus) * 100;
                  return (
                    <li key={s.status}>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: STATUS_COLORS[s.status] }}
                          />
                          <span className="text-zinc-700 dark:text-slate-300">
                            {STATUS_LABELS[s.status] ?? s.status}
                          </span>
                        </div>
                        <span className="font-mono font-medium text-zinc-700 tabular-nums dark:text-slate-300">
                          {s.count}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: STATUS_COLORS[s.status],
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>

          {/* By agent + Top tags */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Active load by agent" icon={<Users size={14} />}>
              {metrics.byAgent.length === 0 ? (
                <p className="text-xs text-zinc-400 dark:text-slate-500">No active tickets.</p>
              ) : (
                <ul className="space-y-2">
                  {metrics.byAgent.map((a) => {
                    const total = a.open + a.pending;
                    const pct = (total / peakAgent) * 100;
                    return (
                      <li key={a.agentId ?? "unassigned"}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="truncate text-zinc-700 font-medium dark:text-slate-200">
                            {a.name}
                          </span>
                          <span className="font-mono text-zinc-500 tabular-nums dark:text-slate-400">
                            {a.open}
                            {a.pending > 0 && (
                              <span className="text-amber-500">
                                {" "}
                                + {a.pending} pending
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-slate-700">
                          <div
                            className="h-full bg-emerald-400 transition-all"
                            style={{
                              width: `${(a.open / total || 0) * pct}%`,
                            }}
                          />
                          <div
                            className="h-full bg-amber-400 transition-all"
                            style={{
                              width: `${(a.pending / total || 0) * pct}%`,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card title="Top tags (active)" icon={<TagIcon size={14} />}>
              {metrics.topTags.length === 0 ? (
                <p className="text-xs text-zinc-400 dark:text-slate-500">No tagged tickets.</p>
              ) : (
                <ul className="space-y-2">
                  {metrics.topTags.map((t) => {
                    const pct = (t.count / peakTag) * 100;
                    return (
                      <li key={t.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: t.color }}
                            />
                            <span className="text-zinc-700 font-medium dark:text-slate-200">
                              {t.name}
                            </span>
                          </span>
                          <span className="font-mono text-zinc-500 tabular-nums dark:text-slate-400">
                            {t.count}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: t.color,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  accent,
  hint,
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: "indigo" | "amber" | "emerald" | "blue";
  hint?: string;
  href?: string;
}) {
  const accents: Record<typeof accent, { bg: string; fg: string }> = {
    indigo: { bg: "bg-indigo-50 dark:bg-indigo-950/40", fg: "text-indigo-600 dark:text-indigo-400" },
    amber: { bg: "bg-amber-50 dark:bg-amber-950/40", fg: "text-amber-600 dark:text-amber-400" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/40", fg: "text-emerald-600 dark:text-emerald-400" },
    blue: { bg: "bg-blue-50 dark:bg-blue-950/40", fg: "text-blue-600 dark:text-blue-400" },
  };
  const tone = accents[accent];

  const inner = (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-slate-400">
          {label}
        </span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone.bg} ${tone.fg}`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-2 text-3xl font-semibold text-zinc-900 tabular-nums dark:text-slate-100">
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-[11px] text-zinc-500 truncate dark:text-slate-400">{hint}</div>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function Card({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      <h3 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-slate-200">
        {icon && <span className="text-zinc-400 dark:text-slate-500">{icon}</span>}
        {title}
      </h3>
      {children}
    </div>
  );
}
