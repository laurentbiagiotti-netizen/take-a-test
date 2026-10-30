\set ON_ERROR_STOP 0
-- Charge les épreuves d'admission 2026, fait passer le B1 à un candidat qui se trompe
-- sur les questions à plusieurs réponses, et vérifie le score et l'alerte caméra.
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@cybersup.ai','{}'),('00000000-0000-0000-0000-00000000000c','eve@test.fr','{}');
update profiles set role='admin' where email='admin@cybersup.ai';
\i ../../supabase/seed/admission-2026.sql
do $$ begin
  if (select count(*) from questions) <> 155 then raise exception 'seed : % questions au lieu de 155', (select count(*) from questions); end if;
  if exists (select 1 from questions q left join answer_keys k on k.question_id = q.id where k.question_id is null) then raise exception 'seed : question sans clé'; end if;
end $$;
update tests set is_published = true, invite_only = false where title like '%Bachelor 1%';
select id as tid from tests where title like '%Bachelor 1%' \gset
set role service_role;
select exam_prepare('00000000-0000-0000-0000-00000000000c', :'tid') is not null as ok;
select id as att from attempts limit 1 \gset
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1','UA',repeat('1',64)) is not null as ok;
select exam_log_event('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'camera_refused',null,'1','UA') is not null as ok;
reset role;
do $$ declare a attempts; i int; k jsonb; begin
  select * into a from attempts limit 1;
  for i in 1 .. array_length(a.question_order, 1) loop
    select correct into k from answer_keys where question_id = a.question_order[i];
    if jsonb_array_length(k) > 1 then k := k - 0; end if;
    perform exam_save_answer('00000000-0000-0000-0000-00000000000c', a.id, repeat('a',64), a.question_order[i], jsonb_build_object('selected', k), '1', 'UA');
    perform exam_next('00000000-0000-0000-0000-00000000000c', a.id, repeat('a',64), i - 1, '1', 'UA');
  end loop;
end $$;
select exam_submit('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'1','UA') is not null as ok;
do $$ declare a attempts; begin
  select * into a from attempts limit 1;
  if a.score <> 53 or a.max_score <> 55 then raise exception 'score attendu 53/55, obtenu %/%', a.score, a.max_score; end if;
  if a.violation_count <> 0 then raise exception 'la caméra refusée ne doit pas compter comme infraction'; end if;
  if not exists (select 1 from proctor_events where kind = 'camera_refused' and severity = 'warning') then raise exception 'alerte caméra absente'; end if;
end $$;
