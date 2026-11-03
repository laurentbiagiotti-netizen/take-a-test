\set ON_ERROR_STOP 0
-- Accès par code : bon code, code sans tirets, mauvais code, limite par IP,
-- épreuve non publiée, premier admin unique, appels interdits au candidat.
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@cybersup.ai','{}'),('00000000-0000-0000-0000-00000000000c','eve@test.fr','{}');
insert into tests(id, owner_id, title, is_published, invite_only) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','Pub',true,true),
 ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-00000000000a','Brouillon',false,true);
insert into invites(test_id, email, code, full_name) values
 ('11111111-1111-1111-1111-111111111111','eve@test.fr','ABCD-EFGH-JKLM','Eve'),
 ('22222222-2222-2222-2222-222222222222','eve@test.fr','ZZZZ-YYYY-XXXX',null);
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select access_by_code('ABCD-EFGH-JKLM', '9.9.9.9') as appel_candidat;
select staff_bootstrap('00000000-0000-0000-0000-00000000000c') as auto_promotion;
reset role;
set role service_role;
select access_by_code('abcd-efgh-jklm', '1.1.1.1')->>'email' as bon_code;
select access_by_code('ABCDEFGHJKLM', '1.1.1.1')->>'test_id' as sans_tirets;
select access_by_code('ZZZZ-YYYY-XXXX', '1.1.1.1')->>'ok' as non_publie;
select access_by_code('AAAA-AAAA-AAAA', '2.2.2.2')->>'ok' from generate_series(1, 10);
select access_by_code('ABCD-EFGH-JKLM', '2.2.2.2') as ip_bloquee;
select staff_bootstrap('00000000-0000-0000-0000-00000000000a') as premier_admin;
select staff_bootstrap('00000000-0000-0000-0000-00000000000c') as second_admin_refuse;
reset role;
select email, role from profiles order by email;
