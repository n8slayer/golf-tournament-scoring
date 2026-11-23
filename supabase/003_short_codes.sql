-- 003: short join codes people can type (e.g. PNW4KX). Run AFTER 002. Safe to re-run.
-- New events get a 6-character code; joining ignores case and spaces; old 10-character
-- codes keep working, so links already shared don't break.

-- 6 characters from an alphabet without look-alikes (no 0/O, 1/I/L).
-- security definer: the uniqueness check must see every event, not just the caller's (RLS).
create or replace function public.gen_join_code() returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from trips where upper(invite_code) = c);
  end loop;
  return c;
end $$;

alter table public.trips alter column invite_code set default public.gen_join_code();

-- Fast, case-insensitive lookups (and no two events with the same code in any case).
create unique index if not exists trips_invite_code_upper on public.trips (upper(invite_code));

create or replace function public.join_trip(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t uuid;
begin
  if not public.is_real_user() then
    raise exception 'Sign in with your email first';
  end if;
  select id into t from trips where upper(invite_code) = upper(regexp_replace(coalesce(code, ''), '\s', '', 'g'));
  if t is null then
    raise exception 'That invite link is not valid';
  end if;
  insert into trip_members (trip_id, user_id) values (t, auth.uid())
    on conflict (trip_id, user_id) do nothing;
  return t;
end $$;

-- Organizer only: give an existing event a new short code (old links/codes stop working).
create or replace function public.regenerate_code(t uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  c text;
begin
  if not exists (select 1 from trips where id = t and organizer_id = auth.uid()) then
    raise exception 'Only the organizer can change the code';
  end if;
  c := public.gen_join_code();
  update trips set invite_code = c where id = t;
  return c;
end $$;

revoke all on function public.gen_join_code() from public, anon;
revoke all on function public.regenerate_code(uuid) from public, anon;
grant execute on function public.gen_join_code() to authenticated;
grant execute on function public.regenerate_code(uuid) to authenticated;
