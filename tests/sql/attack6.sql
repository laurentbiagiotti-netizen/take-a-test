\set ON_ERROR_STOP 0
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@cybersup.ai','{}'),('00000000-0000-0000-0000-00000000000c','eve@test.fr','{}');
update profiles set role='admin' where email='admin@cybersup.ai';
insert into tests(id, owner_id, title, is_published, invite_only, require_webcam, shuffle_questions, linear_navigation) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','Lin',true,false,false,false,true);
insert into questions(id,test_id,position,type,prompt,points,options) values
 ('b0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',0,'mcq_single','Q1',1,'[{"id":"a","text":"A"},{"id":"b","text":"B"}]'),
 ('b0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',1,'mcq_single','Q2',1,'[{"id":"a","text":"A"},{"id":"b","text":"B"}]');
insert into answer_keys values ('b0000000-0000-0000-0000-000000000001','["a"]'),('b0000000-0000-0000-0000-000000000002','["b"]');
set role service_role;
select exam_prepare('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111')->>'linear';
select id as att from attempts limit 1 \gset
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1','UA',repeat('1',64))->>'current_index' as idx;
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'b0000000-0000-0000-0000-000000000002','{"selected":["b"]}','1','UA') as saut_en_avant;
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'b0000000-0000-0000-0000-000000000001','{"selected":["a"]}','1','UA')->>'saved' as q1;
select exam_next('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),0,'1','UA')->>'current_index' as apres_suivante;
select exam_next('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),0,'1','UA')->>'current_index' as rejeu_idempotent;
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'b0000000-0000-0000-0000-000000000001','{"selected":["b"]}','1','UA') as retour_arriere;
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'b0000000-0000-0000-0000-000000000002','{"selected":["b"]}','1','UA')->>'saved' as q2;
select exam_next('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),1,'1','UA')->>'current_index' as pas_au_dela;
select exam_log_event('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'no_face','{"faces":0}','1','UA')->>'violation_count' as no_face;
select exam_log_event('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'multiple_faces','{"faces":2}','1','UA')->>'violation_count' as multi;
select exam_submit('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'1','UA');
reset role; select score, max_score from attempts;
