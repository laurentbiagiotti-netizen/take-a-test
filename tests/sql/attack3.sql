\set ON_ERROR_STOP 0
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@cybersup.ai','{}'),('00000000-0000-0000-0000-00000000000c','eve@test.fr','{}');
update profiles set role='admin' where email='admin@cybersup.ai';
insert into tests(id, owner_id, title, is_published, invite_only, require_webcam, shuffle_questions) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','Terminal',true,false,false, false);
insert into questions(id,test_id,type,prompt,points) values ('33333333-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','terminal','Trouve le flag',4);
insert into question_terminals values ('33333333-0000-0000-0000-000000000001','{"files":{"/home/eve/.secret":"CYBER{ok}"}}','CYBER{ok}');

\echo '=== admin sans MFA (aal1)'
set role authenticated; set request.jwt.sub='00000000-0000-0000-0000-00000000000a'; set request.jwt.claims='{"aal":"aal1","role":"authenticated"}';
select 'tests vus sans MFA', count(*) from tests;
select 'flags vus sans MFA', count(*) from question_terminals;
set request.jwt.claims='{"aal":"aal2","role":"authenticated"}';
select 'tests vus avec MFA', count(*) from tests;
update tests set title='Terminal Linux';
update test_secrets set access_code='X';
insert into test_secrets(test_id, access_code) values ('11111111-1111-1111-1111-111111111111','SECRET-CODE');
reset role;
select table_name, op, actor, changed from admin_audit order by id;

\echo '=== candidat : scenario terminal'
set role authenticated; set request.jwt.sub='00000000-0000-0000-0000-00000000000c'; set request.jwt.claims='{"aal":"aal2"}';
select count(*) as flags_candidat from question_terminals;
reset role; set role service_role;
select exam_prepare('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111')->>'unlocked';
select exam_unlock('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111','SECRET-CODE',null);
select id as att from attempts limit 1 \gset
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1.1.1.1','UA',repeat('1',64))->'questions'->0->>'type' as type_q;
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1.1.1.1','UA',repeat('1',64))->'questions'->0 ? 'scenario' as scenario_fuite;
select exam_terminal_scenario('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'33333333-0000-0000-0000-000000000001','1.1.1.1','UA')->'scenario' as scn;
\echo '=== nonce tournant'
select exam_rotate_nonce('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),repeat('1',64),repeat('2',64),'1.1.1.1') as n1;
select exam_rotate_nonce('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),repeat('1',64),repeat('3',64),'1.1.1.1') as n_prec_tolere;
select exam_rotate_nonce('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),repeat('3',64),repeat('4',64),'1.1.1.1') as n2;
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'33333333-0000-0000-0000-000000000001','{"flag":" CYBER{ok} "}','1.1.1.1','UA');
select exam_rotate_nonce('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),repeat('1',64),repeat('5',64),'1.1.1.1') as copie_desynchronisee;
select status, violation_count, session_token_hash is null as session_coupee from attempts where id=:'att';
select staff_action('00000000-0000-0000-0000-00000000000a',:'att','reset_session','{}');
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('b',64),null,'1.1.1.1','UA',repeat('6',64))->>'token' as reprise;
select exam_submit('00000000-0000-0000-0000-00000000000c',:'att',repeat('b',64),'1.1.1.1','UA');
select score, max_score from attempts where id=:'att';
\echo '=== api nonce'
insert into api_keys(id,name,prefix,key_hash) values ('44444444-0000-0000-0000-000000000001','k','aaaaaaaaaaaa','x');
select api_use_nonce('44444444-0000-0000-0000-000000000001','abc') as premier, api_use_nonce('44444444-0000-0000-0000-000000000001','abc') as rejeu;
reset role;
\echo '=== audit inalterable'
delete from admin_audit;
