\set ON_ERROR_STOP 0
-- En-têtes de mail (noté en base), sous-réseaux et puzzle (notés par le serveur).
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@cybersup.ai','{}'),('00000000-0000-0000-0000-00000000000c','eve@test.fr','{}');
update profiles set role='admin' where email='admin@cybersup.ai';
insert into tests(id, owner_id, title, is_published, invite_only, require_webcam, duration_minutes, shuffle_questions, room_scan_after)
 values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','Réseau',true,false,false,60,false,0);
insert into questions(id,test_id,position,type,prompt,points,options) values
 ('c0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',0,'headers','Q1',2,'{"raw":"From: a@b.example","view":"raw","ask":["origin_ip","spf","reply_to","verdict"]}'),
 ('c0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',1,'subnet','Q2',2,'{"mode":"basic"}'),
 ('c0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111',2,'netpuzzle','Q3',2,'{"w":5,"h":5}');
insert into answer_keys values ('c0000000-0000-0000-0000-000000000001','{"origin_ip":"203.0.113.45","spf":"fail","reply_to":"oui","verdict":"phishing"}'),('c0000000-0000-0000-0000-000000000002','[]'),('c0000000-0000-0000-0000-000000000003','[]');
set role service_role;
select exam_prepare('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111')->>'linear';
select id as att from attempts limit 1 \gset
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1','UA',repeat('1',64),true)->'questions'->0->'options'->>'view' as options_visibles;
-- 1. en-têtes : format invalide (erreur attendue), puis 3 bonnes réponses sur 4
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000001','{"fields":"x"}','1','UA');
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000001','{"fields":{"origin_ip":" 203.0.113.45","spf":"FAIL","reply_to":"oui","verdict":"legitime"}}','1','UA')->>'auto' as auto_entetes;
select exam_next('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),0,'1','UA')->>'current_index';
-- 2. sous-réseau : réponse notée par le serveur
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000002','{"fields":{"network":"10.0.0.0"}}','1','UA')->>'auto' as auto_subnet;
select exam_set_auto_score(:'att','c0000000-0000-0000-0000-000000000002','{"fields":{"network":"10.0.0.0"}}',0.67)->>'ok';
select exam_next('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),1,'1','UA')->>'current_index';
-- 3. puzzle : rotations non numériques refusées (erreur attendue), puis réponse et note serveur
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000003','{"rot":["x"]}','1','UA');
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000003','{"rot":[1,0,2],"moves":12,"ms":40000}','1','UA')->'response'->>'moves';
select exam_set_auto_score(:'att','c0000000-0000-0000-0000-000000000003','{"rot":[1,0,2],"moves":12,"ms":40000}',2)->>'ok';
select exam_submit('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'1','UA')->>'status';
reset role;
select q.type, an.score from answers an join questions q on q.id = an.question_id order by q.position;
