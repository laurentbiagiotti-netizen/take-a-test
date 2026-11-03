-- Détection de téléphone : la caméra signale « phone_detected » (avertissement, sans infraction).

create or replace function public.exam_log_event(p_user uuid, p_attempt uuid, p_token_hash text,
                                                 p_kind text, p_detail jsonb, p_ip text, p_ua text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a attempts;
  t tests;
  v_sev text;
begin
  a := _load_session(p_user, p_attempt, p_token_hash, p_ip, p_ua);
  if a.status <> 'in_progress' then return jsonb_build_object('status', a.status); end if;
  select * into t from tests where id = a.test_id;
  v_sev := case p_kind
    when 'fullscreen_exit' then 'violation'
    when 'tab_hidden' then 'violation'
    when 'window_blur' then 'violation'
    when 'multiple_screens' then 'violation'
    when 'devtools_open' then 'violation'
    -- Caméra refusée ou coupée : le candidat continue, le surveillant est alerté
    when 'camera_off' then 'warning'
    when 'camera_refused' then 'warning'
    when 'no_face' then 'warning'
    when 'multiple_faces' then 'warning'
    when 'camera_covered' then 'warning'
    when 'camera_frozen' then 'warning'
    when 'other_person' then 'warning'
    when 'phone_detected' then 'warning'
    when 'fullscreen_return' then 'info'
    when 'copy_blocked' then 'warning'
    when 'paste_blocked' then 'warning'
    when 'cut_blocked' then 'warning'
    when 'shortcut_blocked' then 'warning'
    when 'print_attempt' then 'violation'
    when 'mouse_left' then 'info'
    when 'resize' then 'info'
    else null end;
  if v_sev is null then raise exception 'unknown_event' using errcode = 'P0001'; end if;
  if p_detail is not null and length(p_detail::text) > 2000 then p_detail := '{"truncated":true}'; end if;

  if v_sev = 'violation' then
    a := _add_violation(a.id, p_kind, p_detail, p_ip);
  else
    perform _log(a.id, p_kind, v_sev, p_detail, p_ip);
  end if;
  return jsonb_build_object('status', a.status, 'violation_count', a.violation_count,
                            'max_violations', t.max_violations);
end; $$;
