\set ON_ERROR_STOP 0
-- Caisses, robot, console AD, tickets : formats contrôlés et notes serveur.
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@cybersup.ai','{}'),('00000000-0000-0000-0000-00000000000c','eve@test.fr','{}');
update profiles set role='admin' where email='admin@cybersup.ai';
insert into tests(id, owner_id, title, is_published, invite_only, require_webcam, duration_minutes, shuffle_questions, room_scan_after)
 values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','Jeux',true,false,false,60,false,0);
insert into questions(id,test_id,position,type,prompt,points,options) values
 ('c0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',0,'sokoban','Q1',3,'{"levels":[]}'),
 ('c0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',1,'robot','Q2',3,'{"levels":[]}'),
 ('c0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111',2,'adsim','Q3',4,'{"initial":{}}'),
 ('c0000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111',3,'tickets','Q4',3,'{"tickets":[]}'),
 ('c0000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111',4,'bash','Q5',3,'{"mission":"m","files":{"a.txt":"x"},"checks":[{"label":"l"}]}'),
 ('c0000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111',5,'feed','Q6',4,'{"posts":[{"id":"f1","text":"t"}],"ask_reason":true}');
insert into answer_keys values ('c0000000-0000-0000-0000-000000000001','[]'),('c0000000-0000-0000-0000-000000000002','[]'),('c0000000-0000-0000-0000-000000000003','{"checks":[]}'),('c0000000-0000-0000-0000-000000000004','{}'),('c0000000-0000-0000-0000-000000000005','{"solution":"cat a.txt","checks":[{"label":"l","kind":"stdout"}]}'),('c0000000-0000-0000-0000-000000000006','{"verdicts":{"f1":"faux"}}');
set role service_role;
select exam_prepare('00000000-0000-0000-0000-00000000000c','11111111-1111-1111-1111-111111111111')->>'linear';
select id as att from attempts limit 1 \gset
select exam_begin('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),null,'1','UA',repeat('1',64),true)->>'timing';
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000001','{"moves":[1]}','1','UA');
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000001','{"moves":["ru",""],"undos":2,"restarts":1}','1','UA')->>'auto';
select exam_set_auto_score(:'att','c0000000-0000-0000-0000-000000000001','{"moves":["ru",""],"undos":2,"restarts":1,"ms":0}',1.5)->>'ok';
select exam_next('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),0,'1','UA')->>'current_index';
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000002','{"programs":"x"}','1','UA');
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000002','{"programs":[{"main":["F"],"p1":[]}],"runs":3}','1','UA')->>'auto';
select exam_next('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),1,'1','UA')->>'current_index';
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000003','{"state":[]}','1','UA');
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000003','{"state":{"users":[]}}','1','UA')->>'auto';
select exam_set_auto_score(:'att','c0000000-0000-0000-0000-000000000003','{"state":{"users":[]},"done":[]}',4)->>'ok';
select exam_next('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),2,'1','UA')->>'current_index';
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000004','{"tickets":"x"}','1','UA');
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000004','{"tickets":{"t1":{"impact":"haute"}}}','1','UA')->>'auto';
select exam_next('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),3,'1','UA')->>'current_index';
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000005','{"script":["rm -rf /"]}','1','UA');
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000005','{"script":"cat a.txt","extra":1}','1','UA')->>'response';
select exam_set_auto_score(:'att','c0000000-0000-0000-0000-000000000005','{"script":"cat a.txt"}',3)->>'ok';
select exam_next('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),4,'1','UA')->>'current_index';
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000006','{"verdicts":{"f1":"faux"},"actions":{"f1":["hack"]}}','1','UA');
select exam_save_answer('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'c0000000-0000-0000-0000-000000000006','{"verdicts":{"f1":"faux"},"reasons":{"f1":["urgence"]},"actions":{"f1":["report"]},"opened":["f1"],"x":1}','1','UA')->>'response';
select exam_submit('00000000-0000-0000-0000-00000000000c',:'att',repeat('a',64),'1','UA')->>'status';
reset role;
select q.type, an.score from answers an join questions q on q.id = an.question_id order by q.position;
