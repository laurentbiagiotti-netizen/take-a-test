-- ============================================================================
-- Cybersup Exam (fork durci de Take A Test) : schéma complet Supabase
-- A exécuter une fois dans l'éditeur SQL Supabase sur un projet neuf.
--
-- Principe de sécurité : le candidat n'a AUCUN accès direct aux tables
-- d'examen. Toutes ses actions passent par le serveur Next.js, qui vérifie
-- Safe Exam Browser, la session unique et le chrono, puis appelle les
-- fonctions exam_* ci-dessous (réservées au rôle service_role).
-- ============================================================================

------------------------------------------------------------
-- Types
------------------------------------------------------------
create type user_role as enum ('admin', 'proctor', 'candidate');
create type question_type as enum ('mcq_single', 'mcq_multi', 'long_text');
create type attempt_status as enum ('pending', 'in_progress', 'submitted', 'terminated', 'expired');
create type identity_status as enum ('not_required', 'pending', 'submitted', 'verified', 'rejected');

------------------------------------------------------------
-- Tables
------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null default 'candidate',
  created_at timestamptz not null default now()
);

create table tests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  description text,
  duration_minutes int not null default 30 check (duration_minutes between 1 and 600),
  is_published boolean not null default false,
  require_seb boolean not null default false,
  invite_only boolean not null default true,
  require_id_check boolean not null default false,
  require_webcam boolean not null default true,
  draw_count int check (draw_count is null or draw_count > 0),
  shuffle_questions boolean not null default true,
  shuffle_options boolean not null default true,
  max_violations int not null default 3 check (max_violations between 1 and 50),
  allow_resume boolean not null default false,
  grace_seconds int not null default 30 check (grace_seconds between 0 and 600),
  opens_at timestamptz,
  closes_at timestamptz,
  retention_days int not null default 90 check (retention_days between 1 and 3650),
  created_at timestamptz not null default now(),
  check (opens_at is null or closes_at is null or opens_at < closes_at)
);

-- Secrets du test : jamais lisibles par un candidat (admin uniquement).
create table test_secrets (
  test_id uuid primary key references tests(id) on delete cascade,
  access_code text,
  seb_browser_exam_keys text[] not null default '{}',
  seb_config_keys text[] not null default '{}',
  seb_quit_password_hash text
);

-- Les questions ne contiennent jamais la bonne réponse (voir answer_keys).
create table questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references tests(id) on delete cascade,
  position int not null default 0,
  type question_type not null,
  prompt text not null,
  options jsonb,            -- [{id, text, image_url?}] pour les QCM
  points numeric not null default 1 check (points >= 0),
  image_url text
);
create index on questions(test_id);

create table answer_keys (
  question_id uuid primary key references questions(id) on delete cascade,
  correct jsonb               -- [option_id, ...]
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references tests(id) on delete cascade,
  candidate_id uuid not null references profiles(id) on delete cascade,
  status attempt_status not null default 'pending',
  created_at timestamptz not null default now(),
  unlocked boolean not null default false,
  started_at timestamptz,
  deadline_at timestamptz,
  extra_minutes int not null default 0 check (extra_minutes between 0 and 600),
  submitted_at timestamptz,
  score numeric,
  max_score numeric,
  question_order uuid[],
  option_orders jsonb,
  violation_count int not null default 0,
  session_token_hash text,
  session_started_at timestamptz,
  last_seen_at timestamptz,
  client_ip text,
  user_agent text,
  identity_status identity_status not null default 'not_required',
  identity_paths jsonb,
  identity_note text,
  end_reason text,
  media_purged_at timestamptz,
  unique (test_id, candidate_id)
);
create index on attempts(status, deadline_at);

create table answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  response jsonb,
  score numeric,
  feedback text,
  graded_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references tests(id) on delete cascade,
  email text not null check (email = lower(email)),
  code text not null unique,
  used_at timestamptz,
  used_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (test_id, email)
);

-- Journal de surveillance : append-only et chaîné par hash (inaltérable).
create table proctor_events (
  id bigserial primary key,
  attempt_id uuid not null references attempts(id) on delete cascade,
  kind text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'violation', 'critical')),
  detail jsonb,
  ip text,
  created_at timestamptz not null default clock_timestamp(),
  prev_hash text,
  hash text
);
create index on proctor_events(attempt_id, id);

