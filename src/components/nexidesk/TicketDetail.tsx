"use client";

import { useRef, useState, type RefObject } from "react";
import { Inbox } from "lucide-react";
import { TicketHeader } from "./TicketHeader";
import { ConversationThread } from "./ConversationThread";
import { Composer } from "./Composer";
import { RightRail } from "./RightRail";
import { useTicketDetail } from "./useTicketDetail";

interface TicketDetailProps {
  ticketId: number | null;
  /** Increment when upstream detects new IMAP / DB activity; refetches open ticket. */
  remoteRefreshToken?: number;
  /** Called after any mutation that should update the ticket list (e.g. assignee change). */
  onListRefresh?: () => void;
  /** Called after the ticket is deleted. */
  onDeleteTicket?: () => void;
  /** Called when a merge completes or user wants to jump to the target ticket. */
  onMergeTicket?: (targetId: number) => void;
  /** Called when the user selects a related ticket in the sidebar. */
  onSelectTicket?: (id: number) => void;
}

export function TicketDetail({
  ticketId,
  remoteRefreshToken = 0,
  onListRefresh,
  onDeleteTicket,
  onMergeTicket,
  onSelectTicket,
}: TicketDetailProps) {
  const {
    detail,
    loading,
    error,
    refresh,
    replyTo,
    setReplyTo,
    handleDeleteMessage,
  } = useTicketDetail(ticketId, remoteRefreshToken);

  const COMPACT_HEIGHT = 400;
  const [composerHeight, setComposerHeight] = useState<number>(COMPACT_HEIGHT);
  const columnRef = useRef<HTMLDivElement>(null);

  if (ticketId === null) return <EmptyState />;

  if (loading) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <div
          className="flex flex-col items-center gap-3"
          role="status"
          aria-live="polite"
        >
          <div
            className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500 dark:border-slate-700 dark:border-t-blue-400"
            aria-hidden="true"
          />
          <p className="text-[13px] text-slate-400 dark:text-slate-500">Loading ticket…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-[13px] text-red-700 dark:border-red-800/50 dark:bg-red-950/20 dark:text-red-400">
          Failed to load ticket: {error}
        </div>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      {/* Main column */}
      <div ref={columnRef} className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TicketHeader
          key={detail.id}
          ticket={detail}
          onUpdated={() => {
            refresh();
            onListRefresh?.();
          }}
          onMerge={(targetId) => {
            onDeleteTicket?.();
            onMergeTicket?.(targetId);
          }}
        />
        <div className="flex-1 overflow-y-auto">
          {detail.mergedIntoTicketId ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div className="rounded-full bg-slate-100 p-3 dark:bg-slate-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-slate-400 dark:text-slate-500"
                >
                  <path d="m16 3 4 4-4 4" />
                  <path d="M20 7H4" />
                  <path d="m8 21-4-4 4-4" />
                  <path d="M4 17h16" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Ticket merged into{" "}
                <span className="text-blue-600 dark:text-blue-400">
                  #{detail.mergedIntoTicketNumber ?? detail.mergedIntoTicketId}
                </span>
              </p>
              <button
                onClick={() => {
                  if (detail.mergedIntoTicketId) {
                    onMergeTicket?.(detail.mergedIntoTicketId);
                  }
                }}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
              >
                View target ticket
              </button>
            </div>
          ) : (
            <ConversationThread
              messages={detail.messages}
              onReply={(m) => {
                // Collect all recipients from the original message (Reply All behavior)
                const others = [...(m.toEmails ?? []), ...(m.ccEmails ?? [])];

                // Filter out:
                // 1. The original sender (they are already in the "To" field)
                // 2. The shared mailbox itself (we don't want to CC ourselves)
                const filteredCc = others.filter((email) => {
                  const e = email.toLowerCase().trim();
                  if (e === m.fromEmail?.toLowerCase().trim()) return false;
                  if (
                    detail.mailboxAddress &&
                    e === detail.mailboxAddress.toLowerCase().trim()
                  )
                    return false;
                  return true;
                });

                // Deduplicate
                const uniqueCc = Array.from(new Set(filteredCc));

                setReplyTo({
                  id: m.id,
                  email: m.fromEmail ?? "",
                  ccEmails: uniqueCc,
                  bccEmails: m.bccEmails,
                });
              }}
              onDelete={handleDeleteMessage}
            />
          )}
        </div>
        {!detail.mergedIntoTicketId && (
          <>
            <ResizeHandle
              columnRef={columnRef}
              composerHeight={composerHeight}
              setComposerHeight={setComposerHeight}
            />
            <div style={{ height: composerHeight }} className="flex-shrink-0">
              <Composer
                key={detail.id}
                ticketId={detail.id}
                requesterEmail={detail.requesterEmail}
                subject={detail.subjectNormalized}
                replyTo={replyTo}
                messages={detail.messages}
                onThreadChanged={() => {
                  refresh();
                  setReplyTo(null);
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Right rail */}
      <RightRail
        key={detail.id}
        ticket={detail}
        onUpdateTicket={() => {
          refresh();
          onListRefresh?.();
        }}
        onDeleteTicket={onDeleteTicket}
        onSelectTicket={onSelectTicket}
      />
    </div>
  );
}

function ResizeHandle({
  columnRef,
  composerHeight,
  setComposerHeight,
}: {
  columnRef: RefObject<HTMLDivElement | null>;
  composerHeight: number;
  setComposerHeight: (h: number) => void;
}) {
  function startDrag(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    const column = columnRef.current;
    if (!column) return;
    const colRect = column.getBoundingClientRect();

    function onMove(ev: MouseEvent) {
      // Measure from the column's bottom so the handle tracks correctly
      const newHeight = colRect.bottom - ev.clientY;
      const min = 180;
      const max = colRect.height * 0.8;
      setComposerHeight(Math.max(min, Math.min(max, newHeight)));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setComposerHeight(composerHeight + 24);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setComposerHeight(Math.max(180, composerHeight - 24));
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize reply panel"
      tabIndex={0}
      onMouseDown={startDrag}
      onKeyDown={onKeyDown}
      className="h-1.5 cursor-ns-resize bg-slate-100 hover:bg-blue-200 dark:bg-slate-800 dark:hover:bg-blue-800"
    />
  );
}

function EmptyState() {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 bg-white dark:bg-slate-950">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800"
        aria-hidden="true"
      >
        <Inbox size={28} className="text-slate-300 dark:text-slate-600" aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="text-[16px] font-semibold text-slate-600 dark:text-slate-400">
          No ticket selected
        </p>
        <p className="mt-1 text-[13px] text-slate-400 dark:text-slate-500">
          Pick a ticket from the list to view the conversation.
        </p>
      </div>
    </div>
  );
}
