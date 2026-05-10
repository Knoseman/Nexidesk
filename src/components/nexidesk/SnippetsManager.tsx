"use client";

import { useEffect, useState, useRef } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Check,
  X,
  MessageSquareText,
} from "lucide-react";
import type { Snippet } from "@/lib/schema";

type EditState = {
  title: string;
  content: string;
};

const EMPTY_FORM: EditState = {
  title: "",
  content: "",
};

export function SnippetsManager() {
  const [snippetsList, setSnippetsList] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const createTitleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/snippets?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSnippetsList(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(() => {
      void load();
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (showCreate) {
      createTitleRef.current?.focus();
    }
  }, [showCreate]);

  function startEdit(snippet: Snippet) {
    setEditingId(snippet.id);
    setEditState({
      title: snippet.title,
      content: snippet.content,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(EMPTY_FORM);
  }

  async function saveEdit(id: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/snippets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editState.title.trim(),
          content: editState.content,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          (j as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      const updated: Snippet = await res.json();
      setSnippetsList((prev) => prev.map((s) => (s.id === id ? updated : s)));
      setEditingId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function createSnippet() {
    setCreateError(null);
    const title = form.title.trim();
    if (!title) {
      setCreateError("Title is required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content: form.content,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          (j as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      const created: Snippet = await res.json();
      setSnippetsList((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowCreate(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function deleteSnippet(snippet: Snippet) {
    if (
      !confirm(
        `Delete "${snippet.title}"?\n\nThis will permanently remove the snippet.`,
      )
    )
      return;
    setDeletingId(snippet.id);
    try {
      const res = await fetch(`/api/snippets/${snippet.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert((j as { error?: string }).error ?? "Delete failed");
        return;
      }
      setSnippetsList((prev) => prev.filter((s) => s.id !== snippet.id));
      setEditingId(null);
    } catch {
      alert("Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            id="snippet-search"
            type="search"
            placeholder="Search snippets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
            aria-label="Search snippets"
          />
        </div>
        <button
          onClick={() => {
            setShowCreate(true);
            setCreateError(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: "#3b82f6" }}
        >
          <Plus size={14} />
          New snippet
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/50 dark:bg-blue-950/20">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-slate-100">
            New snippet
          </h3>
          <div className="grid gap-3">
            <div>
              <label
                htmlFor="snippet-title"
                className="mb-1 block text-xs text-zinc-500 dark:text-slate-400"
              >
                Title *
              </label>
              <input
                id="snippet-title"
                ref={createTitleRef}
                className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="e.g. Welcome message"
              />
            </div>
            <div>
              <label
                htmlFor="snippet-content"
                className="mb-1 block text-xs text-zinc-500 dark:text-slate-400"
              >
                Content
              </label>
              <textarea
                id="snippet-content"
                rows={4}
                className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white resize-y dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
                placeholder="Paste the snippet text here..."
              />
            </div>
          </div>
          {createError && (
            <p className="mt-2 text-xs text-red-600" role="alert">
              {createError}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={createSnippet}
              disabled={creating}
              className="rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 transition-colors"
              style={{ backgroundColor: "#3b82f6" }}
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setForm(EMPTY_FORM);
                setCreateError(null);
              }}
              className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 transition-colors dark:text-slate-400 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-zinc-200 overflow-hidden bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full text-sm" aria-label="Snippets">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-slate-700 dark:bg-slate-800">
              <th
                scope="col"
                className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide dark:text-slate-400"
              >
                Snippet
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide dark:text-slate-400"
              >
                Preview
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide dark:text-slate-400"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-slate-700">
            {loading && snippetsList.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-zinc-400 dark:text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : snippetsList.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-zinc-400 dark:text-slate-500">
                  No snippets found
                </td>
              </tr>
            ) : (
              snippetsList.map((snippet) => (
                <tr key={snippet.id} className="group">
                  {editingId === snippet.id ? (
                    <>
                      <td className="px-4 py-2 align-top">
                        <label
                          htmlFor={`edit-title-${snippet.id}`}
                          className="sr-only"
                        >
                          Snippet title
                        </label>
                        <input
                          id={`edit-title-${snippet.id}`}
                          className="w-full rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-blue-500 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                          value={editState.title}
                          onChange={(e) =>
                            setEditState((s) => ({
                              ...s,
                              title: e.target.value,
                            }))
                          }
                          placeholder="Title"
                        />
                      </td>
                      <td className="px-4 py-2 align-top" colSpan={1}>
                        <label
                          htmlFor={`edit-content-${snippet.id}`}
                          className="sr-only"
                        >
                          Snippet content
                        </label>
                        <textarea
                          id={`edit-content-${snippet.id}`}
                          rows={3}
                          className="w-full rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-blue-500 bg-white resize-y dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                          value={editState.content}
                          onChange={(e) =>
                            setEditState((s) => ({
                              ...s,
                              content: e.target.value,
                            }))
                          }
                          placeholder="Content"
                        />
                      </td>
                      <td className="px-4 py-2 align-top">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => saveEdit(snippet.id)}
                              disabled={saving}
                              className="rounded p-1 text-green-600 hover:bg-green-50 transition-colors dark:text-green-400 dark:hover:bg-green-950/30"
                              aria-label="Save changes"
                              title="Save"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 transition-colors dark:hover:bg-slate-700"
                              aria-label="Cancel editing"
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={() => deleteSnippet(snippet)}
                              disabled={deletingId === snippet.id}
                              title="Delete snippet"
                              aria-label={`Delete ${snippet.title}`}
                              className="rounded p-1 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/30"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <MessageSquareText
                            size={14}
                            className="text-zinc-400 dark:text-slate-500"
                            aria-hidden="true"
                          />
                          <span className="font-medium text-zinc-900 dark:text-slate-200">
                            {snippet.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-xs text-zinc-500 line-clamp-2 dark:text-slate-400">
                          {snippet.content}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex justify-end">
                          <button
                            onClick={() => startEdit(snippet)}
                            className="rounded p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 dark:hover:text-slate-200 dark:hover:bg-slate-700"
                            aria-label={`Edit ${snippet.title}`}
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
