\set ON_ERROR_STOP 0
\set U 'uuid'
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@cybersup.ai','{}'),('00000000-0000-0000-0000-00000000000b','proc@cybersup.ai','{}'),('00000000-0000-0000-0000-00000000000c','eve@test.fr','{}');
update profiles set role='admin' where email='admin@cybersup.ai';
update profiles set role='proctor' where email='proc@cybersup.ai';
insert into tests(id, owner_id, title, is_published, invite_only, max_violations, require_id_check, shuffle_questions) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','QCM',true,true,3,true, false);
insert into questions(id,test_id,type,prompt,options,points) values
 ('22222222-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','mcq_single','Q1','[{"id":"a","text":"A"},{"id":"b","text":"B"}]',2),
 ('22222222-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','long_text','Q3',null,5);
insert into answer_keys values ('22222222-0000-0000-0000-000000000001','["a"]');
insert into invites(test_id,email,code) values ('11111111-1111-1111-1111-111111111111','eve@test.fr','EVE1-CODE');

\echo '=== surveillant : lecture des codes'
set role authenticated; set request.jwt.sub='00000000-0000-0000-0000-00000000000b';
select 'invites vues par surveillant', count(*) from invites;
reset role;

set role service_role;
select exam_prepare('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111')->>'identity_status' as id_status;
select exam_unlock('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111','EVE1-CODE','1.1.1.1');
select id as att from attempts limit 1 \gset
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1.1.1.1','UA1',repeat('n',64)) as sans_identite;
select exam_submit_identity('00000000-0000-0000-0000-00000000000c',:'att','{"document":"x","selfie":"y"}','1.1.1.1');
reset role; update tests set id_verify_before_start=true; set role service_role;
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1.1.1.1','UA1',repeat('n',64)) as identite_non_validee;
select staff_action('00000000-0000-0000-0000-00000000000b',:'att','review_identity','{"ok":true}');
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1.1.1.1','UA1',repeat('n',64))->>'token' as debut;

\echo '=== copie du cookie sur un autre appareil'
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'22222222-0000-0000-0000-000000000001','{"selected":["b"]}','6.6.6.6','UA-COMPLICE') as complice;
select kind, severity, ip from proctor_events where attempt_id=:'att' order by seq desc limit 3;
\echo '=== rechargement meme navigateur'
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('z',64),repeat('a',64),'6.6.6.6','UA-COMPLICE',repeat('n',64))->>'token' as reprise_meme_nav;
\echo '=== notes'
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'22222222-0000-0000-0000-000000000003','{"text":"r"}','6.6.6.6','UA-COMPLICE');
select grade_answer('00000000-0000-0000-0000-00000000000a',(select id from answers where question_id='22222222-0000-0000-0000-000000000003'),5,'') as pendant_epreuve;
select exam_submit('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'6.6.6.6','UA-COMPLICE');
select grade_answer('00000000-0000-0000-0000-00000000000b',(select id from answers where question_id='22222222-0000-0000-0000-000000000001'),2,'') as surveillant_change_qcm;
select grade_answer('00000000-0000-0000-0000-00000000000b',(select id from answers where question_id='22222222-0000-0000-0000-000000000003'),4,'ok') as note_redaction;
select status, score, max_score from attempts where id=:'att';
\echo '=== journal'
select * from verify_event_chain(:'att');
reset role;
delete from proctor_events where attempt_id=:'att' and seq=(select max(seq) from proctor_events where attempt_id=:'att');
alter table proctor_events disable trigger proctor_events_no_update;
delete from proctor_events where attempt_id=:'att' and seq=(select max(seq) from proctor_events where attempt_id=:'att');
alter table proctor_events enable trigger proctor_events_no_update;
select * from verify_event_chain(:'att') as apres_troncature_par_superuser;
\echo '=== suppression en cascade'
set role service_role;
select staff_action('00000000-0000-0000-0000-00000000000a',:'att','reset_attempt','{}');
select count(*) as events_restants from proctor_events;
