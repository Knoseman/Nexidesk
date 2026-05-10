"use client";

import { useState, useEffect, useMemo } from "react";
import DOMPurify from "dompurify";
import {
  ChevronUp,
  Mail,
  Lock,
  MoreHorizontal,
  Reply,
  Paperclip,
} from "lucide-react";
import type { TicketMessage, AttachmentRef } from "@/types/ticket";
import { QAction, MsgMenu } from "./shared";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function initialsFromEmail(email: string): string {
  const name = email.split("@")[0].replace(/[._-]/g, " ");
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function isTerminal(s: string | null | undefined): boolean {
  return s === "sent" || s === "failed" || s === "dead" || s == null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkifyText(text: string): string {
  const urlRegex = /(\b(?:https?:\/\/|www\.)[^\s<]+)/gi;
  return escapeHtml(text)
    .replace(urlRegex, (raw) => {
      const trailing = raw.match(/[.,;:!?\)\]]+$/);
      const url = trailing ? raw.slice(0, -trailing[0].length) : raw;
      const suffix = trailing ? trailing[0] : "";
      const href = url.startsWith("www.") ? `https://${url}` : url;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-800">${url}</a>${suffix}`;
    })
    .replace(/\n/g, "<br/>");
}

function linkifyHtmlNodes(html: string): string {
  if (typeof document === "undefined") return html;
  const container = document.createElement("div");
  container.innerHTML = html;

  function walk(node: Node): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as Element).tagName === "A") return;
      Array.from(node.childNodes).forEach(walk);
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      const urlRegex = /(\b(?:https?:\/\/|www\.)[^\s<>"']+)/gi;
      if (!urlRegex.test(text)) return;
      urlRegex.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      let match: RegExpExecArray | null;
      while ((match = urlRegex.exec(text)) !== null) {
        const raw = match[0];
        // Peel trailing punctuation, but keep closing brackets that are
        // balanced within the URL (e.g. https://…/Cat_(animal) — the ")"
        // is part of the link, not sentence punctuation).
        let url = raw;
        let suffix = "";
        while (url.length > 0) {
          const ch = url[url.length - 1];
          if (".,;:!?".includes(ch)) {
            suffix = ch + suffix;
            url = url.slice(0, -1);
            continue;
          }
          if (ch === ")" || ch === "]") {
            const open = ch === ")" ? "(" : "[";
            const opens = url.split(open).length - 1;
            const closes = url.split(ch).length - 1;
            if (closes > opens) {
              suffix = ch + suffix;
              url = url.slice(0, -1);
              continue;
            }
          }
          break;
        }
        const href = url.startsWith("www.") ? `https://${url}` : url;
        frag.appendChild(document.createTextNode(text.slice(last, match.index)));
        const a = document.createElement("a");
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = url;
        frag.appendChild(a);
        if (suffix) frag.appendChild(document.createTextNode(suffix));
        last = match.index + raw.length;
      }
      frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode?.replaceChild(frag, node);
    }
  }

  Array.from(container.childNodes).forEach(walk);
  return container.innerHTML;
}

function useSanitizedHtml(html: string | null | undefined): string {
  return useMemo(() => {
    if (!html) return "";
    const cleaned = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "A",
        "B",
        "BR",
        "DIV",
        "EM",
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "I",
        "IMG",
        "LI",
        "OL",
        "P",
        "SPAN",
        "STRONG",
        "TABLE",
        "TBODY",
        "TD",
        "TH",
        "THEAD",
        "TR",
        "U",
        "UL",
        "BLOCKQUOTE",
        "HR",
      ],
      ALLOWED_ATTR: {
        A: ["href", "title", "target", "rel"],
        IMG: ["src", "alt", "title", "width", "height"],
        "*": ["class"],
      } as any,
      FORBID_ATTR: ["style"],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|cid):|\/|#)/i,
    });
    // Block remote tracking images — keep data: and cid: images, replace http(s) images
    const withBlockedImages = cleaned.replace(
      /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi,
      '<span class="text-slate-400 text-xs">[Remote image blocked]</span>',
    );
    return linkifyHtmlNodes(withBlockedImages);
  }, [html]);
}

function SendStateBadge({ status }: { status: string | null | undefined }) {
  if (status == null) return null;
  if (status === "pending")
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        ⏳ Queued
      </span>
    );
  if (status === "sending")
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-600 animate-pulse dark:bg-blue-900/40 dark:text-blue-400">
        ↗ Sending…
      </span>
    );
  if (status === "sent")
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
        ✓ Sent
      </span>
    );
  if (status === "failed")
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
        ⚠ Failed
      </span>
    );
  if (status === "dead")
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
        ✕ Failed permanently
      </span>
    );
  return null;
}

interface MessageCardProps {
  message: TicketMessage;
  onReply?: () => void;
  onDelete?: () => void;
}

