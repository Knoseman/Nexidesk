"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronLeft,
  Plus,
  RefreshCw,
  X,
  ChevronDown,
  Check,
  FileSearch,
  Clock,
  AlertCircle,
  AlertTriangle,
  Zap,
} from "lucide-react";
import type { TicketRow, TicketFilter, TicketPriority } from "@/types/ticket";
import { StatusBadge } from "./StatusBadge";
import { NewTicketModal } from "./NewTicketModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<
  TicketPriority,
  { label: string; cls: string; icon: React.ReactNode }
> = {
  low: {
    label: "Low",
    cls: "text-slate-500 dark:text-slate-400",
    icon: <Clock size={10} />,
  },
  normal: {
    label: "Normal",
    cls: "text-sky-700 dark:text-sky-400",
    icon: <AlertCircle size={10} />,
  },
  high: {
    label: "High",
    cls: "text-orange-700 dark:text-orange-400",
    icon: <AlertTriangle size={10} />,
  },
  urgent: {
    label: "Urgent",
    cls: "text-red-600 dark:text-red-400",
    icon: <Zap size={10} />,
  },
};

const TABS: Array<{ label: string; value: TicketFilter }> = [
  { label: "My Open", value: "my_open" },
  { label: "Unassigned", value: "unassigned" },
  { label: "All Open", value: "all_open" },
  { label: "New", value: "new" },
  { label: "All", value: "all" },
];

