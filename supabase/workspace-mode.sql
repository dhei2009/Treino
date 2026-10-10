-- Shape Together: adiciona a preferência de espaço inicial que o servidor já utiliza.
-- Seguro para executar mais de uma vez; não apaga nem altera registros existentes.
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS default_workspace_mode text NOT NULL DEFAULT 'personal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_preferences_default_workspace_mode_check'
      AND conrelid = 'public.user_preferences'::regclass
  ) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_default_workspace_mode_check
      CHECK (default_workspace_mode IN ('personal', 'group'));
  END IF;
END
$$;

-- Atualiza o cache de esquema usado pelo PostgREST/Supabase.
NOTIFY pgrst, 'reload schema';
