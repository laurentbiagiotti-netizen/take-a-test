\set ON_ERROR_STOP 0
-- Messagerie candidat / surveillant : session exigée, limites, droits.
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@cybersup.ai','{}'),('00000000-0000-0000-0000-00000000000c','eve@test.fr','{}'),('00000000-0000-0000-0000-00000000000d','mallory@test.fr','{}');
update profiles set role='admin' where email='admin@cybersup.ai';
insert into tests(id, owner_id, title, is_published, invite_only, require_webcam, duration_minutes)
 values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','Chat',true,false,false,60);
insert into questions(id,test_id,position,type,prompt,points,options) values
 ('c0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',0,'mcq_single','Q1',1,'[{"id":"a","text":"a"},{"id":"b","text":"b"}]');
insert into answer_keys values ('c0000000-0000-0000-0000-000000000001','["a"]');
set role service_role;
select exam_prepare('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111')->>'linear';
select id as att from attempts limit 1 \gset
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1','UA',repeat('1',64),true)->>'timing';
-- 1. message normal
select exam_send_message('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'Bonjour, la caméra ne marche pas','1','UA')->>'sent';
-- 2. mauvais jeton : refus (erreur attendue)
select exam_send_message('00000000-0000-0000-0000-00000000000c',:'att',repeat('b',64),'x','1','UA');
-- 3. autre utilisateur : refus (erreur attendue)
select exam_send_message('00000000-0000-0000-0000-00000000000d',:'att',repeat('a',64),'x','1','UA');
-- 4. vide : refus (erreur attendue)
select exam_send_message('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'   ','1','UA');
-- 5. 3 par minute : le 4e est refusé (erreur attendue)
select exam_send_message('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'2','1','UA')->>'sent';
select exam_send_message('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'3','1','UA')->>'sent';
select exam_send_message('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'4','1','UA');
-- 6. un candidat ne peut pas répondre comme surveillant (erreur attendue), l'admin oui
select staff_send_message('00000000-0000-0000-0000-00000000000d',:'att','faux');
select staff_send_message('00000000-0000-0000-0000-00000000000a',:'att','Rechargez la page')->>'sent';
reset role;
select sender, count(*), count(read_at) from exam_messages group by 1 order by 1;
-- 7. un candidat connecté ne lit pas la table (0 ligne), anon non plus (erreur attendue)
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false) is not null;
select count(*) as lu_par_candidat from exam_messages;
reset role;
set role anon;
select count(*) from exam_messages;
reset role;
-- 8. épreuve rendue : plus de message possible (erreur attendue côté surveillant)
set role service_role;
select exam_submit('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'1','UA')->>'status';
select staff_send_message('00000000-0000-0000-0000-00000000000a',:'att','trop tard');
reset role;
