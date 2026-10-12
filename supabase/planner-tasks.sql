-- Shape Together 10.2.0 — tarefas do Planejador.
-- Migração ADITIVA: não altera nem converte registros de treino existentes.
-- Execute no Supabase SQL Editor antes de publicar o backend 10.2.0.

create table if not exists public.planner_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.app_users(id) on delete set null,
  workspace_group_id uuid references public.groups(id) on delete cascade,
  title text not null,
  details text not null default '',
  due_date date,
  priority text not null default 'normal',
  status text not null default 'open',
  category text not null default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planner_tasks_title_check check (char_length(btrim(title)) between 1 and 160),
  constraint planner_tasks_details_check check (char_length(details) <= 2000),
  constraint planner_tasks_priority_check check (priority in ('low', 'normal', 'high')),
  constraint planner_tasks_status_check check (status in ('open', 'done', 'cancelled')),
  constraint planner_tasks_category_check check (category in ('general', 'personal', 'study', 'work', 'training', 'project'))
);

create index if not exists idx_planner_tasks_owner_due
  on public.planner_tasks(owner_id, due_date);
create index if not exists idx_planner_tasks_group_due
  on public.planner_tasks(workspace_group_id, due_date)
  where workspace_group_id is not null;
create index if not exists idx_planner_tasks_updated
  on public.planner_tasks(updated_at desc);

drop trigger if exists trg_planner_tasks_updated_at on public.planner_tasks;
create trigger trg_planner_tasks_updated_at
before update on public.planner_tasks
for each row execute function public.set_updated_at();

-- O acesso passa exclusivamente pelas rotas autenticadas do Worker.
-- RLS também bloqueia leitura/escrita direta via anon/authenticated.
alter table public.planner_tasks enable row level security;
revoke all on table public.planner_tasks from anon, authenticated;
grant all on table public.planner_tasks to service_role;
