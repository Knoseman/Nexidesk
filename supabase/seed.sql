-- Local dev seed (aligns with RLS test emails in tests/rls/m1.sql).
insert into public.agents (email, name, role, is_active)
values
  ('agent.alice@corp', 'Alice Agent', 'admin', true),
  ('agent.bob@corp', 'Bob Agent', 'agent', true),
  ('agent.disabled@corp', 'Disabled Agent', 'agent', false)
on conflict (email) do nothing;

insert into public.tickets (number, subject_normalized, status, requester_email, assignee_id)
values (
  'TKT-1',
  'welcome open',
  'open',
  'customer@example.com',
  (select id from public.agents where email = 'agent.alice@corp' limit 1)
)
on conflict (number) do nothing;

insert into public.messages (
  ticket_id, direction, message_id, subject, body_text,
  from_email, received_at
)
select t.id,
  'inbound',
  '<seed-msg-001@nexidesk.local>',
  'Welcome',
  'This is seeded mock traffic for Milestone 1.',
  'customer@example.com',
  now()
from public.tickets t
where t.number = 'TKT-1'
  and not exists (
    select 1 from public.messages m
    where m.ticket_id = t.id and m.message_id = '<seed-msg-001@nexidesk.local>'
  );

insert into public.audit_logs (ticket_id, agent_id, action, metadata)
select t.id,
  (select id from public.agents where email = 'agent.alice@corp' limit 1),
  'status_change',
  jsonb_build_object('from', 'open', 'to', 'open', 'note', 'seed')
from public.tickets t
where t.number = 'TKT-1'
  and not exists (
    select 1 from public.audit_logs a
    where a.ticket_id = t.id and a.action = 'status_change'
      and a.metadata->>'note' = 'seed'
  );

insert into public.snippets (title, content, created_by, is_global)
select 'Thanks',
  '<p>Thank you for contacting us.</p>',
  (select id from public.agents where email = 'agent.alice@corp' limit 1),
  true
where not exists (select 1 from public.snippets where title = 'Thanks' and is_global);

insert into public.snippets (title, content, created_by, is_global)
select 'Bob private',
  '<p>Internal note template</p>',
  (select id from public.agents where email = 'agent.bob@corp' limit 1),
  false
where not exists (select 1 from public.snippets where title = 'Bob private' and not is_global);