export function MessageCard({ message, onReply, onDelete }: MessageCardProps) {
  if (message.direction === "note")
    return <NoteCard message={message} onDelete={onDelete} />;
  return <EmailCard message={message} onReply={onReply} />;
}

function EmailCard({
  message,
  onReply,
}: {
  message: TicketMessage;
  onReply?: () => void;
}) {
  const [quotedOpen, setQuotedOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [liveStatus, setLiveStatus] = useState(message.queueStatus ?? null);
  const isOut = message.direction === "outbound";
  const email = message.fromEmail ?? "unknown@example.com";

  const isAutoReply = message.kind === "auto_reply";

  // For outbound, prefer the agent's display name over the mailbox username
  const displayName =
    isOut && message.agentName
      ? message.agentName
      : email.split("@")[0].replace(/[._-]/g, " ");

  const avatarInits =
    isOut && message.agentName
      ? initialsFromName(message.agentName)
      : initialsFromEmail(email);

  const ts = formatDate(message.sentAt ?? message.receivedAt);
  const sanitizedHtml = useSanitizedHtml(message.bodyHtml);
  const hasQuote = sanitizedHtml.includes('class="nexidesk-quote"') || sanitizedHtml.includes("<blockquote");

  useEffect(() => {
    if (!isOut) return;
    if (isTerminal(liveStatus)) return;
    let attempts = 0;
    const baseDelay = 5000;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      try {
        const res = await fetch(
          `/api/tickets/${message.ticketId}/queue-status?messageId=${message.id}`,
        );
        const data = (await res.json()) as { status?: string | null };
        const next = data.status ?? null;
        setLiveStatus(next);
        if (!isTerminal(next)) {
          attempts++;
          const delay = Math.min(baseDelay * Math.pow(1.5, attempts), 60000);
          timer = setTimeout(tick, delay);
        }
      } catch {
        attempts++;
        const delay = Math.min(baseDelay * Math.pow(1.5, attempts), 60000);
        timer = setTimeout(tick, delay);
      }
    }

    timer = setTimeout(tick, baseDelay);
    return () => clearTimeout(timer);
  }, [isOut, liveStatus, message.id, message.ticketId]);

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-shadow ${
        isOut
          ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/50"
          : "bg-white border-slate-200 dark:bg-slate-900/50 dark:border-slate-800"
      }`}
      style={{
        boxShadow: isOut
          ? "0 1px 4px rgba(59,130,246,0.06)"
          : "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setMenuOpen(false);
      }}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-3 border-b px-5 py-3.5 ${
          isOut
            ? "border-blue-100 dark:border-blue-800/30"
            : "border-slate-100 dark:border-slate-800"
        }`}
      >
        <div
          className="h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center text-white text-[12px] font-bold"
          style={{ backgroundColor: "#6366f1" }}
        >
          {avatarInits}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isAutoReply ? (
              <span className="text-[14px] font-medium italic text-slate-500 dark:text-slate-400">
                Automatic reply
              </span>
            ) : (
              <span className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                {displayName}
              </span>
            )}
            {!isAutoReply && message.agentName && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400">
                AGENT
              </span>
            )}
            {isAutoReply && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                AUTO
              </span>
            )}
            {isOut ? (
              <SendStateBadge status={liveStatus ?? message.queueStatus} />
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                <Mail size={10} />
                <span className="font-mono truncate max-w-[200px]">
                  {email}
                </span>
              </div>
            )}
          </div>
          <MessageRecipients message={message} />
        </div>
        <span className="flex-shrink-0 text-[11px] text-slate-400 dark:text-slate-400">
          {ts}
        </span>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-all dark:hover:bg-slate-800"
            aria-label="Message actions"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <MsgMenu
              onClose={() => setMenuOpen(false)}
              onReply={onReply}
              showDelete={false}
            />
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {message.bodyHtml ? (
          <div
            className={`email-body text-[13px] leading-relaxed text-slate-800 dark:text-slate-200 ${
              hasQuote && !quotedOpen ? "nexidesk-quote-collapsed" : ""
            }`}
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        ) : (
          <div
            className="email-body text-[13px] leading-relaxed text-slate-800 dark:text-slate-200"
            dangerouslySetInnerHTML={{
              __html: linkifyText(message.bodyText ?? "(no body)"),
            }}
          />
        )}
        {hasQuote && (
          <div className="mt-3">
            <button
              onClick={() => setQuotedOpen(!quotedOpen)}
              className="flex items-center gap-1.5 text-[12px] text-slate-400 cursor-pointer group transition-all"
            >
              <span className="flex h-4 w-6 items-center justify-center rounded border border-slate-200 group-hover:border-blue-300 group-hover:text-blue-500 dark:border-slate-700 dark:group-hover:border-blue-500">
                {quotedOpen ? (
                  <ChevronUp size={11} />
                ) : (
                  <span className="text-[9px] font-bold">···</span>
                )}
              </span>
              {quotedOpen ? "Hide quoted text" : "Show quoted text"}
            </button>
          </div>
        )}
      </div>

      {/* Attachments */}
      {(message.attachments?.length ?? 0) > 0 && (
        <div
          className={`flex flex-wrap gap-2 border-t px-5 py-3 ${isOut ? "border-blue-100 dark:border-blue-800/30" : "border-slate-100 dark:border-slate-800"}`}
        >
          {message.attachments!.map((att: AttachmentRef) => (
            <a
              key={att.id}
              href={`/api/attachments/${att.id}/download`}
              download={att.filename}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50 transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <Paperclip size={11} className="flex-shrink-0 text-slate-400" />
              <span className="max-w-[160px] truncate">{att.filename}</span>
              <span className="text-[10px] text-slate-400">
                {formatBytes(att.sizeBytes)}
              </span>
            </a>
          ))}
        </div>
      )}

      {/* Footer — reply action */}
      <div
        className={`flex items-center gap-1 border-t px-5 py-2 transition-opacity ${hovered ? "opacity-100" : "opacity-0"} focus-within:opacity-100 ${
          isOut
            ? "border-blue-100 bg-blue-50/50 dark:border-blue-800/30 dark:bg-blue-900/20"
            : "border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30"
        }`}
      >
        <QAction icon={<Reply size={12} />} label="Reply" onClick={onReply} />
      </div>
    </div>
  );
}

