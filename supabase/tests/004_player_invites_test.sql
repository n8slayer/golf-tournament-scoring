-- Checks 004 (player emails, invites, protected claims). Run in SQL Editor AFTER 004.
-- Borrows existing auth.users (u2 must have an email, e.g. a golf-test-…@example.com user).
-- Cleans up its test event.

create temp table if not exists _r4 (n serial, test text, ok boolean);
truncate _r4;

do $$
declare
  u1 uuid; u2 uuid; u3 uuid; u4 uuid;
  e2 text;
  t uuid := '00000000-0000-4000-8000-0000000000cc';
  code text;
  n int;
  ok boolean;
  claims text;
begin
  select id, email into u2, e2 from auth.users where email is not null order by created_at desc limit 1;
  select id into u1 from auth.users where id <> u2 order by created_at limit 1;
  select id into u3 from auth.users where id not in (u1, u2) order by created_at limit 1;
  select id into u4 from auth.users where id not in (u1, u2, u3) order by created_at limit 1;
  if u4 is null or e2 is null then raise exception 'Need 4 users, one with an email'; end if;
  delete from trips where id = t;

  -- Organizer u1 creates an event with three players and invites u2's email as player pA.
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated', 'is_anonymous', false, 'email', 'org@test.dev')::text, true);
  set local role authenticated;
  insert into trips (id, data) values (t, '{"name":"invite test","players":[{"id":"pA","name":"Ann"},{"id":"pB","name":"Bob"},{"id":"pC","name":"Cat"}]}');
  insert into player_emails (trip_id, player_id, email) values (t, 'pA', upper(e2));
  reset role;
  select invite_code into code from trips where id = t;
  insert into _r4 (test, ok) values ('organizer can add a player email', exists (select 1 from player_emails where trip_id = t and player_id = 'pA'));

  -- u2 signs in: invite accepted automatically, linked to pA, no code.
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated', 'is_anonymous', false, 'email', e2)::text, true);
  set local role authenticated;
  perform accept_invites();
  reset role;
  insert into _r4 (test, ok) values ('invited email is auto-linked to their player', exists (select 1 from trip_members where trip_id = t and user_id = u2 and player_id = 'pA'));

  -- u3 joins by code: can't see emails, can't take pA, can take pB.
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated', 'is_anonymous', false, 'email', 'u3@test.dev')::text, true);
  set local role authenticated;
  perform join_trip(code);
  select count(*) into n from player_emails where trip_id = t;
  ok := true;
  begin update trip_members set player_id = 'pA' where trip_id = t and user_id = u3; ok := false; exception when others then null; end;
  begin update trip_members set player_id = 'pB' where trip_id = t and user_id = u3; exception when others then ok := false; end;
  reset role;
  insert into _r4 (test, ok) values ('players cannot see other players'' emails', n = 0);
  insert into _r4 (test, ok) values ('reserved/taken spot refused, free spot claimed', ok and exists (select 1 from trip_members where trip_id = t and user_id = u3 and player_id = 'pB'));

  -- u4 joins: pB is taken (first come), pC is free.
  perform set_config('request.jwt.claims', json_build_object('sub', u4, 'role', 'authenticated', 'is_anonymous', false, 'email', 'u4@test.dev')::text, true);
  set local role authenticated;
  perform join_trip(code);
  ok := true;
  begin update trip_members set player_id = 'pB' where trip_id = t and user_id = u4; ok := false; exception when others then null; end;
  update trip_members set player_id = 'pC' where trip_id = t and user_id = u4;
  select string_agg(player_id || ':' || claimed::text || ':' || reserved::text || ':' || coalesce(masked_email, '-'), ',' order by player_id)
    into claims from player_slots(t);
  reset role;
  insert into _r4 (test, ok) values ('one person per player (taken spot refused)', ok and exists (select 1 from trip_members where trip_id = t and user_id = u4 and player_id = 'pC'));
  insert into _r4 (test, ok) values ('player_slots shows taken/reserved with masked email',
    claims like 'pA:true:true:%•••@%' and claims like '%pB:true:false:-%' and claims like '%pC:true:false:-%');

  -- A player can't unlink others; an organizer can.
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated', 'is_anonymous', false, 'email', e2)::text, true);
  set local role authenticated;
  ok := true;
  begin perform unlink_member(t, u3); ok := false; exception when others then null; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated', 'is_anonymous', false, 'email', 'org@test.dev')::text, true);
  set local role authenticated;
  perform unlink_member(t, u3);
  reset role;
  insert into _r4 (test, ok) values ('only organizers can unlink a player', ok and exists (select 1 from trip_members where trip_id = t and user_id = u3 and player_id is null));

  delete from trips where id = t;
end $$;

select n, test, case when ok then 'PASS' else 'FAIL' end as result from _r4 order by n;
