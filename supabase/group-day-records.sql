-- Shape Together: registros separados por sala. MIGRACAO ADITIVA.
-- Execute uma vez no Supabase SQL Editor antes do deploy do Worker atualizado.
-- Não apaga nem altera os registros pessoais existentes; faz backfill por sala.

create table if not exists public.group_day_records (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  day date not null,
  status text not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id, day),
  constraint group_day_records_status_check check (status in ('red', 'green', 'blue', 'orange')),
  constraint group_day_records_note_check check (char_length(note) <= 500)
);

create index if not exists idx_group_day_records_group_day
  on public.group_day_records(group_id, day desc);

alter table public.group_day_records enable row level security;

drop policy if exists group_day_records_select_member on public.group_day_records;
create policy group_day_records_select_member
on public.group_day_records for select to authenticated
using (public.is_group_member(group_id));

drop policy if exists group_day_records_insert_own on public.group_day_records;
create policy group_day_records_insert_own
on public.group_day_records for insert to authenticated
with check (user_id = public.current_app_user_id() and public.is_group_member(group_id));

drop policy if exists group_day_records_update_own on public.group_day_records;
create policy group_day_records_update_own
on public.group_day_records for update to authenticated
using (user_id = public.current_app_user_id() and public.is_group_member(group_id))
with check (user_id = public.current_app_user_id() and public.is_group_member(group_id));

drop policy if exists group_day_records_delete_own on public.group_day_records;
create policy group_day_records_delete_own
on public.group_day_records for delete to authenticated
using (user_id = public.current_app_user_id() and public.is_group_member(group_id));

revoke all on table public.group_day_records from anon, authenticated;
grant select, insert, update, delete on public.group_day_records to authenticated;

-- Backfill idempotente: cada registro atual é copiado para todas as salas
-- das quais seu autor participa. O registro pessoal original fica intacto.
insert into public.group_day_records(group_id, user_id, day, status, note, updated_at)
select gm.group_id, dr.user_id, dr.day, dr.status, dr.note, dr.updated_at
from public.day_records dr
join public.group_members gm on gm.user_id = dr.user_id
on conflict (group_id, user_id, day) do nothing;

notify pgrst, 'reload schema';
