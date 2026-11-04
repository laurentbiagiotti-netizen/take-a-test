-- Tirage des activités pratiques : chaque candidat reçoit tous les QCM et des activités tirées au hasard,
-- de types variés, dans la limite de tests.activity_minutes.

alter table tests add column if not exists activity_minutes int check (activity_minutes is null or activity_minutes between 1 and 600);

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
      join profiles p on p.email = i.email where i.test_id = t.id and p.id = p_user), 0));
    -- 1. une variante tirée au hasard par groupe ; 2. tirage de N questions ; 3. ordre
    select array_agg(id) into v_order from (
      select id from (
        select distinct on (coalesce(variant_group, id::text)) id, type
        from questions where test_id = t.id
        order by coalesce(variant_group, id::text), random()) pool
      where t.activity_minutes is null or pool.type in ('mcq_single', 'mcq_multi', 'long_text', 'short_answer')
      order by random()
      limit coalesce(t.draw_count, 100000)) s;
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
