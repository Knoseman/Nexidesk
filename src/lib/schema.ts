import {
  pgTable,
  bigint,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  uuid,
  index,
  primaryKey,
  customType,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// citext: case-insensitive text — stored as citext in Postgres, treated as string in TS
const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  },
});

// tsvector: full-text index columns maintained by Postgres triggers
const tsvector = customType<{ data: unknown }>({
  dataType() {
    return "tsvector";
  },
});

// bytea: binary data for attachment SHA-256 digests
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const agents = pgTable("agents", {
  id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  email: citext("email").unique().notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("agent"),
  isActive: boolean("is_active").notNull().default(true),
  signatureHtml: text("signature_html"),
  theme: text("theme").notNull().default("auto"),
  labelColorBg: text("label_color_bg"),
  labelColorText: text("label_color_text"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const contacts = pgTable(
  "contacts",
  {
    id: bigint("id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    email: citext("email").unique().notNull(),
    name: text("name"),
    phone: text("phone"),
    title: text("title"),
    companyName: text("company_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("contacts_email").on(t.email),
    index("contacts_company").on(t.companyName),
  ],
);

export const tickets = pgTable(
  "tickets",
  {
    id: bigint("id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    number: text("number").unique().notNull(),
    subjectNormalized: text("subject_normalized").notNull(),
    status: text("status").notNull().default("new"),
    priority: text("priority").notNull().default("normal"),
    assigneeId: bigint("assignee_id", { mode: "number" }).references(
      () => agents.id,
    ),
    requesterId: bigint("requester_id", { mode: "number" }).references(
      () => contacts.id,
    ),
    requesterEmail: citext("requester_email").notNull(),
    requesterEmailHash: text("requester_email_hash"),
    anonymisedAt: timestamp("anonymised_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    mergedIntoTicketId: bigint("merged_into_ticket_id", {
      mode: "number",
    }),
    tsSubject: tsvector("ts_subject"),
  },
  (t) => [
    index("tickets_inbox").on(t.status, t.assigneeId),
    index("tickets_requester").on(t.requesterEmail),
    index("tickets_merged_into").on(t.mergedIntoTicketId),
    foreignKey({
      columns: [t.mergedIntoTicketId],
      foreignColumns: [t.id],
      name: "tickets_merged_into_ticket_id_tickets_id_fk",
    }),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: bigint("id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    ticketId: bigint("ticket_id", { mode: "number" })
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    direction: text("direction").notNull(),
    messageId: text("message_id"),
    inReplyTo: text("in_reply_to"),
    referencesIds: text("references_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    graphMessageId: text("graph_message_id"),
    fromEmail: citext("from_email"),
    toEmails: citext("to_emails").array(),
    ccEmails: citext("cc_emails").array(),
    bccEmails: citext("bcc_emails").array(),
    subject: text("subject"),
    bodyText: text("body_text"),
    bodyHtml: text("body_html"),
    rawMimeKey: text("raw_mime_key"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    agentId: bigint("agent_id", { mode: "number" }).references(() => agents.id),
    kind: text("kind"),
    anonymisedAt: timestamp("anonymised_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    tsBody: tsvector("ts_body"),
  },
  (t) => [
    index("messages_ticket").on(t.ticketId, t.createdAt),
    index("messages_in_reply_to").on(t.inReplyTo),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: bigint("id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    messageId: bigint("message_id", { mode: "number" })
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    contentType: text("content_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    storageKey: text("storage_key").notNull(),
    sha256: bytea("sha256").notNull(),
    contentId: text("content_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("attachments_message").on(t.messageId)],
);

export const attachmentUploads = pgTable("attachment_uploads", {
  id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  agentId: bigint("agent_id", { mode: "number" })
    .notNull()
    .references(() => agents.id),
  storageKey: text("storage_key").notNull(),
  sha256: bytea("sha256").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  consumedByMessageId: bigint("consumed_by_message_id", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const emailEvents = pgTable(
  "email_events",
  {
    id: bigint("id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    source: text("source").notNull(),
    eventType: text("event_type").notNull(),
    externalId: text("external_id"),
    payload: jsonb("payload").notNull(),
    messageId: bigint("message_id", { mode: "number" }).references(
      () => messages.id,
    ),
    ticketId: bigint("ticket_id", { mode: "number" }).references(
      () => tickets.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("email_events_recent").on(t.createdAt)],
);

export const outboundQueue = pgTable(
  "outbound_queue",
  {
    id: bigint("id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    ticketId: bigint("ticket_id", { mode: "number" })
      .notNull()
      .references(() => tickets.id),
    inReplyToMessageId: bigint("in_reply_to_message_id", {
      mode: "number",
    }).references(() => messages.id),
    stagedMessageId: bigint("staged_message_id", { mode: "number" }).references(
      () => messages.id,
    ),
    agentId: bigint("agent_id", { mode: "number" }).references(() => agents.id),
    bodyText: text("body_text"),
    bodyHtml: text("body_html"),
    toEmails: citext("to_emails").array().notNull(),
    ccEmails: citext("cc_emails").array(),
    bccEmails: citext("bcc_emails").array(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    graphDraftId: text("graph_draft_id"),
    sentMessageId: text("sent_message_id"),
    processingStartedAt: timestamp("processing_started_at", {
      withTimezone: true,
    }),
    idempotencyKey: uuid("idempotency_key").notNull().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("outbound_ready").on(t.nextAttemptAt)],
);

export const mailboxConfig = pgTable("mailbox_config", {
  id: integer("id").primaryKey().default(1),
  mailboxUserId: text("mailbox_user_id").notNull(),
  mailboxAddress: citext("mailbox_address").notNull(),
  inboxFolderId: text("inbox_folder_id").notNull(),
  ticketedFolderId: text("ticketed_folder_id").notNull(),
  ticketedFolderName: text("ticketed_folder_name")
    .notNull()
    .default("Ticketed"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const autoresponderConfig = pgTable("autoresponder_config", {
  id: integer("id").primaryKey().default(1),
  enabled: boolean("enabled").notNull().default(false),
  subject: text("subject")
    .notNull()
    .default("Re: [{{ticket.number}}] {{ticket.subject}}"),
  bodyHtml: text("body_html").notNull().default(
    "<p>Thank you for contacting us. Your request has been received and assigned ticket number <strong>{{ticket.number}}</strong>.</p><p>We will get back to you as soon as possible.</p>",
  ),
  bodyText: text("body_text")
    .notNull()
    .default(
      "Thank you for contacting us. Your request has been received and assigned ticket number {{ticket.number}}.\n\nWe will get back to you as soon as possible.",
    ),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: bigint("updated_by", { mode: "number" }).references(
    () => agents.id,
  ),
});

export const snippets = pgTable(
  "snippets",
  {
    id: bigint("id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdBy: bigint("created_by", { mode: "number" }).references(
      () => agents.id,
    ),
    isGlobal: boolean("is_global").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("snippets_global").on(t.isGlobal, t.title),
    index("snippets_personal").on(t.createdBy, t.title),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: bigint("id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    name: text("name").unique().notNull(),
    color: text("color").notNull().default("#6366f1"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("tags_name").on(t.name)],
);

export const ticketTags = pgTable(
  "ticket_tags",
  {
    ticketId: bigint("ticket_id", { mode: "number" })
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    tagId: bigint("tag_id", { mode: "number" })
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.ticketId, t.tagId] })],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigint("id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    ticketId: bigint("ticket_id", { mode: "number" }).notNull(),
    agentId: bigint("agent_id", { mode: "number" }).references(() => agents.id),
    action: text("action").notNull(),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("audit_logs_ticket").on(t.ticketId, t.createdAt)],
);

export const ticketReads = pgTable(
  "ticket_reads",
  {
    agentId: bigint("agent_id", { mode: "number" })
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    ticketId: bigint("ticket_id", { mode: "number" })
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.agentId, t.ticketId] }),
    index("ticket_reads_agent").on(t.agentId, t.lastReadAt),
  ],
);

export type AgentTheme = "light" | "dark" | "auto";
export type Agent = typeof agents.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type OutboundQueueItem = typeof outboundQueue.$inferSelect;
export type Snippet = typeof snippets.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type TicketTag = typeof ticketTags.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type AutoresponderConfig = typeof autoresponderConfig.$inferSelect;
