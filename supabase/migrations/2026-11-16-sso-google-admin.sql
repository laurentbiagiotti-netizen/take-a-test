-- Connexion Google (SSO) de l'espace admin, réservée à une liste d'adresses.
create table if not exists public.staff_allowlist (
  email text primary key check (email = lower(email)),
  role user_role not null default 'admin',
  full_name text,
  created_at timestamptz not null default now()
);
alter table public.staff_allowlist enable row level security;
revoke all on public.staff_allowlist from anon, authenticated;

insert into public.staff_allowlist(email, role, full_name) values
  ('laurent@cybersup.ai', 'admin', 'Laurent Biagiotti'),
  ('dylan@cybersup.ai',   'admin', 'Dylan Charré'),
  ('manon@cybersup.ai',   'admin', 'Manon Pellat'),
  ('myriam@cybersup.ai',  'admin', 'Myriam Figlarz'),
  ('cemre@cybersup.ai',   'admin', 'Cemre Şahin'),
  ('david@cybersup.ai',   'admin', 'David Truong')
on conflict (email) do update set role = excluded.role, full_name = excluded.full_name;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role user_role;
begin
  select role into v_role from staff_allowlist where email = lower(new.email);
  if coalesce(new.raw_app_meta_data->>'provider', '') = 'google' and v_role is null then
    raise exception 'sso_non_autorise' using errcode = '42501';
  end if;
  insert into public.profiles (id, email, full_name, role)
  values (new.id, lower(new.email),
          left(coalesce(new.raw_user_meta_data->>'full_name', new.email), 200),
          coalesce(v_role, 'candidate'::user_role))
  on conflict (id) do nothing;
  return new;
end; $$;

update public.profiles p set role = a.role
from public.staff_allowlist a where p.email = a.email and p.role <> a.role;

update public.platform_settings set staff_mfa = false;
