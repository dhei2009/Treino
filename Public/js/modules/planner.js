(() => {
  'use strict';

  const root = document.getElementById('page-planner');
  if (!root) return;

  const state = {
    active: false,
    view: 'week',
    anchor: new Date(),
    workspaceMode: 'personal',
    groupId: null,
    tasks: [],
    requestId: 0,
    loaded: false,
    busy: false,
    pollTimer: null
  };

  const pad = (n) => String(n).padStart(2, '0');
  const toIso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const fromIso = (value) => {
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const dateLabel = (value, options = { day: '2-digit', month: 'short' }) => {
    if (!value) return 'Sem data';
    return fromIso(value).toLocaleDateString('pt-BR', options);
  };
  const rangeFor = () => {
    const anchor = new Date(state.anchor.getFullYear(), state.anchor.getMonth(), state.anchor.getDate(), 12);
    if (state.view === 'month') {
      return {
        from: new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12),
        to: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 12)
      };
    }
    const from = new Date(anchor);
    const mondayOffset = (from.getDay() + 6) % 7;
    from.setDate(from.getDate() - mondayOffset);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    return { from, to };
  };
  const rangeText = () => {
    const { from, to } = rangeFor();
    if (state.view === 'month') return from.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const sameMonth = from.getMonth() === to.getMonth();
    const left = from.toLocaleDateString('pt-BR', { day: '2-digit', month: sameMonth ? undefined : 'short' });
    const right = to.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${left} – ${right}`;
  };
  const shiftAnchor = (amount) => {
    if (state.view === 'month') state.anchor = new Date(state.anchor.getFullYear(), state.anchor.getMonth() + amount, 1, 12);
    else state.anchor = new Date(state.anchor.getFullYear(), state.anchor.getMonth(), state.anchor.getDate() + amount * 7, 12);
  };
  const inCurrentWorkspace = () => state.workspaceMode === 'group' && state.groupId;

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(path, {
        ...options,
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
      });
      let payload = {};
      try { payload = await response.json(); } catch { /* Non-JSON response is reported below. */ }
      if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.');
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('O servidor demorou para responder. Tente novamente.');
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function setMessage(message, kind = 'info') {
    const element = document.getElementById('stPlannerMessage');
    if (!element) return;
    element.textContent = message || '';
    element.dataset.kind = kind;
    element.hidden = !message;
  }

  function shell() {
    root.innerHTML = `
      <div class="st-planner-page">
        <header class="head st-planner-heading">
          <div><div class="eyebrow">Planejamento ${inCurrentWorkspace() ? 'compartilhado' : 'pessoal'}</div>
            <h1>Transforme planos em progresso.</h1>
            <p>Organize sua semana e seu mês sem misturar tarefas com os registros de treino.</p>
          </div>
          <div class="st-planner-heading-mark" aria-hidden="true">ST<span>+</span></div>
        </header>
        <section class="card st-planner-panel" aria-label="Planejador de tarefas">
          <div class="st-planner-toolbar">
            <div class="st-planner-view-switch" role="group" aria-label="Visualização do planejamento">
              <button type="button" data-st-view="week" aria-pressed="true">Semana</button>
              <button type="button" data-st-view="month" aria-pressed="false">Mês</button>
            </div>
            <div class="st-planner-range-controls">
              <button class="soft st-planner-icon-button" type="button" data-st-prev aria-label="Período anterior">‹</button>
              <strong id="stPlannerRange" aria-live="polite">Esta semana</strong>
              <button class="soft st-planner-icon-button" type="button" data-st-next aria-label="Próximo período">›</button>
              <button class="soft st-planner-today" type="button" data-st-today>Hoje</button>
            </div>
          </div>
          <div class="st-planner-stats" id="stPlannerStats" aria-live="polite"></div>
          <form id="stPlannerForm" class="st-planner-form">
            <div class="st-planner-form-heading"><div><span class="eyebrow">Nova atividade</span><h2>O que você quer realizar?</h2></div><span class="st-planner-plus" aria-hidden="true">+</span></div>
            <label class="st-planner-field st-planner-title-field"><span>Título *</span><input name="title" required maxlength="160" autocomplete="off" placeholder="Ex.: estudar 30 minutos, treinar, finalizar um projeto"></label>
            <div class="st-planner-form-grid">
              <label class="st-planner-field"><span>Data</span><input name="dueDate" type="date" aria-label="Data da tarefa"><small>Deixe em branco para decidir depois.</small></label>
              <label class="st-planner-field"><span>Prioridade</span><select name="priority"><option value="normal">Normal</option><option value="high">Alta</option><option value="low">Baixa</option></select></label>
              <label class="st-planner-field"><span>Categoria</span><select name="category"><option value="general">Geral</option><option value="personal">Pessoal</option><option value="study">Estudos</option><option value="work">Trabalho</option><option value="training">Treino</option><option value="project">Projeto</option></select></label>
            </div>
            <label class="st-planner-field"><span>Detalhes (opcional)</span><textarea name="details" rows="2" maxlength="2000" placeholder="Anotações ou próximos passos…"></textarea></label>
            <div class="st-planner-form-footer"><p>${inCurrentWorkspace() ? 'Esta tarefa ficará visível aos participantes da sala. Só você e administradores podem alterá-la.' : 'Esta tarefa ficará privada no seu espaço pessoal.'}</p><button class="primary" type="submit" id="stPlannerSubmit">Adicionar tarefa <span aria-hidden="true">→</span></button></div>
          </form>
          <div id="stPlannerMessage" class="st-planner-message" role="status" aria-live="polite" hidden></div>
          <div class="st-planner-list-heading"><div><span class="eyebrow">Seu planejamento</span><h2 id="stPlannerListTitle">Esta semana</h2></div><span id="stPlannerCount" class="st-planner-count">Carregando…</span></div>
          <div id="stPlannerTasks" class="st-planner-tasks" aria-live="polite"><div class="st-planner-loading"><span class="st-planner-spinner"></span> Carregando tarefas…</div></div>
        </section>
        <p class="st-planner-footnote">O planejador é independente dos registros de treino. Concluir uma tarefa não altera seu calendário de treinos nem o radar.</p>
      </div>`;

    root.addEventListener('click', onClick);
    root.addEventListener('submit', onSubmit);
  }

  function taskControl(task, compact = false) {
    const done = task.status === 'done';
    const disabled = !task.canManage || state.busy;
    return `<div class="st-planner-task ${done ? 'is-done' : ''} ${compact ? 'is-compact' : ''}">
      <button type="button" class="st-planner-check" data-st-toggle="${escapeHtml(task.id)}" aria-label="${done ? 'Reabrir' : 'Concluir'} ${escapeHtml(task.title)}" aria-pressed="${done ? 'true' : 'false'}" ${disabled ? 'disabled' : ''}>${done ? '✓' : ''}</button>
      <div class="st-planner-task-copy"><span class="st-planner-task-title">${escapeHtml(task.title)}</span>${compact ? '' : `<span class="st-planner-task-meta"><span class="priority-${escapeHtml(task.priority)}">${task.priority === 'high' ? 'Prioridade alta' : task.priority === 'low' ? 'Prioridade baixa' : 'Prioridade normal'}</span><span>${escapeHtml(({general:'Geral',personal:'Pessoal',study:'Estudos',work:'Trabalho',training:'Treino',project:'Projeto'})[task.category] || 'Geral')}</span>${task.details ? `<span>${escapeHtml(task.details.length > 140 ? task.details.slice(0, 137) + '…' : task.details)}</span>` : ''}${state.workspaceMode === 'group' ? `<span>${task.ownerId === null ? 'Sem responsável' : task.ownerId === task.currentUserId ? 'Criada por você' : 'Compartilhada'}</span>` : ''}</span>`}</div>
      ${!compact ? `<button type="button" class="st-planner-delete" data-st-delete="${escapeHtml(task.id)}" aria-label="Excluir ${escapeHtml(task.title)}" ${disabled ? 'disabled' : ''}>×</button>` : ''}
    </div>`;
  }

  function taskMarkup(task, compact = false) {
    return `<div class="st-planner-task-wrap">${taskControl(task, compact)}</div>`;
  }

  function renderWeek(tasks, range) {
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(range.from);
      date.setDate(date.getDate() + i);
      const iso = toIso(date);
      const daily = tasks.filter((task) => task.dueDate === iso);
      const isToday = iso === toIso(new Date());
      days.push(`<section class="st-planner-day ${isToday ? 'is-today' : ''}">
        <header><div><span>${date.toLocaleDateString('pt-BR', { weekday: 'short' })}</span><strong>${pad(date.getDate())}</strong></div><span class="st-planner-day-count">${daily.length || '—'}</span></header>
        <div class="st-planner-day-items">${daily.length ? daily.map((task) => taskMarkup(task)).join('') : '<span class="st-planner-empty-day">Sem tarefas</span>'}</div>
      </section>`);
    }
    const unscheduled = tasks.filter((task) => !task.dueDate);
    return `<div class="st-planner-week-grid">${days.join('')}</div>${unscheduled.length ? `<section class="st-planner-unscheduled"><h3>Sem data <span>${unscheduled.length}</span></h3>${unscheduled.map((task) => taskMarkup(task)).join('')}</section>` : ''}`;
  }

  function renderMonth(tasks, range) {
    const firstWeekday = (range.from.getDay() + 6) % 7;
    const daysInMonth = range.to.getDate();
    const headers = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => `<div class="st-planner-month-weekday">${day}</div>`).join('');
    let cells = '<div class="st-planner-month-cell st-planner-month-blank" aria-hidden="true"></div>'.repeat(firstWeekday);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(range.from.getFullYear(), range.from.getMonth(), day, 12);
      const iso = toIso(date);
      const daily = tasks.filter((task) => task.dueDate === iso);
      const isToday = iso === toIso(new Date());
      cells += `<div class="st-planner-month-cell ${isToday ? 'is-today' : ''}"><div class="st-planner-month-cell-head"><span>${day}</span><button type="button" data-st-add-date="${iso}" aria-label="Criar tarefa para ${dateLabel(iso, {day:'2-digit',month:'long',year:'numeric'})}">+</button></div><div class="st-planner-month-cell-items">${daily.slice(0, 3).map((task) => taskMarkup(task, true)).join('')}${daily.length > 3 ? `<span class="st-planner-more">+${daily.length - 3} mais</span>` : ''}</div></div>`;
    }
    const totalCells = firstWeekday + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    cells += '<div class="st-planner-month-cell st-planner-month-blank" aria-hidden="true"></div>'.repeat(remaining);
    const unscheduled = tasks.filter((task) => !task.dueDate);
    return `<div class="st-planner-month-grid">${headers}${cells}</div>${unscheduled.length ? `<section class="st-planner-unscheduled"><h3>Sem data <span>${unscheduled.length}</span></h3>${unscheduled.map((task) => taskMarkup(task)).join('')}</section>` : ''}`;
  }

  function renderTasks() {
    const viewport = document.getElementById('stPlannerTasks');
    if (!viewport) return;
    const range = rangeFor();
    const sorted = [...state.tasks].sort((a, b) => {
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      const priorityRank = { high: 0, normal: 1, low: 2 };
      if (a.priority !== b.priority) return priorityRank[a.priority] - priorityRank[b.priority];
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
    const completed = sorted.filter((task) => task.status === 'done').length;
    const open = sorted.filter((task) => task.status === 'open').length;
    document.getElementById('stPlannerRange').textContent = rangeText();
    document.getElementById('stPlannerListTitle').textContent = state.view === 'week' ? 'Sua semana' : 'Seu mês';
    document.getElementById('stPlannerCount').textContent = `${sorted.length} ${sorted.length === 1 ? 'tarefa' : 'tarefas'}`;
    document.getElementById('stPlannerStats').innerHTML = `<div><span>Planejadas</span><strong>${sorted.length}</strong></div><div><span>Em aberto</span><strong>${open}</strong></div><div><span>Concluídas</span><strong>${completed}</strong></div>`;
    document.querySelectorAll('[data-st-view]').forEach((button) => {
      const active = button.dataset.stView === state.view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (!sorted.length) {
      viewport.innerHTML = `<div class="st-planner-empty"><span aria-hidden="true">✦</span><strong>Seu espaço está livre.</strong><p>Adicione uma tarefa acima para começar a organizar este período.</p></div>`;
      return;
    }
    // In week view, show every day plus undated tasks; month view uses a calendar grid.
    viewport.innerHTML = state.view === 'week' ? renderWeek(sorted, range) : renderMonth(sorted, range);
  }

  async function loadTasks() {
    if (!state.active) return;
    const requestId = ++state.requestId;
    const range = rangeFor();
    const params = new URLSearchParams({ from: toIso(range.from), to: toIso(range.to), workspaceMode: state.workspaceMode });
    if (state.workspaceMode === 'group' && state.groupId) params.set('groupId', state.groupId);
    const viewport = document.getElementById('stPlannerTasks');
    if (viewport) viewport.innerHTML = '<div class="st-planner-loading"><span class="st-planner-spinner"></span> Carregando tarefas…</div>';
    setMessage('');
    try {
      const result = await request(`/api/tasks?${params.toString()}`);
      if (requestId !== state.requestId || !state.active) return;
      state.tasks = (Array.isArray(result.tasks) ? result.tasks : []).map((task) => ({ ...task, currentUserId: result.currentUserId }));
      state.loaded = true;
      renderTasks();
    } catch (error) {
      if (requestId !== state.requestId || !state.active) return;
      state.tasks = [];
      if (viewport) viewport.innerHTML = `<div class="st-planner-error"><strong>Não foi possível carregar o planejamento.</strong><p>${escapeHtml(error.message || 'Tente novamente.')}</p><button type="button" class="soft" data-st-retry>Recarregar</button></div>`;
      setMessage('Confira sua conexão e se a migração supabase/planner-tasks.sql já foi aplicada.', 'error');
      document.getElementById('stPlannerStats').innerHTML = '';
      document.getElementById('stPlannerCount').textContent = 'Indisponível';
      document.getElementById('stPlannerRange').textContent = rangeText();
    }
  }

  async function onSubmit(event) {
    if (event.target?.id !== 'stPlannerForm') return;
    event.preventDefault();
    if (state.busy) return;
    const form = event.target;
    const data = new FormData(form);
    const payload = {
      title: String(data.get('title') || '').trim(),
      dueDate: String(data.get('dueDate') || ''),
      details: String(data.get('details') || '').trim(),
      priority: String(data.get('priority') || 'normal'),
      category: String(data.get('category') || 'general'),
      workspaceMode: state.workspaceMode,
      groupId: state.workspaceMode === 'group' ? state.groupId : null
    };
    if (!payload.title) return setMessage('Digite um título para a tarefa.', 'error');
    state.busy = true;
    const submit = document.getElementById('stPlannerSubmit');
    if (submit) { submit.disabled = true; submit.textContent = 'Salvando…'; }
    try {
      await request('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
      form.reset();
      await loadTasks();
      setMessage('Tarefa adicionada.', 'success');
    } catch (error) {
      setMessage(error.message || 'Não foi possível salvar a tarefa.', 'error');
    } finally {
      state.busy = false;
      if (submit) { submit.disabled = false; submit.innerHTML = 'Adicionar tarefa <span aria-hidden="true">→</span>'; }
      renderTasks();
    }
  }

  async function updateTask(taskId, changes) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task || !task.canManage || state.busy) return;
    state.busy = true;
    try {
      await request(`/api/tasks/${encodeURIComponent(taskId)}`, { method: 'PATCH', body: JSON.stringify(changes) });
      await loadTasks();
      setMessage(changes.status === 'done' ? 'Tarefa concluída.' : changes.status === 'open' ? 'Tarefa reaberta.' : 'Tarefa atualizada.', 'success');
    } catch (error) {
      setMessage(error.message || 'Não foi possível atualizar a tarefa.', 'error');
    } finally {
      state.busy = false;
      renderTasks();
    }
  }

  async function deleteTask(taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task || !task.canManage || state.busy) return;
    if (!window.confirm(`Excluir a tarefa “${task.title}”? Esta ação não pode ser desfeita.`)) return;
    state.busy = true;
    try {
      await request(`/api/tasks/${encodeURIComponent(taskId)}`, { method: 'DELETE' });
      await loadTasks();
      setMessage('Tarefa excluída.', 'success');
    } catch (error) {
      setMessage(error.message || 'Não foi possível excluir a tarefa.', 'error');
    } finally {
      state.busy = false;
      renderTasks();
    }
  }

  function onClick(event) {
    const viewButton = event.target.closest('[data-st-view]');
    if (viewButton) {
      state.view = viewButton.dataset.stView === 'month' ? 'month' : 'week';
      loadTasks();
      return;
    }
    if (event.target.closest('[data-st-prev]')) {
      shiftAnchor(-1);
      loadTasks();
      return;
    }
    if (event.target.closest('[data-st-next]')) {
      shiftAnchor(1);
      loadTasks();
      return;
    }
    if (event.target.closest('[data-st-today]')) {
      state.anchor = new Date();
      loadTasks();
      return;
    }
    if (event.target.closest('[data-st-retry]')) {
      loadTasks();
      return;
    }
    const addOnDate = event.target.closest('[data-st-add-date]');
    if (addOnDate) {
      const dateInput = root.querySelector('[name="dueDate"]');
      if (dateInput) { dateInput.value = addOnDate.dataset.stAddDate; dateInput.focus(); }
      root.querySelector('[name="title"]')?.focus();
      return;
    }
    const toggle = event.target.closest('[data-st-toggle]');
    if (toggle) {
      const task = state.tasks.find((item) => item.id === toggle.dataset.stToggle);
      if (task) updateTask(task.id, { status: task.status === 'done' ? 'open' : 'done' });
      return;
    }
    const remove = event.target.closest('[data-st-delete]');
    if (remove) deleteTask(remove.dataset.stDelete);
  }

  function onPageChange(event) {
    const detail = event.detail || {};
    state.active = detail.page === 'planner';
    if (!state.active) {
      state.requestId += 1;
      if (state.pollTimer) window.clearInterval(state.pollTimer);
      state.pollTimer = null;
      return;
    }
    const nextMode = detail.workspaceMode === 'group' && detail.groupId ? 'group' : 'personal';
    const contextChanged = nextMode !== state.workspaceMode || (nextMode === 'group' && detail.groupId !== state.groupId);
    state.workspaceMode = nextMode;
    state.groupId = nextMode === 'group' ? detail.groupId : null;
    if (contextChanged) state.tasks = [];
    shellIfNeeded();
    if (state.pollTimer) window.clearInterval(state.pollTimer);
    state.pollTimer = state.workspaceMode === 'group'
      ? window.setInterval(() => { if (state.active && document.visibilityState === 'visible') loadTasks(); }, 30000)
      : null;
    // Revalidate on every entry so changes made in another tab/device appear promptly.
    loadTasks();
  }

  function shellIfNeeded() {
    if (!document.getElementById('stPlannerForm')) shell();
    const eyebrow = root.querySelector('.st-planner-heading .eyebrow');
    if (eyebrow) eyebrow.textContent = `Planejamento ${inCurrentWorkspace() ? 'compartilhado' : 'pessoal'}`;
    const formFooter = root.querySelector('.st-planner-form-footer p');
    if (formFooter) formFooter.textContent = inCurrentWorkspace()
      ? 'Esta tarefa ficará visível aos participantes da sala. Só você e administradores podem alterá-la.'
      : 'Esta tarefa ficará privada no seu espaço pessoal.';
  }

  window.addEventListener('st:pagechange', onPageChange);
  // Defensive initialization covers browsers where app navigation renders before this module loads.
  if (document.getElementById('page-planner')?.classList.contains('active')) {
    state.active = true;
    shellIfNeeded();
    loadTasks();
  }
})();
