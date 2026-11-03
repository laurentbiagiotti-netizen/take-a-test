-- Pause et scan à 360° de la pièce au téléphone, au N-ième avertissement (réglable par épreuve).

alter table tests add column if not exists room_scan_after int not null default 3 check (room_scan_after between 0 and 50);

alter table attempts add column if not exists paused_at timestamptz;
alter table attempts add column if not exists pause_reason text check (pause_reason is null or pause_reason in ('room_scan'));
alter table attempts add column if not exists scan_token_hash text;
alter table attempts add column if not exists scan_token_at timestamptz;

create or replace function public._add_violation(p_attempt uuid, p_kind text, p_detail jsonb, p_ip text)
returns attempts language plpgsql security definer set search_path = public as $$
declare a attempts; v_max int; v_scan int;
begin
  select * into a from attempts where id = p_attempt;
  -- Pendant la pause (scan de la pièce au téléphone), rien n'est compté comme infraction
  if a.paused_at is not null then
    perform _log(p_attempt, p_kind, 'warning', coalesce(p_detail, '{}'::jsonb) || '{"pendant_pause": true}'::jsonb, p_ip);
    return a;
  end if;
  perform _log(p_attempt, p_kind, 'violation', p_detail, p_ip);
  update attempts set violation_count = violation_count + 1 where id = p_attempt returning * into a;
  select max_violations, room_scan_after into v_max, v_scan from tests where id = a.test_id;
  -- Seuil atteint : alerte au surveillant, jamais d'arrêt automatique. Une personne
  -- de l'équipe vérifie et décide (CNIL, délib. 2023-058, §38 ; RGPD art. 22).
  if a.violation_count = v_max then
    perform _log(a.id, 'violation_threshold', 'critical', jsonb_build_object('count', a.violation_count, 'max', v_max), p_ip);
    perform _enqueue_webhook('attempt.flagged', jsonb_build_object('attempt_id', a.id, 'test_id', a.test_id,
      'candidate_id', a.candidate_id, 'violation_count', a.violation_count));
  end if;
  -- Scan de la pièce : l'épreuve se met en pause, le chrono est gelé
  if v_scan > 0 and a.violation_count = v_scan then
    update attempts set paused_at = now(), pause_reason = 'room_scan', scan_token_hash = null, scan_token_at = null
      where id = a.id returning * into a;
    perform _log(a.id, 'room_scan_requested', 'warning', jsonb_build_object('count', a.violation_count), p_ip);
  end if;
  return a;
end; $$;

create or replace function public._load_session(p_user uuid, p_attempt uuid, p_token_hash text, p_ip text, p_ua text)
returns attempts language plpgsql security definer set search_path = public as $$
declare
  a attempts;
  t tests;
begin
  select * into a from attempts where id = p_attempt and candidate_id = p_user for update;
  if a.id is null then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status <> 'in_progress' then return a; end if;
  if a.session_token_hash is null or p_token_hash is null or a.session_token_hash <> p_token_hash then
    raise exception 'session_invalid' using errcode = 'P0001';
  end if;
  select * into t from tests where id = a.test_id;
  if a.paused_at is null and now() > a.deadline_at + make_interval(secs => t.grace_seconds) then
    perform _finalize_attempt(a.id, 'expired', 'deadline');
    select * into a from attempts where id = p_attempt;
    return a;
  end if;
  if a.user_agent is distinct from left(coalesce(p_ua, ''), 500) then
    update attempts set user_agent = left(coalesce(p_ua, ''), 500) where id = a.id;
    a := _add_violation(a.id, 'device_changed',
      jsonb_build_object('from_ua', left(a.user_agent, 200), 'to_ua', left(p_ua, 200)), p_ip);
    if a.status <> 'in_progress' then return a; end if;
  end if;
  if a.client_ip is distinct from p_ip then
    perform _log(a.id, 'ip_changed', 'warning', jsonb_build_object('from', a.client_ip, 'to', p_ip), p_ip);
    update attempts set client_ip = p_ip where id = a.id;
    a.client_ip := p_ip;
  end if;
  return a;
end; $$;

