-- M1 foundations: DDL from docs/plans/o365-ticketing-migration-backend.plan.md §5 (minus anonymise / GDPR workers).
create extension if not exists citext with schema extensions;

create schema if not exists private;

-- Gate for RLS: maps Supabase JWT (email claim) to agents.id without recursion on agents policies.
create or replace function private.active_agent_id ()
  returns bigint
  language sql
  stable
  security definer
  set search_path = public
  set row_security = off
as $$
  select a.id
  from public.agents a
  where a.is_active
    and lower(a.email::text) = lower(
      coalesce(
        nullif(trim(auth.jwt() ->> 'email'), ''),
        nullif(trim(auth.jwt()->'user_metadata'->>'email'), '')
      ));
$$;

alter function private.active_agent_id () owner to postgres;

revoke all on function private.active_agent_id () from public;
grant execute on function private.active_agent_id () to authenticated;

create table public.agents (
  id bigint generated always as identity primary key,
  email citext unique not null,
  name text not null,
  role text not null default 'agent' check (role in ('agent', 'admin')),
  is_active boolean not null default true,
  signature_html text,
  created_at timestamptz not null default now()
);

create table public.tickets (
  id bigint generated always as identity primary key,
  number text unique not null,
  subject_normalized text not null,
  status text not null default 'open' check (status in ('open', 'pending', 'resolved', 'closed')),
  assignee_id bigint references public.agents (id),
  requester_email citext not null,
  requester_email_hash text,
  anonymised_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  ts_subject tsvector
);

create index tickets_inbox on public.tickets (status, assignee_id);
create index tickets_requester on public.tickets (requester_email);
create index tickets_subject_recent on public.tickets (subject_normalized, created_at desc)
  where status <> 'closed';
create index tickets_fts on public.tickets using gin (ts_subject);

create table public.messages (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.tickets (id) on delete cascade,
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
  agent_id bigint references public.agents (id),
  anonymised_at timestamptz,
  created_at timestamptz not null default now(),
  ts_body tsvector
);

create unique index messages_message_id_uniq on public.messages (message_id)
  where message_id is not null;

create index messages_ticket on public.messages (ticket_id, created_at);
create index messages_in_reply_to on public.messages (in_reply_to)
  where in_reply_to is not null;
create index messages_references_gin on public.messages using gin (references_ids);
create index messages_fts on public.messages using gin (ts_body);

create table public.attachments (
  id bigint generated always as identity primary key,
  message_id bigint not null references public.messages (id) on delete cascade,
  filename text not null,
  content_type text,
  size_bytes bigint not null,
  storage_key text not null,
  sha256 bytea not null,
  content_id text,
  created_at timestamptz not null default now()
);

create index attachments_message on public.attachments (message_id);
create unique index attachments_dedup on public.attachments (message_id, sha256);

create table public.email_events (
  id bigint generated always as identity primary key,
  source text not null check (source in (
    'power_automate_webhook', 'graph_webhook', 'graph_lifecycle', 'imap_reconcile',
    'outbound_send', 'outbound_reconcile', 'manual'
  )),
  event_type text not null,
  external_id text,
  payload jsonb not null,
  message_id bigint references public.messages (id),
  ticket_id bigint references public.tickets (id),
  created_at timestamptz not null default now()
);

create index email_events_recent on public.email_events (created_at desc);
create unique index email_events_dedupe on public.email_events (source, external_id)
  where external_id is not null;

create table public.outbound_queue (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.tickets (id),
  in_reply_to_message_id bigint references public.messages (id),
  agent_id bigint not null references public.agents (id),
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

create index outbound_ready on public.outbound_queue (next_attempt_at)
  where status in ('pending', 'failed');
create index outbound_sending on public.outbound_queue (status, created_at)
  where status = 'sending';

create table public.graph_subscriptions (
  id bigint generated always as identity primary key,
  subscription_id text unique not null,
  resource text not null,
  expires_at timestamptz not null,
  client_state text not null,
  created_at timestamptz not null default now()
);

create index graph_subs_expiring on public.graph_subscriptions (expires_at);

create table public.mailbox_config (
  id int primary key default 1 check (id = 1),
  mailbox_user_id text not null,
  mailbox_address citext not null,
  inbox_folder_id text not null,
  ticketed_folder_id text not null,
  ticketed_folder_name text not null default 'Ticketed',
  updated_at timestamptz not null default now()
);

create table public.mailbox_actions (
  id bigint generated always as identity primary key,
  message_id bigint references public.messages (id) on delete set null,
  graph_message_id text not null,
  action text not null check (action in ('move_to_processed', 'categorize', 'delete')),
  target_folder_id text,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'dead')),
  attempts int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index mailbox_actions_open_uniq
  on public.mailbox_actions (graph_message_id, action)
  where status in ('pending', 'running', 'failed');
