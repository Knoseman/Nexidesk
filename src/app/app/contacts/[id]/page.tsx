import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Hash,
  Mail,
  Phone,
} from "lucide-react";
import { auth, getAgentIdFromSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts, messages, tickets } from "@/lib/schema";
import { StatusBadge } from "@/components/nexidesk/StatusBadge";
import type { TicketStatus } from "@/types/ticket";

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

function fmtDateTime(d: Date | string | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

function initialsOf(email: string, name?: string | null): string {
  const src = (name ?? email.split("@")[0]).replace(/[._-]/g, " ");
  return src
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/");
  const agentId = await getAgentIdFromSession(session);
  if (agentId == null) redirect("/app/tickets");

  const { id } = await params;
  const contactId = Number(id);
  if (Number.isNaN(contactId)) notFound();

  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);
  if (!contact) notFound();

  const ticketRows = await db
    .select({
      id: tickets.id,
      number: tickets.number,
      subjectNormalized: tickets.subjectNormalized,
      status: tickets.status,
      priority: tickets.priority,
      createdAt: tickets.createdAt,
      closedAt: tickets.closedAt,
      lastMessageAt: sql<Date | null>`(select max(${messages.createdAt}) from ${messages} where ${messages.ticketId} = ${tickets.id})`,
      messageCount: sql<number>`(select count(*)::int from ${messages} where ${messages.ticketId} = ${tickets.id})`,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.requesterId, contactId),
        isNull(tickets.mergedIntoTicketId),
      ),
    )
    .orderBy(desc(tickets.createdAt));

  const sorted = ticketRows
    .map((r) => ({
      ...r,
      _sortAt:
        r.lastMessageAt != null
          ? new Date(r.lastMessageAt).getTime()
          : r.createdAt.getTime(),
    }))
    .sort((a, b) => b._sortAt - a._sortAt);

  const totals = {
    total: sorted.length,
    open: sorted.filter((t) =>
      ["new", "open", "pending"].includes(t.status as string),
    ).length,
    closed: sorted.filter((t) =>
      ["resolved", "closed"].includes(t.status as string),
    ).length,
  };

  const inits = initialsOf(contact.email, contact.name);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b border-zinc-200 px-6 py-4 dark:border-slate-700">
        <Link
          href="/app/contacts"
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 transition-colors dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft size={12} />
          Contacts
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-slate-100">
          {contact.name || contact.email}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 bg-zinc-50/50 dark:bg-slate-950">
        <div className="max-w-5xl space-y-6">
          {/* Contact card */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start gap-4">
              <div
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-white text-lg font-bold"
                style={{ backgroundColor: "#6366f1" }}
              >
                {inits || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-slate-100">
                  {contact.name || "Unnamed contact"}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-slate-400">
                  {contact.email}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-y-1.5 gap-x-6 text-sm sm:grid-cols-2">
                  {contact.companyName && (
                    <InfoRow
                      icon={<Building2 size={13} />}
                      label="Company"
                      value={contact.companyName}
                    />
                  )}
                  {contact.title && (
                    <InfoRow
                      icon={<Briefcase size={13} />}
                      label="Title"
                      value={contact.title}
                    />
                  )}
                  {contact.phone && (
                    <InfoRow
                      icon={<Phone size={13} />}
                      label="Phone"
                      value={contact.phone}
                      mono
                    />
                  )}
                  <InfoRow
                    icon={<Mail size={13} />}
                    label="Email"
                    value={contact.email}
                    mono
                  />
                  <InfoRow
                    icon={<Calendar size={13} />}
                    label="Added"
                    value={fmtDate(contact.createdAt)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Totals row */}
          <section className="grid grid-cols-3 gap-3">
            <StatCard label="Total tickets" value={totals.total} />
            <StatCard label="Open" value={totals.open} tone="emerald" />
            <StatCard label="Closed" value={totals.closed} tone="slate" />
          </section>

          {/* Ticket history */}
          <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-slate-200">
                Ticket history
              </h3>
              {sorted.length > 0 && (
                <Link
                  href={`/app/tickets?requesterId=${contact.id}&filter=all`}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Open in inbox →
                </Link>
              )}
            </header>
            {sorted.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-zinc-400 dark:text-slate-500">
                No tickets yet for this contact.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/60 dark:border-slate-700 dark:bg-slate-800">
                    <th
                      scope="col"
                      className="px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-slate-400"
                    >
                      Ticket
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-slate-400"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-slate-400"
                    >
                      Messages
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-slate-400"
                    >
                      Created
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-slate-400"
                    >
                      Last activity
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-slate-700">
                  {sorted.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-zinc-50/60 dark:hover:bg-slate-800/60"
                    >
                      <td className="px-5 py-3 align-top">
                        <Link
                          href={`/app/tickets?ticket=${t.id}`}
                          className="block"
                        >
                          <div className="flex items-center gap-2">
                            <Hash
                              size={11}
                              className="text-zinc-400 flex-shrink-0 dark:text-slate-500"
                            />
                            <span className="font-mono text-[11px] text-zinc-500 dark:text-slate-400">
                              {t.number}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate font-medium text-zinc-800 max-w-[420px] dark:text-slate-200">
                            {t.subjectNormalized || "(no subject)"}
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-3 align-top">
                        <StatusBadge
                          status={t.status as TicketStatus}
                          size="sm"
                        />
                      </td>
                      <td className="px-5 py-3 align-top text-zinc-600 dark:text-slate-300">
                        {t.messageCount}
                      </td>
                      <td className="px-5 py-3 align-top text-zinc-500 text-xs dark:text-slate-400">
                        {fmtDate(t.createdAt)}
                      </td>
                      <td className="px-5 py-3 align-top text-zinc-500 text-xs dark:text-slate-400">
                        {fmtDateTime(t.lastMessageAt ?? t.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-400 dark:text-slate-500">{icon}</span>
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-slate-500">
        {label}
      </span>
      <span
        className="text-zinc-700 dark:text-slate-300"
        style={{
          fontFamily: mono ? "var(--font-geist-mono), monospace" : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: number;
  tone?: "blue" | "emerald" | "slate";
}) {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "slate"
        ? "text-slate-600 dark:text-slate-400"
        : "text-blue-600 dark:text-blue-400";
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}
