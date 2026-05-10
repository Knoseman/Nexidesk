import { MessageSquare } from "lucide-react";
import type { TicketMessage } from "@/types/ticket";
import { MessageCard } from "./MessageCard";

interface ConversationThreadProps {
  messages: TicketMessage[];
  onReply?: (message: TicketMessage) => void;
  onDelete?: (messageId: number) => void;
}

export function ConversationThread({
  messages,
  onReply,
  onDelete,
}: ConversationThreadProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <MessageSquare size={22} className="text-slate-400 dark:text-slate-500" />
        </div>
        <div>
          <p className="text-[14px] font-medium text-slate-600 dark:text-slate-400">
            No messages yet
          </p>
          <p className="mt-1 text-[12px] text-slate-400 dark:text-slate-500">
            Messages will appear here once mail is ingested.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      {messages.map((msg) => (
        <MessageCard
          key={msg.id}
          message={msg}
          onReply={onReply ? () => onReply(msg) : undefined}
          onDelete={onDelete ? () => onDelete(msg.id) : undefined}
        />
      ))}
    </div>
  );
}
