"use client";

import { useEffect, useState } from "react";
import {
  UserPlus,
  Pencil,
  UserX,
  UserCheck,
  X,
  Check,
  Trash2,
} from "lucide-react";

type Agent = {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: "agent" | "admin";
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
};

type EditState = {
  name: string;
  phone: string;
  role: "agent" | "admin";
};

type AgentForm = {
  name: string;
  email: string;
  phone: string;
  role: "agent" | "admin";
};

const EMPTY_FORM: AgentForm = { name: "", email: "", phone: "", role: "agent" };

interface AgentsManagerProps {
  currentAgentId: number;
}

export function AgentsManager({ currentAgentId }: AgentsManagerProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({
    name: "",
    phone: "",
    role: "agent",
  });
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<AgentForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const url = showDeleted
        ? "/api/admin/agents?includeDeleted=1"
        : "/api/admin/agents";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAgents(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeleted]);

  function startEdit(agent: Agent) {
    setEditingId(agent.id);
    setEditState({
      name: agent.name,
      phone: agent.phone ?? "",
      role: agent.role,
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editState.name,
          phone: editState.phone || null,
          role: editState.role,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          (j as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      const updated: Agent = await res.json();
      setAgents((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setEditingId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(agent: Agent) {
    if (agent.deletedAt) {
      alert("Cannot change status of a deleted agent");
      return;
    }
    const nextActive = !agent.isActive;
    const actionLabel = nextActive ? "Reactivate" : "Deactivate";
    if (!confirm(`${actionLabel} ${agent.name}?`)) return;
    const res = await fetch(`/api/admin/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: nextActive }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "Failed");
      return;
    }
    const updated: Agent = await res.json();
    setAgents((prev) => prev.map((a) => (a.id === agent.id ? updated : a)));
  }

  async function deleteAgent(agent: Agent) {
    if (agent.id === currentAgentId) {
      alert("You cannot delete yourself");
      return;
    }
    if (
      !confirm(
        `Permanently delete ${agent.name}?\n\nTheir tickets and messages will remain, but their personal data will be anonymized. This cannot be undone.`,
      )
    )
      return;
    setDeletingId(agent.id);
    try {
      const res = await fetch(`/api/admin/agents/${agent.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert((j as { error?: string }).error ?? "Failed");
        return;
      }
      if (showDeleted) {
        // Refresh to show the anonymized row
        await load();
      } else {
        setAgents((prev) => prev.filter((a) => a.id !== agent.id));
      }
      setEditingId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function createAgent() {
    setCreateError(null);
    if (!form.name.trim()) {
      setCreateError("Name is required");
      return;
    }
    if (!form.email.trim() || !form.email.includes("@")) {
      setCreateError("Valid email is required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          role: form.role,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          (j as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      const created: Agent = await res.json();
      setAgents((prev) => [...prev, created]);
      setForm(EMPTY_FORM);
      setShowCreate(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500 dark:text-slate-400">Loading…</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-zinc-500 dark:text-slate-400">
            {agents.length} agent{agents.length !== 1 ? "s" : ""}
          </p>
          <label className="flex items-center gap-1.5 text-sm text-zinc-500 cursor-pointer dark:text-slate-400">
            <input
              id="show-deleted"
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
            />
            Show deleted
          </label>
        </div>
        <button
          onClick={() => {
            setShowCreate(true);
            setCreateError(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: "#3b82f6" }}
        >
          <UserPlus size={14} />
          Add agent
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/50 dark:bg-blue-950/20">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-slate-100">
            New agent
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="agent-name"
                className="mb-1 block text-xs text-zinc-500 dark:text-slate-400"
              >
                Name *
              </label>
              <input
                id="agent-name"
                name="name"
                className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Full name"
                autoFocus
              />
            </div>
            <div>
              <label
                htmlFor="agent-email"
                className="mb-1 block text-xs text-zinc-500 dark:text-slate-400"
              >
                Email *
              </label>
              <input
                id="agent-email"
                name="email"
                className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="agent@company.com"
                type="email"
              />
            </div>
            <div>
              <label
                htmlFor="agent-phone"
                className="mb-1 block text-xs text-zinc-500 dark:text-slate-400"
              >
                Phone
              </label>
              <input
                id="agent-phone"
                name="phone"
                className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="+1 555 000 0000"
              />
            </div>
            <div>
              <label
                htmlFor="agent-role"
                className="mb-1 block text-xs text-zinc-500 dark:text-slate-400"
              >
                Role
              </label>
              <select
                id="agent-role"
                name="role"
                className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    role: e.target.value as "agent" | "admin",
                  }))
                }
              >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {createError && (
            <p className="mt-2 text-xs text-red-600">{createError}</p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={createAgent}
              disabled={creating}
              className="rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 transition-colors"
              style={{ backgroundColor: "#3b82f6" }}
            >
              {creating ? "Creating…" : "Create"}
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
      <div className="rounded-lg border border-zinc-200 overflow-hidden dark:border-slate-700">
        <table className="w-full text-sm" aria-label="Agents">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-slate-700 dark:bg-slate-800">
              <th
                scope="col"
                className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide dark:text-slate-400"
              >
                Name
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide dark:text-slate-400"
              >
                Email
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide dark:text-slate-400"
              >
                Phone
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide dark:text-slate-400"
              >
                Role
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide dark:text-slate-400"
              >
                Status
              </th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-slate-700 dark:bg-slate-900">
            {agents.map((agent) => (
              <tr key={agent.id} className={agent.isActive ? "" : "opacity-50"}>
                {editingId === agent.id ? (
                  <>
                    <td className="px-4 py-2">
                      <label
                        htmlFor={`edit-name-${agent.id}`}
                        className="sr-only"
                      >
                        Name
                      </label>
                      <input
                        id={`edit-name-${agent.id}`}
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                        value={editState.name}
                        onChange={(e) =>
                          setEditState((s) => ({ ...s, name: e.target.value }))
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-slate-400">{agent.email}</td>
                    <td className="px-4 py-2">
                      <label
                        htmlFor={`edit-phone-${agent.id}`}
                        className="sr-only"
                      >
                        Phone
                      </label>
                      <input
                        id={`edit-phone-${agent.id}`}
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                        value={editState.phone}
                        onChange={(e) =>
                          setEditState((s) => ({ ...s, phone: e.target.value }))
                        }
                        placeholder="—"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        id={`edit-role-${agent.id}`}
                        className="rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-blue-500 bg-white disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                        value={editState.role}
                        disabled={agent.id === currentAgentId}
                        title={
                          agent.id === currentAgentId
                            ? "You cannot change your own role"
                            : undefined
                        }
                        onChange={(e) =>
                          setEditState((s) => ({
                            ...s,
                            role: e.target.value as "agent" | "admin",
                          }))
                        }
                      >
                        <option value="agent">Agent</option>
                        <option value="admin">Admin</option>
                      </select>
                      {agent.id === currentAgentId && (
                        <span className="ml-1 text-[10px] text-zinc-400 dark:text-slate-500">
                          (self)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => deleteAgent(agent)}
                          disabled={
                            deletingId === agent.id ||
                            agent.id === currentAgentId
                          }
                          title="Delete agent"
                          aria-label={`Delete ${agent.name}`}
                          className="rounded p-1 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => saveEdit(agent.id)}
                          disabled={saving}
                          title="Save"
                          aria-label="Save changes"
                          className="rounded p-1 text-green-600 hover:bg-green-50 transition-colors dark:text-green-400 dark:hover:bg-green-950/30"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          title="Cancel"
                          aria-label="Cancel editing"
                          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 transition-colors dark:hover:bg-slate-700"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-slate-200">
                      {agent.name}
                      {agent.deletedAt && (
                        <span className="ml-1.5 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                          Deleted
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-slate-400">{agent.email}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-slate-400">
                      {agent.phone ?? <span className="text-zinc-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${agent.role === "admin" ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400" : "bg-zinc-100 text-zinc-600 dark:bg-slate-700 dark:text-slate-300"}`}
                      >
                        {agent.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${agent.isActive && !agent.deletedAt ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" : "bg-zinc-100 text-zinc-500 dark:bg-slate-700 dark:text-slate-400"}`}
                      >
                        {agent.deletedAt
                          ? "Deleted"
                          : agent.isActive
                            ? "Active"
                            : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {!agent.deletedAt && (
                          <>
                            <button
                              onClick={() => startEdit(agent)}
                              title="Edit"
                              aria-label={`Edit ${agent.name}`}
                              className="rounded p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors dark:hover:text-slate-200 dark:hover:bg-slate-700"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => toggleActive(agent)}
                              title={
                                agent.isActive ? "Deactivate" : "Reactivate"
                              }
                              aria-label={
                                agent.isActive
                                  ? `Deactivate ${agent.name}`
                                  : `Reactivate ${agent.name}`
                              }
                              className={`rounded p-1 transition-colors ${agent.isActive ? "text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/30" : "text-zinc-400 hover:text-green-600 hover:bg-green-50 dark:hover:text-green-400 dark:hover:bg-green-950/30"}`}
                            >
                              {agent.isActive ? (
                                <UserX size={14} />
                              ) : (
                                <UserCheck size={14} />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
