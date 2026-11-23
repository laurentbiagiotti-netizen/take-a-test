-- Plateforme v2 : tirage par domaine, salles et campus, tiers-temps par étudiant,
-- difficulté et versions des questions, origine des copies de questions.

alter table tests add column if not exists draw_rules jsonb
  check (draw_rules is null or (jsonb_typeof(draw_rules) = 'object' and octet_length(draw_rules::text) <= 5000));
alter table tests add column if not exists room text check (room is null or length(room) <= 100);
alter table tests add column if not exists campus text check (campus is null or length(campus) <= 60);

alter table questions add column if not exists difficulty text check (difficulty is null or difficulty in ('facile', 'moyen', 'difficile'));
alter table questions add column if not exists origin_id uuid;
alter table question_bank add column if not exists difficulty text check (difficulty is null or difficulty in ('facile', 'moyen', 'difficile'));

-- Tiers-temps et aménagements, saisis une fois par étudiant et appliqués à toutes ses épreuves
create table if not exists student_accommodations (
  email text primary key check (email = lower(email) and length(email) <= 320),
  extra_minutes int not null default 0 check (extra_minutes between 0 and 600),
  note text check (note is null or length(note) <= 500),
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table student_accommodations enable row level security;
drop policy if exists "accommodations admin all" on student_accommodations;
create policy "accommodations admin all" on student_accommodations for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "accommodations staff read" on student_accommodations;
create policy "accommodations staff read" on student_accommodations for select to authenticated using (is_staff());
revoke all on student_accommodations from anon;

-- Historique des versions : chaque modification d'une question (examen ou banque) garde l'état précédent
create table if not exists question_versions (
  id bigint generated always as identity primary key,
  question_id uuid not null,
  source text not null check (source in ('exam', 'bank')),
  snapshot jsonb not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index if not exists question_versions_q on question_versions (question_id, changed_at desc);
alter table question_versions enable row level security;
drop policy if exists "versions staff read" on question_versions;
create policy "versions staff read" on question_versions for select to authenticated using (is_staff());
revoke all on question_versions from anon;

create or replace function public._question_version() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_snap jsonb;
begin
  if tg_table_name = 'questions' then
    v_snap := to_jsonb(old) || jsonb_build_object('correct', (select correct from answer_keys where question_id = old.id));
    insert into question_versions(question_id, source, snapshot, changed_by) values (old.id, 'exam', v_snap, auth.uid());
  elsif tg_table_name = 'question_bank' then
    insert into question_versions(question_id, source, snapshot, changed_by) values (old.id, 'bank', to_jsonb(old), auth.uid());
  elsif tg_table_name = 'answer_keys' then
    insert into question_versions(question_id, source, snapshot, changed_by)
    select q.id, 'exam', to_jsonb(q) || jsonb_build_object('correct', old.correct), auth.uid() from questions q where q.id = old.question_id;
  end if;
  return new;
end; $$;
drop trigger if exists questions_version on questions;
create trigger questions_version after update on questions for each row
  when (old.prompt is distinct from new.prompt or old.options is distinct from new.options or old.points is distinct from new.points
        or old.explanation is distinct from new.explanation or old.domain is distinct from new.domain or old.difficulty is distinct from new.difficulty)
  execute function _question_version();
drop trigger if exists bank_version on question_bank;
create trigger bank_version after update on question_bank for each row
  when (old.prompt is distinct from new.prompt or old.options is distinct from new.options or old.correct is distinct from new.correct
        or old.points is distinct from new.points or old.explanation is distinct from new.explanation)
  execute function _question_version();
drop trigger if exists keys_version on answer_keys;
create trigger keys_version after update on answer_keys for each row
  when (old.correct is distinct from new.correct) execute function _question_version();

-- Statistiques par option de QCM : combien de copies ont choisi chaque réponse (distracteurs jamais choisis)
create or replace function public.option_stats(p_test uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_object_agg(question_id, counts) from (
      select an.question_id, jsonb_object_agg(opt, n) as counts from (
        select an.question_id, o.value as opt, count(*) as n
        from answers an
        join attempts a on a.id = an.attempt_id and a.test_id = p_test and a.status in ('submitted', 'expired', 'terminated')
          and not _preview_attempt(a.test_id, a.candidate_id)
        join questions q on q.id = an.question_id and q.type in ('mcq_single', 'mcq_multi')
        cross join lateral jsonb_array_elements_text(case when jsonb_typeof(an.response->'selected') = 'array' then an.response->'selected'
                                                          when jsonb_typeof(an.response) = 'array' then an.response else '[]'::jsonb end) o(value)
        group by an.question_id, o.value) an
      group by an.question_id) x), '{}'::jsonb);
end; $$;

-- Difficulté estimée d'après les copies : facile au-dessus de 75 % de réussite, difficile sous 40 %
create or replace function public.estimate_difficulty(p_test uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v int := 0; r jsonb;
begin
  if not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  for r in select * from jsonb_array_elements(item_stats(p_test)->'questions') loop
    if (r->>'n')::int >= 5 and r->>'reussite' is not null then
      update questions set difficulty = case when (r->>'reussite')::numeric >= 0.75 then 'facile'
                                             when (r->>'reussite')::numeric < 0.40 then 'difficile' else 'moyen' end
      where id = (r->>'id')::uuid and difficulty is distinct from case when (r->>'reussite')::numeric >= 0.75 then 'facile'
                                             when (r->>'reussite')::numeric < 0.40 then 'difficile' else 'moyen' end;
      if found then v := v + 1; end if;
    end if;
  end loop;
  return v;
end; $$;

-- Tirage des questions d'un candidat (hors activités pratiques) :
--  - une seule variante par groupe de variantes ;
--  - règles « au moins N questions du domaine X » (tests.draw_rules) servies d'abord ;
--  - complément au hasard jusqu'à draw_count ;
--  - difficulté équilibrée si demandé : facile, moyen et difficile alternent.
create or replace function public._draw_questions(t tests)
returns uuid[] language plpgsql volatile security definer set search_path = public as $$
declare
  v uuid[] := '{}';
  r jsonb;
  v_bal boolean := coalesce((t.draw_rules->>'balance')::boolean, false);
  v_n int;
begin
  create temporary table if not exists _pool (id uuid, domain text, diff text, rnd float8) on commit drop;
  truncate _pool;
  insert into _pool
  select id, domain, coalesce(difficulty, 'moyen'), random() from (
    select distinct on (coalesce(variant_group, id::text)) id, domain, difficulty, type
    from questions where test_id = t.id
    order by coalesce(variant_group, id::text), random()) p
  where t.activity_minutes is null or p.type in ('mcq_single', 'mcq_multi', 'long_text', 'short_answer');

  for r in select * from jsonb_array_elements(coalesce(t.draw_rules->'domains', '[]'::jsonb)) loop
    v_n := greatest(0, coalesce((r->>'min')::int, 0));
    if v_n > 0 then
      v := v || coalesce((select array_agg(id) from (
        select id from _pool where lower(coalesce(domain, '')) = lower(r->>'domain') and not (id = any(v))
        order by case when v_bal then row_number() over (partition by diff order by rnd) else 0 end, rnd
        limit v_n) x), '{}');
    end if;
  end loop;

  v_n := coalesce(t.draw_count, 100000) - coalesce(array_length(v, 1), 0);
  if v_n > 0 then
    v := v || coalesce((select array_agg(id) from (
      select id from _pool where not (id = any(v))
      order by case when v_bal then row_number() over (partition by diff order by rnd) else 0 end, rnd
      limit v_n) x), '{}');
  end if;
  return case when array_length(v, 1) is null then null else v end;
end; $$;
revoke all on function public._draw_questions(tests) from public, anon, authenticated;

create or replace function public.exam_begin(p_user uuid, p_attempt uuid, p_new_token_hash text,
                                             p_prev_token_hash text, p_ip text, p_ua text, p_nonce_hash text,
                                             p_notice boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a attempts;
  t tests;
  v_order uuid[];
  v_act int := 0;
  v_opts jsonb := '{}'::jsonb;
  v_one jsonb;
  q record;
  v_questions jsonb;
  v_answers jsonb;
  v_token text;
begin
  select * into a from attempts where id = p_attempt and candidate_id = p_user for update;
  if a.id is null then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  select * into t from tests where id = a.test_id;
  if not _test_open(t, p_user) then raise exception 'test_not_found' using errcode = 'P0002'; end if;
  if not a.unlocked then raise exception 'locked' using errcode = 'P0001'; end if;
  if a.identity_status in ('pending', 'rejected')
     or (t.id_verify_before_start and a.identity_status = 'submitted' and a.status = 'pending') then
    raise exception 'identity_required' using errcode = 'P0001';
  end if;
  if p_new_token_hash is null or length(p_new_token_hash) <> 64 then raise exception 'bad_token' using errcode = 'P0001'; end if;

  if a.status = 'pending' then
    if t.closes_at is not null and now() > t.closes_at then raise exception 'test_closed' using errcode = 'P0001'; end if;
    -- Notice d'information lue avant de commencer (case à cocher)
    if not coalesce(p_notice, false) then raise exception 'notice_required' using errcode = 'P0001'; end if;
    if t.opens_at is not null and now() < t.opens_at then raise exception 'test_not_open' using errcode = 'P0001'; end if;

    -- Tiers-temps fixé sur l'invitation après la création de la tentative
    a.extra_minutes := greatest(a.extra_minutes, coalesce((select i.extra_minutes from invites i
      join profiles p on p.email = i.email where i.test_id = t.id and p.id = p_user), 0),
      -- Tiers-temps de l'étudiant, valable pour toutes ses épreuves
      coalesce((select sa.extra_minutes from student_accommodations sa join profiles p on lower(p.email) = sa.email where p.id = p_user), 0));
    -- 1. une variante tirée au hasard par groupe ; 2. tirage (règles par domaine, difficulté équilibrée) ; 3. ordre
    v_order := _draw_questions(t);
    -- Activités pratiques : tirées au hasard, de types variés d'abord, sans dépasser activity_minutes.
    if t.activity_minutes is not null then
      for q in
        select x.id, x.secs from (
          select p.id, coalesce(p.time_limit_s, qe.time_limit_s, 480) as secs,
                 row_number() over (partition by p.type order by random()) as rk, random() as r
          from (select distinct on (coalesce(variant_group, id::text)) id, type, time_limit_s
                  from questions where test_id = t.id
                  order by coalesce(variant_group, id::text), random()) p
          left join question_externals qe on qe.question_id = p.id
          where p.type not in ('mcq_single', 'mcq_multi', 'long_text', 'short_answer')) x
        order by x.rk, x.r
      loop
        if v_act + q.secs <= t.activity_minutes * 60 then
          v_order := coalesce(v_order, '{}') || q.id;
          v_act := v_act + q.secs;
        end if;
      end loop;
    end if;
    if t.shuffle_questions then
      select array_agg(id order by random()) into v_order from questions where id = any(v_order);
    else
      select array_agg(id order by position, id) into v_order from questions where id = any(v_order);
    end if;
    if v_order is null then raise exception 'no_questions' using errcode = 'P0001'; end if;

    for q in select q3.id, q3.type, q3.options, k3.correct from questions q3
             left join answer_keys k3 on k3.question_id = q3.id
             where q3.id = any(v_order) and q3.options is not null
               and q3.type in ('mcq_single', 'mcq_multi', 'ordering', 'matching') loop
      if q.type = 'ordering' then
        -- Toujours mélangé, et jamais servi dans l'ordre correct.
        for i in 1..6 loop
          select jsonb_agg(o->>'id' order by random()) into v_one from jsonb_array_elements(q.options) o;
          exit when v_one is distinct from q.correct or jsonb_array_length(q.options) < 2;
        end loop;
      elsif q.type = 'matching' then
        select jsonb_agg(o->>'id' order by random()) into v_one from jsonb_array_elements(q.options->'right') o;
      else
        select jsonb_agg(o->>'id' order by case when t.shuffle_options then random() else ord end) into v_one
        from jsonb_array_elements(q.options) with ordinality as x(o, ord);
      end if;
      v_opts := v_opts || jsonb_build_object(q.id::text, v_one);
    end loop;

    update attempts set status = 'in_progress', started_at = now(),
      deadline_at = case when t.closes_at is null
                         then now() + make_interval(mins => t.duration_minutes + a.extra_minutes)
                         else least(now() + make_interval(mins => t.duration_minutes + a.extra_minutes), t.closes_at) end,
      question_order = v_order, option_orders = v_opts, extra_minutes = a.extra_minutes,
      session_token_hash = p_new_token_hash, session_started_at = now(), last_seen_at = now(),
      client_ip = p_ip, user_agent = left(coalesce(p_ua, ''), 500)
    where id = a.id returning * into a;
    v_token := 'new';
    update attempts set notice_ack_at = now() where id = a.id;
    perform _log(a.id, 'exam_started', 'info', jsonb_build_object('ua', left(p_ua, 300), 'notice_acknowledged', true), p_ip);
    a := _place_question(a.id);

  elsif a.status = 'in_progress' then
    if now() > a.deadline_at + make_interval(secs => t.grace_seconds) then
      perform _finalize_attempt(a.id, 'expired', 'deadline');
      return jsonb_build_object('status', 'expired');
    end if;
    if p_prev_token_hash is not null and a.session_token_hash = p_prev_token_hash then
      -- Même navigateur qui recharge la page : on garde la session, avec les
      -- mêmes contrôles de poste que pour toute autre action.
      a := _load_session(p_user, p_attempt, p_prev_token_hash, p_ip, p_ua);
      if a.status <> 'in_progress' then return jsonb_build_object('status', a.status); end if;
      perform _log(a.id, 'session_reloaded', 'warning', null, p_ip);
      if (select count(*) from proctor_events where attempt_id = a.id and kind = 'session_reloaded') > 3 then
        a := _add_violation(a.id, 'excessive_reloads', null, p_ip);
        if a.status <> 'in_progress' then return jsonb_build_object('status', a.status); end if;
      end if;
      v_token := 'keep';
    elsif a.resume_allowed or t.allow_resume then
      update attempts set session_token_hash = p_new_token_hash, session_started_at = now(), resume_allowed = false,
        last_seen_at = now(), client_ip = p_ip, user_agent = left(coalesce(p_ua, ''), 500)
      where id = a.id returning * into a;
      v_token := 'new';
      perform _log(a.id, 'session_resumed', 'warning',
                   jsonb_build_object('ua', left(p_ua, 300)), p_ip);
    else
      perform _log(a.id, 'concurrent_session_blocked', 'violation',
                   jsonb_build_object('ua', left(p_ua, 300)), p_ip);
      raise exception 'session_locked' using errcode = 'P0001';
    end if;
  else
    return jsonb_build_object('status', a.status);
  end if;

  if p_nonce_hash is null or length(p_nonce_hash) <> 64 then raise exception 'bad_token' using errcode = 'P0001'; end if;
  update attempts set recent_nonce_hashes = (array_remove(array[request_nonce_hash], null) || recent_nonce_hashes)[1:3],
                      request_nonce_hash = p_nonce_hash where id = a.id;

  select jsonb_agg(jsonb_build_object(
      'id', q2.id, 'type', q2.type, 'prompt', q2.prompt, 'points', q2.points, 'image_url', q2.image_url,
      'terminal', (select jsonb_build_object(
          'cwd', coalesce(ts.state->>'cwd', qt.scenario->>'home', '/home/' || coalesce(qt.scenario->>'user', 'candidat')),
          'prompt', coalesce(qt.scenario->>'user', 'candidat') || '@' || coalesce(qt.scenario->>'hostname', 'lab') || ':~$',
          'motd', qt.scenario->>'motd',
          'has_flag', qt.flag is not null,
          'objectives', (select coalesce(jsonb_agg(jsonb_build_object('id', o->>'id', 'title', o->>'title',
                                 'done', (o->>'id') = any(coalesce(ts.done_ids, '{}')))), '[]'::jsonb)
                         from jsonb_array_elements(coalesce(qt.scenario->'objectives', '[]'::jsonb)) o))
        from question_terminals qt
        left join terminal_states ts on ts.attempt_id = a.id and ts.question_id = qt.question_id
        where qt.question_id = q2.id and q2.type = 'terminal'),
      'external', (select jsonb_build_object('tool', qe.tool, 'label', qe.label, 'time_limit_s', qe.time_limit_s,
                          'started', es.id is not null, 'completed', coalesce(es.completed, false))
        from question_externals qe
        left join external_sessions es on es.attempt_id = a.id and es.question_id = qe.question_id
        where qe.question_id = q2.id and q2.type = 'external'),
      'options', case
        when q2.type in ('mcq_single', 'mcq_multi', 'ordering') then
          (select jsonb_agg(o order by array_position(
             array(select jsonb_array_elements_text(a.option_orders->(q2.id::text))), o->>'id'))
           from jsonb_array_elements(q2.options) o)
        when q2.type = 'matching' then
          jsonb_build_object('left', q2.options->'left', 'right',
            (select jsonb_agg(o order by array_position(
               array(select jsonb_array_elements_text(a.option_orders->(q2.id::text))), o->>'id'))
             from jsonb_array_elements(q2.options->'right') o))
        when q2.type in ('hotspot', 'short_answer', 'sql', 'decode', 'password', 'blocks', 'headers', 'subnet', 'netpuzzle', 'sokoban', 'robot', 'adsim', 'tickets', 'feed', 'evtx', 'bash', 'sim') then q2.options
        else null end)
    order by array_position(a.question_order, q2.id))
  into v_questions from questions q2 where q2.id = any(a.question_order);

  select coalesce(jsonb_object_agg(question_id::text, response), '{}'::jsonb)
  into v_answers from answers where attempt_id = a.id;

  return jsonb_build_object('status', 'in_progress', 'token', v_token, 'attempt_id', a.id, 'deadline_at', a.deadline_at, 'server_now', now(),
    'questions', v_questions, 'answers', v_answers,
    'linear', true, 'current_index', a.current_index,
    'timing', t.timing, 'q_deadline_at', a.q_deadline_at,
    'violation_count', a.violation_count, 'max_violations', t.max_violations);
end; $$;

-- Classes (promos) créées par l'équipe, en plus de celles déduites des épreuves
create table if not exists classes (
  name text primary key check (length(name) between 1 and 80),
  campus text check (campus is null or length(campus) <= 60),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table classes enable row level security;
drop policy if exists "classes admin all" on classes;
create policy "classes admin all" on classes for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "classes staff read" on classes;
create policy "classes staff read" on classes for select to authenticated using (is_staff());
revoke all on classes from anon;

-- Supprimer une épreuve ne fait plus perdre ses questions : elles sont versées
-- dans la banque avant la suppression (sans doublon d'énoncé pour un même type).
create or replace function public._archive_test_questions() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_f text := lower(coalesce(old.formation, ''));
  v_level text := case
    when v_f ~ '(bachelor|licence|^b)\s*[1-3]' then 'B' || substring(v_f from '(?:bachelor|licence|^b)\s*([1-3])')
    when v_f ~ '(mast[eè]re|master|msc|^m)\s*[12]' then 'M' || substring(v_f from '(?:mast[eè]re|master|msc|^m)\s*([12])')
    else 'Tous' end;
begin
  insert into question_bank(level, domain, type, prompt, options, correct, points, explanation, image_url, time_limit_s, terminal, external, source, difficulty)
  select v_level, q.domain, q.type, left(q.prompt, 20000), q.options, k.correct, least(q.points, 1000), q.explanation, q.image_url, q.time_limit_s,
         case when qt.question_id is not null then jsonb_build_object('scenario', qt.scenario, 'flag', qt.flag) end,
         case when qe.question_id is not null then jsonb_build_object('tool', qe.tool, 'label', qe.label, 'time_limit_s', qe.time_limit_s,
                                                                      'scenario', qe.scenario, 'answer_key', qe.answer_key) end,
         left('Épreuve supprimée : ' || old.title, 200), q.difficulty
  from questions q
  left join answer_keys k on k.question_id = q.id
  left join question_terminals qt on qt.question_id = q.id
  left join question_externals qe on qe.question_id = q.id
  where q.test_id = old.id and length(q.prompt) >= 1
    and not exists (select 1 from question_bank b where b.type = q.type and md5(b.prompt) = md5(q.prompt));
  return old;
end; $$;
drop trigger if exists tests_archive_questions on tests;
create trigger tests_archive_questions before delete on tests for each row execute function _archive_test_questions();

-- Correction d'erreur répercutée : recopie une question (d'une épreuve ou de la banque)
-- dans ses copies (questions.origin_id) des épreuves où personne n'a encore composé.
create or replace function public.propagate_question(p_id uuid, p_source text default 'exam')
returns int language plpgsql security definer set search_path = public as $$
declare v int := 0; s record; q record;
begin
  if not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_source = 'bank' then
    select prompt, options, correct, points, explanation, domain, difficulty, image_url into s from question_bank where id = p_id;
  else
    select q0.prompt, q0.options, k.correct, q0.points, q0.explanation, q0.domain, q0.difficulty, q0.image_url into s
    from questions q0 left join answer_keys k on k.question_id = q0.id where q0.id = p_id;
  end if;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  for q in select c.id from questions c
           where c.origin_id = p_id and c.id <> p_id
             and not exists (select 1 from attempts a where a.test_id = c.test_id and a.status <> 'pending'
                             and not _preview_attempt(a.test_id, a.candidate_id)) loop
    update questions set prompt = s.prompt, options = s.options, points = s.points, explanation = s.explanation,
                         domain = s.domain, difficulty = s.difficulty, image_url = s.image_url where id = q.id;
    insert into answer_keys(question_id, correct) values (q.id, s.correct)
      on conflict (question_id) do update set correct = excluded.correct;
    v := v + 1;
  end loop;
  return v;
end; $$;
revoke all on function public.propagate_question(uuid, text) from public, anon;
grant execute on function public.propagate_question(uuid, text) to authenticated;

-- Copies d'une question encore modifiables (pour annoncer la portée d'une correction)
create or replace function public.question_copies(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not is_staff() then '[]'::jsonb else coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'test_id', c.test_id, 'title', t.title,
    'started', exists (select 1 from attempts a where a.test_id = c.test_id and a.status <> 'pending' and not _preview_attempt(a.test_id, a.candidate_id)))), '[]'::jsonb) end
  from questions c join tests t on t.id = c.test_id where c.origin_id = p_id and c.id <> p_id;
$$;
revoke all on function public.question_copies(uuid) from public, anon;
grant execute on function public.question_copies(uuid) to authenticated;
