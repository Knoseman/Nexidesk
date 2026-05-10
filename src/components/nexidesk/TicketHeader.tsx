"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  X,
  CheckCircle,
  AlertTriangle,
  Clock,
  AlertCircle,
  Zap,
  User,
  ArrowRightLeft,
} from "lucide-react";
import type {
  TicketStatus,
  TicketPriority,
  TicketDetailData,
} from "@/types/ticket";
import { Toast, DropPanel, DropItem } from "./shared";
import { HelpPanel } from "./HelpPanel";
import { useTicketMutation } from "./useTicketMutation";
import { MergeTicketModal } from "./MergeTicketModal";

const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; bg: string; text: string; dot: string; border: string }
> = {
  new: {
    label: "New",
    bg: "#ede9fe",
    text: "#5b21b6",
    dot: "#8b5cf6",
    border: "#ddd6fe",
  },
  open: {
    label: "Open",
    bg: "#d1fae5",
    text: "#065f46",
    dot: "#10b981",
    border: "#a7f3d0",
  },
  pending: {
    label: "Pending",
    bg: "#fef3c7",
    text: "#92400e",
    dot: "#f59e0b",
    border: "#fde68a",
  },
  resolved: {
    label: "Resolved",
    bg: "#dbeafe",
    text: "#1e40af",
    dot: "#3b82f6",
    border: "#bfdbfe",
  },
  closed: {
    label: "Closed",
    bg: "#f1f5f9",
    text: "#475569",
    dot: "#94a3b8",
    border: "#e2e8f0",
  },
};

const PRIORITY_CONFIG: Record<
  TicketPriority,
  { label: string; text: string; icon: React.ReactNode }
> = {
  low: { label: "Low", text: "#64748b", icon: <Clock size={12} /> },
  normal: { label: "Normal", text: "#0369a1", icon: <AlertCircle size={12} /> },
  high: { label: "High", text: "#c2410c", icon: <AlertTriangle size={12} /> },
  urgent: { label: "Urgent", text: "#dc2626", icon: <Zap size={12} /> },
};

type AgentOption = {
  id: number;
  name: string;
  email: string;
  labelColorBg?: string | null;
  labelColorText?: string | null;
};

interface TicketHeaderProps {
  ticket: TicketDetailData;
  onUpdated?: () => void;
  onMerge?: (targetId: number) => void;
}

