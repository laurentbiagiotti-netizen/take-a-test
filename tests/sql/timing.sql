\set ON_ERROR_STOP 0
-- Temps par question, notice obligatoire, réponses trop rapides, points partiels.
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@cybersup.ai','{}'),('00000000-0000-0000-0000-00000000000c','eve@test.fr','{}');
update profiles set role='admin' where email='admin@cybersup.ai';
insert into tests(id, owner_id, title, is_published, invite_only, require_webcam, shuffle_questions, shuffle_options, linear_navigation, timing, question_time_s, partial_points, duration_minutes)
 values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','Chrono',true,false,false,false,false,true,'question',30,true,60);
insert into questions(id,test_id,position,type,prompt,points,options,time_limit_s) values
 ('c0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',0,'mcq_multi','Q1',3,'[{"id":"a","text":"a"},{"id":"b","text":"b"},{"id":"c","text":"c"},{"id":"d","text":"d"}]',null),
 ('c0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',1,'mcq_single','Q2',1,'[{"id":"a","text":"a"},{"id":"b","text":"b"}]',90),
 ('c0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111',2,'mcq_single','Q3',1,'[{"id":"a","text":"a"},{"id":"b","text":"b"}]',null),
 ('c0000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111',3,'mcq_single','Q4',1,'[{"id":"a","text":"a"},{"id":"b","text":"b"}]',null);

insert into answer_keys values ('c0000000-0000-0000-0000-000000000001','["a","b","c"]'),('c0000000-0000-0000-0000-000000000002','["a"]'),('c0000000-0000-0000-0000-000000000003','["a"]'),('c0000000-0000-0000-0000-000000000004','["a"]');

set role service_role;
select exam_prepare('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111')->>'linear';
select id as att from attempts limit 1 \gset
-- 1. notice non cochée : refus (erreur attendue), puis démarrage
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1','UA',repeat('1',64),false) as sans_notice;
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1','UA',repeat('1',64),true)->>'timing' as mode;
select notice_ack_at is not null as notice_tracee,
       round(extract(epoch from q_deadline_at - q_started_at)) as q1_s,
       round(extract(epoch from deadline_at - q_started_at)) as total_s from attempts;
-- 2. points partiels : a, b et d cochées sur a, b, c attendues = (2 - 1) / 3 de 3 points = 1
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000001','{"selected":["a","b","d"]}','1','UA')->>'ok';
-- 3. réponses rapides : 3 de suite sous 4 s, une alerte
select exam_next('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),0,'1','UA')->>'current_index';
select round(extract(epoch from q_deadline_at - q_started_at)) as q2_s from attempts;
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000002','{"selected":["a"]}','1','UA')->>'ok';
select exam_next('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),1,'1','UA')->>'current_index';
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000003','{"selected":["a"]}','1','UA')->>'ok';
select exam_next('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),2,'1','UA')->>'current_index';
reset role;
select count(*) as alerte_rapide from proctor_events where kind = 'fast_answers';
-- 4. temps de la question écoulé : réponse refusée (erreur attendue), passage toujours possible
update attempts set q_deadline_at = now() - interval '10 seconds';
set role service_role;
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000004','{"selected":["a"]}','1','UA') as trop_tard;
select exam_submit('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'1','UA')->>'status';
reset role;
select score, max_score from attempts;
select question_id, score from answers order by question_id;
