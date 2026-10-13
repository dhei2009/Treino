const TABLE_MIGRATIONS = [
  {
    table: 'group_day_records',
    code: 'MIGRATION_GROUP_DAY_RECORDS_REQUIRED',
    migration: 'supabase/group-day-records.sql',
    error: 'O banco não reconhece public.group_day_records. Execute supabase/group-day-records.sql no SQL Editor do Supabase e tente novamente. A migração mantém os registros pessoais.'
  },
  {
    table: 'planner_tasks',
    code: 'MIGRATION_PLANNER_TASKS_REQUIRED',
    migration: 'supabase/planner-tasks.sql',
    error: 'A tabela de tarefas ainda não está disponível no banco. Execute supabase/planner-tasks.sql no SQL Editor do Supabase.'
  },
  {
    table: 'personal_organizer_items',
    code: 'MIGRATION_PERSONAL_ORGANIZATION_REQUIRED',
    migration: 'supabase/personal-organization.sql',
    error: 'As tabelas de metas, projetos e hábitos ainda não estão disponíveis. Execute supabase/personal-organization.sql no SQL Editor do Supabase.'
  },
  {
    table: 'personal_habit_logs',
    code: 'MIGRATION_PERSONAL_ORGANIZATION_REQUIRED',
    migration: 'supabase/personal-organization.sql',
    error: 'As tabelas de metas, projetos e hábitos ainda não estão disponíveis. Execute supabase/personal-organization.sql no SQL Editor do Supabase.'
  },
  {
    table: 'app_users',
    code: 'MIGRATION_CORE_SCHEMA_REQUIRED',
    migration: 'supabase/schema.sql',
    error: 'Faltam tabelas principais do Shape Together. Confira a instalação inicial descrita em supabase/schema.sql antes de tentar novamente.'
  },
  {
    table: 'groups',
    code: 'MIGRATION_CORE_SCHEMA_REQUIRED',
    migration: 'supabase/schema.sql',
    error: 'Faltam tabelas principais do Shape Together. Confira a instalação inicial descrita em supabase/schema.sql antes de tentar novamente.'
  },
  {
    table: 'group_members',
    code: 'MIGRATION_CORE_SCHEMA_REQUIRED',
    migration: 'supabase/schema.sql',
    error: 'Faltam tabelas principais do Shape Together. Confira a instalação inicial descrita em supabase/schema.sql antes de tentar novamente.'
  },
  {
    table: 'group_invites',
    code: 'MIGRATION_CORE_SCHEMA_REQUIRED',
    migration: 'supabase/schema.sql',
    error: 'Faltam tabelas principais do Shape Together. Confira a instalação inicial descrita em supabase/schema.sql antes de tentar novamente.'
  },
  {
    table: 'day_records',
    code: 'MIGRATION_CORE_SCHEMA_REQUIRED',
    migration: 'supabase/schema.sql',
    error: 'Faltam tabelas principais do Shape Together. Confira a instalação inicial descrita em supabase/schema.sql antes de tentar novamente.'
  },
  {
    table: 'user_preferences',
    code: 'MIGRATION_CORE_SCHEMA_REQUIRED',
    migration: 'supabase/schema.sql',
    error: 'Faltam tabelas principais do Shape Together. Confira a instalação inicial descrita em supabase/schema.sql antes de tentar novamente.'
  }
];

const COLUMN_MIGRATIONS = [
  {
    column: 'visibility',
    code: 'MIGRATION_GROUP_VISIBILITY_REQUIRED',
    migration: 'supabase/groups-visibility.sql',
    error: 'A estrutura de visibilidade das salas está desatualizada. Execute supabase/groups-visibility.sql no SQL Editor do Supabase.'
  },
  {
    column: 'default_workspace_mode',
    code: 'MIGRATION_WORKSPACE_MODE_REQUIRED',
    migration: 'supabase/workspace-mode.sql',
    error: 'A preferência de espaço inicial ainda não existe no banco. Execute supabase/workspace-mode.sql no SQL Editor do Supabase.'
  }
];

/**
 * Converts recognizable Postgres/PostgREST schema-cache failures into safe,
 * actionable messages. It deliberately never returns raw SQL or credentials.
 */
export function schemaMigrationHint(error) {
  const code = String(error?.code || error?.statusCode || '').toUpperCase();
  const message = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const relationMissing =
    ['PGRST205', '42P01'].includes(code) ||
    /could not find the table|relation\s+["'`]?.+?["'`]?(?:\s+does not exist|\s+is missing)|table\s+.+?does not exist/.test(message);

  if (relationMissing) {
    const match = TABLE_MIGRATIONS.find((entry) => message.includes(entry.table));
    if (match) {
      return {
        code: match.code,
        migration: match.migration,
        error: match.error
      };
    }
    return {
      code: 'DATABASE_SCHEMA_TABLE_MISSING',
      migration: 'supabase/schema.sql',
      error: 'O banco não reconhece uma tabela necessária ao Shape Together. Confira a migração correspondente no diretório supabase e atualize o cache do esquema antes de tentar novamente.'
    };
  }

  const columnMissing =
    ['PGRST204', '42703'].includes(code) ||
    /could not find the .+ column|column .+ does not exist|column .+ is missing/.test(message);

  if (columnMissing) {
    const match = COLUMN_MIGRATIONS.find((entry) => message.includes(entry.column));
    if (match) {
      return { code: match.code, migration: match.migration, error: match.error };
    }
    const tableMatch = TABLE_MIGRATIONS.find((entry) => message.includes(entry.table));
    if (tableMatch) {
      return {
        code: tableMatch.code,
        migration: tableMatch.migration,
        error: `A estrutura de ${tableMatch.table} está incompleta. Confira ${tableMatch.migration}; não apague a tabela nem os dados existentes.`
      };
    }
    return {
      code: 'DATABASE_SCHEMA_COLUMN_MISSING',
      migration: 'supabase/schema.sql',
      error: 'O banco possui uma estrutura diferente da esperada pelo aplicativo. Confira as migrações existentes no diretório supabase antes de alterar tabelas.'
    };
  }

  if (code === '42883' || /function .+ does not exist|function .+ was not found/.test(message)) {
    return {
      code: 'MIGRATION_CORE_SCHEMA_REQUIRED',
      migration: 'supabase/schema.sql',
      error: 'Falta uma função necessária no banco. Confira supabase/schema.sql e as migrações aplicadas antes de tentar novamente.'
    };
  }

  return null;
}
