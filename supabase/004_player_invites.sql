-- 004: player emails, auto-linking invites, protected player claims. Run AFTER 003. Safe to re-run.
--
-- Organizers add an (optional) email per player. Whoever signs in with that email is
-- automatically a member of the event, linked to that player (accept_invites). A player with
-- an email can only be claimed by that email; others are first come, one person per player.
-- Emails live here, not in trips.data, so players never see each other's addresses.

create table if not exists public.player_emails (
  trip_id uuid not null references public.trips (id) on delete cascade,
  player_id text not null check (length(player_id) between 1 and 64),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  primary key (trip_id, player_id)
);
create unique index if not exists player_emails_trip_email on public.player_emails (trip_id, lower(email));
create index if not exists player_emails_email on public.player_emails (lower(email));

-- The signed-in user's email (lowercase), from their session.
create or replace function public.my_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

alter table public.player_emails enable row level security;

-- Editors (organizer + co-organizers) manage emails; a user can see invites addressed to them.
drop policy if exists player_emails_select on public.player_emails;
create policy player_emails_select on public.player_emails for select to authenticated
  using (public.is_trip_editor(trip_id) or lower(email) = public.my_email());
drop policy if exists player_emails_insert on public.player_emails;
create policy player_emails_insert on public.player_emails for insert to authenticated
  with check (public.is_trip_editor(trip_id));
drop policy if exists player_emails_update on public.player_emails;
create policy player_emails_update on public.player_emails for update to authenticated
  using (public.is_trip_editor(trip_id)) with check (public.is_trip_editor(trip_id));
drop policy if exists player_emails_delete on public.player_emails;
create policy player_emails_delete on public.player_emails for delete to authenticated
  using (public.is_trip_editor(trip_id));
revoke all on public.player_emails from anon;
grant select, insert, update, delete on public.player_emails to authenticated;

-- ---------- One person per player ----------

-- Clear any existing double-claims (keep the earliest) so the unique index can be created.
with ranked as (
  select trip_id, user_id, row_number() over (partition by trip_id, player_id order by joined_at) as rn
  from public.trip_members where player_id is not null
)
update public.trip_members m set player_id = null
from ranked r
where m.trip_id = r.trip_id and m.user_id = r.user_id and r.rn > 1;

create unique index if not exists trip_members_one_per_player
  on public.trip_members (trip_id, player_id) where player_id is not null;

-- A player with an email can only be claimed by that email.
create or replace function public.guard_player_claim() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.player_id is not null and new.player_id is distinct from old.player_id then
    if exists (
      select 1 from player_emails pe
      where pe.trip_id = new.trip_id and pe.player_id = new.player_id
        and lower(pe.email) <> lower(coalesce((select email from auth.users where id = new.user_id), ''))
    ) then
      raise exception 'This spot is reserved for someone else';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trip_members_guard_claim on public.trip_members;
create trigger trip_members_guard_claim before update of player_id on public.trip_members
  for each row execute function public.guard_player_claim();

-- ---------- Functions the app calls ----------

-- On sign-in: join every event that invited my email, linked to my player. Returns the trip ids.
create or replace function public.accept_invites() returns setof uuid
language plpgsql security definer set search_path = public as $$
declare
  r record;
  me text := public.my_email();
begin
  if not public.is_real_user() or me = '' then
    return;
  end if;
  for r in select trip_id, player_id from player_emails where lower(email) = me loop
    begin
      insert into trip_members (trip_id, user_id, player_id) values (r.trip_id, auth.uid(), r.player_id)
        on conflict (trip_id, user_id) do update set player_id = coalesce(trip_members.player_id, excluded.player_id);
    exception when unique_violation then
      -- someone already holds that player: still let me in, unlinked, for the organizer to sort out
      insert into trip_members (trip_id, user_id) values (r.trip_id, auth.uid()) on conflict (trip_id, user_id) do nothing;
    end;
    return next r.trip_id;
  end loop;
end $$;

-- Who holds / is invited to each player (members only). Emails are masked, e.g. n•••@gmail.com.
create or replace function public.player_slots(t uuid)
returns table (player_id text, claimed boolean, claimed_by text, reserved boolean, reserved_for_me boolean, masked_email text)
language sql stable security definer set search_path = public as $$
  select p.id,
         m.user_id is not null,
         coalesce(pr.display_name, case when m.user_id is not null then 'someone' end),
         pe.email is not null,
         coalesce(lower(pe.email) = public.my_email(), false),
         case when pe.email is null then null
              else left(pe.email, 1) || '•••@' || split_part(pe.email, '@', 2) end
  from trips tr
  cross join lateral jsonb_to_recordset(coalesce(tr.data -> 'players', '[]'::jsonb)) as p(id text)
  left join trip_members m on m.trip_id = tr.id and m.player_id = p.id
  left join profiles pr on pr.id = m.user_id
  left join player_emails pe on pe.trip_id = tr.id and pe.player_id = p.id
  where tr.id = t and public.is_trip_member(t);
$$;

-- Organizer / co-organizers: undo someone's player link (e.g. they picked the wrong name).
create or replace function public.unlink_member(t uuid, member uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_trip_editor(t) then
    raise exception 'Only organizers can unlink players';
  end if;
  update trip_members set player_id = null where trip_id = t and user_id = member;
end $$;

revoke all on function public.my_email() from public, anon;
revoke all on function public.accept_invites() from public, anon;
revoke all on function public.player_slots(uuid) from public, anon;
revoke all on function public.unlink_member(uuid, uuid) from public, anon;
grant execute on function public.my_email() to authenticated;
grant execute on function public.accept_invites() to authenticated;
grant execute on function public.player_slots(uuid) to authenticated;
grant execute on function public.unlink_member(uuid, uuid) to authenticated;
