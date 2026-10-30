\set ON_ERROR_STOP 0
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@cybersup.ai','{}'),('00000000-0000-0000-0000-00000000000c','eve@test.fr','{}'),('00000000-0000-0000-0000-00000000000d','bob@test.fr','{}');
update profiles set role='admin' where email='admin@cybersup.ai';
insert into tests(id, owner_id, title, is_published, invite_only, max_violations, shuffle_questions) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','QCM B1',true,true,3, false);
insert into test_secrets(test_id, access_code) values ('11111111-1111-1111-1111-111111111111','GLOBAL-CODE');
insert into questions(id,test_id,position,type,prompt,options,points) values
 ('22222222-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',0,'mcq_single','Q1','[{"id":"a","text":"A"},{"id":"b","text":"B"}]',2),
 ('22222222-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',1,'mcq_multi','Q2','[{"id":"x","text":"X"},{"id":"y","text":"Y"},{"id":"z","text":"Z"}]',3),
 ('22222222-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111',2,'long_text','Q3',null,5);
insert into answer_keys values ('22222222-0000-0000-0000-000000000001','["a"]'),('22222222-0000-0000-0000-000000000002','["x","z"]');
insert into invites(test_id,email,code) values ('11111111-1111-1111-1111-111111111111','eve@test.fr','EVE1-CODE');

\echo '=== ATTAQUES CANDIDAT (eve) : chaque ligne doit echouer ou renvoyer 0'
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000c';
update profiles set role='admin' where id=auth.uid();
select 'tests visibles', count(*) from tests;
select 'questions visibles', count(*) from questions;
select 'secrets visibles', count(*) from test_secrets;
select 'cles visibles', count(*) from answer_keys;
select 'invites visibles', count(*) from invites;
insert into attempts(test_id,candidate_id,unlocked) values ('11111111-1111-1111-1111-111111111111',auth.uid(),true);
select exam_prepare(auth.uid(),'11111111-1111-1111-1111-111111111111');
select * from my_dashboard();
reset role;
select 'role eve apres attaque', role from profiles where email='eve@test.fr';

\echo '=== anon'
set role anon; reset request.jwt.sub;
select count(*) from tests;
select * from my_dashboard();
reset role;

\echo '=== bob non invite'
set role service_role;
select exam_prepare('00000000-0000-0000-0000-00000000000d','11111111-1111-1111-1111-111111111111');

