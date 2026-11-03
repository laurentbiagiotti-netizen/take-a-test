-- Double authentification du staff : réglable (désactivée ici à la demande de l'école).
-- Pour la réactiver : update platform_settings set staff_mfa = true; et STAFF_MFA=on côté serveur.
create table if not exists platform_settings (
  id boolean primary key default true check (id),
  staff_mfa boolean not null default true
);
insert into platform_settings(id) values (true) on conflict (id) do nothing;
alter table platform_settings enable row level security;
revoke all on platform_settings from anon, authenticated;

create or replace function public._mfa_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select not coalesce((select staff_mfa from platform_settings where id), true)
      or coalesce(auth.jwt()->>'aal', '') = 'aal2';
$$;
revoke execute on function public._mfa_ok() from public, anon, authenticated;
update platform_settings set staff_mfa = false where id;
