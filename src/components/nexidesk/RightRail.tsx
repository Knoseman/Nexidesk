import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  User,
  Mail,
  Calendar,
  Hash,
  Tag,
  Inbox,
  Building2,
  Phone,
  Search,
  X,
  Check,
  Briefcase,
  Trash2,
  Clock,
} from "lucide-react";
import type {
  TicketDetailData,
  TicketTagView,
  TicketStatus,
} from "@/types/ticket";
import type { Contact } from "@/lib/schema";
import { StatusBadge } from "./StatusBadge";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
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

function displayName(email: string, name?: string | null): string {
  if (name) return name;
  const local = email.split("@")[0].replace(/[._-]/g, " ");
  return local
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

interface RightRailProps {
  ticket: TicketDetailData;
  onUpdateTicket?: () => void;
  onDeleteTicket?: () => void;
  onSelectTicket?: (id: number) => void;
}

export function RightRail({
  ticket,
  onUpdateTicket,
  onDeleteTicket,
  onSelectTicket,
}: RightRailProps) {
  const [deleting, setDeleting] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  const [tags, setTags] = useState<TicketTagView[]>(ticket.tags ?? []);
  const [allTags, setAllTags] = useState<TicketTagView[]>([]);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const tagMenuRef = useRef<HTMLDivElement>(null);
  const tagSearchRef = useRef<HTMLInputElement>(null);

  const [related, setRelated] = useState<
    Array<{
      id: number;
      number: string;
      status: TicketStatus;
      subjectNormalized: string;
      createdAt: string;
      lastMessageAt: string | null;
    }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/tickets/${ticket.id}/related`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as typeof related;
        if (!cancelled) setRelated(data);
      } catch {
        /* ignore */
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticket.id]);

  const email = ticket.requesterEmail;
  const inits = initials(email, ticket.requesterName);

  useEffect(() => {
    if (!showTagMenu) return;
    async function load() {
      try {
        const res = await fetch("/api/tags");
        if (res.ok) setAllTags(await res.json());
      } catch {
        /* ignore */
      }
    }
    void load();
    setTimeout(() => tagSearchRef.current?.focus(), 0);
  }, [showTagMenu]);

  const prevShowTagMenu = useRef(showTagMenu);
  useEffect(() => {
    const wasOpen = prevShowTagMenu.current;
    prevShowTagMenu.current = showTagMenu;
    if (wasOpen && !showTagMenu) {
      // Defer to next tick to avoid cascading render
      const t = setTimeout(() => setTagSearch(""), 0);
      return () => clearTimeout(t);
    }
  }, [showTagMenu]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (tagMenuRef.current && !tagMenuRef.current.contains(target)) {
        setShowTagMenu(false);
      }
    }
    if (showTagMenu) {
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }
  }, [showTagMenu]);

  async function addTag(tag: TicketTagView) {
    const res = await fetch(`/api/tickets/${ticket.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId: tag.id }),
    });
    if (res.ok) {
      setTags((prev) => [...prev, tag]);
      onUpdateTicket?.();
    }
  }

  async function removeTag(tagId: number) {
    const res = await fetch(`/api/tickets/${ticket.id}/tags?tagId=${tagId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      onUpdateTicket?.();
    }
  }

  useEffect(() => {
    if (!isChanging || !search.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/contacts?q=${encodeURIComponent(search)}`,
        );
        if (res.ok) setResults(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isChanging, search]);

  async function selectContact(contact: Contact) {
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: contact.id }),
      });
      if (!res.ok) throw new Error("Failed to update requester");
      setIsChanging(false);
      setSearch("");
      onUpdateTicket?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <aside className="flex h-full w-[300px] flex-shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
      {/* Requester */}
      <Section title="Requester">
        {!isChanging ? (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white text-[12px] font-bold"
                style={{ backgroundColor: "#6366f1" }}
              >
                {inits}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                  {displayName(email, ticket.requesterName)}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {email}
                </p>
              </div>
            </div>
            <InfoRow
              icon={<Building2 size={12} />}
              label="Company"
              value={ticket.requesterCompanyName || email.split("@")[1] || "—"}
            />
            {ticket.requesterTitle && (
              <InfoRow
                icon={<Briefcase size={12} />}
                label="Title"
                value={ticket.requesterTitle}
              />
            )}
            {ticket.requesterPhone && (
              <InfoRow
                icon={<Phone size={12} />}
                label="Phone"
                value={ticket.requesterPhone}
                mono
              />
            )}
            <InfoRow
              icon={<Mail size={12} />}
              label="Email"
              value={email}
              mono
              truncate
            />

            <button
              onClick={() => setIsChanging(true)}
              className="mt-2 flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-600 transition-colors"
            >
              <User size={11} />
              Change requester
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-400">
                SELECT CONTACT
              </span>
              <button
                onClick={() => {
                  setIsChanging(false);
                  setSearch("");
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            </div>
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="contact-search"
                autoFocus
                type="text"
                placeholder="Search name or email..."
                aria-label="Search contacts"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-[12px] text-slate-700 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            {loading && (
              <div className="text-center py-2 text-[11px] text-slate-400">
                Searching...
              </div>
            )}
            <div className="max-h-48 overflow-y-auto rounded border border-slate-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              {results.length === 0 && search.trim() && !loading && (
                <div className="p-3 text-center text-[11px] text-slate-400 dark:text-slate-500">
                  No contacts found
                </div>
              )}
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectContact(c)}
                  className="w-full border-b border-slate-50 p-2 text-left hover:bg-blue-50 transition-colors last:border-0 dark:border-slate-700/50 dark:hover:bg-blue-950/30"
                  aria-label={`Select ${c.name || c.email}`}
                >
                  <p className="truncate text-[12px] font-semibold text-slate-800 dark:text-slate-200">
                    {c.name || c.email}
                  </p>
                  <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                    {c.email}
                  </p>
                  {c.companyName && (
                    <p className="truncate text-[10px] text-slate-400 mt-0.5">
                      {c.companyName}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Ticket metadata */}
      <Section title="Ticket">
        <InfoRow
          icon={<Hash size={12} />}
          label="Number"
          value={ticket.number}
          mono
        />
        <InfoRow icon={<Inbox size={12} />} label="Channel" value="Email" />
        <InfoRow
          icon={<Calendar size={12} />}
          label="Created"
          value={formatDate(ticket.createdAt)}
        />
        {ticket.closedAt && (
          <InfoRow
            icon={<Calendar size={12} />}
            label="Closed"
            value={formatDate(ticket.closedAt)}
          />
        )}
        {ticket.assigneeName && (
          <InfoRow
            icon={<User size={12} />}
            label="Assigned"
            value={ticket.assigneeName}
          />
        )}
      </Section>

      {/* Tags */}
      <Section title="Tags">
        <div className="flex flex-wrap gap-1.5">
          {tags.length === 0 && (
            <span className="text-[11px] text-slate-400 italic">
              No tags yet
            </span>
          )}
          {tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
              style={{ backgroundColor: t.color }}
            >
              {t.name}
              <button
                onClick={() => removeTag(t.id)}
                className="ml-0.5 rounded-full hover:bg-white/20"
                aria-label={`Remove ${t.name}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <div className="relative mt-2">
          <button
            onClick={() => setShowTagMenu((s) => !s)}
            className="flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-600 transition-colors"
            aria-expanded={showTagMenu}
            aria-haspopup="listbox"
          >
            <Tag size={11} />
            Add tag
          </button>
          {showTagMenu && (
            <div
              ref={tagMenuRef}
              role="listbox"
              aria-label="Tags"
              className="absolute left-0 top-full z-30 mt-1 w-52 rounded-xl border border-slate-100 bg-white shadow-lg overflow-hidden dark:border-slate-700 dark:bg-slate-800"
              style={{
                boxShadow:
                  "0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.05)",
              }}
            >
              <div className="px-2 pt-2 pb-1.5">
                <div className="relative">
                  <Search
                    size={11}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    ref={tagSearchRef}
                    type="text"
                    placeholder="Search tags..."
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Escape" && setShowTagMenu(false)
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-2 text-[11px] text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:bg-slate-800"
                  />
                </div>
              </div>
              <div className="border-t border-slate-100" />
              <div className="max-h-48 overflow-y-auto py-1">
                {(() => {
                  const q = tagSearch.trim().toLowerCase();
                  const filtered = q
                    ? allTags.filter((t) => t.name.toLowerCase().includes(q))
                    : allTags;
                  const appliedIds = new Set(tags.map((t) => t.id));
                  if (filtered.length === 0) {
                    return (
                      <div className="px-3 py-2 text-[12px] text-slate-400 dark:text-slate-500">
                        {q ? "No tags match" : "No tags yet"}
                      </div>
                    );
                  }
                  return filtered.map((t) => {
                    const applied = appliedIds.has(t.id);
                    return (
                      <button
                        key={t.id}
                        role="option"
                        aria-selected={applied}
                        onClick={() => (applied ? removeTag(t.id) : addTag(t))}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 ${applied ? "bg-indigo-50/50 dark:bg-indigo-900/20" : ""}`}
                      >
                        <span
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: t.color }}
                        />
                        <span className="flex-1 truncate">{t.name}</span>
                        {applied && (
                          <Check
                            size={11}
                            className="flex-shrink-0 text-indigo-500"
                          />
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Previous tickets */}
      {related.length > 0 && (
        <Section title="Previous tickets">
          <div className="space-y-2">
            {related.slice(0, 3).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTicket?.(t.id)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-left transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400">
                    {t.number}
                  </span>
                  <StatusBadge status={t.status} size="sm" />
                </div>
                <p className="mt-1 truncate text-[12px] font-medium text-slate-800 dark:text-slate-200">
                  {t.subjectNormalized}
                </p>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                  <Clock size={11} />
                  <span>
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(t.lastMessageAt ?? t.createdAt))}
                  </span>
                </div>
              </button>
            ))}
          </div>
          {related.length >= 4 && (
            <div className="mt-2 text-center">
              <Link
                href={
                  ticket.requesterId != null
                    ? `/app/contacts/${ticket.requesterId}`
                    : `/app/tickets?q=${encodeURIComponent(ticket.requesterEmail)}`
                }
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-blue-600 transition-colors"
              >
                View all tickets
                <span aria-hidden="true">›</span>
              </Link>
            </div>
          )}
        </Section>
      )}

      {/* Danger zone */}
      <div className="p-4">
        <button
          onClick={async () => {
            if (
              !confirm(
                `Delete ticket ${ticket.number}?\n\nThis will permanently remove the ticket and all its messages. This cannot be undone.`,
              )
            )
              return;
            setDeleting(true);
            try {
              const res = await fetch(`/api/tickets/${ticket.id}`, {
                method: "DELETE",
              });
              if (!res.ok) throw new Error("Delete failed");
              onDeleteTicket?.();
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to delete ticket");
            } finally {
              setDeleting(false);
            }
          }}
          disabled={deleting}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-[12px] font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 dark:border-red-800/40 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          <Trash2 size={13} />
          {deleting ? "Deleting…" : "Delete ticket"}
        </button>
      </div>
    </aside>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-200 p-4 dark:border-slate-700">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {title}
      </p>
      {children}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono,
  truncate: trunc,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="mb-2 flex items-start gap-2">
      <span className="mt-0.5 flex-shrink-0 text-slate-400">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </span>
        <p
          className={`text-[12px] text-slate-700 leading-snug dark:text-slate-300 ${trunc ? "truncate" : ""}`}
          style={{
            fontFamily: mono ? "var(--font-geist-mono), monospace" : undefined,
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
