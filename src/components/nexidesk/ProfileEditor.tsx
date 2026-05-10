"use client";

import { useState } from "react";
import { brand } from "@/lib/brand";
import {
  Bold,
  Italic,
  Link2,
  Check,
  ChevronDown,
  ChevronUp,
  Monitor,
  Sun,
  Moon,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import type { AgentTheme } from "@/lib/schema";

type SaveState = "idle" | "saving" | "saved" | "error";

interface ProfileEditorProps {
  email: string;
  role: string;
  initialTheme: AgentTheme;
  initialName: string;
  initialPhone: string | null;
  initialSignatureHtml: string | null;
  initialColorBg: string | null;
  initialColorText: string | null;
}

const AGENT_COLORS = [
  { bg: "#e0e7ff", text: "#4338ca", name: "Indigo" },
  { bg: "#fef3c7", text: "#b45309", name: "Amber" },
  { bg: "#d1fae5", text: "#047857", name: "Emerald" },
  { bg: "#e0f2fe", text: "#0369a1", name: "Sky" },
  { bg: "#fce7f3", text: "#be185d", name: "Pink" },
  { bg: "#f3e8ff", text: "#7e22ce", name: "Purple" },
  { bg: "#ffedd5", text: "#c2410c", name: "Orange" },
  { bg: "#dcfce7", text: "#15803d", name: "Green" },
];

const THEME_OPTIONS: { value: AgentTheme; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun size={14} /> },
  { value: "dark", label: "Dark", icon: <Moon size={14} /> },
  { value: "auto", label: "Auto", icon: <Monitor size={14} /> },
];

function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden dark:border-slate-700 dark:bg-slate-900">
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="border-b border-zinc-100 px-5 py-4 dark:border-slate-700/60">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-slate-100">{title}</h2>
      {description && (
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-slate-400">{description}</p>
      )}
    </div>
  );
}

