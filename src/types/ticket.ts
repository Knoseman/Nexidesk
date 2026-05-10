export type TicketStatus = "new" | "open" | "pending" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketFilter = "my_open" | "unassigned" | "all_open" | "new" | "all";

export type TicketTagView = {
  id: number;
  name: string;
  color: string;
};

export type TicketRow = {
  id: number;
  number: string;
  subjectNormalized: string;
  status: TicketStatus;
  priority: TicketPriority;
  requesterEmail: string;
  requesterId: number | null;
  updatedAt: string;
  lastMessageAt: string | null;
  assigneeId: number | null;
  requesterName: string | null;
  requesterCompanyName: string | null;
  assigneeName: string | null;
  assigneeColorBg: string | null;
  assigneeColorText: string | null;
  isUnread: boolean;
  mergedIntoTicketId?: number | null;
  tags?: TicketTagView[];
};

export type MessageDirection = "inbound" | "outbound" | "note";

export interface AttachmentRef {
  id: number;
  filename: string;
  contentType: string | null;
  sizeBytes: number;
}

export type TicketMessage = {
  id: number;
  ticketId: number;
  direction: MessageDirection;
  kind?: string | null;
  fromEmail: string | null;
  toEmails?: string[] | null;
  ccEmails?: string[] | null;
  bccEmails?: string[] | null;
  bodyText: string | null;
  bodyHtml?: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  agentName: string | null;
  queueStatus?: string | null;
  attachments?: AttachmentRef[];
};

export interface TicketDetailData extends TicketRow {
  createdAt: string;
  closedAt: string | null;
  requesterPhone: string | null;
  requesterTitle: string | null;
  mailboxAddress: string | null;
  mergedIntoTicketNumber?: string | null;
  messages: TicketMessage[];
  tags: TicketTagView[];
}
