-- Shape Together — migração segura para Espaço Pessoal + Salas/Grupos.
-- Execute UMA vez no Supabase SQL Editor. Não apaga dados existentes.

alter table public.user_preferences
  add column if not exists default_workspace_mode text not null default 'personal';

alter table public.user_preferences
  drop constraint if exists user_preferences_default_workspace_mode_check;
alter table public.user_preferences
  add constraint user_preferences_default_workspace_mode_check
  check (default_workspace_mode in ('personal', 'group'));

alter table public.groups
  add column if not exists visibility text not null default 'private';

alter table public.groups
  drop constraint if exists groups_visibility_check;
alter table public.groups
  add constraint groups_visibility_check
  check (visibility in ('private', 'public'));

create index if not exists idx_user_preferences_default_workspace
  on public.user_preferences(default_workspace_mode);

create index if not exists idx_groups_visibility
  on public.groups(visibility);
