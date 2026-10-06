-- Shape Together — Etapa 1: banco de dados online
-- Compatível com Supabase/PostgreSQL.
-- Este schema prepara autenticação futura via auth.users, mas a Etapa 1
-- ainda usa o login do servidor existente para não alterar o fluxo visual.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  username text not null unique,
  email text,
  initials text not null default 'EU',
  color text not null default '#4C7DFF',
  avatar_path text,
  avatar_source_path text,
  avatar_crop jsonb,
  active_group_id uuid,
  password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_username_check check (username = lower(username) and length(username) between 2 and 40),
  constraint app_users_color_check check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Shape Together',
  created_by uuid references public.app_users(id) on delete set null,
  invite_code text not null unique,
  challenge_start date not null default date '2026-09-29',
  challenge_end date not null default date '2026-12-31',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users
  drop constraint if exists app_users_active_group_fk;
alter table public.app_users
  add constraint app_users_active_group_fk
  foreign key (active_group_id) references public.groups(id) on delete set null;

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  constraint group_members_role_check check (role in ('owner','admin','member'))
);

create table if not exists public.day_records (
  user_id uuid not null references public.app_users(id) on delete cascade,
  day date not null,
  status text not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, day),
  constraint day_records_status_check check (status in ('red','green','blue','orange')),
  constraint day_records_note_check check (char_length(note) <= 500)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  theme text not null default 'light',
  accent text not null default '#11120F',
  updated_at timestamptz not null default now(),
  constraint user_preferences_theme_check check (theme in ('light','dark')),
  constraint user_preferences_accent_check check (accent ~ '^#[0-9A-Fa-f]{6}$')
);

create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  code text not null unique,
  created_by uuid references public.app_users(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_group_members_user on public.group_members(user_id);
create index if not exists idx_group_members_group on public.group_members(group_id);
create index if not exists idx_day_records_user_day on public.day_records(user_id, day desc);
create index if not exists idx_app_users_active_group on public.app_users(active_group_id);
create index if not exists idx_group_invites_code on public.group_invites(code);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_users_updated_at on public.app_users;
create trigger trg_app_users_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

drop trigger if exists trg_groups_updated_at on public.groups;
create trigger trg_groups_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_preferences_updated_at on public.user_preferences;
create trigger trg_user_preferences_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

-- Helpers para RLS. São SECURITY DEFINER para evitar recursão entre políticas.
create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select id
  from public.app_users
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.users_share_group(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on b.group_id = a.group_id
    where a.user_id = p_user_a
      and b.user_id = p_user_b
  );
$$;

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = public.current_app_user_id()
  );
$$;

create or replace function public.is_group_owner_or_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = public.current_app_user_id()
      and gm.role in ('owner','admin')
  );
$$;

revoke all on function public.current_app_user_id() from public;
revoke all on function public.users_share_group(uuid,uuid) from public;
revoke all on function public.is_group_member(uuid) from public;
revoke all on function public.is_group_owner_or_admin(uuid) from public;
grant execute on function public.current_app_user_id() to authenticated;
grant execute on function public.users_share_group(uuid,uuid) to authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner_or_admin(uuid) to authenticated;

-- RLS: habilitado em toda tabela exposta.
alter table public.app_users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.day_records enable row level security;
alter table public.user_preferences enable row level security;
alter table public.group_invites enable row level security;

-- app_users
 drop policy if exists app_users_select_visible on public.app_users;
create policy app_users_select_visible
on public.app_users for select
to authenticated
using (
  id = public.current_app_user_id()
  or public.users_share_group(public.current_app_user_id(), id)
);

drop policy if exists app_users_insert_self on public.app_users;
create policy app_users_insert_self
on public.app_users for insert
to authenticated
with check (id = public.current_app_user_id());

drop policy if exists app_users_update_self on public.app_users;
create policy app_users_update_self
on public.app_users for update
to authenticated
using (id = public.current_app_user_id())
with check (id = public.current_app_user_id());

-- groups
 drop policy if exists groups_select_member on public.groups;
create policy groups_select_member
on public.groups for select
to authenticated
using (public.is_group_member(id));

