-- Shape Together 10.3.0 — organização pessoal: metas, projetos e hábitos.
-- MIGRAÇÃO ADITIVA: preserva os treinos, registros diários, salas e tarefas existentes.
-- Execute no Supabase SQL Editor antes de publicar a versão 10.3.0.

begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.personal_organizer_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.app_users(id) on delete cascade,
  type text not null,
  title text not null,
  details text not null default '',
  due_date date,
  priority text not null default 'normal',
  status text not null default 'active',
  progress smallint not null default 0,
  cadence text not null default 'daily',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_organizer_type_check check (type in ('goal', 'project', 'habit')),
  constraint personal_organizer_title_check check (char_length(btrim(title)) between 1 and 160),
  constraint personal_organizer_details_check check (char_length(details) <= 2000),
  constraint personal_organizer_priority_check check (priority in ('low', 'normal', 'high')),
  constraint personal_organizer_status_check check (status in ('active', 'paused', 'done')),
  constraint personal_organizer_progress_check check (progress between 0 and 100),
  constraint personal_organizer_cadence_check check (cadence in ('daily', 'weekdays', 'weekly'))
);

create index if not exists idx_personal_organizer_owner_type_status
  on public.personal_organizer_items(owner_id, type, status);
create index if not exists idx_personal_organizer_owner_due
  on public.personal_organizer_items(owner_id, due_date);

drop trigger if exists trg_personal_organizer_items_updated_at
  on public.personal_organizer_items;
create trigger trg_personal_organizer_items_updated_at
before update on public.personal_organizer_items
for each row execute function public.set_updated_at();

create table if not exists public.personal_habit_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.app_users(id) on delete cascade,
  item_id uuid not null references public.personal_organizer_items(id) on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now(),
  constraint personal_habit_logs_unique_day unique(owner_id, item_id, log_date)
);

create index if not exists idx_personal_habit_logs_owner_date
  on public.personal_habit_logs(owner_id, log_date desc);
create index if not exists idx_personal_habit_logs_item_date
  on public.personal_habit_logs(item_id, log_date desc);

alter table public.personal_organizer_items enable row level security;
alter table public.personal_habit_logs enable row level security;
revoke all on table public.personal_organizer_items from anon, authenticated;
revoke all on table public.personal_habit_logs from anon, authenticated;
grant all on table public.personal_organizer_items to service_role;
grant all on table public.personal_habit_logs to service_role;

commit;