-- API : clés hachées à portées (scopes), quotas, audit.
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prefix text not null unique,
  key_hash text not null,
  scopes text[] not null default '{}',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table api_rate (
  key_id uuid not null references api_keys(id) on delete cascade,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key_id, window_start)
);

create table api_audit (
  id bigserial primary key,
  key_id uuid references api_keys(id) on delete set null,
  method text not null,
  path text not null,
  status int not null,
  ip text,
  created_at timestamptz not null default now()
);

-- Webhooks : abonnements + boîte d'envoi (outbox) remplie par la base.
create table webhooks (
  id uuid primary key default gen_random_uuid(),
  url text not null check (url ~ '^https://'),
  secret text not null,
  events text[] not null default '{attempt.submitted,attempt.terminated,attempt.expired}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table webhook_outbox (
  id bigserial primary key,
  webhook_id uuid not null references webhooks(id) on delete cascade,
  event text not null,
  payload jsonb not null,
  attempts int not null default 0,
  next_try_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index on webhook_outbox(next_try_at) where delivered_at is null;

------------------------------------------------------------
-- Fonctions utilitaires de rôle
------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role in ('admin', 'proctor'));
$$;

create or replace function public._is_staff_user(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = p_user and role in ('admin', 'proctor'));
$$;

create or replace function public._is_admin_user(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = p_user and role = 'admin');
$$;

create or replace function public._sha256(p text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(coalesce(p, ''), 'UTF8')), 'hex');
$$;

------------------------------------------------------------
-- Row-Level Security : par défaut tout est fermé
------------------------------------------------------------
alter table profiles enable row level security;
alter table tests enable row level security;
alter table test_secrets enable row level security;
alter table questions enable row level security;
alter table answer_keys enable row level security;
alter table attempts enable row level security;
alter table answers enable row level security;
alter table invites enable row level security;
alter table proctor_events enable row level security;
alter table api_keys enable row level security;
alter table api_rate enable row level security;
alter table api_audit enable row level security;
alter table webhooks enable row level security;
alter table webhook_outbox enable row level security;

-- Aucun accès anonyme, et aucun droit d'écriture implicite sur les profils.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke insert, update, delete on profiles from authenticated;

-- profiles : chacun lit le sien, le staff lit tout. Le rôle n'est JAMAIS
-- modifiable par l'utilisateur (aucune politique UPDATE, droit révoqué).
create policy "profiles self or staff read" on profiles for select to authenticated
  using (id = auth.uid() or is_staff());

-- tests : admin gère, staff lit, le candidat ne voit pas les tables
-- directement (il passe par my_dashboard()).
create policy "tests admin all" on tests for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "tests staff read" on tests for select to authenticated
  using (is_staff());

create policy "secrets admin all" on test_secrets for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "questions admin all" on questions for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "questions staff read" on questions for select to authenticated
  using (is_staff());

create policy "keys admin all" on answer_keys for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "attempts staff read" on attempts for select to authenticated
  using (is_staff());

create policy "answers staff read" on answers for select to authenticated
  using (is_staff());

create policy "invites admin all" on invites for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "invites staff read" on invites for select to authenticated
  using (is_staff());

create policy "events staff read" on proctor_events for select to authenticated
  using (is_staff());

create policy "api keys admin read" on api_keys for select to authenticated using (is_admin());
create policy "api audit admin read" on api_audit for select to authenticated using (is_admin());
create policy "webhooks admin all" on webhooks for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "outbox admin read" on webhook_outbox for select to authenticated using (is_admin());

------------------------------------------------------------
-- Journal chaîné : chaque événement contient le hash du précédent.
-- Toute modification ou suppression ciblée casse la chaîne.
------------------------------------------------------------
create or replace function public._event_hash(e proctor_events) returns text
language sql immutable as $$
  select _sha256(
    coalesce(e.prev_hash, 'GENESIS') || '|' || e.attempt_id::text || '|' || e.kind || '|' ||
    e.severity || '|' || coalesce(e.detail::text, '') || '|' || coalesce(e.ip, '') || '|' ||
    to_char(e.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
  );
$$;

create or replace function public._proctor_events_chain() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.attempt_id::text));
  new.created_at := clock_timestamp();
  select hash into new.prev_hash from proctor_events
    where attempt_id = new.attempt_id order by id desc limit 1;
  new.hash := _event_hash(new);
  return new;