\echo '=== parcours eve'
select exam_prepare('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111') ->> 'unlocked' as unlocked_avant_code;
select exam_unlock('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111','GLOBAL-CODE','1.1.1.1') as code_global_refuse_si_invite;
select exam_unlock('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111','nope','1.1.1.1');
select exam_unlock('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111','nope','1.1.1.1');
select exam_unlock('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111','nope','1.1.1.1');
select exam_unlock('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111','nope','1.1.1.1');
select exam_unlock('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111','eve1-code','1.1.1.1') as doit_etre_bloque_rate_limit;
reset role;
alter table proctor_events disable trigger proctor_events_no_update; delete from proctor_events where kind='unlock_failed'; alter table proctor_events enable trigger proctor_events_no_update;
set role service_role;
select exam_unlock('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111',' eve1-code ','1.1.1.1') as bon_code;
select id as att from attempts where candidate_id='00000000-0000-0000-0000-00000000000c' \gset
select jsonb_array_length(exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1.1.1.1','UA1',repeat('n',64))->'questions') as nb_questions;
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('b',64),null,'2.2.2.2','UA2',repeat('n',64)) as autre_appareil_doit_etre_bloque;
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('b',64),'22222222-0000-0000-0000-000000000001','{"selected":["a"]}','1.1.1.1','UA1') as mauvais_jeton;
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'22222222-0000-0000-0000-000000000001','{"selected":["a","b"]}','1.1.1.1','UA1') as single_2_choix;
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'22222222-0000-0000-0000-000000000001','{"selected":["zz"]}','1.1.1.1','UA1') as option_inconnue;
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'22222222-0000-0000-0000-000000000001','{"selected":["a"],"score":99}','1.1.1.1','UA1') as ok1;
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'22222222-0000-0000-0000-000000000002','{"selected":["z","x","x"]}','1.1.1.1','UA1') as ok2;
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'22222222-0000-0000-0000-000000000003','{"text":"ma reponse"}','1.1.1.1','UA1') as ok3;
select response from answers order by question_id;
select exam_log_event('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'hack','{}','1.1.1.1','UA1') as evenement_inconnu;
select exam_heartbeat('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'3.3.3.3','UA1')->>'status' as hb;
select exam_log_event('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'tab_hidden',null,'1.1.1.1','UA1')->>'violation_count' as v;
select exam_heartbeat('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'3.3.3.3','UA-CHANGE')->>'status' as hb_ua_change;
select exam_log_event('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'fullscreen_exit',null,'1.1.1.1','UA1') as troisieme_infraction;
select status, score, max_score, end_reason, violation_count from attempts where id=:'att';
-- Seuil atteint : l'épreuve continue, le surveillant est alerté (jamais d'arrêt automatique)
reset role;
do $$ begin
  if (select status from attempts where violation_count >= 3 limit 1) <> 'in_progress' then raise exception 'arret automatique interdit'; end if;
  if not exists (select 1 from proctor_events where kind = 'violation_threshold' and severity = 'critical') then raise exception 'alerte de seuil absente'; end if;
end $$;
set role service_role;
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'22222222-0000-0000-0000-000000000003','{"text":"apres"}','1.1.1.1','UA1') as apres_cloture;
select * from verify_event_chain(:'att');
select count(*) from webhook_outbox;
reset role;
update proctor_events set kind='x' where id=(select min(id) from proctor_events);
delete from proctor_events where id=(select id from proctor_events where attempt_id=:'att' order by id offset 3 limit 1);
select * from verify_event_chain(:'att') as apres_suppression;
\echo '=== correction'
set role service_role;
select grade_answer('00000000-0000-0000-0000-00000000000c',(select id from answers where question_id='22222222-0000-0000-0000-000000000003'),5,'') as candidat_note;
select grade_answer('00000000-0000-0000-0000-00000000000a',(select id from answers where question_id='22222222-0000-0000-0000-000000000003'),9,'') as hors_bareme;
select grade_answer('00000000-0000-0000-0000-00000000000a',(select id from answers where question_id='22222222-0000-0000-0000-000000000003'),4,'bien');
\echo '=== expiration'
select staff_action('00000000-0000-0000-0000-00000000000a',:'att','reset_attempt','{}');
reset role; alter table proctor_events disable trigger proctor_events_no_update; delete from proctor_events where kind='unlock_failed'; alter table proctor_events enable trigger proctor_events_no_update; update tests set invite_only=false where true; set role service_role;
select exam_prepare('00000000-0000-0000-0000-00000000000d','11111111-1111-1111-1111-111111111111')->>'unlocked' as bob_code_global;
select exam_unlock('00000000-0000-0000-0000-00000000000d','11111111-1111-1111-1111-111111111111','global-code',null);
select id as att2 from attempts where candidate_id='00000000-0000-0000-0000-00000000000d' \gset
select exam_begin('00000000-0000-0000-0000-00000000000d',:'att2',repeat('c',64),null,'1','UA',repeat('n',64)) is not null;
reset role; update attempts set deadline_at = now() - interval '2 minutes' where id=:'att2'; set role service_role;
select exam_save_answer('00000000-0000-0000-0000-00000000000d',:'att2',repeat('c',64),'22222222-0000-0000-0000-000000000001','{"selected":["a"]}','1.1.1.1','UA1') as apres_delai_doit_cloturer;
select status, end_reason from attempts where id=:'att2';
select expire_overdue_attempts();
reset role;
\echo '=== verrou questions'
delete from questions where test_id='11111111-1111-1111-1111-111111111111';
update questions set prompt='Q1 reformulee' where id='22222222-0000-0000-0000-000000000001';
select 'prompt modifiable', prompt from questions where id='22222222-0000-0000-0000-000000000001';
delete from tests where id='11111111-1111-1111-1111-111111111111';
select 'tests restants', count(*) from tests;
