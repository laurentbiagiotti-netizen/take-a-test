-- Mails automatiques et agenda : un compte Google de l'école, connecté par un administrateur,
-- envoie les convocations et une relance unique, et porte les examens dans son agenda.

-- Compte connecté (une seule ligne). Le jeton est chiffré (API_SECRETS_KEY) et n'est lu que par le serveur.
create table if not exists mail_account (
  id boolean primary key default true check (id),
  email text not null check (length(email) <= 320),
  token_sealed text not null,
  calendar_id text not null default 'primary',
  connected_by uuid references profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  last_error text,
  last_error_at timestamptz
);
alter table mail_account enable row level security;
revoke all on mail_account from anon, authenticated;

-- Journal des mails : une ligne par étudiant, épreuve et type, ce qui garantit un seul envoi de chaque
create table if not exists mail_log (
  id bigint generated always as identity primary key,
  test_id uuid not null references tests(id) on delete cascade,
  email text not null check (email = lower(email)),
  kind text not null check (kind in ('convocation', 'relance')),
  status text not null check (status in ('sent', 'failed')),
  error text check (error is null or length(error) <= 500),
  tries int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (test_id, email, kind)
);
create index if not exists mail_log_recent on mail_log (updated_at desc);
alter table mail_log enable row level security;
drop policy if exists "mail_log staff read" on mail_log;
create policy "mail_log staff read" on mail_log for select to authenticated using (is_staff());
revoke all on mail_log from anon;
revoke insert, update, delete on mail_log from authenticated;

alter table tests add column if not exists mail_convocation boolean not null default true;
alter table tests add column if not exists mail_relance boolean not null default true;
alter table tests add column if not exists calendar_event_id text;
alter table tests add column if not exists calendar_hash text;
