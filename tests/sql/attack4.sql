\set ON_ERROR_STOP 0
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@cybersup.ai','{}'),('00000000-0000-0000-0000-00000000000c','eve@test.fr','{}');
update profiles set role='admin' where email='admin@cybersup.ai';
insert into tests(id, owner_id, title, is_published, invite_only, require_webcam, max_violations, shuffle_questions) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','T',true,false,false,10, false);
insert into questions(id,test_id,type,prompt,points) values ('33333333-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','long_text','Q',5);
set role service_role;
select exam_prepare('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111')->>'unlocked' as ouvert;
select id as att from attempts limit 1 \gset
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1','UA',repeat('1',64))->>'token' as debut;
\echo '=== fenetre de 3 jetons (reseau instable)'
select exam_rotate_nonce('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),repeat('1',64),repeat('2',64),'1') as r1;
select exam_rotate_nonce('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),repeat('1',64),repeat('3',64),'1') as r2_ancien;
select exam_rotate_nonce('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),repeat('2',64),repeat('4',64),'1') as r3_ancien;
\echo '=== auto-kill puis reprise sur un 2e appareil sans le surveillant'
select exam_rotate_nonce('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),repeat('f',64),repeat('5',64),'1') as kill_volontaire;
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('b',64),null,'6.6.6.6','UA-B',repeat('6',64)) as appareil_b;
select staff_action('00000000-0000-0000-0000-00000000000a',:'att','reset_session','{}');
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('b',64),null,'6.6.6.6','UA-B',repeat('6',64))->>'token' as apres_accord;
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('c',64),null,'7.7.7.7','UA-C',repeat('7',64)) as accord_usage_unique;
\echo '=== rechargements repetes'
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('z',64),repeat('b',64),'6.6.6.6','UA-B',repeat('8',64))->>'token' from generate_series(1,5);
select violation_count from attempts where id=:'att';
select kind, severity from proctor_events where attempt_id=:'att' and severity in ('violation','critical') order by seq;
\echo '=== audit de la correction'
select exam_rotate_nonce('00000000-0000-0000-0000-00000000000c',:'att',repeat('b',64),repeat('8',64),repeat('9',64),'6.6.6.6');
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('b',64),'33333333-0000-0000-0000-000000000003','{"text":"r"}','6.6.6.6','UA-B');
select exam_submit('00000000-0000-0000-0000-00000000000c',:'att',repeat('b',64),'6.6.6.6','UA-B');
select grade_answer('00000000-0000-0000-0000-00000000000a',(select id from answers limit 1),3,'ok');
reset role;
select table_name, op, actor, actor_role, changed from admin_audit where table_name='answers';
