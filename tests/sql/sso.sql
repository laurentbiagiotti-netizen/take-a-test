\set ON_ERROR_STOP 1
\i ../../supabase/migrations/2026-11-16-sso-google-admin.sql
insert into auth.users(id, email, raw_app_meta_data) values ('00000000-0000-0000-0000-0000000005a1', 'Dylan@cybersup.ai', '{"provider":"google"}');
select role from profiles where id = '00000000-0000-0000-0000-0000000005a1';
insert into auth.users(id, email, raw_app_meta_data) values ('00000000-0000-0000-0000-0000000005a2', 'candidat.x@cybersup.ai', '{"provider":"email"}');
select role from profiles where id = '00000000-0000-0000-0000-0000000005a2';
\set ON_ERROR_STOP 0
insert into auth.users(id, email, raw_app_meta_data) values ('00000000-0000-0000-0000-0000000005a3', 'intrus@gmail.com', '{"provider":"google"}');
select count(*) as intrus from profiles where id = '00000000-0000-0000-0000-0000000005a3';
select staff_mfa from platform_settings;
