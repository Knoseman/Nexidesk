"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Search, ArrowRightLeft } from "lucide-react";
import type { TicketRow } from "@/types/ticket";

interface MergeTicketModalProps {
  open: boolean;
  sourceTicket: TicketRow;
  onClose: () => void;
  onMerged: (targetId: number) => void;
}

type SearchResult = {
  id: number;
  number: string;
  subjectNormalized: string;
  status: string;
  requesterEmail: string;
  requesterName: string | null;
  assigneeName: string | null;
};

export function MergeTicketModal({
  open,
  sourceTicket,
  onClose,
  onMerged,
}: MergeTicketModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Reset form when modal opens
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setResults([]);
      setSelected(null);
      setError(null);
      setMerging(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const search = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/tickets/search?q=${encodeURIComponent(q)}&excludeId=${sourceTicket.id}`,
        );
        if (!res.ok) throw new Error("Search failed");
        const data = (await res.json()) as SearchResult[];
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [sourceTicket.id],
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, open, search]);

  async function handleMerge() {
    if (!selected) return;
    setError(null);
    setMerging(true);
    try {
      const res = await fetch(`/api/tickets/${sourceTicket.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTicketId: selected.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          (j as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      onMerged(selected.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setMerging(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Merge ticket
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <span className="font-medium">#{sourceTicket.number}</span>{" "}
          {sourceTicket.subjectNormalized}
        </div>

        {!selected ? (
          <>
            <div className="relative mb-3">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="merge-search"
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by number, subject, or requester…"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
              />
            </div>

            <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
              {loading && results.length === 0 && (
                <div className="px-3 py-4 text-sm text-slate-400 dark:text-slate-500">
                  Searching…
                </div>
              )}
              {!loading && results.length === 0 && query.trim().length > 0 && (
                <div className="px-3 py-4 text-sm text-slate-400 dark:text-slate-500">
                  No tickets found
                </div>
              )}
              {!loading &&
                results.length === 0 &&
                query.trim().length === 0 && (
                  <div className="px-3 py-4 text-sm text-slate-400 dark:text-slate-500">
                    Start typing to search
                  </div>
                )}
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <ArrowRightLeft
                    size={14}
                    className="shrink-0 text-slate-400 dark:text-slate-500"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      #{r.number} — {r.subjectNormalized}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {r.requesterName ?? r.requesterEmail}
                      {r.assigneeName ? ` · Assigned to ${r.assigneeName}` : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-950/20">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Merge <span className="font-medium">#{sourceTicket.number}</span>{" "}
              into <span className="font-medium">#{selected.number}</span>?
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              All messages will move and #{sourceTicket.number} will be closed.
              This cannot be undone.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-amber-100 transition-colors dark:text-slate-300 dark:hover:bg-amber-950/40"
              >
                Back
              </button>
              <button
                onClick={handleMerge}
                disabled={merging}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {merging ? "Merging…" : "Merge tickets"}
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-4 flex items-center justify-end">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