create or replace function public._check_linear(a attempts, p_question uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if a.paused_at is not null then raise exception 'exam_paused' using errcode = 'P0001'; end if;
  -- Toujours actif : question par question pour toutes les épreuves
  if array_position(a.question_order, p_question) is distinct from a.current_index + 1 then
    raise exception 'question_locked' using errcode = 'P0001';
  end if;
  -- Temps par question : 3 s de marge réseau, puis plus rien n'est accepté sur cette question
  if a.q_deadline_at is not null and now() > a.q_deadline_at + interval '3 seconds' then
    raise exception 'question_time_over' using errcode = 'P0001';
  end if;
end; $$;

create or replace function public.exam_submit(p_user uuid, p_attempt uuid, p_token_hash text, p_ip text, p_ua text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a attempts;
begin
  a := _load_session(p_user, p_attempt, p_token_hash, p_ip, p_ua);
  if a.status <> 'in_progress' then
    return jsonb_build_object('status', a.status, 'receipt', case when a.submitted_at is not null then _receipt(a.id) end);
  end if;
  if a.paused_at is not null then raise exception 'exam_paused' using errcode = 'P0001'; end if;
  perform _finalize_attempt(a.id, 'submitted', 'candidate');
  return jsonb_build_object('status', 'submitted', 'receipt', _receipt(a.id));
end; $$;

create or replace function public.expire_overdue_attempts()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  -- Pause sans scan reçu au bout de 30 minutes : l'épreuve reprend (aucune sanction
  -- automatique) et le surveillant est alerté pour examiner le cas.
  for r in select id from attempts where status = 'in_progress' and paused_at < now() - interval '30 minutes' loop
    perform _resume_attempt(r.id, 'room_scan_missing', null);
  end loop;
  for r in select a.id from attempts a join tests t on t.id = a.test_id
           where a.status = 'in_progress' and a.paused_at is null
             and now() > a.deadline_at + make_interval(secs => t.grace_seconds)
  loop
    perform _finalize_attempt(r.id, 'expired', 'deadline');
    n := n + 1;
  end loop;
  return n;
end; $$;

------------------------------------------------------------
-- Pause et scan à 360° de la pièce (filmé au téléphone)
------------------------------------------------------------
-- Reprise : le temps de pause est rendu au candidat (chrono global, question en cours, outils).
create or replace function public._resume_attempt(p_attempt uuid, p_kind text, p_detail jsonb)
returns attempts language plpgsql security definer set search_path = public as $$
declare a attempts; v_gap interval;
begin
  select * into a from attempts where id = p_attempt for update;
  if a.paused_at is null or a.status <> 'in_progress' then return a; end if;
  v_gap := now() - a.paused_at;
  update attempts set deadline_at = deadline_at + v_gap,
    q_deadline_at = case when q_deadline_at is null then null else q_deadline_at + v_gap end,
    paused_at = null, pause_reason = null, scan_token_hash = null, scan_token_at = null
    where id = a.id returning * into a;
  update external_sessions set deadline_at = deadline_at + v_gap where attempt_id = a.id and not final;
  perform _log(a.id, p_kind, case when p_kind = 'room_scan_missing' then 'critical' else 'info' end,
    coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('pause_s', round(extract(epoch from v_gap))), null);
  return a;
end; $$;

-- Le poste du candidat demande le lien du QR code : un nouveau jeton (haché ici) remplace l'ancien.
create or replace function public.exam_scan_link(p_user uuid, p_attempt uuid, p_token_hash text,
                                                 p_scan_hash text, p_ip text, p_ua text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a attempts;
begin
  a := _load_session(p_user, p_attempt, p_token_hash, p_ip, p_ua);
  if a.status <> 'in_progress' then return jsonb_build_object('status', a.status); end if;
  if a.paused_at is null then return jsonb_build_object('status', a.status, 'paused', false); end if;
  if p_scan_hash !~ '^[0-9a-f]{64}$' then raise exception 'bad_token' using errcode = 'P0001'; end if;
  update attempts set scan_token_hash = p_scan_hash, scan_token_at = now() where id = a.id;
  return jsonb_build_object('status', a.status, 'paused', true);
end; $$;

-- Le téléphone présente le jeton du QR code (valable 30 minutes).
create or replace function public.scan_lookup(p_scan_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a attempts; t tests;
begin
  select * into a from attempts where scan_token_hash = p_scan_hash and p_scan_hash ~ '^[0-9a-f]{64}$'
    and status = 'in_progress' and paused_at is not null and scan_token_at > now() - interval '30 minutes';
  if a.id is null then raise exception 'scan_invalid' using errcode = 'P0001'; end if;
  select * into t from tests where id = a.test_id;
  return jsonb_build_object('attempt_id', a.id, 'title', t.title);
end; $$;

-- Vidéo reçue : journalisée pour le surveillant, puis l'épreuve reprend.
create or replace function public.scan_complete(p_scan_hash text, p_path text, p_seconds int, p_ip text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  v := scan_lookup(p_scan_hash);
  if p_path is null or p_path !~ ('^' || (v->>'attempt_id') || '/[0-9a-zA-Z._-]+$') then
    raise exception 'bad_path' using errcode = 'P0001';
  end if;
  perform _log((v->>'attempt_id')::uuid, 'room_scan', 'info',
    jsonb_build_object('path', p_path, 'seconds', p_seconds, 'ip', p_ip), p_ip);
  perform _resume_attempt((v->>'attempt_id')::uuid, 'exam_resumed', jsonb_build_object('by', 'room_scan'));
  return jsonb_build_object('ok', true);
end; $$;

-- Le surveillant reprend l'épreuve lui-même (pas de téléphone, vidéo inutilisable…).
create or replace function public.staff_resume(p_actor uuid, p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a attempts;
begin
  if not _is_staff_user(p_actor) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into a from attempts where id = p_attempt;
  if a.id is null then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.paused_at is null then return jsonb_build_object('resumed', false); end if;
  perform _resume_attempt(a.id, 'exam_resumed', jsonb_build_object('by', 'staff', 'actor', p_actor));
  return jsonb_build_object('resumed', true);
end; $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('room-scans', 'room-scans', false, 41943040, array['video/webm', 'video/mp4', 'video/quicktime'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;



drop policy if exists "proctor media staff read" on storage.objects;
create policy "proctor media staff read" on storage.objects for select to authenticated
  using (bucket_id in ('snapshots', 'identity', 'room-scans') and public.is_staff());

revoke execute on function public._resume_attempt(uuid, text, jsonb), public.exam_scan_link(uuid, uuid, text, text, text, text),
  public.scan_lookup(text), public.scan_complete(text, text, int, text), public.staff_resume(uuid, uuid) from public, anon, authenticated;
grant execute on function public._resume_attempt(uuid, text, jsonb), public.exam_scan_link(uuid, uuid, text, text, text, text),
  public.scan_lookup(text), public.scan_complete(text, text, int, text), public.staff_resume(uuid, uuid) to service_role;
