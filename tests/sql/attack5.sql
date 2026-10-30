\set ON_ERROR_STOP 0
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@cybersup.ai','{}'),('00000000-0000-0000-0000-00000000000c','eve@test.fr','{}');
update profiles set role='admin' where email='admin@cybersup.ai';
insert into tests(id, owner_id, title, is_published, invite_only, require_webcam, shuffle_questions) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','Fun',true,false,false,false);
insert into questions(id,test_id,position,type,prompt,points,options) values
 ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',0,'ordering','Ordre IR',4,'[{"id":"s1","text":"Détecter"},{"id":"s2","text":"Contenir"},{"id":"s3","text":"Éradiquer"},{"id":"s4","text":"Restaurer"}]'),
 ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',1,'matching','Ports',3,'{"left":[{"id":"l1","text":"22"},{"id":"l2","text":"443"},{"id":"l3","text":"53"}],"right":[{"id":"r1","text":"SSH"},{"id":"r2","text":"HTTPS"},{"id":"r3","text":"DNS"}]}'),
 ('a0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111',2,'hotspot','Phishing',2,'{"layout":"email","multi":true,"header":{"from":"support@paypa1.com","subject":"Urgent"},"segments":[{"id":"h1","text":"Bonjour,"},{"id":"h2","text":"Votre compte sera suspendu sous 24h"},{"id":"h3","text":"cliquez ici : http://paypa1-secure.xyz"},{"id":"h4","text":"Cordialement"}]}'),
 ('a0000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111',3,'short_answer','IP la plus active ?',2,'{"data":{"kind":"table","columns":["ip","req"],"rows":[["10.0.0.1","3"],["198.51.100.23","40"]]}}'),
 ('a0000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111',4,'terminal','Mission',6,null);
insert into answer_keys values
 ('a0000000-0000-0000-0000-000000000001','["s1","s2","s3","s4"]'),
 ('a0000000-0000-0000-0000-000000000002','{"l1":"r1","l2":"r2","l3":"r3"}'),
 ('a0000000-0000-0000-0000-000000000003','["h2","h3"]'),
 ('a0000000-0000-0000-0000-000000000004','{"answers":["198.51.100.23"],"case_sensitive":false}');
insert into question_terminals values ('a0000000-0000-0000-0000-000000000005','{"files":{"/home/c/a":"x"},"objectives":[{"id":"o1","title":"Tuer","check":{"type":"process_absent","name":"x"}},{"id":"o2","title":"Supprimer","check":{"type":"absent","path":"/tmp/x"}}]}','CYBER{ok}');
set role service_role;
select exam_prepare('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111')->>'unlocked';
select id as att from attempts limit 1 \gset
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1','UA',repeat('1',64)) as b \gset
select jsonb_path_query(:'b'::jsonb, '$.questions[*].options') as options_servies;
select (:'b'::jsonb)->'questions'->4->'terminal' as terminal_public;
select position('CYBER' in :'b') + position('process_absent' in :'b') + position('case_sensitive' in :'b') + position('"correct"' in :'b') + position('files' in :'b') as fuite_de_cle;
\echo '=== reponses invalides'
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'a0000000-0000-0000-0000-000000000001','{"order":["s1","s1","s3","s4"]}','1','UA') as doublon;
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'a0000000-0000-0000-0000-000000000002','{"pairs":{"l1":"zz"}}','1','UA') as mauvais_pair;
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'a0000000-0000-0000-0000-000000000003','{"selected":["h9"]}','1','UA') as segment_inconnu;
\echo '=== reponses'
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'a0000000-0000-0000-0000-000000000001','{"order":["s1","s2","s4","s3"]}','1','UA')->>'saved';
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'a0000000-0000-0000-0000-000000000002','{"pairs":{"l1":"r1","l2":"r3","l3":"r2"}}','1','UA')->>'saved';
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'a0000000-0000-0000-0000-000000000003','{"selected":["h2","h3","h1"]}','1','UA')->>'saved';
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'a0000000-0000-0000-0000-000000000004','{"text":"  198.51.100.23 "}','1','UA')->>'saved';
select exam_terminal_scenario('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'a0000000-0000-0000-0000-000000000005','1','UA')->>'status';
select exam_terminal_save(:'att','a0000000-0000-0000-0000-000000000005','{"v":2}','{o1}',2);
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'a0000000-0000-0000-0000-000000000005','{"flag":"CYBER{ok}"}','1','UA')->>'saved';
select exam_submit('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'1','UA');
reset role;
select q.type, a.score, q.points from answers a join questions q on q.id=a.question_id order by q.position;
select score, max_score from attempts;
