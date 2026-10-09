-- Shape Together — datas de meta do espaço pessoal.
-- Migração aditiva e segura: apenas acrescenta colunas e uma validação;
-- não apaga tabelas, contas, anotações nem registros de treino.

alter table public.user_preferences
  add column if not exists personal_goal_start date,
  add column if not exists personal_goal_end date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_preferences_personal_goal_dates_check'
      and conrelid = 'public.user_preferences'::regclass
  ) then
    alter table public.user_preferences
      add constraint user_preferences_personal_goal_dates_check
      check (
        personal_goal_start is null
        or personal_goal_end is null
        or personal_goal_start <= personal_goal_end
      );
  end if;
end $$;
