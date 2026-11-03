-- Script Bash (just-bash, Apache 2.0), fil d'actualité enrichi, simulations réalistes (appli photo, brassage, pare-feu web, capture réseau).

alter type question_type add value if not exists 'bash';
alter type question_type add value if not exists 'sim';

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

create or replace function public.exam_save_answer(p_user uuid, p_attempt uuid, p_token_hash text,
                                                   p_question uuid, p_response jsonb, p_ip text, p_ua text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a attempts;
  q questions;
  v_sel jsonb;
  v_allowed text[];
begin
  a := _load_session(p_user, p_attempt, p_token_hash, p_ip, p_ua);
  if a.status <> 'in_progress' then return jsonb_build_object('status', a.status); end if;
  if now() > a.deadline_at then raise exception 'time_over' using errcode = 'P0001'; end if;
  if not (p_question = any(a.question_order)) then raise exception 'bad_question' using errcode = 'P0001'; end if;
  perform _check_linear(a, p_question);
  select * into q from questions where id = p_question;

  if q.type = 'long_text' then
    if jsonb_typeof(p_response->'text') <> 'string' or length(p_response->>'text') > 20000 then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('text', p_response->>'text');
  elsif q.type = 'terminal' then
    if jsonb_typeof(p_response->'flag') <> 'string' or length(p_response->>'flag') > 200 then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('flag', p_response->>'flag');
  elsif q.type = 'short_answer' then
    if jsonb_typeof(p_response->'text') <> 'string' or length(p_response->>'text') > 500 then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('text', p_response->>'text');
  elsif q.type = 'ordering' then
    v_sel := p_response->'order';
    if jsonb_typeof(v_sel) <> 'array'
       or jsonb_array_length(v_sel) <> jsonb_array_length(q.options)
       or (select count(distinct x) from jsonb_array_elements_text(v_sel) x) <> jsonb_array_length(q.options)
       or exists (select 1 from jsonb_array_elements(v_sel) x where jsonb_typeof(x) <> 'string'
                  or (x #>> '{}') not in (select o->>'id' from jsonb_array_elements(q.options) o)) then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('order', v_sel);
  elsif q.type = 'matching' then
    v_sel := p_response->'pairs';
    if jsonb_typeof(v_sel) <> 'object'
       or exists (select 1 from jsonb_each(v_sel) e
                  where e.key not in (select o->>'id' from jsonb_array_elements(q.options->'left') o)
                     or jsonb_typeof(e.value) <> 'string'
                     or (e.value #>> '{}') not in (select o->>'id' from jsonb_array_elements(q.options->'right') o)) then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('pairs', v_sel);
  elsif q.type = 'hotspot' then
    v_sel := p_response->'selected';
    if jsonb_typeof(v_sel) <> 'array'
       or exists (select 1 from jsonb_array_elements(v_sel) x where jsonb_typeof(x) <> 'string'
                  or (x #>> '{}') not in (select o->>'id' from jsonb_array_elements(q.options->'segments') o))
       or (not coalesce((q.options->>'multi')::boolean, true) and jsonb_array_length(v_sel) > 1) then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('selected',
      (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(v_sel) x));
  elsif q.type = 'sql' then
    if coalesce(jsonb_typeof(p_response->'query'), '') <> 'string' or length(p_response->>'query') > 4000 then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('query', p_response->>'query');
  elsif q.type = 'decode' then
    if coalesce(jsonb_typeof(p_response->'text'), '') <> 'string' or length(p_response->>'text') > 500
       or (p_response ? 'recipe' and (jsonb_typeof(p_response->'recipe') <> 'array' or length((p_response->'recipe')::text) > 4000)) then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('text', p_response->>'text', 'recipe', coalesce(p_response->'recipe', '[]'::jsonb));
  elsif q.type = 'password' then
    if q.options->>'mode' = 'rank' then
      v_sel := p_response->'order';
      if coalesce(jsonb_typeof(v_sel), '') <> 'array' or jsonb_array_length(v_sel) <> jsonb_array_length(q.options->'items')
         or (select count(distinct x) from jsonb_array_elements_text(v_sel) x) <> jsonb_array_length(q.options->'items')
         or exists (select 1 from jsonb_array_elements(v_sel) x where jsonb_typeof(x) <> 'string'
                    or (x #>> '{}') not in (select o->>'id' from jsonb_array_elements(q.options->'items') o)) then
        raise exception 'bad_response' using errcode = 'P0001';
      end if;
      p_response := jsonb_build_object('order', v_sel);
    else
      if coalesce(jsonb_typeof(p_response->'text'), '') <> 'string' or length(p_response->>'text') > 128 then
        raise exception 'bad_response' using errcode = 'P0001';
      end if;
      p_response := jsonb_build_object('text', p_response->>'text');
    end if;
  elsif q.type in ('headers', 'subnet') then
    if (coalesce(jsonb_typeof(p_response->'fields'), '') <> 'object' and coalesce(jsonb_typeof(p_response->'subnets'), '') <> 'object')
       or length(p_response::text) > 3000 then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := case when p_response ? 'subnets' and q.type = 'subnet' then jsonb_build_object('subnets', p_response->'subnets')
                       else jsonb_build_object('fields', p_response->'fields') end;
  elsif q.type = 'sokoban' then
    if coalesce(jsonb_typeof(p_response->'moves'), '') <> 'array' or jsonb_array_length(p_response->'moves') > 6
       or exists (select 1 from jsonb_array_elements(p_response->'moves') x where jsonb_typeof(x) <> 'string' or length(x #>> '{}') > 2000) then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('moves', p_response->'moves',
      'undos', least(100000, greatest(0, coalesce((p_response->>'undos')::int, 0))),
      'restarts', least(100000, greatest(0, coalesce((p_response->>'restarts')::int, 0))),
      'ms', least(86400000, greatest(0, coalesce((p_response->>'ms')::bigint, 0))));
  elsif q.type = 'robot' then
    if coalesce(jsonb_typeof(p_response->'programs'), '') <> 'array' or jsonb_array_length(p_response->'programs') > 6
       or length((p_response->'programs')::text) > 4000 then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('programs', p_response->'programs', 'runs', least(100000, greatest(0, coalesce((p_response->>'runs')::int, 0))));
  elsif q.type = 'adsim' then
    if coalesce(jsonb_typeof(p_response->'state'), '') <> 'object' or length(p_response::text) > 60000 then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('state', p_response->'state', 'done', coalesce(p_response->'done', '[]'::jsonb));
  elsif q.type = 'sim' then
    if coalesce(jsonb_typeof(p_response->'state'), '') <> 'object' or length(p_response::text) > 20000 then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('state', p_response->'state');
  elsif q.type = 'bash' then
    if coalesce(jsonb_typeof(p_response->'script'), '') <> 'string' or length(p_response->>'script') > 8000 then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('script', p_response->>'script');
  elsif q.type = 'evtx' then
    if coalesce(jsonb_typeof(p_response->'answers'), '') <> 'object' or length(p_response::text) > 3000 then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('answers', p_response->'answers');
  elsif q.type = 'feed' then
    if coalesce(jsonb_typeof(p_response->'verdicts'), '') <> 'object' or length(p_response::text) > 8000
       or exists (select 1 from jsonb_each(p_response->'verdicts') e where (e.value #>> '{}') not in ('fiable', 'douteux', 'faux'))
       or (p_response ? 'reasons' and jsonb_typeof(p_response->'reasons') <> 'object')
       or (p_response ? 'reasons' and exists (select 1 from jsonb_each(p_response->'reasons') e where jsonb_typeof(e.value) <> 'array'))
       or (p_response ? 'actions' and jsonb_typeof(p_response->'actions') <> 'object')
       or (p_response ? 'actions' and exists (select 1 from jsonb_each(p_response->'actions') e where jsonb_typeof(e.value) <> 'array'
             or exists (select 1 from jsonb_array_elements(e.value) x where (x #>> '{}') not in ('like', 'share', 'report'))))
       or (p_response ? 'opened' and jsonb_typeof(p_response->'opened') <> 'array') then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('verdicts', p_response->'verdicts', 'reasons', coalesce(p_response->'reasons', '{}'::jsonb),
                                     'actions', coalesce(p_response->'actions', '{}'::jsonb), 'opened', coalesce(p_response->'opened', '[]'::jsonb));
  elsif q.type = 'tickets' then
    if coalesce(jsonb_typeof(p_response->'tickets'), '') <> 'object' or length(p_response::text) > 6000 then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('tickets', p_response->'tickets');
  elsif q.type = 'netpuzzle' then
    if coalesce(jsonb_typeof(p_response->'rot'), '') <> 'array' or jsonb_array_length(p_response->'rot') > 81
       or exists (select 1 from jsonb_array_elements(p_response->'rot') x where jsonb_typeof(x) <> 'number') then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('rot', p_response->'rot',
      'moves', least(100000, greatest(0, coalesce((p_response->>'moves')::int, 0))),
      'ms', least(86400000, greatest(0, coalesce((p_response->>'ms')::bigint, 0))));
  elsif q.type = 'blocks' then
    if coalesce(jsonb_typeof(p_response->'program'), '') <> 'object' or length((p_response->'program')::text) > 20000
       or (p_response ? 'state' and length((p_response->'state')::text) > 60000) then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('program', p_response->'program', 'state', p_response->'state');
  elsif q.type in ('mcq_single', 'mcq_multi') then
    v_sel := p_response->'selected';
    if jsonb_typeof(v_sel) <> 'array' then raise exception 'bad_response' using errcode = 'P0001'; end if;
    select array_agg(o->>'id') into v_allowed from jsonb_array_elements(q.options) o;
    if exists (select 1 from jsonb_array_elements(v_sel) x
               where jsonb_typeof(x) <> 'string' or not ((x #>> '{}') = any(v_allowed))) then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    if q.type = 'mcq_single' and jsonb_array_length(v_sel) > 1 then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('selected',
      (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(v_sel) x));
  else
    raise exception 'bad_question' using errcode = 'P0001';
  end if;

  insert into answers(attempt_id, question_id, response, updated_at)
  values (a.id, p_question, p_response, now())
  on conflict (attempt_id, question_id) do update set response = excluded.response, auto_score = null, updated_at = now();
  if q.type in ('sql', 'password', 'blocks', 'subnet', 'netpuzzle', 'sokoban', 'robot', 'adsim', 'tickets', 'feed', 'evtx', 'bash', 'sim') then
    return jsonb_build_object('status', 'in_progress', 'saved', true, 'auto', true, 'response', p_response);
  end if;
  return jsonb_build_object('status', 'in_progress', 'saved', true);
end; $$;

create or replace function public._finalize_attempt(p_attempt uuid, p_status attempt_status, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  a attempts;
  r record;
  s numeric;
  resp jsonb;
  correct jsonb;
  v_total numeric := 0;
  v_max numeric := 0;
  v_partial boolean;
  v_good int; v_bad int; v_n int;
begin
  select * into a from attempts where id = p_attempt for update;
  if a.id is null or a.status not in ('pending', 'in_progress') then return; end if;
  select partial_points into v_partial from tests where id = a.test_id;

  for r in
    select q.id as qid, q.type, q.points, q.options, an.id as aid, an.response, an.auto_score, k.correct, qt.flag,
           jsonb_array_length(coalesce(qt.scenario->'objectives', '[]'::jsonb)) as n_obj, ts.done_ids,
           es.score_ratio, es.id as esid
    from questions q
    left join answers an on an.question_id = q.id and an.attempt_id = p_attempt
    left join answer_keys k on k.question_id = q.id
    left join question_terminals qt on qt.question_id = q.id
    left join terminal_states ts on ts.attempt_id = p_attempt and ts.question_id = q.id
    left join external_sessions es on es.attempt_id = p_attempt and es.question_id = q.id
    where q.id = any(coalesce(a.question_order, '{}'))
  loop
    v_max := v_max + r.points;
    continue when r.type = 'long_text';
    if r.type in ('sql', 'password', 'blocks', 'subnet', 'netpuzzle', 'sokoban', 'robot', 'adsim', 'tickets', 'feed', 'evtx', 'bash', 'sim') then
      -- Noté par le serveur à l'enregistrement de la réponse (jamais par le navigateur)
      s := least(r.points, greatest(0, coalesce(r.auto_score, 0)));
    elsif r.type = 'external' then
      s := round(r.points * least(1, greatest(0, coalesce(r.score_ratio, 0))), 2);
      update external_sessions set final = true where id = r.esid;
    elsif r.type = 'mcq_multi' and v_partial and r.response is not null then
      -- Points partiels : bonnes cases cochées moins mauvaises, au prorata, jamais négatif
      v_n := jsonb_array_length(coalesce(r.correct, '[]'::jsonb));
      select count(*) filter (where x in (select jsonb_array_elements_text(r.correct))),
             count(*) filter (where x not in (select jsonb_array_elements_text(r.correct)))
        into v_good, v_bad from jsonb_array_elements_text(coalesce(r.response->'selected', '[]'::jsonb)) x;
      s := case when v_n = 0 then 0 else round(r.points * greatest(0, v_good - v_bad)::numeric / v_n, 2) end;
    else
      s := _grade(r.type, r.points, r.response, r.correct, r.flag, r.n_obj, coalesce(r.done_ids, '{}'));
    end if;
    if r.aid is null and r.type in ('terminal', 'external') and (s > 0 or r.esid is not null) then
      insert into answers(attempt_id, question_id, response, score)
      values (p_attempt, r.qid, case when r.type = 'external' then jsonb_build_object('completed', true) else '{}'::jsonb end, s);
    elsif r.aid is not null then
      update answers set score = s where id = r.aid;
    end if;
    v_total := v_total + s;
  end loop;

  update attempts set status = p_status, submitted_at = now(), score = v_total,
         max_score = v_max, end_reason = p_reason, session_token_hash = null
   where id = p_attempt;

  perform _log(p_attempt, 'attempt_' || p_status::text,
               case when p_status = 'submitted' then 'info' else 'critical' end,
               jsonb_build_object('reason', p_reason, 'score', v_total, 'max_score', v_max), null);
  perform _enqueue_webhook('attempt.' || p_status::text, jsonb_build_object(
    'attempt_id', p_attempt, 'test_id', a.test_id, 'candidate_id', a.candidate_id,
    'candidate_email', (select email from profiles where id = a.candidate_id),
    'status', p_status, 'reason', p_reason, 'score', v_total, 'max_score', v_max,
    'violation_count', a.violation_count, 'submitted_at', now(),
    'admission', _attempt_report(p_attempt),
    'external_ref', (select i.external_ref from invites i join profiles pr on pr.email = i.email
                     where i.test_id = a.test_id and pr.id = a.candidate_id),
    'journal_last_hash', (select last_event_hash from attempts where id = p_attempt),
    'journal_events', (select event_seq from attempts where id = p_attempt)));
end; $$;

create or replace function public.exam_set_auto_score(p_attempt uuid, p_question uuid, p_response jsonb, p_score numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_points numeric; v_n int;
begin
  select q.points into v_points from questions q join attempts a on a.id = p_attempt
    where q.id = p_question and q.type in ('sql', 'password', 'blocks', 'subnet', 'netpuzzle', 'sokoban', 'robot', 'adsim', 'tickets', 'feed', 'evtx', 'bash', 'sim') and a.status = 'in_progress';
  if v_points is null then return jsonb_build_object('ok', false); end if;
  update answers set auto_score = least(v_points, greatest(0, coalesce(p_score, 0)))
    where attempt_id = p_attempt and question_id = p_question and response = p_response;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', v_n = 1);
end; $$;