end; $$;

create trigger proctor_events_chain before insert on proctor_events
  for each row execute function _proctor_events_chain();

create or replace function public._proctor_events_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'proctor_events est en ajout seul';
end; $$;

create trigger proctor_events_no_update before update on proctor_events
  for each row execute function _proctor_events_immutable();

create or replace function public.verify_event_chain(p_attempt uuid)
returns table(valid boolean, events int, first_broken_id bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  r proctor_events;
  prev text := null;
  n int := 0;
begin
  for r in select * from proctor_events where attempt_id = p_attempt order by id loop
    n := n + 1;
    if r.prev_hash is distinct from prev or r.hash is distinct from _event_hash(r) then
      return query select false, n, r.id; return;
    end if;
    prev := r.hash;
  end loop;
  return query select true, n, null::bigint;
end; $$;

------------------------------------------------------------
-- Intégrité : une fois qu'un candidat a commencé, les questions du test
-- ne peuvent plus être supprimées ni changer de type, d'options ou de
-- barème (sinon les copies seraient corrompues). Dupliquer le test.
------------------------------------------------------------
create or replace function public._questions_locked() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_test uuid := coalesce(old.test_id, new.test_id);
begin
  if exists(select 1 from tests where id = v_test)
     and exists(select 1 from attempts where test_id = v_test and status <> 'pending') then
    if tg_op = 'DELETE'
       or new.type is distinct from old.type
       or new.options is distinct from old.options
       or new.points is distinct from old.points
       or new.test_id is distinct from old.test_id then
      raise exception 'questions_locked' using errcode = 'P0001',
        hint = 'Des candidats ont déjà composé : dupliquez le test pour le modifier.';
    end if;
  end if;
  return coalesce(new, old);
end; $$;

create trigger questions_locked before update or delete on questions
  for each row execute function _questions_locked();

------------------------------------------------------------
-- Inscription : toujours candidat.
------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, lower(new.email),
          left(coalesce(new.raw_user_meta_data->>'full_name', new.email), 200),
          'candidate'::user_role)
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------
-- Interne : écriture d'un événement + webhooks
------------------------------------------------------------
create or replace function public._log(p_attempt uuid, p_kind text, p_severity text, p_detail jsonb, p_ip text)
returns void language sql security definer set search_path = public as $$
  insert into proctor_events(attempt_id, kind, severity, detail, ip)
  values (p_attempt, p_kind, p_severity, p_detail, p_ip);
$$;

create or replace function public._enqueue_webhook(p_event text, p_payload jsonb)
returns void language sql security definer set search_path = public as $$
  insert into webhook_outbox(webhook_id, event, payload)
  select id, p_event, jsonb_build_object('event', p_event, 'created_at', now(), 'data', p_payload)
  from webhooks where active and p_event = any(events);
$$;

------------------------------------------------------------
-- Interne : correction et clôture d'une tentative
------------------------------------------------------------
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
begin
  select * into a from attempts where id = p_attempt for update;
  if a.id is null or a.status not in ('pending', 'in_progress') then return; end if;

  for r in
    select q.id as qid, q.type, q.points, an.id as aid, an.response, k.correct
    from questions q
    left join answers an on an.question_id = q.id and an.attempt_id = p_attempt
    left join answer_keys k on k.question_id = q.id
    where q.id = any(coalesce(a.question_order, '{}'))
  loop
    v_max := v_max + r.points;
    continue when r.aid is null or r.type = 'long_text';
    s := 0;
    resp := coalesce(r.response->'selected', '[]'::jsonb);
    correct := coalesce(r.correct, '[]'::jsonb);
    if jsonb_array_length(correct) > 0
       and jsonb_array_length(resp) = jsonb_array_length(correct)
       and not exists (select 1 from jsonb_array_elements_text(resp) x
                       where x not in (select jsonb_array_elements_text(correct))) then
      s := r.points;
    end if;
    update answers set score = s where id = r.aid;
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
    'violation_count', a.violation_count, 'submitted_at', now()));
