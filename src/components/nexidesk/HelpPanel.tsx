"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  HelpCircle,
  X,
  BookOpen,
  Search,
  MessageSquare,
  Tag,
  Users,
  FileText,
  Settings,
  Lightbulb,
  ArrowLeft,
} from "lucide-react";

interface GuideLink {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const GUIDES: GuideLink[] = [
  {
    id: "getting-started",
    label: "Getting started",
    description: "Learn the layout and how tickets work",
    icon: <BookOpen size={14} />,
  },
  {
    id: "finding-tickets",
    label: "Finding tickets",
    description: "Filters, search, and unread badges",
    icon: <Search size={14} />,
  },
  {
    id: "working-a-ticket",
    label: "Working on a ticket",
    description: "Status, priority, and the thread",
    icon: <MessageSquare size={14} />,
  },
  {
    id: "writing-replies",
    label: "Writing replies",
    description: "Composer, attachments, and snippets",
    icon: <FileText size={14} />,
  },
  {
    id: "right-rail",
    label: "The sidebar",
    description: "Requester details, tags, and metadata",
    icon: <Tag size={14} />,
  },
  {
    id: "contacts",
    label: "Contacts",
    description: "Managing the contact database",
    icon: <Users size={14} />,
  },
  {
    id: "snippets",
    label: "Snippets",
    description: "Create and use canned responses",
    icon: <FileText size={14} />,
  },
  {
    id: "account",
    label: "Your account",
    description: "Profile, colour, and signature",
    icon: <Settings size={14} />,
  },
  {
    id: "tips-and-troubleshooting",
    label: "Tips & troubleshooting",
    description: "Best practices and quick fixes",
    icon: <Lightbulb size={14} />,
  },
];

export function HelpPanel() {
  const [open, setOpen] = useState(false);
  const [activeGuide, setActiveGuide] = useState<string | null>(null);
  const [guideContent, setGuideContent] = useState<string>("");
  const [guideLoading, setGuideLoading] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (activeGuide) {
          setActiveGuide(null);
        } else {
          setOpen(false);
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, activeGuide]);

