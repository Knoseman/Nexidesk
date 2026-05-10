"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TicketRow, TicketFilter } from "@/types/ticket";
import { TicketList } from "./TicketList";
import { TicketDetail } from "./TicketDetail";

const POLL_MS = 8_000;

interface TicketWorkspaceProps {
  tickets: TicketRow[];
  currentAgentId: number | null;
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
  initialTicketId?: number | null;
}

export function TicketWorkspace({
  tickets,
  currentAgentId,
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
  initialTicketId = null,
}: TicketWorkspaceProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(initialTicketId);
  const [locallyDeletedIds, setLocallyDeletedIds] = useState<Set<number>>(
    new Set(),
  );
  const [remoteRefreshToken, setRemoteRefreshToken] = useState(0);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [locallyReadIds, setLocallyReadIds] = useState<Set<number>>(new Set());
  const lastRevRef = useRef<number | null>(null);

  const displayTickets = tickets.filter((t) => !locallyDeletedIds.has(t.id));

  const handleSelect = (id: number) => {
    setSelectedId(id);
    setLocallyReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const r = await fetch("/api/tickets/inbox-rev", {
          credentials: "include",
        });
        if (!r.ok || cancelled) return;
        const data = (await r.json()) as { rev?: number };
        const rev = typeof data.rev === "number" ? data.rev : 0;

        if (lastRevRef.current === null) {
          lastRevRef.current = rev;
          return;
        }
        if (rev !== lastRevRef.current) {
          lastRevRef.current = rev;
          router.refresh();
          setRemoteRefreshToken((n) => n + 1);
        }
      } catch {
        /* ignore transient errors */
      }
    };

    const interval = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    void poll();

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return (
    <div className="flex h-full min-w-0 w-full overflow-hidden">
      <TicketList
        tickets={displayTickets}
        selectedId={selectedId}
        onSelect={handleSelect}
        collapsed={listCollapsed}
        onToggleCollapse={() => setListCollapsed((v) => !v)}
        currentAgentId={currentAgentId}
        locallyReadIds={locallyReadIds}
        requesterFilter={requesterFilter}
        initialQuery={initialQuery}
        currentFilter={currentFilter}
        counts={counts}
        agentsList={agentsList}
        currentStatus={currentStatus}
        currentPriority={currentPriority}
        currentTagIds={currentTagIds}
        currentAssignee={currentAssignee}
        tagsList={tagsList}
        bodySearch={bodySearch}
        hasMore={hasMore}
      />
      <TicketDetail
        ticketId={selectedId}
        remoteRefreshToken={remoteRefreshToken}
        onListRefresh={() => router.refresh()}
        onDeleteTicket={() => {
          const deletedId = selectedId;
          setSelectedId(null);
          if (deletedId != null) {
            setLocallyDeletedIds((prev) => {
              const next = new Set(prev);
              next.add(deletedId);
              return next;
            });
          }
          router.refresh();
        }}
        onMergeTicket={(targetId) => {
          const sourceId = selectedId;
          if (sourceId != null) {
            setLocallyDeletedIds((prev) => {
              const next = new Set(prev);
              next.add(sourceId);
              return next;
            });
          }
          setSelectedId(targetId);
          router.refresh();
        }}
        onSelectTicket={(id) => {
          setSelectedId(id);
          setLocallyReadIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
          });
        }}
      />
    </div>
  );
}