function SaveRow({ state, onSave }: { state: SaveState; onSave: () => void }) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-zinc-100 bg-zinc-50 px-5 py-3 dark:border-slate-700/60 dark:bg-slate-800/50">
      {state === "saved" && (
        <span className="flex items-center gap-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
          <Check size={13} /> Saved
        </span>
      )}
      {state === "error" && (
        <span className="text-[12px] font-medium text-red-600 dark:text-red-400">
          Failed to save
        </span>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={state === "saving"}
        className="rounded-lg bg-blue-500 px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-40"
      >
        {state === "saving" ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

export function ProfileEditor({
  email,
  role,
  initialTheme,
  initialName,
  initialPhone,
  initialSignatureHtml,
  initialColorBg,
  initialColorText,
}: ProfileEditorProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [theme, setTheme] = useState<AgentTheme>(initialTheme);
  const [colorBg, setColorBg] = useState(initialColorBg);
  const [colorText, setColorText] = useState(initialColorText);
  const [profileSave, setProfileSave] = useState<SaveState>("idle");
  const [sigSave, setSigSave] = useState<SaveState>("idle");
  const [themeSave, setThemeSave] = useState<SaveState>("idle");
  const [previewOpen, setPreviewOpen] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false }), Link.configure({ openOnClick: false })],
    content: initialSignatureHtml ?? "",
    editorProps: {
      attributes: {
        class:
          "outline-none min-h-[90px] leading-relaxed text-slate-800 dark:text-slate-200 text-[14px] px-4 py-3",
        role: "textbox",
        "aria-label": "Signature editor",
        "aria-multiline": "true",
      },
    },
    immediatelyRender: false,
  });

  async function saveProfile() {
    setProfileSave("saving");
    try {
      const res = await fetch("/api/agents/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          phone: phone.trim() || null,
          labelColorBg: colorBg,
          labelColorText: colorText,
        }),
      });
      setProfileSave(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setProfileSave("idle"), 3000);
    } catch {
      setProfileSave("error");
    }
  }

  async function saveTheme() {
    setThemeSave("saving");
    try {
      const res = await fetch("/api/agents/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      if (res.ok) {
        // Apply theme immediately without page reload
        const html = document.documentElement;
        if (theme === "dark") {
          html.classList.add("dark");
        } else if (theme === "light") {
          html.classList.remove("dark");
        } else {
          html.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
        }
        setThemeSave("saved");
        setTimeout(() => setThemeSave("idle"), 3000);
      } else {
        setThemeSave("error");
      }
    } catch {
      setThemeSave("error");
    }
  }

  async function saveSignature() {
    setSigSave("saving");
    try {
      const res = await fetch("/api/agents/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureHtml: editor?.getHTML() ?? null }),
      });
      setSigSave(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setSigSave("idle"), 3000);
    } catch {
      setSigSave("error");
    }
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
      },
      isActive: () => editor?.isActive("link") ?? false,
    },
  ];

  const inits = initialsFromName(name || email);
  const roleLabel = role === "admin" ? "Admin" : "Agent";
  const sigHtml = editor?.getHTML() ?? "";

  return (
    <div className="flex flex-col gap-4">
      {/* Identity header */}
      <SectionCard>
        <div className="flex items-center gap-4 px-5 py-5">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-white text-lg font-bold"
            style={{ backgroundColor: "#6366f1" }}
          >
            {inits}
          </div>
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-zinc-900 leading-tight dark:text-slate-100">
              {name || "—"}
            </p>
            <p className="mt-0.5 text-[13px] text-zinc-500 truncate dark:text-slate-400">{email}</p>
          </div>
          <div className="ml-auto flex-shrink-0 flex flex-col items-end gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${role === "admin" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" : "bg-zinc-100 text-zinc-600 dark:bg-slate-700 dark:text-slate-300"}`}
            >
              {roleLabel}
            </span>
            {colorBg && colorText && (
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: colorBg, color: colorText }}
              >
                Label Preview
              </span>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Appearance section */}
      <SectionCard>
        <SectionHeader
          title="Appearance"
          description="Choose how Nexidesk looks for you."
        />
        <div className="px-5 py-4">
          <label className="mb-3 block text-xs font-medium text-zinc-600 dark:text-slate-400">
            Color theme
          </label>
          <div className="flex gap-2">
            {THEME_OPTIONS.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                  theme === value
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] text-zinc-400 italic dark:text-slate-500">
            Auto follows your device or browser setting.
          </p>
        </div>
        <SaveRow state={themeSave} onSave={() => void saveTheme()} />
      </SectionCard>

      {/* Profile section */}
      <SectionCard>
        <SectionHeader
          title="Profile"
          description={`Name and contact details used within ${brand.name}.`}
        />
        <div className="px-5 py-4 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="display-name"
                className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-slate-400"
              >
                Display name
              </label>
              <input
                id="display-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[14px] text-zinc-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-900/30"
                placeholder="Your name"
              />
            </div>
            <div>
              <label
                htmlFor="phone"
                className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-slate-400"
              >
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[14px] text-zinc-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-900/30"
                placeholder="+1 555 000 0000"
              />
            </div>
          </div>

          <div>
            <label className="mb-3 block text-xs font-medium text-zinc-600 dark:text-slate-400">
              Agent Label Color
            </label>
            <div className="flex flex-wrap gap-2">
              {AGENT_COLORS.map((c) => (
                <button
                  key={c.bg}
                  type="button"
                  onClick={() => {
                    setColorBg(c.bg);
                    setColorText(c.text);
                  }}
                  className={`group relative flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all ${
                    colorBg === c.bg
                      ? "border-blue-500 scale-110 shadow-sm"
                      : "border-transparent hover:border-zinc-200 dark:hover:border-slate-600"
                  }`}
                  style={{ backgroundColor: c.bg }}
                  title={c.name}
                >
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: c.text }}
                  >
                    Aa
                  </span>
                  {colorBg === c.bg && (
                    <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-zinc-400 italic dark:text-slate-500">
              This color is used for your name tag in the ticket inbox.
            </p>
          </div>
        </div>
        <SaveRow state={profileSave} onSave={() => void saveProfile()} />
      </SectionCard>

      {/* Signature section */}
      <SectionCard>
        <SectionHeader
          title="Email Signature"
          description="Appended automatically to every outbound reply."
        />

        <div className="flex items-center gap-0.5 border-b border-zinc-100 px-3 py-2 dark:border-slate-700/60">
          {toolbarButtons.map(({ icon, title, action, isActive }) => (
            <button
              key={title}
              type="button"
              title={title}
              onClick={action}
              aria-pressed={isActive()}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                isActive()
                  ? "bg-zinc-200 text-zinc-800 dark:bg-slate-700 dark:text-slate-100"
                  : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {icon}
            </button>
          ))}
        </div>

        <EditorContent editor={editor} />

        <div className="border-t border-zinc-100 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setPreviewOpen(!previewOpen)}
            className="flex w-full items-center justify-between px-5 py-2.5 text-left text-xs font-medium text-zinc-500 hover:bg-zinc-50 transition-colors dark:text-slate-400 dark:hover:bg-slate-800/50"
          >
            <span>Preview in email</span>
            {previewOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {previewOpen && (
            <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-4 dark:border-slate-700/60 dark:bg-slate-800/50">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-slate-500">
                How it appears to the recipient
              </p>
              <div className="rounded-lg border border-zinc-200 bg-white p-4 text-[13px] text-zinc-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                <p className="mb-3 text-zinc-400 italic text-[12px] dark:text-slate-500">
                  On{" "}
                  {new Date().toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  , Customer wrote:
                </p>
                <blockquote className="mb-4 border-l-2 border-zinc-200 pl-3 text-zinc-400 text-[12px] dark:border-slate-700 dark:text-slate-500">
                  Hi, I need help with my request.
                </blockquote>
                <div className="border-t border-zinc-100 pt-3 dark:border-slate-700/60">
                  {sigHtml && sigHtml !== "<p></p>" ? (
                    <div
                      className="prose prose-sm max-w-none text-zinc-700 dark:prose-invert dark:text-slate-300"
                      dangerouslySetInnerHTML={{ __html: sigHtml }}
                    />
                  ) : (
                    <p className="text-zinc-300 italic text-[12px] dark:text-slate-600">
                      No signature set.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <SaveRow state={sigSave} onSave={() => void saveSignature()} />
      </SectionCard>
    </div>
  );
}
