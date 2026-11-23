\set ON_ERROR_STOP 1
insert into auth.users(id, email) values ('00000000-0000-0000-0000-00000000c001', 'prof-c@x.fr'), ('00000000-0000-0000-0000-00000000c002', 'cand@x.fr');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000c001';
insert into tests(id, owner_id, title, duration_minutes, is_published, invite_only) values ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-00000000c001', 'Admission', 30, true, true);
insert into invites(test_id, email, code, slot_at) values ('00000000-0000-0000-0000-0000000000c9', 'cand@x.fr', 'AAA-BBB-CCC', now() + interval '2 days');
do $$
declare r jsonb; t tests;
begin
  r := exam_prepare('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000c9');
  if r->>'state' <> 'not_open' then raise exception 'créneau futur : %', r; end if;
  update invites set slot_at = now() - interval '3 hours' where email = 'cand@x.fr';
  r := exam_prepare('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000c9');
  if r->>'state' <> 'closed' then raise exception 'créneau passé : %', r; end if;
  update invites set slot_at = now() - interval '2 minutes' where email = 'cand@x.fr';
  r := exam_prepare('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000c9');
  if r->>'attempt_id' is null then raise exception 'créneau en cours : %', r; end if;
  select * into t from tests where id = '00000000-0000-0000-0000-0000000000c9';
  t := _slot_window(t, '00000000-0000-0000-0000-00000000c002');
  if abs(extract(epoch from (t.closes_at - now())) - 43 * 60) > 5 then raise exception 'fin de créneau : %', t.closes_at; end if;
  update invites set slot_at = null where email = 'cand@x.fr';
  select * into t from tests where id = '00000000-0000-0000-0000-0000000000c9';
  t := _slot_window(t, '00000000-0000-0000-0000-00000000c002');
  if t.opens_at is not null or t.closes_at is not null then raise exception 'sans créneau'; end if;
  -- épreuve à créneaux : sans créneau, pas d'accès
  update tests set agenda_keyword = 'B3 Cyber' where id = '00000000-0000-0000-0000-0000000000c9';
  select * into t from tests where id = '00000000-0000-0000-0000-0000000000c9';
  t := _slot_window(t, '00000000-0000-0000-0000-00000000c002');
  if t.opens_at <> 'infinity' then raise exception 'accès ouvert sans créneau'; end if;
  delete from attempts where test_id = t.id;
  r := exam_prepare('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000c9');
  if r->>'state' <> 'not_open' then raise exception 'sans créneau : %', r; end if;
end $$;
