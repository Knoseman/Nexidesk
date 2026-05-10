"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Mail,
  Lock,
  Bold,
  Italic,
  Link2,
  List,
  Send,
  Save,
  Paperclip,
  X,
  ChevronDown,
  ChevronUp,
  Code,
  MessageSquareText,
} from "lucide-react";
import type { Snippet } from "@/lib/schema";
import type { TicketMessage } from "@/types/ticket";
import { buildQuoteHtml } from "@/lib/build-quote-html";
import { QuoteContainer } from "@/lib/tiptap-quote-container";

type Tab = "reply" | "note";

interface ComposerProps {
  ticketId: number;
  requesterEmail: string;
  subject?: string;
  replyTo?: {
    id: number;
    email: string;
    ccEmails?: string[] | null;
    bccEmails?: string[] | null;
  } | null;
  messages: TicketMessage[];
  onThreadChanged?: () => void;
}

export function Composer({
  ticketId,
  requesterEmail,
  subject,
  replyTo,
  messages,
  onThreadChanged,
}: ComposerProps) {
  const [tab, setTab] = useState<Tab>("reply");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pendingFiles, setPendingFiles] = useState<
    Array<{
      uploadId: number;
      filename: string;
      contentType: string;
      sizeBytes: number;
    }>
  >([]);

  // Track editor state for re-renders
  const quoteSnapshotRef = useRef<string>("");
  const [hasAgentContent, setHasAgentContent] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [subjectText, setSubjectText] = useState(subject ?? "");
  const [ccText, setCcText] = useState("");
  const [bccText, setBccText] = useState("");

  // Snippet picker state
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [showSnippets, setShowSnippets] = useState(false);
  const [activeSnippetId, setActiveSnippetId] = useState<number | null>(null);
  const snippetsPanelRef = useRef<HTMLDivElement>(null);
  const snippetBtnRef = useRef<HTMLButtonElement>(null);

  const isNote = tab === "note";

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({
        placeholder: isNote
          ? "Add an internal note visible only to agents…"
          : "Write a reply…",
      }),
      QuoteContainer,
    ],
    editorProps: {
      attributes: {
        class:
          "px-4 py-3 text-[14px] leading-relaxed text-slate-800 dark:text-slate-200 focus:outline-none",
        role: "textbox",
        "aria-label": isNote ? "Internal note editor" : "Reply editor",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => {
      setHasAgentContent(editor.getHTML() !== quoteSnapshotRef.current);
    },
  });

  const lastReplyToId = useRef<number | null>(null);
  const lastTab = useRef<Tab>(tab);

  const handleResetReplyEditor = useCallback(() => {
    if (!editor) return;
    editor.commands.clearContent();
    const quote = buildQuoteHtml(messages, replyTo?.id ?? null);
    if (quote) {
      // Two empty paragraphs above the quote give the agent a writing area.
      // Use <p><br></p> instead of <p></p> — Tiptap strips truly empty paragraphs on parse.
      editor.commands.insertContent(`<p><br></p><p><br></p>${quote}`);
      editor.commands.focus("start");
      quoteSnapshotRef.current = editor.getHTML();
    } else {
      // No quote inserted — baseline is the editor's empty serialization
      // (Tiptap renders an empty doc as "<p></p>", not ""), so that
      // type-then-delete returns hasAgentContent to false.
      quoteSnapshotRef.current = editor.getHTML();
    }
    setHasAgentContent(false);
  }, [editor, messages, replyTo?.id]);

  const handleResetNoteEditor = useCallback(() => {
    if (!editor) return;
    editor.commands.clearContent();
    quoteSnapshotRef.current = editor.getHTML();
    setHasAgentContent(false);
    editor.commands.focus();
  }, [editor]);

  // Synchronize state when replyTo or tab changes
  useEffect(() => {
    if (!editor) return;

    // Case 1: A new replyTo was requested (e.g. clicking "Reply" on a message)
    if (replyTo && replyTo.id !== lastReplyToId.current) {
      lastReplyToId.current = replyTo.id;
      lastTab.current = "reply";
      setTab("reply");
      setCcText((replyTo.ccEmails ?? []).join(", "));
      setBccText((replyTo.bccEmails ?? []).join(", "));
      setShowMore((replyTo.ccEmails?.length ?? 0) + (replyTo.bccEmails?.length ?? 0) > 0);
      setPendingFiles([]);
      setActiveSnippetId(null);
      handleResetReplyEditor();
      containerRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    // Case 2: Manual tab switch
    if (tab !== lastTab.current) {
      lastTab.current = tab;
      setPendingFiles([]);
      setCcText("");
      setBccText("");
      setSubjectText(subject ?? "");
      setShowMore(false);
      setActiveSnippetId(null);
      if (tab === "reply") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        handleResetReplyEditor();
      } else {
        handleResetNoteEditor();
      }
    }

    // Reset lastReplyToId if replyTo is cleared from upstream
    if (!replyTo && lastReplyToId.current !== null) {
      lastReplyToId.current = null;
    }
  }, [replyTo, tab, editor, subject, handleResetReplyEditor, handleResetNoteEditor]);

  // Initial population on mount — only fires once per Composer instance
  const didInitialPopulate = useRef(false);
  useEffect(() => {
    if (!editor || didInitialPopulate.current) return;
    if (tab !== "reply") return;
    if (messages.length === 0) return;
    didInitialPopulate.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleResetReplyEditor();
  }, [editor, messages, tab, handleResetReplyEditor]);

  // Load snippets when picker opens
  useEffect(() => {
    if (!showSnippets) return;
    async function load() {
      try {
        const res = await fetch("/api/snippets");
        if (res.ok) setSnippets(await res.json());
      } catch {
        /* ignore */
      }
    }
    void load();
  }, [showSnippets]);

  // Close snippet panel on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        snippetsPanelRef.current &&
        !snippetsPanelRef.current.contains(target) &&
        snippetBtnRef.current &&
        !snippetBtnRef.current.contains(target)
      ) {
        setShowSnippets(false);
      }
    }
    if (showSnippets) {
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }
  }, [showSnippets]);

  const canSubmit = (hasAgentContent || pendingFiles.length > 0) && !busy;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setNotice({ kind: "ok", text: "Uploading…" });
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/tickets/${ticketId}/attachments/upload`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      setNotice({ kind: "err", text: "Upload failed" });
      return;
    }
    const data = (await res.json()) as {
      uploadId: number;
      filename: string;
      contentType: string;
      sizeBytes: number;
    };
    setPendingFiles((prev) => [...prev, data]);
    setNotice(null);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setNotice(null);
    try {
      const bodyHtml = editor!.getHTML();
      const bodyText = editor!.getText();
      const parseEmails = (text: string) =>
        text
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

      // If the subject was edited, update the ticket subject first
      const trimmedSubject = subjectText.trim();
      if (
        !isNote &&
        trimmedSubject &&
        trimmedSubject !== (subject ?? "").trim()
      ) {
        await fetch(`/api/tickets/${ticketId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subjectNormalized: trimmedSubject }),
        });
      }

      const res = await fetch(`/api/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: isNote ? "internal_note" : "reply",
          bodyText,
          bodyHtml,
          inReplyToMessageId: !isNote && replyTo ? replyTo.id : undefined,
          attachments:
            pendingFiles.length > 0
              ? pendingFiles.map((f) => ({
                  uploadId: f.uploadId,
                  filename: f.filename,
                }))
              : undefined,
          ccEmails: !isNote && ccText ? parseEmails(ccText) : undefined,
          bccEmails: !isNote && bccText ? parseEmails(bccText) : undefined,
          snippet_id: activeSnippetId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setNotice({ kind: "err", text: data.error || `HTTP ${res.status}` });
        return;
      }
      if (isNote) {
        editor!.commands.clearContent();
        quoteSnapshotRef.current = editor!.getHTML();
        setHasAgentContent(false);
      } else {
        handleResetReplyEditor();
      }
      setPendingFiles([]);
      setCcText("");
      setBccText("");
      setSubjectText(subject ?? "");
      setShowMore(false);
      setActiveSnippetId(null);
      setNotice({
        kind: "ok",
        text: isNote ? "Note saved" : "Reply queued — sending shortly",
      });
      setTimeout(() => setNotice(null), 4000);
      onThreadChanged?.();
    } catch {
      setNotice({ kind: "err", text: "Network error" });
    } finally {
      setBusy(false);
    }
  }

  function handleBold() {
    editor?.chain().focus().toggleBold().run();
  }

  function handleItalic() {
    editor?.chain().focus().toggleItalic().run();
  }

  function handleLink() {
    const url = prompt("Enter URL:");
    if (url) {
      let href = url.trim();
      if (
        !/^https?:\/\//i.test(href) &&
        !href.startsWith("mailto:") &&
        !href.startsWith("tel:")
      ) {
        href = `https://${href}`;
      }
      editor?.chain().focus().toggleLink({ href }).run();
    }
  }

  function handleList() {
    editor?.chain().focus().toggleBulletList().run();
  }

  function handleCodeBlock() {
    if (!editor) return;
    const { empty } = editor.state.selection;
    if (empty) {
      editor.chain().focus().toggleCodeBlock().run();
    } else {
      editor.chain().focus().toggleCode().run();
    }
  }

  function insertSnippet(snippet: Snippet) {
    editor?.chain().focus().insertContent(snippet.content).run();
    setShowSnippets(false);
  }

  const toolbarButtons = [
    {
      icon: <Bold size={13} />,
      title: "Bold",
      onClick: handleBold,
      isActive: editor?.isActive("bold") ?? false,
    },
    {
      icon: <Italic size={13} />,
      title: "Italic",
      onClick: handleItalic,
      isActive: editor?.isActive("italic") ?? false,
    },
    {
      icon: <Link2 size={13} />,
      title: "Link",
      onClick: handleLink,
      isActive: editor?.isActive("link") ?? false,
    },
    {
      icon: <List size={13} />,
      title: "List",
      onClick: handleList,
      isActive: editor?.isActive("bulletList") ?? false,
    },
    {
      icon: <Code size={13} />,
      title: "Code (inline if selection, block if none)",
      onClick: handleCodeBlock,
      isActive:
        (editor?.isActive("code") || editor?.isActive("codeBlock")) ?? false,
    },
  ];

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full border-t rounded-b-none transition-colors ${
        isNote
          ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <div
        className={`flex items-center gap-1 border-b px-4 pt-3 pb-0 ${
          isNote
            ? "border-amber-200 dark:border-amber-900/40"
            : "border-slate-200 dark:border-slate-800"
        }`}
      >
        <TabBtn
          active={tab === "reply"}
          onClick={() => {
            if (tab === "reply") return;
            const hasDraft = hasAgentContent || pendingFiles.length > 0;
            if (
              hasDraft &&
              !confirm(
                "Switching tabs will discard your current draft. Continue?",
              )
            ) {
              return;
            }
            setTab("reply");
          }}
        >
          <Mail size={13} />
          Reply
        </TabBtn>
        <TabBtn
          active={tab === "note"}
          onClick={() => {
            if (tab === "note") return;
            const hasDraft = hasAgentContent || pendingFiles.length > 0;
            if (
              hasDraft &&
              !confirm(
                "Switching tabs will discard your current draft. Continue?",
              )
            ) {
              return;
            }
            setTab("note");
          }}
        >
          <Lock size={13} />
          Internal Note
        </TabBtn>
      </div>

      {!isNote && (
        <div className="border-b border-slate-100 px-4 py-2 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 w-5 dark:text-slate-500">
              To
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[12px] font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400">
              {replyTo?.email || requesterEmail}
            </span>
            <button
              type="button"
              onClick={() => setShowMore((s) => !s)}
              className="ml-2 inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              title={showMore ? "Hide options" : "More options"}
              aria-expanded={showMore}
              aria-label={showMore ? "Hide options" : "More options"}
            >
              More…
              {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
          {showMore && (
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="subject-input"
                  className="text-[11px] font-semibold text-slate-400 w-8 flex-shrink-0 dark:text-slate-500"
                >
                  Subject
                </label>
                <input
                  id="subject-input"
                  type="text"
                  value={subjectText}
                  onChange={(e) => setSubjectText(e.target.value)}
                  placeholder="Email subject…"
                  className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-600 dark:focus:border-blue-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="cc-input"
                  className="text-[11px] font-semibold text-slate-400 w-8 flex-shrink-0 dark:text-slate-500"
                >
                  CC
                </label>
                <input
                  id="cc-input"
                  type="text"
                  value={ccText}
                  onChange={(e) => setCcText(e.target.value)}
                  placeholder="cc@example.com, ..."
                  className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-600 dark:focus:border-blue-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="bcc-input"
                  className="text-[11px] font-semibold text-slate-400 w-8 flex-shrink-0 dark:text-slate-500"
                >
                  BCC
                </label>
                <input
                  id="bcc-input"
                  type="text"
                  value={bccText}
                  onChange={(e) => setBccText(e.target.value)}
                  placeholder="bcc@example.com, ..."
                  className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-600 dark:focus:border-blue-400"
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div
          className={`w-full rounded-xl border bg-white text-[14px] transition-all dark:bg-slate-950 ${
            isNote
              ? "border-amber-200 dark:border-amber-800"
              : "border-slate-200 dark:border-slate-700"
          }`}
          onFocus={() => {
            const el = document.activeElement?.closest(
              ".composer-editor",
            ) as HTMLElement | null;
            if (el) {
              const isDark =
                document.documentElement.classList.contains("dark");
              el.style.borderColor = isNote
                ? isDark
                  ? "#b45309"
                  : "#f59e0b"
                : isDark
                  ? "#3b82f6"
                  : "#93c5fd";
              el.style.boxShadow = isNote
                ? isDark
                  ? "0 0 0 3px rgba(245,158,11,0.15)"
                  : "0 0 0 3px rgba(245,158,11,0.1)"
                : isDark
                  ? "0 0 0 3px rgba(59,130,246,0.12)"
                  : "0 0 0 3px rgba(59,130,246,0.08)";
            }
          }}
        >
          <EditorContent
            editor={editor}
            className={`composer-editor w-full rounded-xl ${busy ? "opacity-60 pointer-events-none" : ""}`}
          />
        </div>
      </div>

      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {pendingFiles.map((f, i) => (
            <span
              key={f.uploadId}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <Paperclip
                size={10}
                className="text-slate-400"
                aria-hidden="true"
              />
              <span className="max-w-[120px] truncate">{f.filename}</span>
              <button
                type="button"
                onClick={() =>
                  setPendingFiles((prev) => prev.filter((_, j) => j !== i))
                }
                className="ml-0.5 text-slate-400 hover:text-slate-600"
                aria-label={`Remove attachment ${f.filename}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-4 pb-3">
        <div className="flex items-center gap-0.5">
          {toolbarButtons.map(({ icon, title, onClick, isActive }) => (
            <button
              key={title}
              type="button"
              title={title}
              onClick={onClick}
              aria-pressed={isActive}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                isActive
                  ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                  : "text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {icon}
            </button>
          ))}

          {/* Snippet picker */}
          <div className="relative">
            <button
              ref={snippetBtnRef}
              type="button"
              title="Insert snippet"
              onClick={() => setShowSnippets((s) => !s)}
              aria-expanded={showSnippets}
              aria-haspopup="listbox"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            >
              <MessageSquareText size={13} />
            </button>
            {showSnippets && (
              <div
                ref={snippetsPanelRef}
                role="listbox"
                aria-label="Snippets"
                className="absolute bottom-full left-0 z-30 mb-1.5 w-64 rounded-xl border border-slate-100 bg-white py-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                style={{
                  boxShadow:
                    "0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.05)",
                }}
              >
                {snippets.length === 0 ? (
                  <div className="px-3 py-2 text-[12px] text-slate-400 dark:text-slate-500">
                    No snippets
                  </div>
                ) : (
                  snippets.map((s) => (
                    <button
                      key={s.id}
                      role="option"
                      aria-selected={activeSnippetId === s.id}
                      onClick={() => insertSnippet(s)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left text-[12px] transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <MessageSquareText
                        size={12}
                        className="mt-0.5 flex-shrink-0 text-slate-400 dark:text-slate-500"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-700 dark:text-slate-200">
                          {s.title}
                        </div>
                        <div className="truncate text-slate-400 dark:text-slate-500">
                          {s.content}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {!isNote && (
            <>
              <input
                id="attachment-input"
                ref={fileInputRef}
                type="file"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => void handleFileChange(e)}
              />
              <button
                type="button"
                title="Attach file"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                aria-label="Attach file"
              >
                <Paperclip size={13} />
              </button>
            </>
          )}
        </div>

        <div className="flex-1" />

        {notice && (
          <span
            className={`text-[12px] font-medium ${notice.kind === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            role="status"
            aria-live="polite"
          >
            {notice.text}
          </span>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[13px] font-semibold text-white transition-all disabled:opacity-40 ${
            isNote
              ? "bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
              : "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500"
          }`}
        >
          {isNote ? <Save size={13} /> : <Send size={13} />}
          {busy ? "…" : isNote ? "Save Note" : "Send Reply"}
        </button>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-[12px] font-semibold transition-all border-b-2 ${
        active
          ? "text-slate-900 border-blue-500 dark:text-slate-100 dark:border-blue-400"
          : "text-slate-400 border-transparent hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
