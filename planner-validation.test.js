import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlannerIsoDate, validatePlannerRange, validatePlannerTaskInput } from './planner-validation.js';

test('validates real ISO dates, not just date-shaped strings', () => {
  assert.equal(isPlannerIsoDate('2026-10-12'), true);
  assert.equal(isPlannerIsoDate('2026-02-30'), false);
  assert.equal(isPlannerIsoDate('12/10/2026'), false);
});

test('validates range order and prevents huge range queries', () => {
  assert.equal(validatePlannerRange('2026-10-01', '2026-10-31').error, null);
  assert.match(validatePlannerRange('2026-10-31', '2026-10-01').error, /inicial/);
  assert.match(validatePlannerRange('2025-01-01', '2026-10-12').error, /371 dias/);
  assert.match(validatePlannerRange('2026-10-01', '').error, /início e o fim/);
});

test('normalizes task creation and trims user text', () => {
  const result = validatePlannerTaskInput({ title: '  Estudar JS  ', details: '  Capítulo 1 ', dueDate: '2026-10-13' });
  assert.equal(result.error, null);
  assert.deepEqual(result.value, { title: 'Estudar JS', details: 'Capítulo 1', due_date: '2026-10-13', priority: 'normal', status: 'open', category: 'general' });
});

test('rejects invalid task values and oversized text', () => {
  assert.match(validatePlannerTaskInput({ title: ' ' }).error, /título/);
  assert.match(validatePlannerTaskInput({ title: 'Tarefa', dueDate: '2026-02-30' }).error, /data/);
  assert.match(validatePlannerTaskInput({ title: 'Tarefa', priority: 'urgent' }).error, /prioridade/);
  assert.match(validatePlannerTaskInput({ title: 'Tarefa', details: 'x'.repeat(2001) }).error, /2.000/);
});

test('PATCH validation only accepts allowlisted mutable fields', () => {
  assert.deepEqual(validatePlannerTaskInput({ status: 'done', owner_id: 'attacker' }, { partial: true }).value, { status: 'done' });
  assert.match(validatePlannerTaskInput({ owner_id: 'attacker' }, { partial: true }).error, /Nenhuma alteração/);
  assert.equal(validatePlannerTaskInput({ dueDate: '' }, { partial: true }).value.due_date, null);
});