end; $$;

-- Charge la tentative et vérifie la session (jeton httpOnly haché).
-- Si le délai est dépassé, la tentative est close et renvoyée avec son
-- nouveau statut : l'appelant doit alors RETOURNER (pas lever d'erreur,
-- sinon la clôture serait annulée par le rollback).
create or replace function public._load_session(p_user uuid, p_attempt uuid, p_token_hash text)
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
  if now() > a.deadline_at + make_interval(secs => t.grace_seconds) then
    perform _finalize_attempt(a.id, 'expired', 'deadline');
    select * into a from attempts where id = p_attempt;
  end if;
  return a;
end; $$;

------------------------------------------------------------
-- Cycle d'examen (appelé UNIQUEMENT par le serveur, service_role)
------------------------------------------------------------

-- Prépare l'accès : contrôles d'invitation, de fenêtre, crée la tentative.
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
  if t.id is null or not t.is_published then raise exception 'test_not_found' using errcode = 'P0002'; end if;
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
    insert into attempts(test_id, candidate_id, unlocked, identity_status)
    values (p_test, p_user, not v_code_required,
            case when t.require_id_check then 'pending'::identity_status else 'not_required' end)
    returning * into a;
    perform _log(a.id, 'attempt_created', 'info', null, null);
  end if;

  return jsonb_build_object(
    'state', a.status, 'attempt_id', a.id, 'unlocked', a.unlocked,
    'identity_status', a.identity_status, 'title', t.title, 'description', t.description,
    'duration_minutes', t.duration_minutes + a.extra_minutes, 'max_violations', t.max_violations,
    'require_seb', t.require_seb, 'require_webcam', t.require_webcam, 'session_active', a.session_token_hash is not null,
    'allow_resume', t.allow_resume, 'closes_at', t.closes_at);
end; $$;

-- Saisie du code d'accès, avec limitation des essais (5 / 10 min).
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
  select * into t from tests where id = p_test and is_published;
  if t.id is null then raise exception 'test_not_found' using errcode = 'P0002'; end if;
  select * into a from attempts where test_id = p_test and candidate_id = p_user for update;
  if a.id is null then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.unlocked then return jsonb_build_object('ok', true); end if;

  select count(*) into v_fails from proctor_events
   where attempt_id = a.id and kind = 'unlock_failed' and created_at > now() - interval '10 minutes';
  if v_fails >= 5 then raise exception 'too_many_attempts' using errcode = 'P0001'; end if;

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

-- Pièce d'identité + selfie déposés par le serveur dans le bucket privé.
create or replace function public.exam_submit_identity(p_user uuid, p_attempt uuid, p_paths jsonb, p_ip text)
returns void language plpgsql security definer set search_path = public as $$
declare a attempts;
begin
  select * into a from attempts where id = p_attempt and candidate_id = p_user for update;
  if a.id is null then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status <> 'pending' or a.identity_status not in ('pending', 'rejected') then
    raise exception 'identity_not_expected' using errcode = 'P0001';
  end if;
  update attempts set identity_status = 'submitted', identity_paths = p_paths where id = a.id;
  perform _log(a.id, 'identity_submitted', 'info', p_paths, p_ip);
end; $$;

