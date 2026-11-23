\set ON_ERROR_STOP 1
insert into auth.users(id, email) values ('00000000-0000-0000-0000-00000000a001', 'prof@x.fr');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000a001';
insert into tests(id, owner_id, title, draw_count, draw_rules) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000a001', 'Tirage', 10,
  '{"domains":[{"domain":"Réseau","min":4},{"domain":"Linux","min":3}],"balance":true}');
insert into questions(test_id, position, type, prompt, points, domain, difficulty)
select '00000000-0000-0000-0000-0000000000d1', g, 'long_text', 'Q' || g, 1,
  case when g <= 10 then 'Réseau' when g <= 20 then 'Linux' else 'Web' end,
  (array['facile','moyen','difficile'])[1 + g % 3]
from generate_series(1, 40) g;
do $$
declare v uuid[]; t tests; n_res int; n_lin int; i int;
begin
  select * into t from tests where id = '00000000-0000-0000-0000-0000000000d1';
  for i in 1..20 loop
    v := _draw_questions(t);
    select count(*) filter (where domain = 'Réseau'), count(*) filter (where domain = 'Linux') into n_res, n_lin from questions where id = any(v);
    if array_length(v, 1) <> 10 or n_res < 4 or n_lin < 3 then raise exception 'tirage faux : % % %', array_length(v, 1), n_res, n_lin; end if;
  end loop;
  raise notice 'tirage ok';
end $$;
insert into student_accommodations(email, extra_minutes) values ('eleve@x.fr', 30);
select 'acc ok' where (select extra_minutes from student_accommodations where email = 'eleve@x.fr') = 30;