create index mailbox_actions_ready
  on public.mailbox_actions (next_attempt_at)
  where status in ('pending', 'failed');

create table public.snippets (
  id bigint generated always as identity primary key,
  title text not null,
  content text not null,
  created_by bigint references public.agents (id),
  is_global boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index snippets_global on public.snippets (is_global, title)
  where is_global;
create index snippets_personal on public.snippets (created_by, title)
  where not is_global;

create table public.audit_logs (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.tickets (id) on delete cascade,
  agent_id bigint references public.agents (id),
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_ticket on public.audit_logs (ticket_id, created_at desc);
create index audit_logs_action on public.audit_logs (action, created_at desc);

create table public.ticket_reads (
  agent_id bigint not null references public.agents (id) on delete cascade,
  ticket_id bigint not null references public.tickets (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (agent_id, ticket_id)
);

create index ticket_reads_agent on public.ticket_reads (agent_id, last_read_at desc);

-- Full-text search triggers (plan §5)
create or replace function public.tickets_ts_trigger_fn ()
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
  before insert or update of subject_normalized, number on public.tickets
  for each row
  execute function public.tickets_ts_trigger_fn ();

create or replace function public.messages_ts_trigger_fn ()
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
  before insert or update of subject, body_text, body_html on public.messages
  for each row
  execute function public.messages_ts_trigger_fn ();

-- Backfill tsvector columns for any existing rows (no-op on fresh DB)
update public.tickets
set
  ts_subject = to_tsvector('english', coalesce(subject_normalized, '') || ' ' || coalesce(number, ''));

-- RLS
alter table public.agents enable row level security;
alter table public.tickets enable row level security;
alter table public.messages enable row level security;
alter table public.attachments enable row level security;
alter table public.snippets enable row level security;
alter table public.audit_logs enable row level security;
alter table public.ticket_reads enable row level security;
alter table public.email_events enable row level security;
alter table public.outbound_queue enable row level security;
alter table public.graph_subscriptions enable row level security;
alter table public.mailbox_config enable row level security;
alter table public.mailbox_actions enable row level security;

create policy "agents_select_roster"
  on public.agents for select to authenticated
  using (private.active_agent_id () is not null);

create policy "agents_update_self"
  on public.agents for update to authenticated
  using (id = private.active_agent_id ())
  with check (id = private.active_agent_id ());

create policy "tickets_select_agents"
  on public.tickets for select to authenticated
  using (private.active_agent_id () is not null);

create policy "messages_select_agents"
  on public.messages for select to authenticated
  using (
    private.active_agent_id () is not null
    and exists (
      select 1
      from public.tickets t
      where t.id = messages.ticket_id
    )
  );

create policy "attachments_select_agents"
  on public.attachments for select to authenticated
  using (
    private.active_agent_id () is not null
    and exists (
      select 1 from public.messages m
      where m.id = attachments.message_id
    )
  );

create policy "snippets_select_visible"
  on public.snippets for select to authenticated
  using (
    private.active_agent_id () is not null
    and (is_global or created_by = private.active_agent_id ())
  );

create policy "audit_logs_select_ticket_access"
  on public.audit_logs for select to authenticated
  using (
    private.active_agent_id () is not null
    and exists (
      select 1 from public.tickets t
      where t.id = audit_logs.ticket_id
    )
  );

create policy "ticket_reads_self"
  on public.ticket_reads for select to authenticated
  using (agent_id = private.active_agent_id ());

create policy "ticket_reads_self_insert"
  on public.ticket_reads for insert to authenticated
  with check (agent_id = private.active_agent_id ());

create policy "ticket_reads_self_update"
  on public.ticket_reads for update to authenticated
  using (agent_id = private.active_agent_id ())
  with check (agent_id = private.active_agent_id ());

create policy "ticket_reads_self_delete"
  on public.ticket_reads for delete to authenticated
  using (agent_id = private.active_agent_id ());

-- Privileges (RLS still applies)
grant usage on schema public to postgres, anon, authenticated, service_role;
grant usage on schema private to postgres, service_role;

grant all on all tables in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