export function TicketHeader({
  ticket,
  onUpdated,
  onMerge,
}: TicketHeaderProps) {
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);
  const [openDrop, setOpenDrop] = useState<
    "status" | "priority" | "assignee" | "more" | null
  >(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const [assigneeId, setAssigneeId] = useState<number | null>(
    ticket.assigneeId,
  );
  const [assigneeName, setAssigneeName] = useState<string | null>(
    ticket.assigneeName,
  );
  const [assigneeColorBg, setAssigneeColorBg] = useState<string | null>(
    ticket.assigneeColorBg,
  );
  const [assigneeColorText, setAssigneeColorText] = useState<string | null>(
    ticket.assigneeColorText,
  );
  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [currentAgentId, setCurrentAgentId] = useState<number | null>(null);

  const { mutate, toastMsg, setToastMsg } = useTicketMutation(
    ticket.id,
    onUpdated,
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(ticket.status);
  }, [ticket.status]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPriority(ticket.priority);
  }, [ticket.priority]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAssigneeId(ticket.assigneeId);
    setAssigneeName(ticket.assigneeName);
    setAssigneeColorBg(ticket.assigneeColorBg);
    setAssigneeColorText(ticket.assigneeColorText);
  }, [
    ticket.assigneeId,
    ticket.assigneeName,
    ticket.assigneeColorBg,
    ticket.assigneeColorText,
  ]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setOpenDrop(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleStatusChange(s: TicketStatus) {
    const old = status;
    setStatus(s);
    setOpenDrop(null);
    try {
      await mutate({ status: s }, `Status set to ${STATUS_CONFIG[s].label}`);
    } catch {
      setStatus(old);
    }
  }

  async function handlePriorityChange(p: TicketPriority) {
    const old = priority;
    setPriority(p);
    setOpenDrop(null);
    try {
      await mutate(
        { priority: p },
        `Priority set to ${PRIORITY_CONFIG[p].label}`,
      );
    } catch {
      setPriority(old);
    }
  }

  async function openAssigneeDrop() {
    setOpenDrop(openDrop === "assignee" ? null : "assignee");
    if (agentOptions.length > 0) return;
    setLoadingAgents(true);
    try {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to load agents");
      const data = (await res.json()) as {
        agents: AgentOption[];
        currentAgentId: number;
      };
      setAgentOptions(data.agents);
      setCurrentAgentId(data.currentAgentId);
    } catch (err) {
      console.error("[TicketHeader agents]", err);
      setOpenDrop(null);
      setToastMsg("Error: Could not load agents");
    } finally {
      setLoadingAgents(false);
    }
  }

  async function handleAssign(agent: AgentOption | null) {
    const old = {
      id: assigneeId,
      name: assigneeName,
      bg: assigneeColorBg,
      text: assigneeColorText,
      status,
    };
    setAssigneeId(agent?.id ?? null);
    setAssigneeName(agent?.name ?? null);
    setAssigneeColorBg(agent?.labelColorBg ?? null);
    setAssigneeColorText(agent?.labelColorText ?? null);
    if (agent && status === "new") setStatus("open");
    setOpenDrop(null);

    try {
      await mutate(
        { assigneeId: agent?.id ?? null },
        agent ? `Assigned to ${agent.name}` : "Unassigned",
      );
    } catch {
      setAssigneeId(old.id);
      setAssigneeName(old.name);
      setAssigneeColorBg(old.bg);
      setAssigneeColorText(old.text);
      setStatus(old.status);
    }
  }

  const sc = STATUS_CONFIG[status];
  const pc = PRIORITY_CONFIG[priority];

  return (
    <div
      className="flex-shrink-0 border-b border-slate-200 bg-white px-6 pt-5 pb-4 dark:border-slate-700 dark:bg-slate-900"
      ref={dropRef}
    >
      <div className="flex items-center gap-1.5 mb-3 text-[12px]">
        <span className="text-slate-400 font-medium dark:text-slate-500">Tickets</span>
        <ChevronRight size={13} className="text-slate-300 dark:text-slate-600" aria-hidden="true" />
        <span className="font-mono font-semibold text-blue-500">
          {ticket.number}
        </span>
      </div>

      <h1 className="mb-4 text-[22px] font-bold leading-snug tracking-tight text-slate-900 dark:text-slate-100">
        {ticket.subjectNormalized}
      </h1>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <button
            onClick={() => setOpenDrop(openDrop === "status" ? null : "status")}
            aria-expanded={openDrop === "status"}
            aria-haspopup="menu"
            aria-label="Change status"
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold cursor-pointer transition-all hover:opacity-90"
            style={{
              backgroundColor: sc.bg,
              color: sc.text,
              borderColor: sc.border,
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: sc.dot }}
            />
            {sc.label}
            <ChevronDown size={11} />
          </button>
          {openDrop === "status" && (
            <DropPanel>
              {(
                [
                  "new",
                  "open",
                  "pending",
                  "resolved",
                  "closed",
                ] as TicketStatus[]
              ).map((s) => {
                const c = STATUS_CONFIG[s];
                return (
                  <DropItem
                    key={s}
                    active={status === s}
                    onClick={() => handleStatusChange(s)}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: c.dot }}
                    />
                    <span style={{ color: c.text, fontWeight: 500 }}>
                      {c.label}
                    </span>
                  </DropItem>
                );
              })}
            </DropPanel>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() =>
              setOpenDrop(openDrop === "priority" ? null : "priority")
            }
            aria-expanded={openDrop === "priority"}
            aria-haspopup="menu"
            aria-label="Change priority"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 cursor-pointer hover:bg-slate-50 transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <span style={{ color: pc.text }}>{pc.icon}</span>
            {pc.label}
            <ChevronDown size={11} className="text-slate-400" />
          </button>
          {openDrop === "priority" && (
            <DropPanel>
              {(["low", "normal", "high", "urgent"] as TicketPriority[]).map(
                (p) => {
                  const c = PRIORITY_CONFIG[p];
                  return (
                    <DropItem
                      key={p}
                      active={priority === p}
                      onClick={() => handlePriorityChange(p)}
                    >
                      <span style={{ color: c.text }}>{c.icon}</span>
                      <span style={{ color: c.text, fontWeight: 500 }}>
                        {c.label}
                      </span>
                    </DropItem>
                  );
                },
              )}
            </DropPanel>
          )}
        </div>

        <div className="relative">
          <button
            onClick={openAssigneeDrop}
            aria-expanded={openDrop === "assignee"}
            aria-haspopup="menu"
            aria-label="Change assignee"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium cursor-pointer hover:bg-slate-50 transition-all dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            style={{ color: assigneeName ? "#374151" : "#94a3b8" }}
          >
            {assigneeName && assigneeColorBg && assigneeColorText ? (
              <span
                className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                style={{
                  backgroundColor: assigneeColorBg,
                  color: assigneeColorText,
                }}
              >
                {assigneeName[0]?.toUpperCase()}
              </span>
            ) : (
              <User size={12} />
            )}
            {assigneeName ?? "Unassigned"}
            <ChevronDown size={11} className="text-slate-400" />
          </button>
          {openDrop === "assignee" && (
            <DropPanel>
              {loadingAgents ? (
                <div className="px-3 py-2 text-[12px] text-slate-400 dark:text-slate-500">
                  Loading…
                </div>
              ) : (
                <>
                  <DropItem
                    active={assigneeId === null}
                    onClick={() => handleAssign(null)}
                  >
                    <span className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
                    <span className="text-slate-500">Unassigned</span>
                  </DropItem>
                  {agentOptions.map((a) => (
                    <DropItem
                      key={a.id}
                      active={assigneeId === a.id}
                      onClick={() => handleAssign(a)}
                    >
                      <span
                        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-white text-[9px] font-bold"
                        style={{
                          backgroundColor: a.labelColorBg ?? "#6366f1",
                          color: a.labelColorText ?? "#ffffff",
                        }}
                      >
                        {a.name[0]?.toUpperCase()}
                      </span>
                      <span>
                        {a.name}
                        {a.id === currentAgentId && (
                          <span className="ml-1 text-slate-400">(Me)</span>
                        )}
                      </span>
                    </DropItem>
                  ))}
                </>
              )}
            </DropPanel>
          )}
        </div>

        <div className="flex-1" />

        <HelpPanel />

        {!ticket.mergedIntoTicketId && (
          <button
            onClick={() => setShowMergeModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 cursor-pointer hover:bg-slate-50 transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            title="Merge into another ticket"
          >
            <ArrowRightLeft size={13} />
            Merge
          </button>
        )}

        <button
          onClick={() =>
            handleStatusChange(status === "closed" ? "open" : "closed")
          }
          className={`flex items-center gap-1.5 rounded-lg border px-4 py-1.5 text-[12px] font-semibold cursor-pointer transition-all ${
            status === "closed"
              ? "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400"
              : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          }`}
        >
          {status === "closed" ? <CheckCircle size={13} /> : <X size={13} />}
          {status === "closed" ? "Reopen" : "Close Ticket"}
        </button>
      </div>

      <MergeTicketModal
        open={showMergeModal}
        sourceTicket={ticket}
        onClose={() => setShowMergeModal(false)}
        onMerged={(targetId) => {
          setShowMergeModal(false);
          onMerge?.(targetId);
        }}
      />

      {toastMsg && (
        <Toast message={toastMsg} onDone={() => setToastMsg(null)} />
      )}
    </div>
  );
}
