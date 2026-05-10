-- M1: Initial schema for Nexidesk fresh start (Railway + Neon Postgres).
-- Derived from supabase/migrations/20260510163000_initial_schema.sql with:
--   - private schema and active_agent_id() function removed (auth via API middleware)
--   - All CREATE POLICY and ALTER TABLE ... ENABLE ROW LEVEL SECURITY removed
--   - graph_subscriptions table removed (IMAP-first; no Graph subscription inbound)
--   - mailbox_actions table removed (folder move is synchronous in IMAP worker)
--   - email_events.source updated: 'imap_poll' replaces power_automate/graph_webhook variants
--   - Supabase-specific GRANT/REVOKE statements removed

create extension if not exists citext;

create table agents (
  id bigint generated always as identity primary key,
  email citext unique not null,
  name text not null,
  role text not null default 'agent' check (role in ('agent', 'admin')),
  is_active boolean not null default true,
  signature_html text,
  created_at timestamptz not null default now()
);

create table tickets (
  id bigint generated always as identity primary key,
  number text unique not null,
  subject_normalized text not null,
  status text not null default 'open' check (status in ('open', 'pending', 'resolved', 'closed')),
  assignee_id bigint references agents (id),
  requester_email citext not null,
  requester_email_hash text,
  anonymised_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  ts_subject tsvector
);

create index tickets_inbox on tickets (status, assignee_id);
create index tickets_requester on tickets (requester_email);
create index tickets_subject_recent on tickets (subject_normalized, created_at desc)
  where status <> 'closed';
create index tickets_fts on tickets using gin (ts_subject);

create table messages (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references tickets (id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound', 'internal_note')),
  message_id text,
  in_reply_to text,
  references_ids text[] not null default '{}',
  graph_message_id text,
  from_email citext,
  to_emails citext[],
  cc_emails citext[],
  subject text,
  body_text text,
  body_html text,
  raw_mime_key text,
  received_at timestamptz,
  sent_at timestamptz,
  agent_id bigint references agents (id),
  anonymised_at timestamptz,
  created_at timestamptz not null default now(),
  ts_body tsvector
);

create unique index messages_message_id_uniq on messages (message_id)
  where message_id is not null;

create index messages_ticket on messages (ticket_id, created_at);
create index messages_in_reply_to on messages (in_reply_to)
  where in_reply_to is not null;
create index messages_references_gin on messages using gin (references_ids);
create index messages_fts on messages using gin (ts_body);

create table attachments (
  id bigint generated always as identity primary key,
  message_id bigint not null references messages (id) on delete cascade,
  filename text not null,
  content_type text,
  size_bytes bigint not null,
  storage_key text not null,
  sha256 bytea not null,
  content_id text,
  created_at timestamptz not null default now()
);

create index attachments_message on attachments (message_id);
create unique index attachments_dedup on attachments (message_id, sha256);

create table email_events (
  id bigint generated always as identity primary key,
  source text not null check (source in (
    'imap_poll', 'outbound_send', 'outbound_reconcile', 'manual'
  )),
  event_type text not null,
  external_id text,
  payload jsonb not null,
  message_id bigint references messages (id),
  ticket_id bigint references tickets (id),
  created_at timestamptz not null default now()
);

create index email_events_recent on email_events (created_at desc);
create unique index email_events_dedupe on email_events (source, external_id)
  where external_id is not null;

create table outbound_queue (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references tickets (id),
  in_reply_to_message_id bigint references messages (id),
  agent_id bigint not null references agents (id),
  body_text text,
  body_html text,
  to_emails citext[] not null,
  cc_emails citext[],
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'dead')),
  attempts int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  graph_draft_id text,
  sent_message_id text,
  idempotency_key uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index outbound_ready on outbound_queue (next_attempt_at)
  where status in ('pending', 'failed');
create index outbound_sending on outbound_queue (status, created_at)
  where status = 'sending';

create table mailbox_config (
  id int primary key default 1 check (id = 1),
  mailbox_user_id text not null,
  mailbox_address citext not null,
  inbox_folder_id text not null,
  ticketed_folder_id text not null,
  ticketed_folder_name text not null default 'Ticketed',
  updated_at timestamptz not null default now()
);

create table snippets (
  id bigint generated always as identity primary key,
  title text not null,
  content text not null,
  created_by bigint references agents (id),
  is_global boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index snippets_global on snippets (is_global, title)
  where is_global;
create index snippets_personal on snippets (created_by, title)
  where not is_global;

create table audit_logs (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references tickets (id) on delete cascade,
  agent_id bigint references agents (id),
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_ticket on audit_logs (ticket_id, created_at desc);
create index audit_logs_action on audit_logs (action, created_at desc);

create table ticket_reads (
  agent_id bigint not null references agents (id) on delete cascade,
  ticket_id bigint not null references tickets (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (agent_id, ticket_id)
);

create index ticket_reads_agent on ticket_reads (agent_id, last_read_at desc);

-- Full-text search triggers
create or replace function tickets_ts_trigger_fn ()
  returns trigger
  language plpgsql
as $$
begin
  new.ts_subject := to_tsvector('english',
    coalesce(new.subject_normalized, '') || ' ' ||
    coalesce(new.number, ''));
  return new;
end;
$$;

create trigger tickets_ts_update
  before insert or update of subject_normalized, number on tickets
  for each row
  execute function tickets_ts_trigger_fn ();

create or replace function messages_ts_trigger_fn ()
  returns trigger
  language plpgsql
as $$
begin
  new.ts_body := to_tsvector('english',
    coalesce(new.subject, '') || ' ' ||
    coalesce(new.body_text, '') || ' ' ||
    regexp_replace(coalesce(new.body_html, ''), '<[^>]+>', ' ', 'g'));
  return new;
end;
$$;

create trigger messages_ts_update
  before insert or update of subject, body_text, body_html on messages
  for each row
  execute function messages_ts_trigger_fn ();
