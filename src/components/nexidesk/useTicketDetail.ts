"use client";

import { useEffect, useState } from "react";
import type { TicketDetailData } from "@/types/ticket";

export function useTicketDetail(
  ticketId: number | null,
  remoteRefreshToken?: number,
) {
  const [detail, setDetail] = useState<TicketDetailData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [resolvedId, setResolvedId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [replyTo, setReplyTo] = useState<{
    id: number;
    email: string;
    ccEmails?: string[] | null;
    bccEmails?: string[] | null;
  } | null>(null);

  async function handleDeleteMessage(messageId: number) {
    if (!confirm("Delete this internal note?")) return;
    try {
      const res = await fetch(
        `/api/tickets/${ticketId}/messages/${messageId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Delete failed");
      setRefreshKey((k) => k + 1);
    } catch {
      alert("Error: could not delete message");
    }
  }

  useEffect(() => {
    if (ticketId === null) return;
    const controller = new AbortController();
    fetch(`/api/tickets/${ticketId}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<TicketDetailData>;
      })
      .then((data) => {
        setDetail(data);
        setFetchError(null);
        setResolvedId(ticketId);
        fetch(`/api/tickets/${ticketId}/read`, { method: "POST" }).catch(
          () => {},
        );
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setFetchError(e.message);
        setResolvedId(ticketId);
      });
    return () => controller.abort();
  }, [ticketId, refreshKey, remoteRefreshToken]);

  const refresh = () => setRefreshKey((k) => k + 1);

  return {
    ticketId,
    detail: ticketId === null ? null : detail,
    loading: ticketId !== null && resolvedId !== ticketId,
    error: ticketId === null ? null : fetchError,
    refreshKey,
    refresh,
    replyTo: ticketId === null ? null : replyTo,
    setReplyTo,
    handleDeleteMessage,
  };
}