drop policy if exists groups_insert_owner on public.groups;
create policy groups_insert_owner
on public.groups for insert
to authenticated
with check (created_by = public.current_app_user_id());

drop policy if exists groups_update_owner on public.groups;
create policy groups_update_owner
on public.groups for update
to authenticated
using (public.is_group_owner_or_admin(id))
with check (public.is_group_owner_or_admin(id));

-- group_members
 drop policy if exists group_members_select_member on public.group_members;
create policy group_members_select_member
on public.group_members for select
to authenticated
using (public.is_group_member(group_id));

drop policy if exists group_members_insert_self_or_admin on public.group_members;
create policy group_members_insert_self_or_admin
on public.group_members for insert
to authenticated
with check (
  user_id = public.current_app_user_id()
  or public.is_group_owner_or_admin(group_id)
);

drop policy if exists group_members_delete_self_or_admin on public.group_members;
create policy group_members_delete_self_or_admin
on public.group_members for delete
to authenticated
using (
  user_id = public.current_app_user_id()
  or public.is_group_owner_or_admin(group_id)
);

-- day_records
 drop policy if exists day_records_select_group on public.day_records;
create policy day_records_select_group
on public.day_records for select
to authenticated
using (
  user_id = public.current_app_user_id()
  or public.users_share_group(public.current_app_user_id(), user_id)
);

drop policy if exists day_records_insert_self on public.day_records;
create policy day_records_insert_self
on public.day_records for insert
to authenticated
with check (user_id = public.current_app_user_id());

drop policy if exists day_records_update_self on public.day_records;
create policy day_records_update_self
on public.day_records for update
to authenticated
using (user_id = public.current_app_user_id())
with check (user_id = public.current_app_user_id());

drop policy if exists day_records_delete_self on public.day_records;
create policy day_records_delete_self
on public.day_records for delete
to authenticated
using (user_id = public.current_app_user_id());

-- preferences
 drop policy if exists user_preferences_select_self on public.user_preferences;
create policy user_preferences_select_self
on public.user_preferences for select
to authenticated
using (user_id = public.current_app_user_id());

drop policy if exists user_preferences_insert_self on public.user_preferences;
create policy user_preferences_insert_self
on public.user_preferences for insert
to authenticated
with check (user_id = public.current_app_user_id());

drop policy if exists user_preferences_update_self on public.user_preferences;
create policy user_preferences_update_self
on public.user_preferences for update
to authenticated
using (user_id = public.current_app_user_id())
with check (user_id = public.current_app_user_id());

-- invites
 drop policy if exists group_invites_select_member on public.group_invites;
create policy group_invites_select_member
on public.group_invites for select
to authenticated
using (public.is_group_member(group_id));

drop policy if exists group_invites_insert_admin on public.group_invites;
create policy group_invites_insert_admin
on public.group_invites for insert
to authenticated
with check (public.is_group_owner_or_admin(group_id));

drop policy if exists group_invites_delete_admin on public.group_invites;
create policy group_invites_delete_admin
on public.group_invites for delete
to authenticated
using (public.is_group_owner_or_admin(group_id));

-- Grants mínimos para o futuro acesso direto pelo frontend após Google Auth.
revoke all on table public.app_users from anon, authenticated;
revoke all on table public.groups from anon, authenticated;
revoke all on table public.group_members from anon, authenticated;
revoke all on table public.day_records from anon, authenticated;
revoke all on table public.user_preferences from anon, authenticated;
revoke all on table public.group_invites from anon, authenticated;
grant select, insert, update on public.app_users to authenticated;
grant select, insert, update on public.groups to authenticated;
grant select, insert, delete on public.group_members to authenticated;
grant select, insert, update, delete on public.day_records to authenticated;
grant select, insert, update on public.user_preferences to authenticated;
grant select, insert, delete on public.group_invites to authenticated;

-- Storage de fotos. O bucket é público para leitura das fotos dos integrantes;
-- escrita/alteração/remoção continuam protegidas.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = public.current_app_user_id()::text
);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = public.current_app_user_id()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = public.current_app_user_id()::text
);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = public.current_app_user_id()::text
);
