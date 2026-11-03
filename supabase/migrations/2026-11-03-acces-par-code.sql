-- Accès des candidats par code (sans inscription) et création du premier admin.
-- À exécuter une fois sur un projet où schema.sql a déjà été chargé.
create table if not exists access_failures (
  id bigserial primary key,
  ip text,
  at timestamptz not null default now()
);
create index if not exists access_failures_at on access_failures(at);
alter table access_failures enable row level security;
revoke all on access_failures from anon, authenticated;

-- Code de convocation -> candidat et épreuve. Réservé au serveur (service_role).
-- Limites : 10 échecs par IP et 300 échecs au total sur 10 minutes.
create or replace function public.access_by_code(p_code text, p_ip text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  inv invites;
  t tests;
begin
  delete from access_failures where at < now() - interval '1 day';
  if p_ip is not null and (select count(*) from access_failures where ip = p_ip and at > now() - interval '10 minutes') >= 10 then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  if (select count(*) from access_failures where at > now() - interval '10 minutes') >= 300 then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  if length(v_code) between 8 and 32 then
    select * into inv from invites where upper(replace(code, '-', '')) = v_code;
  end if;
  if inv.id is not null then select * into t from tests where id = inv.test_id and is_published; end if;
  if inv.id is null or t.id is null then
    insert into access_failures(ip) values (p_ip);
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true, 'email', inv.email, 'full_name', inv.full_name,
                            'test_id', inv.test_id, 'code', inv.code);
end; $$;

-- Premier administrateur : seulement tant qu'aucun admin n'existe.
create or replace function public.staff_bootstrap(p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where role = 'admin') then return false; end if;
  update profiles set role = 'admin' where id = p_user;
  return found;
end; $$;

revoke execute on function public.access_by_code(text, text), public.staff_bootstrap(uuid) from public, anon, authenticated;
grant execute on function public.access_by_code(text, text), public.staff_bootstrap(uuid) to service_role;
