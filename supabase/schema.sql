-- Golf trip app: shared events. Run once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS).
-- Then run 002_accounts_roles.sql (email accounts + co-organizers), which replaces some rules below.
--
-- Who can do what (enforced by Row Level Security, not by the app):
--   organizer (device that created the event): everything on their event
--   member (joined with the invite link):       read the event, enter/edit scores,
--                                                pick which player they are, add themselves
--   anyone else:                                 nothing

create extension if not exists pgcrypto;

-- ---------- Tables ----------

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The invite link's secret. 10 hex chars = 40 bits; anyone holding it can join.
  invite_code text not null unique default substr(encode(gen_random_bytes(8), 'hex'), 1, 10),
  -- The app's Trip object minus scores (event, players, teams, courses, rounds).
  data jsonb not null check (pg_column_size(data) < 500000),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  player_id text, -- which roster player this device is (null until they pick)
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.scores (
  trip_id uuid not null references public.trips (id) on delete cascade,
  round_id text not null check (length(round_id) between 1 and 64),
  player_id text not null check (length(player_id) between 1 and 64),
  hole_number int not null check (hole_number between 1 and 18),
  strokes int not null check (strokes between 1 and 20),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (trip_id, round_id, player_id, hole_number)
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trips_touch on public.trips;
create trigger trips_touch before update on public.trips
  for each row execute function public.touch_updated_at();

drop trigger if exists scores_touch on public.scores;
create trigger scores_touch before update on public.scores
  for each row execute function public.touch_updated_at();

-- ---------- Membership check (security definer avoids RLS recursion) ----------

create or replace function public.is_trip_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trips where id = t and organizer_id = auth.uid())
      or exists (select 1 from trip_members where trip_id = t and user_id = auth.uid());
$$;

-- ---------- Row Level Security ----------

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.scores enable row level security;

-- trips: members read; only the organizer creates/changes/deletes.
drop policy if exists trips_select on public.trips;
-- organizer_id check first: on INSERT ... RETURNING the new row isn't visible to
-- is_trip_member()'s lookup yet, so the organizer must match on the column directly.
create policy trips_select on public.trips for select to authenticated
  using (organizer_id = auth.uid() or public.is_trip_member(id));
drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips for insert to authenticated
  with check (organizer_id = auth.uid());
drop policy if exists trips_update on public.trips;
create policy trips_update on public.trips for update to authenticated
  using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());
drop policy if exists trips_delete on public.trips;
create policy trips_delete on public.trips for delete to authenticated
  using (organizer_id = auth.uid());

-- trip_members: members see who's in; each device edits/leaves only its own row.
-- (Joining goes through join_trip(), never a direct insert.)
drop policy if exists members_select on public.trip_members;
create policy members_select on public.trip_members for select to authenticated
  using (public.is_trip_member(trip_id));
drop policy if exists members_update on public.trip_members;
create policy members_update on public.trip_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists members_delete on public.trip_members;
create policy members_delete on public.trip_members for delete to authenticated
  using (user_id = auth.uid());

-- scores: any member of the event can read and enter scores.
drop policy if exists scores_all on public.scores;
create policy scores_all on public.scores for all to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

-- Only signed-in devices (anonymous sign-ins count) get table access.
revoke all on public.trips, public.trip_members, public.scores from anon;
grant select, insert, update, delete on public.trips, public.trip_members, public.scores to authenticated;

-- ---------- Functions the app calls ----------

-- Join with an invite code: adds this device as a member, returns the trip id.
create or replace function public.join_trip(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select id into t from trips where invite_code = lower(trim(code));
  if t is null then
    raise exception 'That invite link is not valid';
  end if;
  insert into trip_members (trip_id, user_id) values (t, auth.uid())
    on conflict (trip_id, user_id) do nothing;
  return t;
end $$;

-- "I'm not listed": a member adds themselves to the roster (the only roster write
-- members may make) and is linked to that player. Validated here, not in the app.
create or replace function public.add_self_as_player(t uuid, player_id text, player_name text, handicap_index numeric)
returns void
language plpgsql security definer set search_path = public as $$
begin
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

revoke all on function public.join_trip(text) from public, anon;
revoke all on function public.add_self_as_player(uuid, text, text, numeric) from public, anon;
revoke all on function public.is_trip_member(uuid) from public, anon;
grant execute on function public.join_trip(text) to authenticated;
grant execute on function public.add_self_as_player(uuid, text, text, numeric) to authenticated;
grant execute on function public.is_trip_member(uuid) to authenticated;

-- ---------- Live updates ----------

do $$
begin
  alter publication supabase_realtime add table public.scores;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.trips;
exception when duplicate_object then null;
end $$;
