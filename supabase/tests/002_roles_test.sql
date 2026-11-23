-- Checks the 002 role rules by acting as three users (borrowed from existing auth.users rows,
-- treated as email accounts for the test). Run in SQL Editor AFTER 002_accounts_roles.sql.
-- Cleans up its test event; the result table disappears when the session ends.
-- Every row should say ok = true.

create temp table if not exists _r (n serial, test text, ok boolean);
truncate _r;

do $$
declare
  u1 uuid; u2 uuid; u3 uuid;
  t uuid := '00000000-0000-4000-8000-0000000000aa';
  n int;
  ok boolean;
  code text;
begin
  select id into u1 from auth.users order by created_at limit 1;
  select id into u2 from auth.users order by created_at offset 1 limit 1;
  select id into u3 from auth.users order by created_at offset 2 limit 1;
  if u3 is null then raise exception 'Need at least 3 users in auth.users'; end if;
  delete from trips where id = t;

  -- Organizer (u1) creates the event.
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  begin
    insert into trips (id, data) values (t, '{"name":"role test"}');
    ok := true;
  exception when others then ok := false;
  end;
  reset role;
  insert into _r (test, ok) values ('email user can create an event', ok);
  select invite_code into code from trips where id = t; -- read as admin: non-members can't see it

  -- An anonymous session cannot create one.
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  set local role authenticated;
  begin
    insert into trips (data) values ('{"name":"anon"}');
    ok := false;
  exception when others then ok := true;
  end;
  begin
    perform join_trip(code);
    ok := ok and false;
  exception when others then null;
  end;
  reset role;
  insert into _r (test, ok) values ('anonymous session cannot create or join', ok);

  -- u2 and u3 join with the invite code (as email users).
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  perform join_trip(code);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  perform join_trip(code);
  reset role;
  insert into _r (test, ok) values ('two email users joined', (select count(*) = 2 from trip_members where trip_id = t));

  -- Player u2: cannot edit the event, cannot promote themselves.
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  update trips set data = '{"name":"hacked"}' where id = t;
  get diagnostics n = row_count;
  begin
    update trip_members set role = 'admin' where trip_id = t and user_id = u2;
    ok := false;
  exception when others then ok := true;
  end;
  begin
    perform set_member_role(t, u2, 'admin');
    ok := false;
  exception when others then null;
  end;
  reset role;
  insert into _r (test, ok) values ('player cannot edit the event', n = 0);
  insert into _r (test, ok) values ('player cannot make themselves co-organizer', ok and (select role = 'player' from trip_members where trip_id = t and user_id = u2));

  -- Player can still enter a score.
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  begin
    insert into scores (trip_id, round_id, player_id, hole_number, strokes) values (t, 'r1', 'p1', 1, 4);
    ok := true;
  exception when others then ok := false;
  end;
  reset role;
  insert into _r (test, ok) values ('player can enter scores', ok);

  -- Organizer makes u2 co-organizer.
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  perform set_member_role(t, u2, 'admin');
  reset role;
  insert into _r (test, ok) values ('organizer can make someone co-organizer', (select role = 'admin' from trip_members where trip_id = t and user_id = u2));

  -- Co-organizer u2: can edit; cannot take over, change invite code, change roles or remove people.
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  update trips set data = '{"name":"edited by co-organizer"}' where id = t;
  get diagnostics n = row_count;
  ok := true;
  begin update trips set organizer_id = u2 where id = t; ok := false; exception when others then null; end;
  begin update trips set invite_code = 'stolen1234' where id = t; ok := false; exception when others then null; end;
  begin perform set_member_role(t, u3, 'admin'); ok := false; exception when others then null; end;
  begin perform remove_member(t, u3); ok := false; exception when others then null; end;
  reset role;
  insert into _r (test, ok) values ('co-organizer can edit the event', n = 1 and (select data ->> 'name' from trips where id = t) = 'edited by co-organizer');
  insert into _r (test, ok) values ('co-organizer cannot take over / change roles / remove people', ok and (select organizer_id = u1 from trips where id = t));
  insert into _r (test, ok) values ('co-organizer edit is stamped with who made it', (select updated_by = u2 from trips where id = t));

  -- Co-organizer cannot delete the event.
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  delete from trips where id = t;
  get diagnostics n = row_count;
  reset role;
  insert into _r (test, ok) values ('co-organizer cannot delete the event', n = 0);

  -- Members see each other in list_members (no emails); names via profiles.
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  select count(*) into n from list_members(t);
  reset role;
  insert into _r (test, ok) values ('members can list the people in the event', n = 3);

  -- Organizer removes u3; u3 can then no longer read the event.
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  perform remove_member(t, u3);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  select count(*) into n from trips where id = t;
  reset role;
  insert into _r (test, ok) values ('removed person loses access', n = 0);

  -- Clean up the test event (scores and members cascade).
  delete from trips where id = t;
end $$;

select n, test, case when ok then 'PASS' else 'FAIL' end as result from _r order by n;
