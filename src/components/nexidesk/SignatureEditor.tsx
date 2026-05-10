"use client";

import { useState } from "react";
import { Bold, Italic, Link2 } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

type SaveState = "idle" | "saving" | "saved" | "error";

interface SignatureEditorProps {
  initialSignatureHtml: string | null;
  initialName: string;
}

export function SignatureEditor({
  initialSignatureHtml,
  initialName,
}: SignatureEditorProps) {
  const [name, setName] = useState(initialName);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false }), Link.configure({ openOnClick: false })],
    content: initialSignatureHtml ?? "",
    editorProps: {
      attributes: {
        class:
          "outline-none min-h-[120px] leading-relaxed text-slate-800 text-[14px] px-4 py-3",
        role: "textbox",
        "aria-label": "Signature editor",
        "aria-multiline": "true",
      },
    },
    immediatelyRender: false,
  });

  async function handleSave() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/agents/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureHtml: editor?.getHTML() ?? null,
          name: name.trim() || undefined,
        }),
      });
      setSaveState(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveState("error");
    }
  }

  function handleBold() {
    editor?.chain().focus().toggleBold().run();
  }

  function handleItalic() {
    editor?.chain().focus().toggleItalic().run();
  }

  function handleLink() {
    const url = window.prompt("Enter URL");
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

  const toolbarButtons = [
    {
      icon: <Bold size={13} />,
      title: "Bold",
      action: handleBold,
      isActive: () => editor?.isActive("bold") ?? false,
    },
    {
      icon: <Italic size={13} />,
      title: "Italic",
      action: handleItalic,
      isActive: () => editor?.isActive("italic") ?? false,
    },
    {
      icon: <Link2 size={13} />,
      title: "Link",
      action: handleLink,
      isActive: () => editor?.isActive("link") ?? false,
    },
  ];

  const isSaving = saveState === "saving";

  return (
    <div className="flex flex-col gap-4">
      {/* Display name field */}
      <div>
        <label
          htmlFor="display-name"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-slate-300"
        >
          Display name
        </label>
        <input
          id="display-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:max-w-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
          placeholder="Your name"
        />
      </div>

      {/* Signature editor */}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-slate-300">
          Signature HTML
        </label>
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 [&_.tiptap]:dark:text-slate-200">
          <EditorContent editor={editor} />
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
