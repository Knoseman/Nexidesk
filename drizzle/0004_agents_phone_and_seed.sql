alter table agents add column if not exists phone text;

insert into agents (email, name, phone, role, is_active)
values
  ('teemu@mail.com',   'Teemu',   '+358 40 712 3456', 'agent', true),
  ('jannick@mail.com', 'Jannick', '+45 60 23 45 67',  'agent', true)
on conflict (email) do nothing;