const STATUS_OPTIONS = [
  { label: "New", value: "new" },
  { label: "Open", value: "open" },
  { label: "Pending", value: "pending" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

const PRIORITY_OPTIONS = [
  { label: "Urgent", value: "urgent" },
  { label: "High", value: "high" },
  { label: "Normal", value: "normal" },
  { label: "Low", value: "low" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string, nowMs: number): string {
  const diff = nowMs - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function initials(email: string, name?: string | null): string {
  if (name) {
    return name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");
  }
  const local = email.split("@")[0].replace(/[._-]/g, " ");
  return local
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#0ea5e9",
  "#ec4899",
  "#8b5cf6",
];
function avatarColor(email: string, name?: string | null): string {
  let h = 0;
  const str = name || email;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const AGENT_COLORS = [
  {
    cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
  },
  {
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  },
  {
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  { cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400" },
  { cls: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400" },
  {
    cls: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  },
  {
    cls: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  },
  {
    cls: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  },
];
function agentColorClass(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AGENT_COLORS[h % AGENT_COLORS.length].cls;
}

// ─── DropdownChip ─────────────────────────────────────────────────────────────

function DropdownChip({
  label,
  options,
  selected,
  onSelect,
  multi = false,
}: {
  label: string;
  options: Array<{ label: string; value: string; dot?: string }>;
  selected: string[];
  onSelect: (values: string[]) => void;
  multi?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = selected.length > 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectedLabel =
    selected.length === 1
      ? (options.find((o) => o.value === selected[0])?.label ?? label)
      : selected.length > 1
        ? `${label} (${selected.length})`
        : label;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors ${
          isActive
            ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300"
            : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 bg-white dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-300 dark:bg-slate-800"
        }`}
      >
        {selectedLabel}
        <ChevronDown size={9} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[148px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {isActive && (
            <button
              type="button"
              onClick={() => {
                onSelect([]);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-slate-400 hover:bg-slate-50 dark:text-slate-500 dark:hover:bg-slate-700"
            >
              <X size={10} />
              Clear
            </button>
          )}
          {options.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  if (multi) {
                    const next = isSelected
                      ? selected.filter((v) => v !== opt.value)
                      : [...selected, opt.value];
                    onSelect(next);
                  } else {
                    onSelect(isSelected ? [] : [opt.value]);
                    setOpen(false);
                  }
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {multi && (
                  <span
                    className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border ${
                      isSelected
                        ? "border-blue-500 bg-blue-500"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {isSelected && <Check size={9} className="text-white" />}
                  </span>
                )}
                {!multi && (
                  <span
                    className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                      isSelected ? "bg-blue-500" : "bg-transparent"
                    }`}
                  />
                )}
                {opt.dot && (
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: opt.dot }}
                  />
                )}
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── TicketList ───────────────────────────────────────────────────────────────

interface TicketListProps {
  tickets: TicketRow[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentAgentId: number | null;
  locallyReadIds?: Set<number>;
  requesterFilter?: { id: number; name: string } | null;
  initialQuery?: string;
  currentFilter: TicketFilter;
  counts: { unassigned: number; new: number };
  agentsList: Array<{ id: number; name: string }>;
  tagsList: Array<{ id: number; name: string; color: string }>;
  currentStatus: string[];
  currentPriority: string[];
  currentTagIds: string[];
  currentAssignee: string;
  bodySearch: boolean;
  hasMore: boolean;
}

const RELATIVE_TIME_TICK_MS = 30_000;

export function TicketList({
  tickets,
  selectedId,
  onSelect,
  collapsed,
  onToggleCollapse,
  currentAgentId: _currentAgentId,
  locallyReadIds,
  requesterFilter,
  initialQuery = "",
  currentFilter,
  counts,
  agentsList,
  tagsList,
  currentStatus,
  currentPriority,
  currentTagIds,
  currentAssignee,
  bodySearch,
  hasMore,
}: TicketListProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const bump = () => setNowMs(Date.now());
    const id = setInterval(bump, RELATIVE_TIME_TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // If the user previously enabled body search, reflect that on fresh loads
  useEffect(() => {
    if (!bodySearch && initialQuery) {
      try {
        if (localStorage.getItem("nd-body-search") === "1") {
          navigate({ bodySearch: "1" });
        }
      } catch {
        /* localStorage unavailable */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navigate(updates: Record<string, string | null>) {
    const sp = new URLSearchParams(window.location.search);
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === "") {
        sp.delete(key);
      } else {
        sp.set(key, val);
      }
    }
    const qs = sp.toString();
    router.push(`/app/tickets${qs ? `?${qs}` : ""}`);
  }

  function handleTabClick(tab: TicketFilter) {
    // Reset secondary filters when switching tabs; preserve search query
    navigate({
      filter: tab === "my_open" ? null : tab,
      status: null,
      priority: null,
      tag: null,
      assignee: null,
    });
  }

  function handleStatusChange(values: string[]) {
    navigate({ status: values.join(",") || null });
  }

  function handlePriorityChange(values: string[]) {
    navigate({ priority: values.join(",") || null });
  }

  function handleTagChange(values: string[]) {
    navigate({ tag: values.join(",") || null });
  }

  function handleAssigneeChange(values: string[]) {
    navigate({ assignee: values[0] ?? null });
  }

  function handleBodySearchToggle() {
    const next = !bodySearch;
    try {
      localStorage.setItem("nd-body-search", next ? "1" : "0");
    } catch {
      /* ignore */
    }
    navigate({ bodySearch: next ? "1" : null });
  }

  function handleClearFilters() {
    navigate({ status: null, priority: null, tag: null, assignee: null });
  }

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/poll", { method: "POST" });
      if (!res.ok) throw new Error("Poll failed");
    } catch {
      /* ignore; polling is best-effort */
    } finally {
      setRefreshing(false);
      window.location.reload();
    }
  }, [refreshing]);

  const hasSecondaryFilters =
    currentStatus.length > 0 ||
    currentPriority.length > 0 ||
    currentTagIds.length > 0 ||
    !!currentAssignee;

  // "All" tab with no active search or filters shows a prompt, not a list
  const isAllGated =
    currentFilter === "all" &&
    !initialQuery &&
    !hasSecondaryFilters &&
    !requesterFilter;

  const assigneeOptions = [
    { label: "Me", value: "me" },
    { label: "Unassigned", value: "unassigned" },
    ...agentsList.map((a) => ({ label: a.name, value: String(a.id) })),
  ];

  /* ── Collapsed strip ── */
  if (collapsed) {
    return (
      <div className="flex h-full w-10 flex-shrink-0 flex-col items-center border-r border-slate-200 bg-slate-50 pt-4 dark:border-slate-700 dark:bg-slate-900/50">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expand inbox"
          aria-expanded="false"
          aria-label="Expand inbox"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <ChevronLeft size={16} className="rotate-180" aria-hidden="true" />
        </button>
      </div>
    );
  }

  /* ── Expanded list ── */
  return (
    <div
      className="flex h-full flex-shrink-0 flex-col border-r border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50"
      style={{ width: "480px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Inbox
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowNewTicket(true)}
            title="New ticket"
            aria-label="New ticket"
            className="flex h-7 items-center gap-1 rounded-lg bg-blue-500 px-2.5 text-xs font-medium text-white hover:bg-blue-600 transition-colors"
          >
            <Plus size={13} />
            New
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Check for new mail"
            aria-label="Check for new mail"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <RefreshCw
              size={14}
              className={refreshing ? "animate-spin" : ""}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Collapse inbox"
            aria-expanded="true"
            aria-label="Collapse inbox"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-0.5 px-3 pt-1 pb-1.5">
        {TABS.map(({ label, value }) => {
          const badge =
            value === "unassigned"
              ? counts.unassigned
              : value === "new"
                ? counts.new
                : null;
          const isActive = currentFilter === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleTabClick(value)}
              aria-pressed={isActive}
              className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? "bg-blue-500 text-white"
                  : "text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {label}
              {badge != null && badge > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                    isActive
                      ? "bg-white/25 text-white"
                      : "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                  }`}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="px-3 pb-1">
        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            id="ticket-search"
            type="search"
            placeholder="Search tickets…"
            aria-label="Search tickets"
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              if (val === "") navigate({ q: null });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                navigate({ q: query.trim() || null });
              }
              if (e.key === "Escape") {
                setQuery("");
                navigate({ q: null });
              }
            }}
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:ring-blue-900/30"
          />
        </div>

        {/* Body search toggle */}
        <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 select-none">
          <span
            className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
              bodySearch
                ? "border-blue-500 bg-blue-500"
                : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800"
            }`}
            onClick={handleBodySearchToggle}
          >
            {bodySearch && <Check size={9} className="text-white" />}
          </span>
          <span
            className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors dark:text-slate-400 dark:hover:text-slate-200"
            onClick={handleBodySearchToggle}
          >
            Search message bodies
          </span>
        </label>
      </div>

      {/* Secondary filter chips */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
        <DropdownChip
          label="Status"
          options={STATUS_OPTIONS}
          selected={currentStatus}
          onSelect={handleStatusChange}
          multi
        />
        <DropdownChip
          label="Priority"
          options={PRIORITY_OPTIONS}
          selected={currentPriority}
          onSelect={handlePriorityChange}
          multi
        />
        {tagsList.length > 0 && (
          <DropdownChip
            label="Tag"
            options={tagsList.map((t) => ({
              label: t.name,
              value: String(t.id),
              dot: t.color,
            }))}
            selected={currentTagIds}
            onSelect={handleTagChange}
            multi
          />
        )}
        <DropdownChip
          label="Assignee"
          options={assigneeOptions}
          selected={currentAssignee ? [currentAssignee] : []}
          onSelect={handleAssigneeChange}
        />
        {hasSecondaryFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors dark:text-slate-500 dark:hover:text-slate-300"
          >
            <X size={9} />
            Clear
          </button>
        )}
      </div>

      {/* Requester filter chip */}
      {requesterFilter && (
        <div className="px-3 pb-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <span>From: {requesterFilter.name}</span>
            <a
              href="/app/tickets"
              className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-blue-100 dark:hover:bg-blue-800"
              aria-label="Clear requester filter"
            >
              <X size={10} />
            </a>
          </div>
        </div>
      )}

      {/* Count */}
      {!isAllGated && (
        <div className="px-4 pb-2">
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-400">
            {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}
            {hasMore && " (showing first 100 — refine to see more)"}
          </span>
        </div>
      )}

      {/* List */}
      <div
        className="flex-1 overflow-y-auto"
        role="listbox"
        aria-label="Tickets"
      >
        {isAllGated ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <FileSearch
              size={28}
              className="mb-3 text-slate-300 dark:text-slate-600"
            />
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
              Search or filter to explore all tickets
            </p>
            <p className="mt-1 text-[12px] text-slate-400 dark:text-slate-500">
              Try searching by subject, requester, or ticket number
            </p>
          </div>
        ) : tickets.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 px-6 text-center"
            aria-live="polite"
          >
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
              No tickets found
            </p>
            {initialQuery && !bodySearch && (
              <button
                type="button"
                onClick={handleBodySearchToggle}
                className="mt-2 text-[12px] text-blue-500 hover:underline"
              >
                Search message bodies too?
              </button>
            )}
          </div>
        ) : (
          tickets.map((t) => (
            <TicketRow
              key={t.id}
              ticket={t}
              nowMs={nowMs}
              selected={t.id === selectedId}
              isUnread={t.isUnread && !(locallyReadIds?.has(t.id) ?? false)}
              onClick={() => onSelect(t.id)}
            />
          ))
        )}
      </div>

      <NewTicketModal
        open={showNewTicket}
        onClose={() => setShowNewTicket(false)}
        onCreated={handleRefresh}
      />
    </div>
  );
}

// ─── TicketRow ────────────────────────────────────────────────────────────────

function TicketRow({
  ticket,
  nowMs,
  selected,
  isUnread,
  onClick,
}: {
  ticket: TicketRow;
  nowMs: number;
  selected: boolean;
  isUnread: boolean;
  onClick: () => void;
}) {
  const color = avatarColor(ticket.requesterEmail, ticket.requesterName);
  const inits = initials(ticket.requesterEmail, ticket.requesterName);
  const aColor =
    ticket.assigneeColorBg && ticket.assigneeColorText
      ? { bg: ticket.assigneeColorBg, text: ticket.assigneeColorText }
      : null;
  const aCls =
    !aColor && ticket.assigneeName ? agentColorClass(ticket.assigneeName) : "";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={selected}
      role="option"
      className={`w-full cursor-pointer border-b border-slate-200 px-4 py-3 text-left transition-colors dark:border-slate-800 ${
        selected
          ? "bg-blue-50 dark:bg-blue-900/20"
          : isUnread
            ? "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800"
            : "hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative mt-0.5 flex-shrink-0">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-white"
            style={{
              backgroundColor: color,
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            {inits}
          </div>
          {isUnread && !selected && (
            <span
              className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white dark:ring-slate-900"
              aria-label="Unread"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`flex-shrink-0 text-[11px] font-mono ${isUnread ? "font-semibold text-slate-700 dark:text-slate-300" : "font-medium text-slate-500 dark:text-slate-500"}`}
            >
              {ticket.number}
            </span>
            {(() => {
              const pc = PRIORITY_CONFIG[ticket.priority];
              return (
                <span
                  className={`flex flex-shrink-0 items-center gap-0.5 text-[10px] font-medium ${pc.cls}`}
                >
                  {pc.icon}
                  {pc.label}
                </span>
              );
            })()}
            {ticket.mergedIntoTicketId && (
              <span className="flex-shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                Merged
              </span>
            )}
            {(ticket.tags?.length ?? 0) > 0 && (
              <div className="flex min-w-0 flex-wrap gap-0.5">
                {ticket.tags!.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex flex-shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white shadow-xs"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
            <span
              className={`ml-auto flex-shrink-0 text-[10px] ${isUnread ? "font-medium text-slate-500 dark:text-slate-400" : "text-slate-400 dark:text-slate-500"}`}
            >
              {relativeTime(ticket.lastMessageAt ?? ticket.updatedAt, nowMs)}
            </span>
          </div>
          <p
            className={`mt-0.5 truncate text-[13px] leading-snug ${isUnread ? "font-semibold text-slate-900 dark:text-slate-100" : "font-medium text-slate-800 dark:text-slate-200"}`}
          >
            {ticket.subjectNormalized}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <StatusBadge status={ticket.status} size="sm" />
            {ticket.mergedIntoTicketId && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Merged
              </span>
            )}
            <span
              className={`truncate text-[11px] ${isUnread ? "font-medium text-slate-600 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}`}
            >
              {ticket.requesterName || ticket.requesterEmail}
              {ticket.requesterCompanyName && (
                <span
                  className={`mx-1 ${isUnread ? "text-slate-400" : "text-slate-300 dark:text-slate-600"}`}
                >
                  ·
                </span>
              )}
              {ticket.requesterCompanyName}
            </span>
            {ticket.assigneeName && (aColor || aCls) && (
              <span
                className={`ml-auto flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${aCls}`}
                style={
                  aColor
                    ? { backgroundColor: aColor.bg, color: aColor.text }
                    : undefined
                }
              >
                {ticket.assigneeName.split(" ")[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
