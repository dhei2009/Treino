-- Shape Together — visibilidade de salas públicas e privadas.
-- Migração aditiva e segura: não recria tabelas nem apaga salas, membros ou registros.
-- Salas que já existiam antes deste recurso começam como privadas por segurança;
-- depois da migração, o criador pode alterar a visibilidade na tela Gerenciar sala.

alter table public.groups
  add column if not exists visibility text not null default 'private';

-- Garante o padrão e normaliza somente valores ausentes/inválidos, caso a coluna
-- tenha sido criada manualmente antes desta migração.
alter table public.groups
  alter column visibility set default 'private';

update public.groups
set visibility = 'private'
where visibility is null or visibility not in ('public', 'private');

alter table public.groups
  alter column visibility set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'groups_visibility_check'
      and conrelid = 'public.groups'::regclass
  ) then
    alter table public.groups
      add constraint groups_visibility_check
      check (visibility in ('public', 'private'));
  end if;
end $$;

create index if not exists idx_groups_visibility_name
  on public.groups (visibility, name);

-- Atualiza a cache do PostgREST usada pela API do Supabase.
notify pgrst, 'reload schema';
