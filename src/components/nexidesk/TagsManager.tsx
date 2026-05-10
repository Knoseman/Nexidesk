"use client";

import { useEffect, useState, useRef } from "react";
import {
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  Check,
  X,
  Plus,
  GripVertical,
} from "lucide-react";

type Tag = {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
};

const DEFAULT_COLOR = "#6366f1";

export function TagsManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const newNameRef = useRef<HTMLInputElement>(null);

  async function fetchTags() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tags");
      if (!res.ok) throw new Error("Failed to load tags");
      setTags(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading tags");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void fetchTags(), 0);
    return () => clearTimeout(t);
  }, []);

  async function reorder(ordered: Tag[]) {
    setTags(ordered);
    await fetch("/api/tags/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ordered.map((t) => t.id)),
    });
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...tags];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    void reorder(next);
  }

  function moveDown(index: number) {
    if (index === tags.length - 1) return;
    const next = [...tags];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    void reorder(next);
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: number) {
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tags/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: editColor }),
      });
      if (!res.ok) throw new Error("Save failed");
      const updated: Tag = await res.json();
      setTags((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setEditingId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTag(id: number) {
    if (!confirm("Delete this tag? It will be removed from all tickets."))
      return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setTags((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function createTag(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: newColor }),
      });
      if (res.status === 409) {
        setCreateError("A tag with that name already exists.");
        return;
      }
      if (!res.ok) throw new Error("Create failed");
      const created: Tag = await res.json();
      setTags((prev) => [...prev, created]);
      setNewName("");
      setNewColor(DEFAULT_COLOR);
      newNameRef.current?.focus();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-zinc-400 py-8 text-center dark:text-slate-500">
        Loading tags…
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-500 py-8 text-center">{error}</div>;
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Tag list */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden dark:border-slate-700 dark:bg-slate-900">
        {tags.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-slate-500">
            No tags yet. Create one below.
          </div>
        ) : (
          <ul>
            {tags.map((tag, i) => (
              <li
                key={tag.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 last:border-0 group dark:border-slate-700"
              >
                {/* Drag handle (visual only) */}
                <GripVertical
                  size={14}
                  className="text-zinc-300 flex-shrink-0 cursor-grab dark:text-slate-600"
                />

                {editingId === tag.id ? (
                  /* Edit row */
                  <>
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="h-6 w-6 cursor-pointer rounded border border-zinc-200 p-0 flex-shrink-0 dark:border-slate-600"
                      title="Tag color"
                    />
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveEdit(tag.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      autoFocus
                      className="flex-1 rounded border border-zinc-200 px-2 py-1 text-sm text-zinc-800 outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    />
                    <button
                      onClick={() => void saveEdit(tag.id)}
                      disabled={saving}
                      className="flex-shrink-0 rounded p-1 text-indigo-500 hover:bg-indigo-50 disabled:opacity-40 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                      title="Save"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex-shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-slate-700"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  /* Display row */
                  <>
                    <span
                      className="h-4 w-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-sm font-medium text-zinc-800 truncate dark:text-slate-200">
                      {tag.name}
                    </span>

                    {/* Sort buttons */}
                    <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => moveUp(i)}
                        disabled={i === 0}
                        className="rounded p-0.5 text-zinc-400 hover:text-zinc-700 disabled:opacity-20 dark:hover:text-slate-200"
                        title="Move up"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        onClick={() => moveDown(i)}
                        disabled={i === tags.length - 1}
                        className="rounded p-0.5 text-zinc-400 hover:text-zinc-700 disabled:opacity-20 dark:hover:text-slate-200"
                        title="Move down"
                      >
                        <ChevronDown size={13} />
                      </button>
                    </div>

                    <button
                      onClick={() => startEdit(tag)}
                      className="flex-shrink-0 rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity dark:hover:bg-slate-700 dark:hover:text-slate-200"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => void deleteTag(tag.id)}
                      disabled={deletingId === tag.id}
                      className="flex-shrink-0 rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Create form */}
      <div className="rounded-xl border border-zinc-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-slate-500">
          New tag
        </p>
        <form
          onSubmit={(e) => void createTag(e)}
          className="flex items-center gap-3"
        >
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border border-zinc-200 p-0.5 flex-shrink-0 dark:border-slate-600"
            title="Tag color"
          />
          <input
            ref={newNameRef}
            type="text"
            placeholder="Tag name"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setCreateError(null);
            }}
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            <Plus size={14} />
            {creating ? "Adding…" : "Add"}
          </button>
        </form>
        {createError && (
          <p className="mt-2 text-xs text-red-500">{createError}</p>
        )}
      </div>
    </div>
  );
}
