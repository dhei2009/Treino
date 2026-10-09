-- CONSULTA SOMENTE DE LEITURA.
-- Use apenas se uma conta nova continuar mostrando uma sala que não criou nem entrou.
-- Não cria, edita nem apaga usuários, salas ou participantes.
select
  u.id as user_id,
  u.name as user_name,
  u.email,
  u.created_at as user_created_at,
  u.active_group_id,
  active_g.name as active_group_name,
  active_g.visibility as active_group_visibility,
  g.id as member_group_id,
  g.name as member_group_name,
  g.visibility as member_group_visibility,
  g.created_by as member_group_created_by,
  g.created_at as member_group_created_at,
  gm.role as membership_role,
  gm.joined_at
from public.app_users u
left join public.groups active_g
  on active_g.id = u.active_group_id
left join public.group_members gm
  on gm.user_id = u.id
left join public.groups g
  on g.id = gm.group_id
order by u.created_at desc, gm.joined_at desc nulls last;
