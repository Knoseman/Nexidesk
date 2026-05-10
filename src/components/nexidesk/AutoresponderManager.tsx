"use client";

import { useState, useEffect } from "react";
import { Bold, Italic, Link2 } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

type SaveState = "idle" | "saving" | "saved" | "error";

interface Config {
  enabled: boolean;
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

const VARIABLES = [
  { label: "{{ticket.number}}", title: "Ticket number, e.g. CID-00042" },
  { label: "{{ticket.subject}}", title: "Subject line of the inbound email" },
  { label: "{{requester.name}}", title: "Requester's display name" },
  { label: "{{requester.email}}", title: "Requester's email address" },
];

export function AutoresponderManager() {
  const [config, setConfig] = useState<Config | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [subject, setSubject] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "outline-none min-h-[180px] leading-relaxed text-slate-800 text-[14px] px-4 py-3",
        role: "textbox",
        "aria-label": "Auto-reply body editor",
        "aria-multiline": "true",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    fetch("/api/admin/autoresponse")
      .then((r) => r.json())
      .then((data: Config) => {
        setConfig(data);
        setEnabled(data.enabled);
        setSubject(data.subject);
        editor?.commands.setContent(data.bodyHtml ?? "");
      })
      .catch(console.error);
  }, [editor]);

  async function handleSave() {
    setSaveState("saving");
    const bodyHtml = editor?.getHTML() ?? "";
    const bodyText = editor?.getText() ?? "";
    try {
      const res = await fetch("/api/admin/autoresponse", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, subject, bodyHtml, bodyText }),
      });
      setSaveState(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveState("error");
    }
  }

  function insertVariable(v: string) {
    editor?.chain().focus().insertContent(v).run();
  }

  const toolbarButtons = [
    {
      icon: <Bold size={13} />,
      title: "Bold",
      action: () => editor?.chain().focus().toggleBold().run(),
      isActive: () => editor?.isActive("bold") ?? false,
    },
    {
      icon: <Italic size={13} />,
      title: "Italic",
      action: () => editor?.chain().focus().toggleItalic().run(),
      isActive: () => editor?.isActive("italic") ?? false,
    },
    {
      icon: <Link2 size={13} />,
      title: "Link",
      action: () => {
        const url = window.prompt("Enter URL");
        if (!url) return;
        const href =
          /^https?:\/\//i.test(url) ? url : `https://${url}`;
        editor?.chain().focus().toggleLink({ href }).run();
      },
      isActive: () => editor?.isActive("link") ?? false,
    },
  ];

  const isSaving = saveState === "saving";

  if (!config) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Enable toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            enabled ? "bg-blue-500" : "bg-slate-200 dark:bg-slate-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span className="text-sm font-medium text-zinc-700 dark:text-slate-300">
          {enabled ? "Auto-reply enabled" : "Auto-reply disabled"}
        </span>
      </div>

      {/* Subject */}
      <div>
        <label
          htmlFor="ar-subject"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-slate-300"
        >
          Subject
        </label>
        <input
          id="ar-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
          placeholder="Re: [{{ticket.number}}] {{ticket.subject}}"
        />
      </div>

      {/* Body editor */}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-slate-300">
          Body
        </label>
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 [&_.tiptap]:dark:text-slate-200">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Variables */}
      <div>
        <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-slate-400">
          Insert variable into body
        </p>
        <div className="flex flex-wrap gap-2">
          {VARIABLES.map(({ label, title }) => (
            <button
              key={label}
              type="button"
              title={title}
              onClick={() => insertVariable(label)}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600 hover:bg-slate-100 transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar + Save */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          {toolbarButtons.map(({ icon, title, action, isActive }) => (
            <button
              key={title}
              type="button"
              title={title}
              onClick={action}
              disabled={isSaving}
              aria-pressed={isActive()}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all disabled:opacity-40 ${
                isActive()
                  ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {icon}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {saveState === "saved" && (
          <span className="text-[12px] font-medium text-emerald-600">
            Saved!
          </span>
        )}
        {saveState === "error" && (
          <span className="text-[12px] font-medium text-red-600">
            Failed to save
          </span>
        )}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-1.5 text-[13px] font-semibold text-white transition-all hover:bg-blue-600 disabled:opacity-40"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
