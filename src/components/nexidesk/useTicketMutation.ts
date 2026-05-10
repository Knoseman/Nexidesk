import { useState, useCallback } from "react";

export function useTicketMutation(ticketId: number, onUpdated?: () => void) {
  const [isMutating, setIsMutating] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const mutate = useCallback(
    async (patch: Record<string, unknown>, successLabel?: string) => {
      setIsMutating(true);
      try {
        const res = await fetch(`/api/tickets/${ticketId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error("Failed to update ticket");
        if (successLabel) setToastMsg(successLabel);
        onUpdated?.();
      } catch (err) {
        console.error("[useTicketMutation]", err);
        setToastMsg("Error: Change could not be saved");
        throw err;
      } finally {
        setIsMutating(false);
      }
    },
    [ticketId, onUpdated],
  );

  return { mutate, isMutating, toastMsg, setToastMsg };
}
