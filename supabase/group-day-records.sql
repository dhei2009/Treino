-- Shape Together 10.3.1 — registros diários separados por sala.
-- Corrige: "Could not find the table 'public.group_day_records' in the schema cache".
-- Migração aditiva/idempotente: preserve os registros pessoais e os dados de treino.
-- Execute no Supabase SQL Editor uma vez antes de publicar/usar a versão atualizada.

begin;

do $$
begin
  if to_regclass('public.groups') is null then
    raise exception 'A tabela public.groups não existe. Execute primeiro a migração inicial do Shape Together.';
  end if;
  if to_regclass('public.app_users') is null then
    raise exception 'A tabela public.app_users não existe. Execute primeiro a migração inicial do Shape Together.';
  end if;
  if to_regclass('public.group_members') is null then
    raise exception 'A tabela public.group_members não existe. Execute primeiro a migração inicial do Shape Together.';
  end if;
  if to_regclass('public.day_records') is null then
    raise exception 'A tabela public.day_records não existe. Execute primeiro a migração inicial do Shape Together.';
  end if;
  if to_regprocedure('public.is_group_member(uuid)') is null then
    raise exception 'A função public.is_group_member(uuid) não existe. Execute primeiro o schema inicial do Shape Together.';
  end if;
  if to_regprocedure('public.current_app_user_id()') is null then
    raise exception 'A função public.current_app_user_id() não existe. Execute primeiro o schema inicial do Shape Together.';
  end if;
end;
$$;

create table if not exists public.group_day_records (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  day date not null,
  status text not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id, day),
  constraint group_day_records_status_check
    check (status in ('red', 'green', 'blue', 'orange')),
  constraint group_day_records_note_check
    check (char_length(note) <= 500)
);

create index if not exists idx_group_day_records_group_day
  on public.group_day_records(group_id, day desc);

alter table public.group_day_records enable row level security;

drop policy if exists group_day_records_select_member
  on public.group_day_records;
create policy group_day_records_select_member
on public.group_day_records
for select to authenticated
using (public.is_group_member(group_id));

drop policy if exists group_day_records_insert_own
  on public.group_day_records;
create policy group_day_records_insert_own
on public.group_day_records
for insert to authenticated
with check (
  user_id = public.current_app_user_id()
  and public.is_group_member(group_id)
);

drop policy if exists group_day_records_update_own
  on public.group_day_records;
create policy group_day_records_update_own
on public.group_day_records
for update to authenticated
using (
  user_id = public.current_app_user_id()
  and public.is_group_member(group_id)
)
with check (
  user_id = public.current_app_user_id()
  and public.is_group_member(group_id)
);

drop policy if exists group_day_records_delete_own
  on public.group_day_records;
create policy group_day_records_delete_own
on public.group_day_records
for delete to authenticated
using (
  user_id = public.current_app_user_id()
  and public.is_group_member(group_id)
);

revoke all on table public.group_day_records from anon, authenticated;
grant select, insert, update, delete on table public.group_day_records to authenticated;
grant all on table public.group_day_records to service_role;

-- Copia os registros já existentes às salas atuais, sem apagar os pessoais.
-- Usar ON CONFLICT DO NOTHING torna a operação segura ao executar novamente.
insert into public.group_day_records
  (group_id, user_id, day, status, note, updated_at)
select gm.group_id, dr.user_id, dr.day, dr.status, dr.note, dr.updated_at
from public.day_records as dr
join public.group_members as gm on gm.user_id = dr.user_id
on conflict (group_id, user_id, day) do nothing;

commit;

-- Solicita ao PostgREST que atualize o cache do schema imediatamente.
notify pgrst, 'reload schema';
