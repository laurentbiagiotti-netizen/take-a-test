\set ON_ERROR_STOP 0
-- Exercice externe : lancement, envoi signé du résultat (côté base), rejeu,
-- mauvais nonce, mauvais outil, note hors bornes, accès candidat refusé,
-- envoi après clôture, et note finale proportionnelle.
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@cybersup.ai','{}'),('00000000-0000-0000-0000-00000000000c','eve@test.fr','{}');
update profiles set role='admin' where email='admin@cybersup.ai';
insert into tests(id, owner_id, title, is_published, invite_only, require_webcam, shuffle_questions, linear_navigation) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','Ext',true,false,false,false,true);
insert into questions(id,test_id,position,type,prompt,points,options) values
 ('b0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',0,'external','Enquête',4,null),
 ('b0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',1,'external','Tri',2,null);
insert into question_externals(question_id, tool, scenario, answer_key, time_limit_s) values
 ('b0000000-0000-0000-0000-000000000001','crime','{"count":2}',null,600),
 ('b0000000-0000-0000-0000-000000000002','win95','{"items":[{"id":"u1","kind":"url"}]}','{"u1":"fraud"}',null);

-- 1. le candidat ne lit ni la table des exercices ni les sessions
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select count(*) as lit_corrige from question_externals;
select count(*) as lit_sessions from external_sessions;
select external_record(gen_random_uuid(), 'x', 'crime', 1, 1, null, null, null, true) as appel_direct;
reset role;

set role service_role;
select exam_prepare('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111')->>'linear';
select id as att from attempts limit 1 \gset
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1','UA',repeat('1',64))->'questions'->0->'external' as info_exo;
-- 2. la question suivante est verrouillée (navigation linéaire)
select exam_external_launch('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'b0000000-0000-0000-0000-000000000002','1','UA') as saut_en_avant;
-- 3. lancement, puis relance : même session, même nonce
select exam_external_launch('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'b0000000-0000-0000-0000-000000000001','1','UA') as l1 \gset
select (:'l1'::jsonb->>'nonce') = (exam_external_launch('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'b0000000-0000-0000-0000-000000000001','1','UA')->>'nonce') as meme_session;
select (:'l1'::jsonb->'scenario') ? 'answer_key' as fuite_corrige;
select (:'l1'::jsonb->>'session_id') as sid, (:'l1'::jsonb->>'nonce') as nonce \gset
-- 4. réponses à la saisie refusées pour ce type
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'b0000000-0000-0000-0000-000000000001','{"completed":true}','1','UA') as reponse_forgee;
-- 5. envois
select external_record(:'sid', 'mauvais', 'crime', 1, 1, null, null, null, false) as mauvais_nonce;
select external_record(:'sid', :'nonce', 'win95', 1, 1, null, null, null, false) as mauvais_outil;
select external_record(:'sid', :'nonce', 'crime', 1, 1.5, null, null, null, false) as hors_bornes;
select external_record(:'sid', :'nonce', 'crime', 2, 0.25, 2500, 10000, '{"cases":[]}', false)->>'ok' as envoi_1;
select external_record(:'sid', :'nonce', 'crime', 2, 1, 10000, 10000, null, true) as rejeu_meme_seq;
select external_record(:'sid', :'nonce', 'crime', 1, 1, 10000, 10000, null, true) as rejeu_ancien;
select external_record(:'sid', :'nonce', 'crime', 3, 0.75, 7500, 10000, '{"cases":[]}', true)->>'completed' as envoi_final;
select external_session(:'sid', :'nonce')->>'completed' as termine;
select count(*) as journal from proctor_events where kind in ('external_launch','external_completed');
select exam_submit('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'1','UA')->>'status';
-- 6. après la remise : plus rien n'est accepté
select external_record(:'sid', :'nonce', 'crime', 4, 1, null, null, null, true) as apres_remise;
reset role;
select score, max_score from attempts;
select score from answers order by score;
-- 7. Résultat sur 20 et décision forcée
set role service_role;
select _attempt_report(:'att')->>'score20' as sur20, _attempt_report(:'att')->>'verdict' as auto;
select staff_action('00000000-0000-0000-0000-00000000000a', :'att', 'set_verdict', '{"verdict":"pass"}') as sans_motif;
select staff_action('00000000-0000-0000-0000-00000000000a', :'att', 'set_verdict', '{"verdict":"admis","reason":"ok ok"}') as verdict_inconnu;
select staff_action('00000000-0000-0000-0000-00000000000c', :'att', 'set_verdict', '{"verdict":"pass","reason":"moi"}') as candidat;
select staff_action('00000000-0000-0000-0000-00000000000a', :'att', 'set_verdict', '{"verdict":"review","reason":"Panne réseau pendant l enquête"}')->>'ok' as force;
select _attempt_report(:'att')->>'verdict' as final, _attempt_report(:'att')->'verdict_override'->>'reason' as motif,
       _attempt_report(:'att')->>'verdict_auto' as calcul, (_attempt_report(:'att')->>'passed')::boolean as admis;
select count(*) as journal_et_webhook from proctor_events where kind = 'staff_verdict';
select staff_action('00000000-0000-0000-0000-00000000000a', :'att', 'set_verdict', '{"verdict":null}')->>'ok' as annule;
select _attempt_report(:'att')->>'verdict' as retour_auto;
reset role;
