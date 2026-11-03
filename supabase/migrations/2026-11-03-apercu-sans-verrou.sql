-- Copies d'aperçu : pas de verrou des questions, pas dans les statistiques.

create or replace function public._preview_attempt(p_test uuid, p_candidate uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from invites i join profiles p on p.email = i.email
                  where i.test_id = p_test and i.preview and p.id = p_candidate);
$$;

create or replace function public._questions_locked() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_test uuid := coalesce(old.test_id, new.test_id);
begin
  if exists(select 1 from tests where id = v_test)
     and exists(select 1 from attempts a where a.test_id = v_test and a.status <> 'pending'
                and not _preview_attempt(a.test_id, a.candidate_id)) then
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

create or replace function public.item_stats(p_test uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  with fin as (
    select a.id, a.question_order, case when a.max_score > 0 then a.score / a.max_score else 0 end as total,
           ntile(4) over (order by case when a.max_score > 0 then a.score / a.max_score else 0 end) as quart
    from attempts a where a.test_id = p_test and a.status in ('submitted', 'expired', 'terminated')
      and not _preview_attempt(a.test_id, a.candidate_id)
  ), it as (
    select q.id, q.position, q.domain, q.variant_group, q.type, left(q.prompt, 160) as prompt, q.points, f.quart,
           case when q.points > 0 then coalesce(an.score, 0) / q.points else 0 end as r,
           an.response is not null as answered
    from fin f
    join questions q on q.id = any(f.question_order)
    left join answers an on an.attempt_id = f.id and an.question_id = q.id
    where q.type <> 'long_text' or an.score is not null
  ), agg as (
    select id, position, domain, variant_group, type, prompt, count(*) as n,
           round(avg(r), 3) as reussite,
           round(count(*) filter (where not answered)::numeric / count(*), 3) as sans_reponse,
           round(coalesce(avg(r) filter (where quart = 4), 0) - coalesce(avg(r) filter (where quart = 1), 0), 3) as discrimination
    from it group by id, position, domain, variant_group, type, prompt
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'position', position, 'domain', domain, 'variant_group', variant_group, 'type', type,
      'prompt', prompt, 'n', n, 'reussite', reussite, 'sans_reponse', sans_reponse, 'discrimination', discrimination,
      'alerte', case when n < 10 then null
                     when reussite >= 0.9 then 'trop facile'
                     when reussite <= 0.15 then 'trop difficile'
                     when discrimination < 0.15 then 'ne départage pas'
                     else null end)
    order by position, variant_group nulls first, id), '[]'::jsonb)
  into v from agg;
  return jsonb_build_object('copies', (select count(*) from attempts where test_id = p_test and status in ('submitted', 'expired', 'terminated')
                                         and not _preview_attempt(test_id, candidate_id)), 'questions', v);
end; $$;

revoke execute on function public._preview_attempt(uuid, uuid) from public, anon, authenticated;

grant execute on function public._preview_attempt(uuid, uuid) to service_role;
