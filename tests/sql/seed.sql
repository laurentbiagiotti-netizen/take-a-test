\set ON_ERROR_STOP 0
-- Charge les épreuves d'admission 2026, fait passer le B1 à un candidat qui se trompe
-- sur les questions à plusieurs réponses, et vérifie le score et l'alerte caméra.
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@cybersup.ai','{}'),('00000000-0000-0000-0000-00000000000c','eve@test.fr','{}');
update profiles set role='admin' where email='admin@cybersup.ai';
\i ../../supabase/seed/admission-2026.sql
do $$ begin
  if (select count(*) from questions) <> 312 then raise exception 'seed : % questions au lieu de 312', (select count(*) from questions); end if;
  if (select count(*) from question_terminals) <> 2 then raise exception 'seed : missions terminal manquantes'; end if;
  if exists (select 1 from questions q left join answer_keys k on k.question_id = q.id where k.question_id is null and q.type <> 'terminal') then raise exception 'seed : question sans clé'; end if;
end $$;
update tests set is_published = true, invite_only = false where title like '%Bachelor 1%';
select id as tid from tests where title like '%Bachelor 1%' \gset
set role service_role;
reset role;
insert into invites(test_id, email, code, extra_minutes) values (:'tid', 'eve@test.fr', 'CODE-EVE-1', 15);
set role service_role;
select exam_prepare('00000000-0000-0000-0000-00000000000c', :'tid') is not null as ok;
reset role;
update attempts set unlocked = true;
set role service_role;
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
  if array_length(a.question_order, 1) <> 55 then raise exception 'tirage : % questions au lieu de 55', array_length(a.question_order, 1); end if;
  if (select count(distinct variant_group) from questions where id = any(a.question_order)) <> 55 then raise exception 'tirage : deux variantes d''un même groupe'; end if;
  if a.extra_minutes <> 15 or a.deadline_at - a.started_at <> interval '70 minutes' then raise exception 'tiers-temps non appliqué (% min)', a.extra_minutes; end if;
  if (_attempt_report(a.id)->>'passed')::boolean is not true then raise exception 'rapport : candidat à 53/55 non admissible'; end if;
  if jsonb_array_length(_attempt_report(a.id)->'domains') <> 6 then raise exception 'rapport : domaines manquants'; end if;
  if length(_receipt(a.id)->>'reference') <> 12 then raise exception 'accusé de réception absent'; end if;
  if a.violation_count <> 0 then raise exception 'la caméra refusée ne doit pas compter comme infraction'; end if;
  if not exists (select 1 from proctor_events where kind = 'camera_refused' and severity = 'warning') then raise exception 'alerte caméra absente'; end if;
end $$;
-- Outils du personnel : statistiques, suivi en direct, fiche jury
set request.jwt.sub = '00000000-0000-0000-0000-00000000000a';
set request.jwt.claims = '{"aal": "aal2"}';
do $$ declare t uuid; a uuid; s jsonb; begin
  select id into t from tests where title like '%Bachelor 1%';
  select id into a from attempts limit 1;
  s := item_stats(t);
  if (s->>'copies')::int <> 1 or jsonb_array_length(s->'questions') <> 55 then raise exception 'item_stats : %', s; end if;
  s := staff_live(t);
  if jsonb_array_length(s->'attempts') <> 1 then raise exception 'staff_live : %', s; end if;
  if attempt_report(a)->'receipt'->>'reference' is null then raise exception 'attempt_report sans accusé'; end if;
end $$;
set request.jwt.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  perform item_stats((select id from tests limit 1));
  raise exception 'un candidat ne doit pas lire les statistiques';
exception when insufficient_privilege then null;
end $$;
