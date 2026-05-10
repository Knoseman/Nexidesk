"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, Reply, Trash2 } from "lucide-react";

export function Toast({
  message,
  onDone,
}: {
  message: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-[13px] font-medium text-white shadow-xl animate-in fade-in slide-in-from-bottom-2"
    >
      <CheckCircle
        size={14}
        className="text-emerald-400 flex-shrink-0"
        aria-hidden="true"
      />
      {message}
    </div>,
    document.body,
  );
}

export function DropPanel({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <div
      role="menu"
      className="absolute top-full z-30 mt-1.5 rounded-xl border border-slate-100 bg-white py-1.5 dark:border-slate-700 dark:bg-slate-800"
      style={{
        minWidth: "160px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.05)",
        left: right ? "auto" : 0,
        right: right ? 0 : "auto",
      }}
    >
      {children}
    </div>
  );
}

export function DropItem({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 ${
        active
          ? "bg-blue-50 font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          : "text-slate-700 dark:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

export function QAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 transition-all dark:text-slate-400 dark:hover:bg-slate-700"
    >
      {icon}
      {label}
    </button>
  );
}

export function MsgMenu({
  onClose,
  onReply,
  onDelete,
  showReply = true,
  showDelete = true,
}: {
  onClose: () => void;
  onReply?: () => void;
  onDelete?: () => void;
  showReply?: boolean;
  showDelete?: boolean;
}) {
  return (
    <div
      role="menu"
      className="absolute right-0 top-full z-20 mt-1 rounded-xl border border-slate-100 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
      style={{ minWidth: "130px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
    >
      {showReply && (
        <button
          role="menuitem"
          onClick={() => {
            onReply?.();
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-slate-50 transition-all text-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <Reply size={12} aria-hidden="true" />
          Reply
        </button>
      )}
      {showDelete && (
        <button
          role="menuitem"
          onClick={() => {
            onDelete?.();
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-slate-50 transition-all text-red-600 dark:hover:bg-slate-700 dark:text-red-400"
        >
          <Trash2 size={12} aria-hidden="true" />
          Delete
        </button>
      )}
    </div>
  );
}
