-- Inscription automatique depuis l'agenda du compte relié : les rendez-vous « Test technique <classe> - <prénom> »
-- (créés par HubSpot) inscrivent le candidat à l'épreuve dont le mot-clé d'agenda figure dans le titre.
alter table tests add column if not exists agenda_keyword text check (agenda_keyword is null or length(agenda_keyword) <= 60);

-- Rendez-vous « Test technique » vus dans l'agenda mais non rattachés à une épreuve (classe absente, invité manquant…)
create table if not exists agenda_inbox (
  event_id text primary key,
  title text,
  start_at timestamptz,
  email text,
  reason text not null,
  seen_at timestamptz not null default now()
);
alter table agenda_inbox enable row level security;
drop policy if exists "agenda_inbox staff read" on agenda_inbox;
create policy "agenda_inbox staff read" on agenda_inbox for select to authenticated using (is_staff());
revoke all on agenda_inbox from anon;
revoke insert, update, delete on agenda_inbox from authenticated;
