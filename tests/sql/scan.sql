\set ON_ERROR_STOP 0
-- Pause et scan de la pièce : déclenchement au 3e avertissement, chrono gelé, jeton, reprise.
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@cybersup.ai','{}'),('00000000-0000-0000-0000-00000000000c','eve@test.fr','{}');
update profiles set role='admin' where email='admin@cybersup.ai';
insert into tests(id, owner_id, title, is_published, invite_only, require_webcam, duration_minutes, max_violations, room_scan_after)
 values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','Scan',true,false,false,60,5,3);
insert into questions(id,test_id,position,type,prompt,points,options) values
 ('c0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',0,'mcq_single','Q1',1,'[{"id":"a","text":"a"},{"id":"b","text":"b"}]'),
 ('c0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',1,'mcq_single','Q2',1,'[{"id":"a","text":"a"},{"id":"b","text":"b"}]');
insert into answer_keys values ('c0000000-0000-0000-0000-000000000001','["a"]'),('c0000000-0000-0000-0000-000000000002','["a"]');
set role service_role;
select exam_prepare('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111')->>'linear';
select id as att from attempts limit 1 \gset
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1','UA',repeat('1',64),true)->>'timing';
reset role;
select question_order[1] as q1 from attempts \gset
set role service_role;
-- 1. pas de pause : lien refusé poliment
select exam_scan_link('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),repeat('f',64),'1','UA')->>'paused' as pause_avant;
-- 2. trois infractions : pause
select exam_log_event('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'tab_hidden',null,'1','UA')->>'violation_count';
select exam_log_event('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'tab_hidden',null,'1','UA')->>'violation_count';
select exam_log_event('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'tab_hidden',null,'1','UA')->>'violation_count';
reset role;
select paused_at is not null as en_pause, pause_reason from attempts;
-- 3. pendant la pause : infraction non comptée, réponse et remise refusées (2 erreurs attendues)
set role service_role;
select exam_log_event('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'tab_hidden',null,'1','UA')->>'violation_count' as compteur_pause;
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000001','{"selected":["a"]}','1','UA');
select exam_submit('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'1','UA');
-- 4. délai dépassé pendant la pause : pas d'expiration
reset role;
update attempts set deadline_at = now() - interval '5 minutes', paused_at = now() - interval '10 minutes';
set role service_role;
select expire_overdue_attempts() as expirees;
select exam_heartbeat('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'1','UA')->>'status';
-- 5. jeton : mauvais format et jeton inconnu refusés (2 erreurs attendues)
select exam_scan_link('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'pas-un-hash','1','UA');
select exam_scan_link('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),repeat('e',64),'1','UA')->>'paused';
select scan_lookup(repeat('d',64));
select scan_lookup(repeat('e',64))->>'title';
-- 6. chemin d'un autre dossier refusé (erreur attendue), puis vidéo reçue : reprise avec le temps rendu
select scan_complete(repeat('e',64),'autre/x.webm',20,'1');
select scan_complete(repeat('e',64),:'att' || '/1-ab.webm',20,'1')->>'ok';
reset role;
select paused_at is null as reprise, round(extract(epoch from deadline_at - now()) / 60) as minutes_restantes,
       scan_token_hash is null as jeton_efface, violation_count from attempts;
select kind, severity from proctor_events where kind in ('room_scan_requested','room_scan','exam_resumed') order by id;
-- 7. jeton déjà utilisé (erreur attendue), le candidat repart
set role service_role;
select scan_lookup(repeat('e',64));
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),:'q1','{"selected":["a"]}','1','UA')->>'ok' as repart;
-- 8. surveillant : reprise forcée ; un candidat ne peut pas (erreur attendue)
reset role;
update attempts set paused_at = now(), pause_reason = 'room_scan';
set role service_role;
select staff_resume('00000000-0000-0000-0000-00000000000c',:'att');
select staff_resume('00000000-0000-0000-0000-00000000000a',:'att')->>'resumed';
-- 9. pause oubliée plus de 30 min : reprise automatique et alerte critique
reset role;
update attempts set paused_at = now() - interval '31 minutes', pause_reason = 'room_scan', deadline_at = now() + interval '10 minutes';
set role service_role;
select expire_overdue_attempts() as expirees;
reset role;
select paused_at is null as reprise_auto, (select severity from proctor_events where kind = 'room_scan_missing') as alerte from attempts;