  async function loadGuide(id: string) {
    setActiveGuide(id);
    setGuideLoading(true);
    setGuideContent("");
    try {
      const res = await fetch(`/user-guide/${id}.md`);
      if (!res.ok) throw new Error("Failed to load");
      const text = await res.text();
      setGuideContent(text);
    } catch {
      setGuideContent(
        "Sorry, this guide could not be loaded. Please try again later.",
      );
    } finally {
      setGuideLoading(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen((s) => !s)}
        aria-label="Help"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        title="Help"
      >
        <HelpCircle size={18} />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-40">
            {/* Backdrop for guide reader */}
            {activeGuide && (
              <div
                className="absolute inset-0 bg-black/20"
                onClick={() => setActiveGuide(null)}
              />
            )}

            {/* Small overlay (menu) */}
            {!activeGuide && (
              <div
                ref={panelRef}
                className="absolute right-4 top-14 z-50 w-72 rounded-xl border border-slate-100 bg-white py-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                style={{
                  boxShadow:
                    "0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.05)",
                }}
              >
                <div className="flex items-center justify-between px-3 pb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    User Guide
                  </span>
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                    aria-label="Close help"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {GUIDES.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => loadGuide(g.id)}
                      className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <span className="mt-0.5 flex-shrink-0 text-slate-400 dark:text-slate-500">
                        {g.icon}
                      </span>
                      <div>
                        <p className="text-[12px] font-medium text-slate-700 dark:text-slate-300">
                          {g.label}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          {g.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Large overlay (guide reader) */}
            {activeGuide && (
              <div
                ref={panelRef}
                className="absolute right-4 top-14 z-50 flex h-[calc(100vh-5rem)] w-[28rem] flex-col rounded-xl border border-slate-100 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
                style={{
                  boxShadow:
                    "0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.05)",
                }}
              >
                {/* Header */}
                <div className="flex flex-shrink-0 items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                  <button
                    onClick={() => setActiveGuide(null)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                    aria-label="Back to guide list"
                    title="Back"
                  >
                    <ArrowLeft size={15} />
                  </button>
                  <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                    {GUIDES.find((g) => g.id === activeGuide)?.label}
                  </span>
                  <div className="flex-1" />
                  <button
                    onClick={() => {
                      setActiveGuide(null);
                      setOpen(false);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                    aria-label="Close help"
                    title="Close"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {guideLoading ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500 dark:border-slate-700 dark:border-t-blue-400" />
                      <p className="text-[12px] text-slate-400 dark:text-slate-500">
                        Loading guide…
                      </p>
                    </div>
                  ) : (
                    <MarkdownContent source={guideContent} />
                  )}
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function MarkdownContent({ source }: { source: string }) {
  // Very lightweight markdown-to-HTML for the user guide.
  // Supports: headings, paragraphs, bold, italic, links, lists, tables, code blocks, inline code, horizontal rules.
  const html = React.useMemo(() => {
    let text = source;

    // Escape HTML
    text = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Horizontal rules
    text = text.replace(/^---+$/gm, '<hr class="my-4 border-slate-100" />');

    // Code blocks ```...```
    text = text.replace(
      /```([\s\S]*?)```/g,
      (_m, code) =>
        `<pre class="my-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700"><code>${code.trim()}</code></pre>`,
    );

    // Inline code `...`
    text = text.replace(
      /`([^`]+)`/g,
      '<code class="rounded bg-slate-100 px-1 py-0.5 text-[11px] text-slate-700">$1</code>',
    );

    // Headings
    text = text.replace(
      /^#{6}\s+(.+)$/gm,
      '<h6 class="mt-4 mb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">$1</h6>',
    );
    text = text.replace(
      /^#{5}\s+(.+)$/gm,
      '<h5 class="mt-4 mb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">$1</h5>',
    );
    text = text.replace(
      /^#{4}\s+(.+)$/gm,
      '<h4 class="mt-5 mb-2 text-[12px] font-semibold text-slate-700">$1</h4>',
    );
    text = text.replace(
      /^#{3}\s+(.+)$/gm,
      '<h3 class="mt-6 mb-2 text-[13px] font-semibold text-slate-800">$1</h3>',
    );
    text = text.replace(
      /^#{2}\s+(.+)$/gm,
      '<h2 class="mt-7 mb-3 text-[14px] font-bold text-slate-900">$1</h2>',
    );
    text = text.replace(
      /^#{1}\s+(.+)$/gm,
      '<h1 class="mt-8 mb-3 text-[16px] font-bold text-slate-900">$1</h1>',
    );

    // Bold / Italic
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Links [text](url)
    text = text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">$1</a>',
    );

    // Tables (simple pipe tables with header separator)
    text = text.replace(
      /((?:\|[^\n]+\|\n)+)(\|[-:\s|]+\|\n)((?:\|[^\n]+\|\n?)+)/g,
      (_match, headerRow, _sep, bodyRows) => {
        const parseRow = (row: string) =>
          row
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((c) => c.trim());
        const headers = parseRow(headerRow as string);
        const body = (bodyRows as string).trim().split("\n").map(parseRow);
        const ths = headers
          .map(
            (h) =>
              `<th class="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50">${h}</th>`,
          )
          .join("");
        const trs = body
          .map(
            (row) =>
              `<tr class="border-b border-slate-50">${row
                .map(
                  (c) =>
                    `<td class="px-2 py-1.5 text-[11px] text-slate-700">${c}</td>`,
                )
                .join("")}</tr>`,
          )
          .join("");
        return `<div class="my-3 overflow-x-auto rounded-lg border border-slate-100"><table class="w-full text-sm">${ths ? `<thead><tr>${ths}</tr></thead>` : ""}<tbody>${trs}</tbody></table></div>`;
      },
    );

    // Lists
    const processLists = (input: string) => {
      const lines = input.split("\n");
      const out: string[] = [];
      let inUl = false;
      let inOl = false;
      for (const line of lines) {
        const ulMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
        const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
        if (ulMatch) {
          if (!inUl) {
            out.push(
              '<ul class="my-2 list-disc pl-5 text-[12px] text-slate-700">',
            );
            inUl = true;
          }
          out.push(`<li class="mb-0.5">${ulMatch[2]}</li>`);
          continue;
        }
        if (olMatch) {
          if (!inOl) {
            out.push(
              '<ol class="my-2 list-decimal pl-5 text-[12px] text-slate-700">',
            );
            inOl = true;
          }
          out.push(`<li class="mb-0.5">${olMatch[2]}</li>`);
          continue;
        }
        if (inUl) {
          out.push("</ul>");
          inUl = false;
        }
        if (inOl) {
          out.push("</ol>");
          inOl = false;
        }
        out.push(line);
      }
      if (inUl) out.push("</ul>");
      if (inOl) out.push("</ol>");
      return out.join("\n");
    };
    text = processLists(text);

    // Paragraphs: wrap non-empty, non-tag lines
    text = text
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return "";
        if (
          trimmed.startsWith("<") &&
          (trimmed.endsWith(">") || trimmed.includes("</"))
        ) {
          return line;
        }
        return `<p class="my-2 text-[12px] leading-relaxed text-slate-700">${trimmed}</p>`;
      })
      .join("\n");

    return text;
  }, [source]);

  return (
    <div className="help-markdown" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