function MessageRecipients({ message }: { message: TicketMessage }) {
  const [expanded, setExpanded] = useState(false);
  const cc = message.ccEmails;
  const bcc = message.bccEmails;
  const to = message.toEmails;
  const hasRecipients =
    (to && to.length > 0) || (cc && cc.length > 0) || (bcc && bcc.length > 0);
  if (!hasRecipients) return null;

  return (
    <div className="mt-0.5">
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors dark:text-slate-400 dark:hover:text-slate-200"
        >
          Show recipients
        </button>
      ) : (
        <div className="space-y-0.5 text-[11px] text-slate-400 dark:text-slate-400">
          {to && to.length > 0 && (
            <div className="flex items-start gap-1">
              <span className="font-medium text-slate-400 dark:text-slate-500 w-6">
                To
              </span>
              <span className="break-all">{to.join(", ")}</span>
            </div>
          )}
          {cc && cc.length > 0 && (
            <div className="flex items-start gap-1">
              <span className="font-medium text-slate-400 dark:text-slate-500 w-6">
                CC
              </span>
              <span className="break-all">{cc.join(", ")}</span>
            </div>
          )}
          {bcc && bcc.length > 0 && (
            <div className="flex items-start gap-1">
              <span className="font-medium text-slate-400 dark:text-slate-500 w-6">
                BCC
              </span>
              <span className="break-all">{bcc.join(", ")}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors dark:text-slate-400 dark:hover:text-slate-200"
          >
            Hide recipients
          </button>
        </div>
      )}
    </div>
  );
}

function NoteCard({
  message,
  onDelete,
}: {
  message: TicketMessage;
  onDelete?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const inits = initialsFromName(message.agentName ?? message.fromEmail ?? "U");
  const ts = formatDate(message.sentAt ?? message.receivedAt);

  return (
    <div
      className="rounded-2xl border overflow-hidden bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-700/50"
      style={{ boxShadow: "0 1px 4px rgba(245,158,11,0.08)" }}
    >
      <div className="flex items-center gap-3 border-b border-amber-100 px-5 py-3 dark:border-amber-700/30">
        <div
          className="h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center text-white text-[12px] font-bold"
          style={{ backgroundColor: "#f59e0b" }}
        >
          {inits}
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
            {message.agentName ?? message.fromEmail}
          </span>
          <div className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            <Lock size={9} />
            INTERNAL NOTE
          </div>
        </div>
        <span className="flex-shrink-0 text-[11px] text-amber-700 dark:text-amber-400">
          {ts}
        </span>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-100 transition-all dark:text-amber-400 dark:hover:bg-amber-900/40"
            aria-label="Note actions"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <MsgMenu
              onClose={() => setMenuOpen(false)}
              onDelete={onDelete}
              showReply={false}
            />
          )}
        </div>
      </div>
      <div className="px-5 py-4">
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-amber-950 dark:text-amber-200">
          {message.bodyText ?? ""}
        </p>
      </div>
      <div className="flex items-center gap-1.5 border-t border-amber-100 bg-amber-50/80 px-5 py-2 dark:border-amber-700/30 dark:bg-amber-950/20">
        <Lock size={11} className="text-amber-600 dark:text-amber-400" />
        <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
          Visible to agents only — not sent to customer
        </span>
      </div>
    </div>
  );
}
