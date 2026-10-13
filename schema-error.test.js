import test from 'node:test';
import assert from 'node:assert/strict';
import { schemaMigrationHint } from './schema-error.js';

test('identifies missing group_day_records schema-cache table', () => {
  const hint = schemaMigrationHint({
    code: 'PGRST205',
    message: "Could not find the table 'public.group_day_records' in the schema cache"
  });
  assert.equal(hint.code, 'MIGRATION_GROUP_DAY_RECORDS_REQUIRED');
  assert.equal(hint.migration, 'supabase/group-day-records.sql');
  assert.match(hint.error, /mantém os registros pessoais/i);
});

test('identifies missing planner and organizer migrations', () => {
  const planner = schemaMigrationHint({ code: '42P01', message: 'relation "public.planner_tasks" does not exist' });
  const organizer = schemaMigrationHint({ code: 'PGRST205', message: "Could not find the table 'public.personal_habit_logs' in the schema cache" });
  assert.equal(planner.migration, 'supabase/planner-tasks.sql');
  assert.equal(organizer.migration, 'supabase/personal-organization.sql');
});

test('identifies known missing compatibility columns and functions', () => {
  const visibility = schemaMigrationHint({ code: 'PGRST204', message: "Could not find the 'visibility' column of 'groups' in the schema cache" });
  const mode = schemaMigrationHint({ code: '42703', message: 'column default_workspace_mode does not exist' });
  const fn = schemaMigrationHint({ code: '42883', message: 'function public.is_group_member(uuid) does not exist' });
  assert.equal(visibility.migration, 'supabase/groups-visibility.sql');
  assert.equal(mode.migration, 'supabase/workspace-mode.sql');
  assert.equal(fn.migration, 'supabase/schema.sql');
});

test('does not classify ordinary server errors as migration failures', () => {
  assert.equal(schemaMigrationHint({ code: '57014', message: 'statement timeout' }), null);
  assert.equal(schemaMigrationHint({ message: 'connection refused' }), null);
});
