-- 002: email accounts + co-organizers. Run AFTER schema.sql (SQL Editor → New query → Run).
-- Safe to re-run.
--
-- Roles:  organizer = trips.organizer_id (everything, incl. roles and deleting the event)
--         co-organizer = trip_members.role 'admin' (edit setup, rounds, players; not roles/delete)
--         player = trip_members.role 'player' (view, score, pick/add themselves)
-- Everyone must have an email account to create, join or score (anonymous sessions can only read).

-- ---------- Columns / tables ----------

alter table public.trip_members add column if not exists role text not null default 'player';
do $$
begin
  alter table public.trip_members add constraint trip_members_role_check check (role in ('admin', 'player'));
exception when duplicate_object then null;
end $$;

alter table public.trips add column if not exists updated_by uuid default auth.uid();

create table if not exists public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 40),
  updated_at timestamptz not null default now()
);

-- ---------- Helpers ----------

-- Signed in with an email account (not an anonymous session).
create or replace function public.is_real_user() returns boolean
language sql stable as $$
  select auth.uid() is not null and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

-- Organizer or co-organizer of the event.
create or replace function public.is_trip_editor(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trips where id = t and organizer_id = auth.uid())
      or exists (select 1 from trip_members where trip_id = t and user_id = auth.uid() and role = 'admin');
$$;

-- True when the caller and `other` are in at least one event together (to see each other's names).
create or replace function public.shares_trip_with(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from trips t
    where (t.organizer_id = auth.uid() or exists (select 1 from trip_members m where m.trip_id = t.id and m.user_id = auth.uid()))
      and (t.organizer_id = other or exists (select 1 from trip_members m2 where m2.trip_id = t.id and m2.user_id = other))
  );
$$;

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_trip_with(id));
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid() and public.is_real_user());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

-- trips: only email accounts create; organizer + co-organizers edit; organizer alone deletes.
drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips for insert to authenticated
  with check (organizer_id = auth.uid() and public.is_real_user());
drop policy if exists trips_update on public.trips;
create policy trips_update on public.trips for update to authenticated
  using (public.is_trip_editor(id)) with check (public.is_trip_editor(id));

-- Co-organizers may edit the event but never take it over or change its invite code.
create or replace function public.guard_trip_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() <> old.organizer_id
     and (new.organizer_id is distinct from old.organizer_id or new.invite_code is distinct from old.invite_code) then
    raise exception 'Only the organizer can change that';
  end if;
  new.updated_by = auth.uid();
  return new;
end $$;
drop trigger if exists trips_guard on public.trips;
create trigger trips_guard before update on public.trips
  for each row execute function public.guard_trip_update();

-- scores: members read; members with an email account write.
drop policy if exists scores_all on public.scores;
drop policy if exists scores_select on public.scores;
create policy scores_select on public.scores for select to authenticated
  using (public.is_trip_member(trip_id));
drop policy if exists scores_write on public.scores;
create policy scores_write on public.scores for insert to authenticated
  with check (public.is_trip_member(trip_id) and public.is_real_user());
drop policy if exists scores_update on public.scores;
create policy scores_update on public.scores for update to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id) and public.is_real_user());
drop policy if exists scores_delete on public.scores;
create policy scores_delete on public.scores for delete to authenticated
  using (public.is_trip_member(trip_id) and public.is_real_user());

-- trip_members: a member may only change which player they are, never their own role.
revoke update on public.trip_members from authenticated;
grant update (player_id) on public.trip_members to authenticated;

-- ---------- Functions ----------

create or replace function public.join_trip(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t uuid;
begin
  if not public.is_real_user() then
    raise exception 'Sign in with your email first';
  end if;
  select id into t from trips where invite_code = lower(trim(code));
  if t is null then
    raise exception 'That invite link is not valid';
  end if;
  insert into trip_members (trip_id, user_id) values (t, auth.uid())
    on conflict (trip_id, user_id) do nothing;
  return t;
end $$;

create or replace function public.add_self_as_player(t uuid, player_id text, player_name text, handicap_index numeric)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_real_user() then
    raise exception 'Sign in with your email first';
  end if;
  if not exists (select 1 from trip_members where trip_id = t and user_id = auth.uid()) then
    raise exception 'Join the event first';
  end if;
  if length(trim(player_name)) not between 1 and 40 then
    raise exception 'Name must be 1-40 characters';
  end if;
  if handicap_index < -10 or handicap_index > 54 then
    raise exception 'Handicap index must be between +10 and 54';
  end if;
  if length(player_id) not between 1 and 64 then
    raise exception 'Bad player id';
  end if;
  update trips
     set data = jsonb_set(
           data, '{players}',
           coalesce(data -> 'players', '[]'::jsonb)
             || jsonb_build_array(jsonb_build_object('id', player_id, 'name', trim(player_name), 'handicapIndex', handicap_index)))
   where id = t;
  update trip_members set player_id = add_self_as_player.player_id
   where trip_id = t and user_id = auth.uid();
end $$;

-- Organizer only: make someone a co-organizer ('admin') or back to 'player'.
create or replace function public.set_member_role(t uuid, member uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from trips where id = t and organizer_id = auth.uid()) then
    raise exception 'Only the organizer can change roles';
  end if;
  if new_role not in ('admin', 'player') then
    raise exception 'Unknown role';
  end if;
  update trip_members set role = new_role where trip_id = t and user_id = member;
  if not found then
    raise exception 'That person is not in this event';
  end if;
end $$;

-- Organizer only: remove someone from the event (their scores stay).
create or replace function public.remove_member(t uuid, member uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from trips where id = t and organizer_id = auth.uid()) then
    raise exception 'Only the organizer can remove people';
  end if;
  if member = auth.uid() then
    raise exception 'The organizer cannot leave their own event';
  end if;
  delete from trip_members where trip_id = t and user_id = member;
end $$;

-- Everyone in the event with their role, linked player and display name (no emails).
create or replace function public.list_members(t uuid)
returns table (user_id uuid, role text, player_id text, display_name text)
language sql stable security definer set search_path = public as $$
  select x.user_id, x.role, x.player_id, p.display_name
  from (
    select tr.organizer_id as user_id, 'owner'::text as role,
           (select m.player_id from trip_members m where m.trip_id = tr.id and m.user_id = tr.organizer_id) as player_id
      from trips tr where tr.id = t
    union all
    select m.user_id, m.role, m.player_id
      from trip_members m join trips tr on tr.id = m.trip_id
     where m.trip_id = t and m.user_id <> tr.organizer_id
  ) x
  left join profiles p on p.id = x.user_id
  where public.is_trip_member(t);
$$;

revoke all on function public.is_real_user() from public, anon;
revoke all on function public.is_trip_editor(uuid) from public, anon;
revoke all on function public.shares_trip_with(uuid) from public, anon;
revoke all on function public.set_member_role(uuid, uuid, text) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
revoke all on function public.list_members(uuid) from public, anon;
grant execute on function public.is_real_user() to authenticated;
grant execute on function public.is_trip_editor(uuid) to authenticated;
grant execute on function public.shares_trip_with(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.list_members(uuid) to authenticated;

-- Role changes reach other devices live.
do $$
begin
  alter publication supabase_realtime add table public.trip_members;
exception when duplicate_object then null;
end $$;