-- Démarrage (ou reprise autorisée) : tirage des questions, chrono serveur,
-- jeton de session unique.
create or replace function public.exam_begin(p_user uuid, p_attempt uuid, p_token_hash text, p_ip text, p_ua text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a attempts;
  t tests;
  v_order uuid[];
  v_opts jsonb := '{}'::jsonb;
  q record;
  v_questions jsonb;
  v_answers jsonb;
begin
  select * into a from attempts where id = p_attempt and candidate_id = p_user for update;
  if a.id is null then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  select * into t from tests where id = a.test_id;
  if not t.is_published then raise exception 'test_not_found' using errcode = 'P0002'; end if;
  if not a.unlocked then raise exception 'locked' using errcode = 'P0001'; end if;
  if a.identity_status in ('pending', 'rejected') then raise exception 'identity_required' using errcode = 'P0001'; end if;
  if p_token_hash is null or length(p_token_hash) <> 64 then raise exception 'bad_token' using errcode = 'P0001'; end if;

  if a.status = 'pending' then
    if t.closes_at is not null and now() > t.closes_at then raise exception 'test_closed' using errcode = 'P0001'; end if;
    if t.opens_at is not null and now() < t.opens_at then raise exception 'test_not_open' using errcode = 'P0001'; end if;

    if t.draw_count is not null then
      select array_agg(id) into v_order from (
        select id from questions where test_id = t.id order by random() limit t.draw_count) s;
      if not t.shuffle_questions then
        select array_agg(id order by position) into v_order from questions where id = any(v_order);
      end if;
    elsif t.shuffle_questions then
      select array_agg(id order by random()) into v_order from questions where test_id = t.id;
    else
      select array_agg(id order by position) into v_order from questions where test_id = t.id;
    end if;
    if v_order is null then raise exception 'no_questions' using errcode = 'P0001'; end if;

    for q in select id, options from questions where id = any(v_order) and options is not null loop
      v_opts := v_opts || jsonb_build_object(q.id::text, (
        select jsonb_agg(o->>'id' order by case when t.shuffle_options then random() else ord end)
        from jsonb_array_elements(q.options) with ordinality as x(o, ord)));
    end loop;

    update attempts set status = 'in_progress', started_at = now(),
      deadline_at = case when t.closes_at is null
                         then now() + make_interval(mins => t.duration_minutes + a.extra_minutes)
                         else least(now() + make_interval(mins => t.duration_minutes + a.extra_minutes), t.closes_at) end,
      question_order = v_order, option_orders = v_opts,
      session_token_hash = p_token_hash, session_started_at = now(), last_seen_at = now(),
      client_ip = p_ip, user_agent = left(p_ua, 500)
    where id = a.id returning * into a;
    perform _log(a.id, 'exam_started', 'info', jsonb_build_object('ua', left(p_ua, 300)), p_ip);

  elsif a.status = 'in_progress' then
    if now() > a.deadline_at + make_interval(secs => t.grace_seconds) then
      perform _finalize_attempt(a.id, 'expired', 'deadline');
      return jsonb_build_object('status', 'expired');
    end if;
    if a.session_token_hash = p_token_hash then
      null; -- même navigateur qui recharge la page : on continue
    elsif a.session_token_hash is null or t.allow_resume then
      update attempts set session_token_hash = p_token_hash, session_started_at = now(),
        last_seen_at = now(), client_ip = p_ip, user_agent = left(p_ua, 500)
      where id = a.id returning * into a;
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

  select jsonb_agg(jsonb_build_object(
      'id', q2.id, 'type', q2.type, 'prompt', q2.prompt, 'points', q2.points, 'image_url', q2.image_url,
      'options', (select jsonb_agg(o order by array_position(
                     array(select jsonb_array_elements_text(a.option_orders->(q2.id::text))), o->>'id'))
                  from jsonb_array_elements(q2.options) o))
    order by array_position(a.question_order, q2.id))
  into v_questions from questions q2 where q2.id = any(a.question_order);

  select coalesce(jsonb_object_agg(question_id::text, response), '{}'::jsonb)
  into v_answers from answers where attempt_id = a.id;

  return jsonb_build_object('status', 'in_progress', 'attempt_id', a.id, 'deadline_at', a.deadline_at, 'server_now', now(),
    'questions', v_questions, 'answers', v_answers,
    'violation_count', a.violation_count, 'max_violations', t.max_violations);
end; $$;

-- Battement de cœur (toutes les ~10 s) : présence, IP, navigateur, chrono.
create or replace function public.exam_heartbeat(p_user uuid, p_attempt uuid, p_token_hash text, p_ip text, p_ua text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a attempts;
  t tests;
  v_gap numeric;
begin
  a := _load_session(p_user, p_attempt, p_token_hash);
  if a.status <> 'in_progress' then return jsonb_build_object('status', a.status); end if;
  select * into t from tests where id = a.test_id;
  v_gap := extract(epoch from now() - a.last_seen_at);
  if v_gap > 45 then
    perform _log(a.id, 'connection_gap', 'warning', jsonb_build_object('seconds', round(v_gap)), p_ip);
  end if;
  if a.client_ip is distinct from p_ip then
    perform _log(a.id, 'ip_changed', 'warning', jsonb_build_object('from', a.client_ip, 'to', p_ip), p_ip);
  end if;
  if a.user_agent is distinct from left(p_ua, 500) then
    perform exam_log_event(p_user, p_attempt, p_token_hash, 'user_agent_changed', null, p_ip);
    select * into a from attempts where id = a.id;
    if a.status <> 'in_progress' then
      return jsonb_build_object('status', a.status);
    end if;
  end if;
  update attempts set last_seen_at = now(), client_ip = p_ip where id = a.id;
  return jsonb_build_object('status', a.status, 'deadline_at', a.deadline_at, 'server_now', now(),
    'violation_count', a.violation_count, 'max_violations', t.max_violations);
end; $$;

-- Enregistrement d'une réponse (forme validée, hors délai refusé).
create or replace function public.exam_save_answer(p_user uuid, p_attempt uuid, p_token_hash text,
                                                   p_question uuid, p_response jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a attempts;
  q questions;
  v_sel jsonb;
  v_allowed text[];
begin
  a := _load_session(p_user, p_attempt, p_token_hash);
  if a.status <> 'in_progress' then return jsonb_build_object('status', a.status); end if;
  if now() > a.deadline_at then raise exception 'time_over' using errcode = 'P0001'; end if;
  if not (p_question = any(a.question_order)) then raise exception 'bad_question' using errcode = 'P0001'; end if;
  select * into q from questions where id = p_question;

  if q.type = 'long_text' then
    if jsonb_typeof(p_response->'text') <> 'string' or length(p_response->>'text') > 20000 then
      raise exception 'bad_response' using errcode = 'P0001';
    end if;
    p_response := jsonb_build_object('text', p_response->>'text');
  else
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
  end if;

  insert into answers(attempt_id, question_id, response, updated_at)
  values (a.id, p_question, p_response, now())
  on conflict (attempt_id, question_id) do update set response = excluded.response, updated_at = now();
  return jsonb_build_object('status', 'in_progress', 'saved', true);
end; $$;

-- Signalement d'un événement par le client. La gravité et le compteur
-- d'infractions sont décidés ICI, pas par le navigateur.
create or replace function public.exam_log_event(p_user uuid, p_attempt uuid, p_token_hash text,
                                                 p_kind text, p_detail jsonb, p_ip text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a attempts;
  t tests;
  v_sev text;
begin
  a := _load_session(p_user, p_attempt, p_token_hash);
  if a.status <> 'in_progress' then return jsonb_build_object('status', a.status); end if;
  select * into t from tests where id = a.test_id;
  v_sev := case p_kind
    when 'fullscreen_exit' then 'violation'
    when 'tab_hidden' then 'violation'
    when 'window_blur' then 'violation'
    when 'multiple_screens' then 'violation'
    when 'devtools_open' then 'violation'
    when 'camera_off' then 'violation'
    when 'no_face' then 'warning'
    when 'user_agent_changed' then 'violation'
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

  perform _log(a.id, p_kind, v_sev, p_detail, p_ip);
  if v_sev = 'violation' then
    update attempts set violation_count = violation_count + 1 where id = a.id
      returning * into a;
    if a.violation_count >= t.max_violations then
      perform _finalize_attempt(a.id, 'terminated', 'max_violations');
      return jsonb_build_object('status', 'terminated', 'violation_count', a.violation_count,
                                'max_violations', t.max_violations);
    end if;
  end if;
  return jsonb_build_object('status', 'in_progress', 'violation_count', a.violation_count,
                            'max_violations', t.max_violations);
end; $$;

create or replace function public.exam_add_snapshot(p_user uuid, p_attempt uuid, p_token_hash text,
                                                    p_path text, p_ip text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a attempts;
begin
  a := _load_session(p_user, p_attempt, p_token_hash);
  if a.status <> 'in_progress' then return jsonb_build_object('status', a.status); end if;
  if p_path not like a.id::text || '/%' then raise exception 'bad_path' using errcode = 'P0001'; end if;
  perform _log(a.id, 'snapshot', 'info', jsonb_build_object('path', p_path), p_ip);
  return jsonb_build_object('status', 'in_progress');
end; $$;

create or replace function public.exam_submit(p_user uuid, p_attempt uuid, p_token_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a attempts;
begin
  a := _load_session(p_user, p_attempt, p_token_hash);
  if a.status <> 'in_progress' then return jsonb_build_object('status', a.status); end if;
  perform _finalize_attempt(a.id, 'submitted', 'candidate');
  return jsonb_build_object('status', 'submitted');
end; $$;

-- Clôt les tentatives dont le délai est dépassé (à appeler par le cron).
create or replace function public.expire_overdue_attempts()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select a.id from attempts a join tests t on t.id = a.test_id
           where a.status = 'in_progress'
             and now() > a.deadline_at + make_interval(secs => t.grace_seconds)
  loop
    perform _finalize_attempt(r.id, 'expired', 'deadline');
    n := n + 1;
  end loop;
  return n;
end; $$;

------------------------------------------------------------
-- Actions du staff (surveillant / admin), via le serveur
------------------------------------------------------------
create or replace function public.staff_action(p_actor uuid, p_attempt uuid, p_action text, p_arg jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a attempts;
  v_min int;
begin
  if not _is_staff_user(p_actor) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into a from attempts where id = p_attempt for update;
  if a.id is null then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;

  if p_action = 'reset_session' then
    update attempts set session_token_hash = null where id = a.id;
    perform _log(a.id, 'staff_reset_session', 'info', jsonb_build_object('by', p_actor), null);
  elsif p_action = 'extend_time' then
    v_min := (p_arg->>'minutes')::int;
    if v_min is null or v_min < 1 or v_min > 600 then raise exception 'bad_minutes' using errcode = 'P0001'; end if;
    update attempts set extra_minutes = extra_minutes + v_min,
      deadline_at = case when deadline_at is null then null else deadline_at + make_interval(mins => v_min) end
      where id = a.id;
    perform _log(a.id, 'staff_extend_time', 'info', jsonb_build_object('by', p_actor, 'minutes', v_min), null);
  elsif p_action = 'terminate' then
    perform _log(a.id, 'staff_terminate', 'critical',
                 jsonb_build_object('by', p_actor, 'reason', left(p_arg->>'reason', 500)), null);
    perform _finalize_attempt(a.id, 'terminated', 'staff');
  elsif p_action = 'review_identity' then
    if a.identity_status not in ('submitted', 'verified', 'rejected') then
      raise exception 'identity_not_submitted' using errcode = 'P0001';
    end if;
    update attempts set identity_status = case when (p_arg->>'ok')::boolean then 'verified' else 'rejected' end::identity_status,
      identity_note = left(p_arg->>'note', 500) where id = a.id;
    perform _log(a.id, 'staff_identity_review', 'info',
                 jsonb_build_object('by', p_actor, 'ok', (p_arg->>'ok')::boolean), null);
  elsif p_action = 'reset_attempt' then
    if not _is_admin_user(p_actor) then raise exception 'forbidden' using errcode = '42501'; end if;
    delete from attempts where id = a.id;
    return jsonb_build_object('ok', true, 'deleted', true);
  else
    raise exception 'unknown_action' using errcode = 'P0001';
  end if;
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.grade_answer(p_actor uuid, p_answer uuid, p_score numeric, p_feedback text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  an answers;
  q questions;
  v_total numeric;
begin
  if not _is_staff_user(p_actor) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into an from answers where id = p_answer for update;
  if an.id is null then raise exception 'answer_not_found' using errcode = 'P0002'; end if;
  select * into q from questions where id = an.question_id;
  if p_score is not null and (p_score < 0 or p_score > q.points) then
    raise exception 'score_out_of_range' using errcode = 'P0001';
  end if;
  update answers set score = p_score, feedback = left(p_feedback, 5000), graded_by = p_actor where id = an.id;
  select coalesce(sum(score), 0) into v_total from answers where attempt_id = an.attempt_id;
  update attempts set score = v_total where id = an.attempt_id and status in ('submitted', 'terminated', 'expired');
  perform _log(an.attempt_id, 'graded', 'info',
               jsonb_build_object('by', p_actor, 'question', q.id, 'score', p_score), null);
  return jsonb_build_object('ok', true, 'attempt_total', v_total);
end; $$;

------------------------------------------------------------
-- Tableau de bord candidat (lecture seule, sans scores)
------------------------------------------------------------
create or replace function public.my_dashboard()
returns table(test_id uuid, title text, description text, duration_minutes int,
              opens_at timestamptz, closes_at timestamptz, status attempt_status)
language sql stable security definer set search_path = public as $$
  select t.id, t.title, t.description, t.duration_minutes, t.opens_at, t.closes_at, a.status
  from tests t
  left join attempts a on a.test_id = t.id and a.candidate_id = auth.uid()
  where t.is_published
    and (not t.invite_only or exists(
      select 1 from invites i where i.test_id = t.id
        and i.email = (select lower(email) from profiles where id = auth.uid())))
  order by t.created_at desc;
$$;

------------------------------------------------------------
-- RGPD : médias à purger après la durée de conservation
------------------------------------------------------------
create or replace function public.media_to_purge()
returns table(attempt_id uuid, snapshot_paths text[], identity_paths jsonb)
language sql stable security definer set search_path = public as $$
  select a.id,
         array(select e.detail->>'path' from proctor_events e
               where e.attempt_id = a.id and e.kind = 'snapshot' and e.detail ? 'path'),
         a.identity_paths
  from attempts a join tests t on t.id = a.test_id
  where a.status in ('submitted', 'terminated', 'expired')
    and a.media_purged_at is null
    and a.submitted_at < now() - make_interval(days => t.retention_days);
$$;

create or replace function public.mark_media_purged(p_attempt uuid)
returns void language sql security definer set search_path = public as $$
  update attempts set media_purged_at = now(), identity_paths = null where id = p_attempt;
  select _log(p_attempt, 'media_purged', 'info', null, null);
$$;

------------------------------------------------------------
-- API : quota par clé (fenêtre fixe d'une minute)
------------------------------------------------------------
create or replace function public.api_rate_hit(p_key uuid, p_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hits int;
begin
  insert into api_rate(key_id, window_start, hits) values (p_key, date_trunc('minute', now()), 1)
  on conflict (key_id, window_start) do update set hits = api_rate.hits + 1
  returning hits into v_hits;
  delete from api_rate where window_start < now() - interval '1 hour';
  update api_keys set last_used_at = now() where id = p_key;
  return v_hits <= p_limit;
end; $$;

------------------------------------------------------------
-- Droits d'exécution : tout est fermé, puis ouvert au strict nécessaire
------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin(), public.is_staff(), public.my_dashboard() to authenticated;
grant execute on all functions in schema public to service_role;

------------------------------------------------------------
-- Stockage
------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('snapshots', 'snapshots', false, 307200, array['image/jpeg', 'image/webp'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('identity', 'identity', false, 3145728, array['image/jpeg', 'image/webp', 'image/png'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('question-images', 'question-images', true, 5242880,
          array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  on conflict (id) do update set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Captures et pièces d'identité : seul le staff lit ; l'écriture se fait
-- par le serveur (service_role), jamais par le navigateur du candidat.
create policy "proctor media staff read" on storage.objects for select to authenticated
  using (bucket_id in ('snapshots', 'identity') and public.is_staff());

create policy "question-images admin write" on storage.objects for insert to authenticated
  with check (bucket_id = 'question-images' and public.is_admin());
create policy "question-images admin update" on storage.objects for update to authenticated
  using (bucket_id = 'question-images' and public.is_admin());
create policy "question-images admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'question-images' and public.is_admin());

------------------------------------------------------------
-- Ensuite :
--   1. Activer la confirmation d'e-mail (Authentication > Providers > Email)
--   2. S'inscrire sur /signup, puis :
--      update public.profiles set role = 'admin' where email = 'vous@cybersup.ai';
--   3. Planifier /api/cron/maintenance toutes les minutes (voir README).
------------------------------------------------------------
