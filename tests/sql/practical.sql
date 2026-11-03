\set ON_ERROR_STOP 0
-- Types pratiques : SQL, décodage, mots de passe, pare-feu. Note serveur, contrôles de format.
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@cybersup.ai','{}'),('00000000-0000-0000-0000-00000000000c','eve@test.fr','{}');
update profiles set role='admin' where email='admin@cybersup.ai';
insert into tests(id, owner_id, title, is_published, invite_only, require_webcam, duration_minutes, shuffle_questions, room_scan_after)
 values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','Pratique',true,false,false,60,false,0);
insert into questions(id,test_id,position,type,prompt,points,options) values
 ('c0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',0,'sql','Q1',2,'{"mode":"query","setup":"CREATE TABLE t(a);"}'),
 ('c0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',1,'decode','Q2',2,'{"input":"UExGUlx="}'),
 ('c0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111',2,'password','Q3',2,'{"mode":"rank","items":[{"id":"p1","text":"a"},{"id":"p2","text":"b"},{"id":"p3","text":"c"}]}'),
 ('c0000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111',3,'blocks','Q4',3,'{"sample":[]}');
insert into answer_keys values ('c0000000-0000-0000-0000-000000000001','{"expected_sql":"SELECT 1"}'),('c0000000-0000-0000-0000-000000000002','{"answers":["CYBER{ok}"],"case_sensitive":true}'),('c0000000-0000-0000-0000-000000000004','{"packets":[]}');
set role service_role;
select exam_prepare('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111')->>'linear';
select id as att from attempts limit 1 \gset
select jsonb_array_length(exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1','UA',repeat('1',64),true)->'questions') as nb_questions;
-- 1. SQL : réponse acceptée, le serveur reçoit la réponse normalisée à noter
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000001','{"query":"SELECT 1","extra":"x"}','1','UA')->'response' as reponse_sql;
-- 2. note serveur : 5 plafonné à 2 ; une note sur une réponse périmée est ignorée
select exam_set_auto_score(:'att','c0000000-0000-0000-0000-000000000001','{"query":"SELECT 1"}',5)->>'ok' as note_ok;
select exam_set_auto_score(:'att','c0000000-0000-0000-0000-000000000001','{"query":"SELECT 2"}',1)->>'ok' as note_perimee;
-- 3. requête trop longue (erreur attendue)
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000001',jsonb_build_object('query', repeat('x', 5000)),'1','UA');
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000001','{"query":"SELECT 1"}','1','UA')->>'saved';
select exam_set_auto_score(:'att','c0000000-0000-0000-0000-000000000001','{"query":"SELECT 1"}',2)->>'ok';
select exam_next('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),0,'1','UA')->>'current_index';
-- 4. décodage : flag noté en base, recette gardée
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000002','{"text":"CYBER{ok}","recipe":[{"op":"from_base64"}]}','1','UA')->>'saved';
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000002','{"text":"x","recipe":"pas un tableau"}','1','UA');
select exam_next('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),1,'1','UA')->>'current_index';
-- 5. mots de passe : ordre incomplet refusé (erreur attendue), puis ordre complet
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000003','{"order":["p1","p2"]}','1','UA');
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000003','{"order":["p1","p2","p3"]}','1','UA')->>'auto';
select exam_set_auto_score(:'att','c0000000-0000-0000-0000-000000000003','{"order":["p1","p2","p3"]}',1.33)->>'ok';
select exam_next('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),2,'1','UA')->>'current_index';
-- 6. pare-feu : programme absent refusé (erreur attendue) ; une nouvelle réponse efface l'ancienne note
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000004','{"state":{}}','1','UA');
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000004','{"program":{"default":"block","rules":[]}}','1','UA')->>'saved';
select exam_set_auto_score(:'att','c0000000-0000-0000-0000-000000000004','{"program":{"default":"block","rules":[]},"state":null}',3)->>'ok';
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000004','{"program":{"default":"allow","rules":[]}}','1','UA')->>'saved';
-- 7. un type non noté par le serveur ne reçoit pas de note serveur
select exam_set_auto_score(:'att','c0000000-0000-0000-0000-000000000002','{"text":"CYBER{ok}"}',2)->>'ok' as decode_refuse;
select exam_submit('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'1','UA')->>'status';
reset role;
select q.type, an.score from answers an join questions q on q.id = an.question_id order by q.position;
select score, max_score from attempts;
-- 8. le navigateur (rôle authenticated) ne peut pas appeler exam_set_auto_score (erreur attendue)
set role authenticated;
select exam_set_auto_score(:'att','c0000000-0000-0000-0000-000000000001','{}',2);
reset role;
