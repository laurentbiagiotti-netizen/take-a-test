\set ON_ERROR_STOP 0
-- Tirage des activités : tous les QCM, des activités au hasard sans dépasser activity_minutes.
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@cybersup.ai','{}');
update profiles set role='admin' where email='admin@cybersup.ai';
insert into tests(id, owner_id, title, is_published, invite_only, require_webcam, duration_minutes, shuffle_questions, room_scan_after, activity_minutes)
 values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','Tirage',true,false,false,90,false,0,20);
insert into questions(test_id,position,type,prompt,points,options,time_limit_s)
 select '11111111-1111-1111-1111-111111111111', g, 'mcq_single', 'Q'||g, 1, '[{"id":"a","text":"a"},{"id":"b","text":"b"}]', null from generate_series(1,10) g;
insert into questions(test_id,position,type,prompt,points,options,time_limit_s) values
 ('11111111-1111-1111-1111-111111111111',20,'sql','S1',2,'{"setup":""}',600),('11111111-1111-1111-1111-111111111111',21,'sql','S2',2,'{"setup":""}',600),
 ('11111111-1111-1111-1111-111111111111',22,'sim','P1',4,'{"kind":"patch"}',420),('11111111-1111-1111-1111-111111111111',23,'feed','F1',4,'{"posts":[]}',480),
 ('11111111-1111-1111-1111-111111111111',24,'tickets','T1',3,'{"tickets":[]}',300),('11111111-1111-1111-1111-111111111111',25,'adsim','A1',4,'{"initial":{}}',480);
insert into answer_keys select id, '["a"]' from questions where type='mcq_single';
do $$
declare i int; v_user uuid; v_att uuid; v_q jsonb; n_qcm int; n_act int; secs int; ok int := 0;
begin
  for i in 1..30 loop
    v_user := gen_random_uuid();
    insert into auth.users values (v_user, 'c'||i||'@t.fr', '{}');
    perform set_config('role', 'service_role', true);
    perform exam_prepare(v_user, '11111111-1111-1111-1111-111111111111');
    select id into v_att from attempts where candidate_id = v_user;
    perform exam_begin(v_user, v_att, repeat('a',64), null, '1', 'UA', repeat(lpad(i::text,2,'0'),32), true);
    perform set_config('role', 'postgres', true);
    select count(*) filter (where q.type = 'mcq_single'), count(*) filter (where q.type <> 'mcq_single'), coalesce(sum(q.time_limit_s) filter (where q.type <> 'mcq_single'), 0)
      into n_qcm, n_act, secs from attempts a join questions q on q.id = any(a.question_order) where a.id = v_att;
    if n_qcm = 10 and n_act >= 2 and secs <= 1200 then ok := ok + 1; end if;
  end loop;
  raise notice 'tirages conformes : %/30', ok;
end $$;
select count(distinct question_order) > 1 as varie from attempts;
