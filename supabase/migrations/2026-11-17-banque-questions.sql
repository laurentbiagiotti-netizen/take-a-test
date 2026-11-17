-- Nom et prénom déclarés par le candidat à l'accès
alter table profiles add column if not exists first_name text check (first_name is null or length(first_name) <= 80);
alter table profiles add column if not exists last_name text check (last_name is null or length(last_name) <= 80);

-- Banque de questions : questions réutilisables, classées par niveau et par domaine.
-- Elles ne sont jamais servies aux candidats directement : on les copie dans une épreuve.
create table if not exists question_bank (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'Tous' check (length(level) between 1 and 40),
  domain text check (domain is null or length(domain) <= 100),
  type question_type not null,
  prompt text not null check (length(prompt) between 1 and 20000),
  options jsonb,
  correct jsonb,
  points numeric not null default 1 check (points >= 0 and points <= 1000),
  explanation text check (explanation is null or length(explanation) <= 5000),
  image_url text,
  time_limit_s int check (time_limit_s is null or time_limit_s between 5 and 3600),
  terminal jsonb,
  external jsonb,
  source text check (source is null or length(source) <= 200),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists question_bank_level_domain on question_bank (level, domain);
alter table question_bank enable row level security;
drop policy if exists "bank admin all" on question_bank;
create policy "bank admin all" on question_bank for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "bank staff read" on question_bank;
create policy "bank staff read" on question_bank for select to authenticated using (is_staff());
revoke all on question_bank from anon;
