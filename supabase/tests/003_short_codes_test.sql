-- Checks 003 (short join codes). Run in SQL Editor AFTER 003_short_codes.sql.
-- Borrows three existing auth.users as email accounts; cleans up its test events.

create temp table if not exists _r3 (n serial, test text, ok boolean);
truncate _r3;

do $$
declare
  u1 uuid; u2 uuid; u3 uuid;
  t uuid := '00000000-0000-4000-8000-0000000000bb';
  t_old uuid := '00000000-0000-4000-8000-0000000000bc';
  code text;
  c2 text;
  ok boolean;
begin
  select id into u1 from auth.users order by created_at limit 1;
  select id into u2 from auth.users order by created_at offset 1 limit 1;
  select id into u3 from auth.users order by created_at offset 2 limit 1;
  delete from trips where id in (t, t_old);

  -- New event gets a 6-character code from the safe alphabet.
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  insert into trips (id, data) values (t, '{"name":"code test"}');
  reset role;
  select invite_code into code from trips where id = t;
  insert into _r3 (test, ok) values ('new event gets a 6-character code', code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$');

  -- Typed in lowercase with spaces still joins.
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  begin
    perform join_trip(' ' || lower(substr(code, 1, 3)) || ' ' || lower(substr(code, 4)) || ' ');
    ok := true;
  exception when others then ok := false;
  end;
  reset role;
  insert into _r3 (test, ok) values ('lowercase code with spaces joins', ok and exists (select 1 from trip_members where trip_id = t and user_id = u2));

  -- An old-style 10-character code still works (typed in capitals).
  insert into trips (id, organizer_id, invite_code, data) values (t_old, u1, 'ab12cd34ef', '{"name":"old code"}');
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  begin
    perform join_trip('AB12CD34EF');
    ok := true;
  exception when others then ok := false;
  end;
  reset role;
  insert into _r3 (test, ok) values ('old 10-character code still joins', ok);

  -- Wrong code is refused.
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  begin
    perform join_trip('ZZZZZZ9');
    ok := false;
  exception when others then ok := true;
  end;
  reset role;
  insert into _r3 (test, ok) values ('wrong code is refused', ok);

  -- Only the organizer can regenerate the code.
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  begin
    perform regenerate_code(t);
    ok := false;
  exception when others then ok := true;
  end;
  reset role;
  insert into _r3 (test, ok) values ('player cannot change the code', ok and (select invite_code = code from trips where id = t));

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  select regenerate_code(t) into c2;
  reset role;
  insert into _r3 (test, ok) values ('organizer can get a new code', c2 <> code and c2 ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$');

  delete from trips where id in (t, t_old);
end $$;

select n, test, case when ok then 'PASS' else 'FAIL' end as result from _r3 order by n;
