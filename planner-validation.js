const PRIORITIES = new Set(['low', 'normal', 'high']);
const STATUSES = new Set(['open', 'done', 'cancelled']);
const CATEGORIES = new Set(['general', 'personal', 'study', 'work', 'training', 'project']);

export function isPlannerIsoDate(value) {
  const text = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validatePlannerRange(fromValue, toValue) {
  const fromText = String(fromValue ?? '').trim();
  const toText = String(toValue ?? '').trim();
  if (!fromText && !toText) return { from: null, to: null, error: null };
  if (!fromText || !toText) return { from: null, to: null, error: 'Informe o início e o fim do período.' };
  if (!isPlannerIsoDate(fromText) || !isPlannerIsoDate(toText)) {
    return { from: null, to: null, error: 'O período informado contém uma data inválida.' };
  }
  if (fromText > toText) return { from: null, to: null, error: 'A data inicial não pode ser posterior à data final.' };
  const span = (Date.parse(`${toText}T00:00:00Z`) - Date.parse(`${fromText}T00:00:00Z`)) / 86400000;
  if (span > 370) return { from: null, to: null, error: 'Consulte um período de até 371 dias por vez.' };
  return { from: fromText, to: toText, error: null };
}

/** Normaliza somente campos permitidos. `partial` é usado em atualizações PATCH. */
export function validatePlannerTaskInput(input, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { value: null, error: 'Envie os dados da tarefa em formato válido.' };
  }
  const value = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(input, key);

  if (!partial || has('title')) {
    const title = String(input.title ?? '').trim();
    if (!title || title.length > 160) return { value: null, error: 'O título deve ter entre 1 e 160 caracteres.' };
    value.title = title;
  }
  if (!partial || has('details')) {
    const details = String(input.details ?? '').trim();
    if (details.length > 2000) return { value: null, error: 'Os detalhes podem ter no máximo 2.000 caracteres.' };
    value.details = details;
  }
  if (!partial || has('dueDate')) {
    const dueText = String(input.dueDate ?? '').trim();
    if (dueText && !isPlannerIsoDate(dueText)) return { value: null, error: 'A data da tarefa é inválida.' };
    value.due_date = dueText || null;
  }
  if (!partial || has('priority')) {
    const priority = String(input.priority ?? (partial ? '' : 'normal'));
    if (!PRIORITIES.has(priority)) return { value: null, error: 'A prioridade selecionada é inválida.' };
    value.priority = priority;
  }
  if (!partial || has('status')) {
    const status = String(input.status ?? (partial ? '' : 'open'));
    if (!STATUSES.has(status)) return { value: null, error: 'O status selecionado é inválido.' };
    value.status = status;
  }
  if (!partial || has('category')) {
    const category = String(input.category ?? (partial ? '' : 'general'));
    if (!CATEGORIES.has(category)) return { value: null, error: 'A categoria selecionada é inválida.' };
    value.category = category;
  }
  if (!Object.keys(value).length) return { value: null, error: 'Nenhuma alteração válida foi enviada.' };
  return { value, error: null };
}
