-- M1 RLS smoke (run with psql against local or linked Supabase DB).
-- Impersonate JWT claims the way PostgREST does (see backend plan §11.V).
begin;

set local role authenticated;
set local request.jwt.claims to '{"email":"agent.alice@corp","sub":"test-alice","role":"authenticated"}';

do $$
begin
  if (select count(*) from public.tickets) = 0 then
    raise exception 'RLS regression: active agent sees zero tickets';
  end if;
end $$;

do $$
begin
  if (select count(*) from public.snippets where title = 'Bob private') <> 0 then
    raise exception 'RLS regression: alice can see bob personal snippets';
  end if;
end $$;

do $$
begin
  if (select count(*) from public.snippets where is_global and title = 'Thanks') = 0 then
    raise exception 'RLS regression: alice cannot see global snippets';
  end if;
end $$;

set local request.jwt.claims to '{"email":"stranger@nope","sub":"x","role":"authenticated"}';

do $$
begin
  if (select count(*) from public.tickets) <> 0 then
    raise exception 'RLS regression: unknown email leaked tickets';
  end if;
end $$;

set local request.jwt.claims to '{"email":"agent.disabled@corp","sub":"d","role":"authenticated"}';

do $$
begin
  if (select count(*) from public.tickets) <> 0 then
    raise exception 'RLS regression: inactive agent leaked tickets';
  end if;
end $$;

rollback;
