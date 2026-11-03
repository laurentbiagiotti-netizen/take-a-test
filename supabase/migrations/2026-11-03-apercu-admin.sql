-- Aperçu des épreuves par un admin (avant publication), à exécuter une fois.

alter table invites add column if not exists preview boolean not null default false;

create or replace function public._test_open(t tests, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select t.is_published or exists (
    select 1 from invites i join profiles p on p.email = i.email
     where i.test_id = t.id and i.preview and p.id = p_user);
$$;

create or replace function public.exam_prepare(p_user uuid, p_test uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t tests;
  sec test_secrets;
  v_email text;
  inv invites;
  a attempts;
  v_code_required boolean;
begin
  select * into t from tests where id = p_test;
  if t.id is null or not _test_open(t, p_user) then raise exception 'test_not_found' using errcode = 'P0002'; end if;
  select email into v_email from profiles where id = p_user;
  select * into inv from invites where test_id = p_test and email = lower(v_email);
  if t.invite_only and inv.id is null then raise exception 'not_invited' using errcode = 'P0001'; end if;
  if t.opens_at is not null and now() < t.opens_at then
    return jsonb_build_object('state', 'not_open', 'opens_at', t.opens_at, 'title', t.title);
  end if;

  select * into a from attempts where test_id = p_test and candidate_id = p_user;
  if a.id is null then
    if t.closes_at is not null and now() > t.closes_at then
      return jsonb_build_object('state', 'closed', 'title', t.title);
    end if;
    select * into sec from test_secrets where test_id = p_test;
    v_code_required := inv.id is not null or (not t.invite_only and sec.access_code is not null);
    insert into attempts(test_id, candidate_id, unlocked, identity_status, extra_minutes)
    values (p_test, p_user, not v_code_required,
            case when t.require_id_check then 'pending'::identity_status else 'not_required' end,
            coalesce(inv.extra_minutes, 0))
    returning * into a;
    perform _log(a.id, 'attempt_created', 'info', null, null);
  end if;

  return jsonb_build_object(
    'state', a.status, 'attempt_id', a.id, 'unlocked', a.unlocked,
    'identity_status', a.identity_status, 'title', t.title, 'description', t.description,
    'duration_minutes', t.duration_minutes + a.extra_minutes, 'max_violations', t.max_violations,
    'require_seb', t.require_seb, 'require_webcam', true, 'linear', true,
    'id_verify_before_start', t.id_verify_before_start, 'session_active', a.session_token_hash is not null,
    'allow_resume', t.allow_resume, 'closes_at', t.closes_at);
end; $$;

create or replace function public.exam_unlock(p_user uuid, p_test uuid, p_code text, p_ip text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t tests;
  sec test_secrets;
  a attempts;
  inv invites;
  v_email text;
  v_code text := upper(trim(coalesce(p_code, '')));
  v_fails int;
begin
  select * into t from tests where id = p_test;
  if t.id is null or not _test_open(t, p_user) then raise exception 'test_not_found' using errcode = 'P0002'; end if;
  select * into a from attempts where test_id = p_test and candidate_id = p_user for update;
  if a.id is null then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.unlocked then return jsonb_build_object('ok', true); end if;

  select count(*) into v_fails from proctor_events
   where attempt_id = a.id and kind = 'unlock_failed' and created_at > now() - interval '10 minutes';
  if v_fails >= 5 then raise exception 'too_many_attempts' using errcode = 'P0001'; end if;
  -- Limite globale par test et par IP (force brute avec plusieurs comptes)
  if p_ip is not null then
    select count(*) into v_fails from proctor_events e join attempts x on x.id = e.attempt_id
     where x.test_id = p_test and e.kind = 'unlock_failed' and e.ip = p_ip
       and e.created_at > now() - interval '10 minutes';
    if v_fails >= 20 then raise exception 'too_many_attempts' using errcode = 'P0001'; end if;
  end if;

  select email into v_email from profiles where id = p_user;
  select * into inv from invites where test_id = p_test and email = lower(v_email) for update;
  select * into sec from test_secrets where test_id = p_test;

  if inv.id is not null then
    if inv.used_by is not null and inv.used_by <> p_user then
      perform _log(a.id, 'unlock_failed', 'warning', '{"reason":"code_already_used"}', p_ip);
      return jsonb_build_object('ok', false, 'error', 'code_already_used');
    end if;
    if _sha256(inv.code) <> _sha256(v_code) then
      perform _log(a.id, 'unlock_failed', 'warning', '{"reason":"wrong_code"}', p_ip);
      return jsonb_build_object('ok', false, 'error', 'wrong_code');
    end if;
    update invites set used_at = coalesce(used_at, now()), used_by = p_user where id = inv.id;
  elsif not t.invite_only and sec.access_code is not null then
    if _sha256(upper(trim(sec.access_code))) <> _sha256(v_code) then
      perform _log(a.id, 'unlock_failed', 'warning', '{"reason":"wrong_code"}', p_ip);
      return jsonb_build_object('ok', false, 'error', 'wrong_code');
    end if;
  end if;

  update attempts set unlocked = true where id = a.id;
  perform _log(a.id, 'unlock_success', 'info', null, p_ip);
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.exam_begin(p_user uuid, p_attempt uuid, p_new_token_hash text,
                                             p_prev_token_hash text, p_ip text, p_ua text, p_nonce_hash text,
                                             p_notice boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a attempts;
  t tests;
  v_order uuid[];
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
      join profiles p on p.email = i.email where i.test_id = t.id and p.id = p_user), 0));
    -- 1. une variante tirée au hasard par groupe ; 2. tirage de N questions ; 3. ordre
    select array_agg(id) into v_order from (
      select id from (
        select distinct on (coalesce(variant_group, id::text)) id
        from questions where test_id = t.id
        order by coalesce(variant_group, id::text), random()) pool
      order by random()
      limit coalesce(t.draw_count, 100000)) s;
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
        when q2.type in ('hotspot', 'short_answer') then q2.options
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

create or replace function public.access_by_code(p_code text, p_ip text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  inv invites;
  t tests;
begin
  delete from access_failures where at < now() - interval '1 day';
  if p_ip is not null and (select count(*) from access_failures where ip = p_ip and at > now() - interval '10 minutes') >= 10 then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  if (select count(*) from access_failures where at > now() - interval '10 minutes') >= 300 then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  if length(v_code) between 8 and 32 then
    select * into inv from invites where upper(replace(code, '-', '')) = v_code;
  end if;
  if inv.id is not null then select * into t from tests where id = inv.test_id and (is_published or inv.preview); end if;
  if inv.id is null or t.id is null then
    insert into access_failures(ip) values (p_ip);
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true, 'email', inv.email, 'full_name', inv.full_name,
                            'test_id', inv.test_id, 'code', inv.code);
end; $$;

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin(), public.is_staff(), public.my_dashboard() to authenticated;

grant execute on function public.attempt_report(uuid), public.item_stats(uuid), public.staff_live(uuid), public.test_results(uuid) to authenticated;

grant execute on all functions in schema public to service_role;
