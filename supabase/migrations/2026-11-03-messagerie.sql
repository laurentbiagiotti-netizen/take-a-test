------------------------------------------------------------
-- Messagerie candidat / surveillant pendant l'épreuve
------------------------------------------------------------
create table if not exists exam_messages (
  id bigserial primary key,
  attempt_id uuid not null references attempts(id) on delete cascade,
  sender text not null check (sender in ('candidate', 'staff')),
  author uuid references profiles(id) on delete set null,
  body text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists exam_messages_attempt on exam_messages (attempt_id, id);
alter table exam_messages enable row level security;
revoke all on exam_messages from anon, authenticated;
grant select on exam_messages to authenticated;
drop policy if exists "messages staff read" on exam_messages;
create policy "messages staff read" on exam_messages for select to authenticated using (is_staff());

-- Le candidat écrit au surveillant : session vérifiée, 3 messages par minute, 40 au total.
create or replace function public.exam_send_message(p_user uuid, p_attempt uuid, p_token_hash text,
                                                    p_body text, p_ip text, p_ua text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a attempts;
  v_body text := btrim(coalesce(p_body, ''));
begin
  a := _load_session(p_user, p_attempt, p_token_hash, p_ip, p_ua);
  if a.status <> 'in_progress' then return jsonb_build_object('status', a.status); end if;
  if length(v_body) = 0 or length(v_body) > 1000 then raise exception 'message_invalid' using errcode = 'P0001'; end if;
  if (select count(*) from exam_messages where attempt_id = a.id and sender = 'candidate'
        and created_at > now() - interval '1 minute') >= 3
     or (select count(*) from exam_messages where attempt_id = a.id and sender = 'candidate') >= 40 then
    raise exception 'message_rate' using errcode = 'P0001';
  end if;
  insert into exam_messages (attempt_id, sender, author, body) values (a.id, 'candidate', p_user, v_body);
  return jsonb_build_object('status', a.status, 'sent', true);
end; $$;

-- Le surveillant répond (ou écrit le premier). Les messages du candidat passent en « lus ».
create or replace function public.staff_send_message(p_actor uuid, p_attempt uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_status attempt_status;
begin
  if not _is_staff_user(p_actor) then raise exception 'forbidden' using errcode = '42501'; end if;
  select status into v_status from attempts where id = p_attempt;
  if v_status is null then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if v_status <> 'in_progress' then raise exception 'attempt_not_running' using errcode = 'P0001'; end if;
  if length(v_body) = 0 or length(v_body) > 1000 then raise exception 'message_invalid' using errcode = 'P0001'; end if;
  update exam_messages set read_at = now() where attempt_id = p_attempt and sender = 'candidate' and read_at is null;
  insert into exam_messages (attempt_id, sender, author, body) values (p_attempt, 'staff', p_actor, v_body);
  return jsonb_build_object('sent', true);
end; $$;

create or replace function public.staff_read_messages(p_actor uuid, p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _is_staff_user(p_actor) then raise exception 'forbidden' using errcode = '42501'; end if;
  update exam_messages set read_at = now() where attempt_id = p_attempt and sender = 'candidate' and read_at is null;
  return jsonb_build_object('ok', true);
end; $$;

revoke execute on function public.exam_send_message(uuid, uuid, text, text, text, text),
  public.staff_send_message(uuid, uuid, text), public.staff_read_messages(uuid, uuid) from public, anon, authenticated;
grant execute on function public.exam_send_message(uuid, uuid, text, text, text, text),
  public.staff_send_message(uuid, uuid, text), public.staff_read_messages(uuid, uuid) to service_role;
grant all on exam_messages to service_role;
grant usage on sequence exam_messages_id_seq to service_role;
