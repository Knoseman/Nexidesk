"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  UserPlus,
  Pencil,
  X,
  Check,
  Search,
  Building2,
  Phone,
  Tag,
  Trash2,
} from "lucide-react";
import type { Contact } from "@/lib/schema";

type EditState = {
  name: string;
  phone: string;
  title: string;
  companyName: string;
};

const EMPTY_FORM = {
  email: "",
  name: "",
  phone: "",
  title: "",
  companyName: "",
};

export function ContactsManager() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({
    name: "",
    phone: "",
    title: "",
    companyName: "",
  });
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/contacts?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setContacts(await res.json());
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

  function startEdit(contact: Contact) {
    setEditingId(contact.id);
    setEditState({
      name: contact.name ?? "",
      phone: contact.phone ?? "",
      title: contact.title ?? "",
      companyName: contact.companyName ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editState.name || null,
          phone: editState.phone || null,
          title: editState.title || null,
          companyName: editState.companyName || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          (j as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      const updated: Contact = await res.json();
      setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setEditingId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(contact: Contact) {
    const label = contact.name || contact.email;
    if (
      !confirm(
        `Delete ${label}?\n\nThis removes the contact record. Their tickets will remain but the CRM link will be cleared.`,
      )
    )
      return;
    setDeletingId(contact.id);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert((j as { error?: string }).error ?? "Delete failed");
        return;
      }
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      setEditingId(null);
    } catch {
      alert("Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function createContact() {
    setCreateError(null);
    if (!form.email.trim() || !form.email.includes("@")) {
      setCreateError("Valid email is required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          name: form.name.trim() || null,
          phone: form.phone.trim() || null,
          title: form.title.trim() || null,
          companyName: form.companyName.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          (j as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      const created: Contact = await res.json();
      setContacts((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowCreate(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            id="contact-search"
            type="search"
            placeholder="Search contacts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
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
          <UserPlus size={14} />
          New contact
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/50 dark:bg-blue-950/20">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-slate-100">
            New contact
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div>
              <label
                htmlFor="contact-email"
                className="mb-1 block text-xs text-zinc-500 dark:text-slate-400"
              >
                Email *
              </label>
              <input
                id="contact-email"
                name="email"
                className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="email@example.com"
                autoFocus
              />
            </div>
            <div>
              <label
                htmlFor="contact-name"
                className="mb-1 block text-xs text-zinc-500 dark:text-slate-400"
              >
                Name
              </label>
              <input
                id="contact-name"
                name="name"
                className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Full name"
              />
            </div>
            <div>
              <label
                htmlFor="contact-company"
                className="mb-1 block text-xs text-zinc-500 dark:text-slate-400"
              >
                Company
              </label>
              <input
                id="contact-company"
                name="company"
                className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
                value={form.companyName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, companyName: e.target.value }))
                }
                placeholder="Company"
              />
            </div>
            <div>
              <label
                htmlFor="contact-title"
                className="mb-1 block text-xs text-zinc-500 dark:text-slate-400"
              >
                Title
              </label>
              <input
                id="contact-title"
                name="title"
                className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Job title"
              />
            </div>
            <div>
              <label
                htmlFor="contact-phone"
                className="mb-1 block text-xs text-zinc-500 dark:text-slate-400"
              >
                Phone
              </label>
              <input
                id="contact-phone"
                name="phone"
                className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="+1..."
              />
            </div>
          </div>
          {createError && (
            <p className="mt-2 text-xs text-red-600">{createError}</p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={createContact}
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
        <table className="w-full text-sm" aria-label="Contacts">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-slate-700 dark:bg-slate-800">
              <th
                scope="col"
                className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide dark:text-slate-400"
              >
                Contact
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide dark:text-slate-400"
              >
                Company
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide dark:text-slate-400"
              >
                Details
              </th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-slate-700">
            {loading && contacts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-400 dark:text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-400 dark:text-slate-500">
                  No contacts found
                </td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <tr key={contact.id} className="group">
                  {editingId === contact.id ? (
                    <>
                      <td className="px-4 py-2 align-top">
                        <label
                          htmlFor={`edit-name-${contact.id}`}
                          className="sr-only"
                        >
                          Name
                        </label>
                        <input
                          id={`edit-name-${contact.id}`}
                          className="mb-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-blue-500 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                          value={editState.name}
                          onChange={(e) =>
                            setEditState((s) => ({
                              ...s,
                              name: e.target.value,
                            }))
                          }
                          placeholder="Name"
                        />
                        <div className="text-xs text-zinc-400 px-2 dark:text-slate-500">
                          {contact.email}
                        </div>
                      </td>
                      <td className="px-4 py-2 align-top">
                        <label
                          htmlFor={`edit-company-${contact.id}`}
                          className="sr-only"
                        >
                          Company
                        </label>
                        <input
                          id={`edit-company-${contact.id}`}
                          className="w-full rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-blue-500 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                          value={editState.companyName}
                          onChange={(e) =>
                            setEditState((s) => ({
                              ...s,
                              companyName: e.target.value,
                            }))
                          }
                          placeholder="Company"
                        />
                      </td>
                      <td className="px-4 py-2 align-top">
                        <label
                          htmlFor={`edit-title-${contact.id}`}
                          className="sr-only"
                        >
                          Title
                        </label>
                        <input
                          id={`edit-title-${contact.id}`}
                          className="mb-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-blue-500 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                          value={editState.title}
                          onChange={(e) =>
                            setEditState((s) => ({
                              ...s,
                              title: e.target.value,
                            }))
                          }
                          placeholder="Title"
                        />
                        <label
                          htmlFor={`edit-phone-${contact.id}`}
                          className="sr-only"
                        >
                          Phone
                        </label>
                        <input
                          id={`edit-phone-${contact.id}`}
                          className="w-full rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-blue-500 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                          value={editState.phone}
                          onChange={(e) =>
                            setEditState((s) => ({
                              ...s,
                              phone: e.target.value,
                            }))
                          }
                          placeholder="Phone"
                        />
                      </td>
                      <td className="px-4 py-2 align-top">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => saveEdit(contact.id)}
                              disabled={saving}
                              title="Save"
                              aria-label="Save changes"
                              className="rounded p-1 text-green-600 hover:bg-green-50 transition-colors dark:text-green-400 dark:hover:bg-green-950/30"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              title="Cancel"
                              aria-label="Cancel editing"
                              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 transition-colors dark:hover:bg-slate-700"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={() => deleteContact(contact)}
                              disabled={deletingId === contact.id}
                              title="Delete contact"
                              aria-label={`Delete ${contact.name || contact.email}`}
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
                        <Link
                          href={`/app/contacts/${contact.id}`}
                          className="block group/link"
                        >
                          <div className="font-medium text-zinc-900 group-hover/link:text-blue-600 transition-colors dark:text-slate-200 dark:group-hover/link:text-blue-400">
                            {contact.name || "Unnamed Contact"}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-slate-400">
                            {contact.email}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {contact.companyName ? (
                          <div className="flex items-center gap-1.5 text-zinc-700 dark:text-slate-300">
                            <Building2 size={13} className="text-zinc-400 dark:text-slate-500" />
                            <span>{contact.companyName}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-300 text-xs dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top space-y-1">
                        {contact.title && (
                          <div className="flex items-center gap-1.5 text-zinc-600 dark:text-slate-300">
                            <Tag size={13} className="text-zinc-400 dark:text-slate-500" />
                            <span>{contact.title}</span>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-1.5 text-zinc-600 font-mono text-xs dark:text-slate-300">
                            <Phone size={13} className="text-zinc-400 dark:text-slate-500" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                        {!contact.title && !contact.phone && (
                          <span className="text-zinc-300 text-xs dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex justify-end">
                          <button
                            onClick={() => startEdit(contact)}
                            className="rounded p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 dark:hover:text-slate-200 dark:hover:bg-slate-700"
                            aria-label={`Edit ${contact.name || contact.email}`}
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
