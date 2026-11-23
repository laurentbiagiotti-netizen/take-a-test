-- Suivi : migrations appliquées, santé de la tâche planifiée, accès fermé sans créneau, avis de report.

-- Migrations appliquées (remplie par scripts/migrer.sh ; lue par la page « Mails et agenda »)
create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
alter table schema_migrations enable row level security;
drop policy if exists "schema_migrations staff read" on schema_migrations;
create policy "schema_migrations staff read" on schema_migrations for select to authenticated using (is_staff());
revoke all on schema_migrations from anon;
revoke insert, update, delete on schema_migrations from authenticated;
-- Déjà en place avant ce suivi
insert into schema_migrations(name) values
  ('2026-11-17-sans-scan-piece.sql'), ('2026-11-17-banque-questions.sql'), ('2026-11-23-plateforme-v2.sql'),
  ('2026-11-23-mails-agenda.sql'), ('2026-11-23-creneaux.sql'), ('2026-11-23-agenda-hubspot.sql')
on conflict do nothing;

-- Santé des tâches planifiées : dernier passage, dernier passage réussi, dernière erreur
create table if not exists job_health (
  job text primary key,
  last_run_at timestamptz,
  last_ok_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  detail jsonb
);
alter table job_health enable row level security;
drop policy if exists "job_health staff read" on job_health;
create policy "job_health staff read" on job_health for select to authenticated using (is_staff());
revoke all on job_health from anon;
revoke insert, update, delete on job_health from authenticated;

-- Créneau dont le candidat a été informé (convocation ou avis de report) : s'il diffère du créneau, un avis part
alter table invites add column if not exists slot_notified timestamptz;
alter table mail_log drop constraint if exists mail_log_kind_check;
alter table mail_log add constraint mail_log_kind_check check (kind in ('convocation', 'relance', 'rappel_veille', 'rappel_10min', 'report'));

-- Épreuve à créneaux individuels (case cochée ou mot-clé d'agenda) : sans créneau, pas d'accès.
-- L'ouverture est repoussée à l'infini ; une épreuve déjà commencée n'est pas touchée (seule la fermeture compte alors).
create or replace function public._slot_window(t tests, p_user uuid) returns tests
language plpgsql stable security definer set search_path = public as $$
declare v_slot timestamptz; v_extra int; v_email text; v_found boolean := false;
begin
  select lower(email) into v_email from profiles where id = p_user;
  select i.slot_at, i.extra_minutes, true into v_slot, v_extra, v_found from invites i where i.test_id = t.id and i.email = v_email and not i.preview;
  if v_slot is not null then
    v_extra := greatest(coalesce(v_extra, 0), coalesce((select extra_minutes from student_accommodations where email = v_email), 0));
    t.opens_at := v_slot - interval '10 minutes';
    t.closes_at := v_slot + make_interval(mins => t.duration_minutes + v_extra + 15);
  elsif coalesce(v_found, false) and (t.slots or coalesce(trim(t.agenda_keyword), '') <> '') then
    t.opens_at := 'infinity';
  end if;
  return t;
end; $$;
