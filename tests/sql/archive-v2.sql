-- Suppression d'une épreuve : ses questions restent en banque ; correction répercutée
\set ON_ERROR_STOP on
begin;
insert into auth.users(id, email) values ('00000000-0000-0000-0000-00000000a009', 'prof9@x.fr');
insert into tests(id, owner_id, title, formation, duration_minutes) values ('aaaaaaaa-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a009', 'Archive', 'Bachelor 1 Cybersécurité', 30);
insert into questions(id, test_id, type, prompt, points, domain) values
  ('aaaaaaaa-0000-0000-0000-00000000b001', 'aaaaaaaa-0000-0000-0000-00000000a001', 'mcq_single', 'Question archive unique 1', 2, 'Réseau'),
  ('aaaaaaaa-0000-0000-0000-00000000b002', 'aaaaaaaa-0000-0000-0000-00000000a001', 'short_answer', 'Question archive unique 2', 1, 'Linux');
insert into answer_keys(question_id, correct) values ('aaaaaaaa-0000-0000-0000-00000000b001', '["a"]');
delete from tests where id = 'aaaaaaaa-0000-0000-0000-00000000a001';
do $$ begin
  if (select count(*) from question_bank where prompt like 'Question archive unique %' and level = 'B1') <> 2 then raise exception 'archive absente'; end if;
  if not exists (select 1 from question_bank where prompt = 'Question archive unique 1' and correct = '["a"]'::jsonb) then raise exception 'corrige perdu'; end if;
  if exists (select 1 from questions where test_id = 'aaaaaaaa-0000-0000-0000-00000000a001') then raise exception 'questions restantes'; end if;
end $$;
rollback;
