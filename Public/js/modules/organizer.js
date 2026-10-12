(() => {
  'use strict';

  const root = document.getElementById('page-life');
  if (!root) return;

  const state = {
    active: false,
    type: 'goal',
    items: [],
    habitLogs: [],
    loaded: false,
    busy: false,
    editingId: null,
    requestId: 0,
    lastLoadedAt: 0
  };

  const pad = (value) => String(value).padStart(2, '0');
  const localIso = (value = new Date()) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  const today = () => localIso();
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const dateFromIso = (value) => {
    if (!value) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(year, month - 1, day, 12);
  };
  const dateLabel = (value) => {
    const date = dateFromIso(value);
    return date ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sem prazo definido';
  };
  const typeLabels = { goal: 'Meta', project: 'Projeto', habit: 'Hábito' };
  const priorityLabels = { high: 'Prioridade alta', normal: 'Prioridade normal', low: 'Prioridade baixa' };
  const cadenceLabels = { daily: 'Todos os dias', weekdays: 'Dias úteis', weekly: 'Toda semana' };

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
      try { payload = await response.json(); } catch { /* Report a concise error below. */ }
      if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.');
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('O servidor demorou para responder. Tente novamente.');
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function showMessage(message, kind = 'info') {
    const node = document.getElementById('stLifeMessage');
    if (!node) return;
    node.textContent = message || '';
    node.dataset.kind = kind;
    node.hidden = !message;
  }

  function shell() {
    root.innerHTML = `
      <div class="st-life-page">
        <header class="head st-life-heading">
          <div><div class="eyebrow">VIDA PESSOAL · METAS, PROJETOS E HÁBITOS</div>
            <h1>Construa a vida que você quer.</h1>
            <p>Transforme intenções em passos visíveis. Suas metas, projetos e hábitos ficam salvos na sua conta, separados dos espaços compartilhados.</p>
          </div>
          <button id="stLifeOpenForm" class="st-life-add-button" type="button"><span aria-hidden="true">＋</span> Novo item</button>
        </header>
        <div id="stLifeMessage" class="st-life-message" role="status" aria-live="polite" hidden></div>
        <section class="st-life-summary" aria-label="Resumo da organização">
          <article class="st-life-summary-card"><span class="st-life-summary-mark st-life-mark-goal">◎</span><div><span>Metas em andamento</span><strong id="stLifeGoalCount">0</strong><small>O que você quer conquistar</small></div></article>
          <article class="st-life-summary-card"><span class="st-life-summary-mark st-life-mark-project">↗</span><div><span>Projetos ativos</span><strong id="stLifeProjectCount">0</strong><small>Planos em construção</small></div></article>
          <article class="st-life-summary-card"><span class="st-life-summary-mark st-life-mark-habit">✳</span><div><span>Hábitos feitos hoje</span><strong id="stLifeHabitCount">0/0</strong><small>Constância acima da perfeição</small></div></article>
        </section>
        <section id="stLifeFormPanel" class="st-life-form-panel" hidden>
          <header class="st-life-form-heading"><div><span class="eyebrow">COLOQUE EM MOVIMENTO</span><h2 id="stLifeFormTitle">Comece com algo importante.</h2><p id="stLifeFormIntro">Um objetivo claro ajuda você a escolher o próximo passo.</p></div><button class="st-life-close-form" type="button" data-life-close aria-label="Fechar formulário">×</button></header>
          <form id="stLifeForm">
            <input type="hidden" name="type" value="goal">
            <div class="st-life-form-main">
              <label class="st-life-field st-life-title-field"><span>Nome</span><input name="title" required maxlength="160" autocomplete="off" placeholder="Ex.: concluir meu curso, organizar a casa"></label>
              <label class="st-life-field"><span>Prazo (opcional)</span><input name="dueDate" type="date"></label>
            </div>
            <label class="st-life-field"><span>Descrição ou próximo passo (opcional)</span><textarea name="details" rows="2" maxlength="2000" placeholder="O que isso significa para você? Qual é o primeiro passo?"></textarea></label>
            <div class="st-life-form-options">
              <label class="st-life-field" id="stLifePriorityWrap"><span>Prioridade</span><select name="priority"><option value="normal">Normal</option><option value="high">Alta</option><option value="low">Baixa</option></select></label>
              <label class="st-life-field" id="stLifeCadenceWrap" hidden><span>Frequência</span><select name="cadence"><option value="daily">Todos os dias</option><option value="weekdays">Dias úteis</option><option value="weekly">Toda semana</option></select></label>
              <label class="st-life-field st-life-progress-field" id="stLifeProgressWrap"><span>Progresso atual <output id="stLifeProgressValue">0%</output></span><input name="progress" type="range" min="0" max="100" step="5" value="0"></label>
              <label class="st-life-field" id="stLifeStatusWrap"><span>Estado</span><select name="status"><option value="active">Em andamento</option><option value="paused">Em pausa</option><option value="done">Concluído</option></select></label>
            </div>
            <footer class="st-life-form-footer"><p id="stLifeFormNote">Você pode editar ou arquivar este item a qualquer momento.</p><div><button class="st-life-cancel-button" type="button" data-life-close>Cancelar</button><button id="stLifeSave" class="st-life-save-button" type="submit">Salvar item <span aria-hidden="true">→</span></button></div></footer>
          </form>
        </section>
        <section class="st-life-library">
          <header class="st-life-library-heading"><div><span class="eyebrow">SEU CAMINHO, DO SEU JEITO</span><h2>O que você está construindo?</h2></div><span id="stLifeItemCount" class="st-life-count">0 itens</span></header>
          <div class="st-life-type-tabs" role="tablist" aria-label="Filtrar itens">
            <button type="button" data-life-type="goal" role="tab" aria-selected="true"><span>◎</span> Metas <b id="stLifeTabGoals">0</b></button>
            <button type="button" data-life-type="project" role="tab" aria-selected="false"><span>↗</span> Projetos <b id="stLifeTabProjects">0</b></button>
            <button type="button" data-life-type="habit" role="tab" aria-selected="false"><span>✳</span> Hábitos <b id="stLifeTabHabits">0</b></button>
          </div>
          <div id="stLifeItems" class="st-life-items"><div class="st-life-loading"><span></span> Carregando sua organização…</div></div>
        </section>
        <footer class="st-life-note"><span>✳</span><p>Metas dão direção. Projetos transformam planos em etapas. Hábitos ajudam você a continuar, um dia de cada vez.</p></footer>
      </div>`;

    root.querySelectorAll('[data-life-type]').forEach((button) => button.addEventListener('click', () => {
      state.type = button.dataset.lifeType;
      renderItems();
      updateTabState();
      if (!document.getElementById('stLifeFormPanel').hidden && !state.editingId) {
        document.getElementById('stLifeForm').elements.type.value = state.type;
        syncFormType();
      }
    }));
    root.querySelectorAll('[data-life-close]').forEach((button) => button.addEventListener('click', closeForm));
    document.getElementById('stLifeOpenForm').addEventListener('click', () => openForm());
    document.getElementById('stLifeForm').addEventListener('submit', onSubmit);
    document.getElementById('stLifeForm').elements.progress.addEventListener('input', (event) => {
      document.getElementById('stLifeProgressValue').textContent = `${event.target.value}%`;
    });
    document.getElementById('stLifeForm').elements.type.addEventListener('change', syncFormType);
    if (root.dataset.lifeEventsBound !== 'true') {
      root.addEventListener('click', onClick);
      root.dataset.lifeEventsBound = 'true';
    }
    updateTabState();
  }

  function syncFormType() {
    const form = document.getElementById('stLifeForm');
    if (!form) return;
    const type = form.elements.type.value || state.type;
    const isHabit = type === 'habit';
    document.getElementById('stLifeCadenceWrap').hidden = !isHabit;
    document.getElementById('stLifeProgressWrap').hidden = isHabit;
    document.getElementById('stLifePriorityWrap').hidden = isHabit;
    document.getElementById('stLifeFormTitle').textContent = state.editingId ? `Editar ${typeLabels[type].toLocaleLowerCase('pt-BR')}` : ({ goal: 'Defina algo que importa.', project: 'Dê forma ao seu próximo projeto.', habit: 'Escolha um hábito possível.' })[type];
    document.getElementById('stLifeFormIntro').textContent = ({ goal: 'Escreva o que você quer conquistar e acompanhe o seu avanço.', project: 'Organize uma iniciativa em andamento com um próximo passo claro.', habit: 'Comece pequeno. Marque cada dia em que você praticar.' })[type];
    document.getElementById('stLifeSave').innerHTML = `${state.editingId ? 'Salvar alterações' : `Criar ${typeLabels[type].toLocaleLowerCase('pt-BR')}`} <span aria-hidden="true">→</span>`;
  }

  function openForm(item = null) {
    const panel = document.getElementById('stLifeFormPanel');
    const form = document.getElementById('stLifeForm');
    if (!panel || !form) return;
    state.editingId = item?.id || null;
    const type = item?.type || state.type || 'goal';
    form.reset();
    form.elements.type.value = type;
    form.elements.title.value = item?.title || '';
    form.elements.details.value = item?.details || '';
    form.elements.dueDate.value = item?.dueDate || '';
    form.elements.priority.value = item?.priority || 'normal';
    form.elements.progress.value = String(item?.progress ?? 0);
    form.elements.cadence.value = item?.cadence || 'daily';
    form.elements.status.value = item?.status || 'active';
    document.getElementById('stLifeProgressValue').textContent = `${form.elements.progress.value}%`;
    panel.hidden = false;
    syncFormType();
    document.getElementById('stLifeOpenForm').textContent = 'Formulário aberto';
    form.elements.title.focus({ preventScroll: true });
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeForm() {
    const panel = document.getElementById('stLifeFormPanel');
    const form = document.getElementById('stLifeForm');
    if (panel) panel.hidden = true;
    if (form) form.reset();
    state.editingId = null;
    const open = document.getElementById('stLifeOpenForm');
    if (open) open.innerHTML = '<span aria-hidden="true">＋</span> Novo item';
  }

  async function loadData(force = false) {
    if (!state.active && !force) return;
    const now = Date.now();
    if (!force && state.loaded && now - state.lastLoadedAt < 12000) {
      emitSummary();
      return;
    }
    const requestId = ++state.requestId;
    const end = dateFromIso(today());
    const from = new Date(end);
    from.setDate(from.getDate() - 59);
    const params = new URLSearchParams({ from: localIso(from), to: today() });
    const viewport = document.getElementById('stLifeItems');
    if (viewport) viewport.innerHTML = '<div class="st-life-loading"><span></span> Atualizando sua organização…</div>';
    try {
      const payload = await request(`/api/organizer?${params.toString()}`);
      if (requestId !== state.requestId) return;
      state.items = Array.isArray(payload.items) ? payload.items : [];
      state.habitLogs = Array.isArray(payload.habitLogs) ? payload.habitLogs : [];
      state.loaded = true;
      state.lastLoadedAt = Date.now();
      renderSummary();
      renderItems();
      emitSummary();
      showMessage('');
    } catch (error) {
      if (requestId !== state.requestId) return;
      state.loaded = false;
      state.items = [];
      state.habitLogs = [];
      if (viewport) viewport.innerHTML = `<div class="st-life-error"><span aria-hidden="true">!</span><b>Não foi possível carregar suas metas e hábitos.</b><p>${escapeHtml(error.message || 'Tente novamente.')}</p><button type="button" class="st-life-save-button" data-life-retry>Recarregar</button><small>Confirme se a migração <code>supabase/personal-organization.sql</code> foi aplicada.</small></div>`;
      showMessage('Os treinos e os registros existentes continuam separados e preservados.', 'error');
      emitSummary(true);
    }
  }

  function renderSummary() {
    const goals = state.items.filter((item) => item.type === 'goal' && item.status === 'active');
    const projects = state.items.filter((item) => item.type === 'project' && item.status === 'active');
    const habits = state.items.filter((item) => item.type === 'habit' && item.status === 'active');
    const doneToday = new Set(state.habitLogs.filter((log) => log.date === today()).map((log) => log.itemId));
    const goalCount = document.getElementById('stLifeGoalCount');
    const projectCount = document.getElementById('stLifeProjectCount');
    const habitCount = document.getElementById('stLifeHabitCount');
    const tabGoals = document.getElementById('stLifeTabGoals');
    const tabProjects = document.getElementById('stLifeTabProjects');
    const tabHabits = document.getElementById('stLifeTabHabits');
    if (goalCount) goalCount.textContent = String(goals.length);
    if (projectCount) projectCount.textContent = String(projects.length);
    if (habitCount) habitCount.textContent = `${habits.filter((item) => doneToday.has(item.id)).length}/${habits.length}`;
    if (tabGoals) tabGoals.textContent = String(state.items.filter((item) => item.type === 'goal').length);
    if (tabProjects) tabProjects.textContent = String(state.items.filter((item) => item.type === 'project').length);
    if (tabHabits) tabHabits.textContent = String(state.items.filter((item) => item.type === 'habit').length);
  }

  function emitSummary(error = false) {
    window.dispatchEvent(new CustomEvent('st:organizer-dashboard-summary', {
      detail: { items: state.items, habitLogs: state.habitLogs, error }
    }));
  }

  function updateTabState() {
    root.querySelectorAll('[data-life-type]').forEach((button) => {
      const active = button.dataset.lifeType === state.type;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    const title = document.querySelector('.st-life-library-heading h2');
    if (title) title.textContent = ({ goal: 'O que você quer conquistar?', project: 'O que você está construindo?', habit: 'Pequenas ações, repetidas com intenção.' })[state.type];
  }

  function itemMarkup(item) {
    const isHabit = item.type === 'habit';
    const checkedDates = new Set(state.habitLogs.filter((log) => log.itemId === item.id).map((log) => log.date));
    const checkedToday = checkedDates.has(today());
    const lastSeven = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = dateFromIso(today());
      date.setDate(date.getDate() - offset);
      const key = localIso(date);
      lastSeven.push({ key, label: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), done: checkedDates.has(key), isToday: key === today() });
    }
    const progress = Math.max(0, Math.min(100, Number(item.progress) || 0));
    const dueText = item.dueDate ? `Prazo ${dateLabel(item.dueDate)}` : 'Sem prazo definido';
    return `<article class="st-life-item-card ${isHabit ? 'is-habit' : ''} ${item.status === 'done' ? 'is-complete' : ''}">
      <header class="st-life-item-top"><span class="st-life-item-type type-${escapeHtml(item.type)}">${escapeHtml(typeLabels[item.type] || 'Item')}</span><button type="button" class="st-life-more" data-life-edit="${escapeHtml(item.id)}" aria-label="Editar ${escapeHtml(item.title)}" title="Editar">···</button></header>
      <h3>${escapeHtml(item.title)}</h3>
      ${item.details ? `<p class="st-life-item-details">${escapeHtml(item.details)}</p>` : `<p class="st-life-item-details st-life-details-empty">${isHabit ? 'Registre cada vez que cumprir esse hábito.' : 'Adicione um detalhe para lembrar por que isso importa.'}</p>`}
      ${isHabit ? `<div class="st-life-week-track" aria-label="Últimos sete dias">${lastSeven.map(day => `<span class="st-life-week-day ${day.done ? 'done' : ''} ${day.isToday ? 'today' : ''}" title="${day.key}${day.done ? ' · concluído' : ''}"><i>${day.done ? '✓' : ''}</i><small>${escapeHtml(day.label)}</small></span>`).join('')}</div><div class="st-life-item-foot"><span class="st-life-meta">${escapeHtml(cadenceLabels[item.cadence] || cadenceLabels.daily)}</span><button type="button" class="st-life-habit-check ${checkedToday ? 'checked' : ''}" data-life-habit-check="${escapeHtml(item.id)}" data-life-checked="${checkedToday ? 'true' : 'false'}">${checkedToday ? '✓ Feito hoje' : 'Marcar hoje'}</button></div>` : `<div class="st-life-progress-line"><div><span>${item.type === 'goal' ? 'Progresso da meta' : 'Projeto em andamento'}</span><b>${progress}%</b></div><div class="st-life-progress-track"><i style="width:${progress}%"></i></div></div><div class="st-life-item-foot"><span class="st-life-meta">${escapeHtml(dueText)}</span><span class="st-life-status status-${escapeHtml(item.status)}">${item.status === 'done' ? 'Concluído' : item.status === 'paused' ? 'Em pausa' : priorityLabels[item.priority] || 'Em andamento'}</span></div>`}
      <footer class="st-life-item-actions"><button type="button" data-life-edit="${escapeHtml(item.id)}">Editar</button>${item.status === 'done' ? `<button type="button" data-life-status="${escapeHtml(item.id)}" data-life-next-status="active">Reabrir</button>` : `<button type="button" data-life-status="${escapeHtml(item.id)}" data-life-next-status="done">${isHabit ? 'Concluir hábito' : 'Marcar concluído'}</button>`}<button type="button" class="danger" data-life-delete="${escapeHtml(item.id)}">Excluir</button></footer>
    </article>`;
  }

  function renderItems() {
    const viewport = document.getElementById('stLifeItems');
    if (!viewport) return;
    updateTabState();
    const items = state.items.filter((item) => item.type === state.type).sort((a, b) => {
      const statusRank = { active: 0, paused: 1, done: 2 };
      if (a.status !== b.status) return statusRank[a.status] - statusRank[b.status];
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    document.getElementById('stLifeItemCount').textContent = `${items.length} ${items.length === 1 ? 'item' : 'itens'}`;
    if (!items.length) {
      const copy = ({
        goal: ['Ainda não há metas por aqui.', 'Escolha algo que seja importante para você — não precisa ser grande para começar.', 'Criar minha primeira meta'],
        project: ['Seu próximo projeto começa aqui.', 'Organize uma ideia, um plano pessoal ou algo que você quer tirar do papel.', 'Criar meu primeiro projeto'],
        habit: ['Vamos começar com um hábito possível.', 'Uma caminhada, dez minutos de leitura ou beber água. Comece pequeno e registre o que fizer.', 'Criar meu primeiro hábito']
      })[state.type];
      viewport.innerHTML = `<div class="st-life-empty"><div class="st-life-empty-art"><span>✳</span><i></i><i></i></div><h3>${copy[0]}</h3><p>${copy[1]}</p><button type="button" class="st-life-save-button" data-life-new>${copy[2]} <span aria-hidden="true">→</span></button></div>`;
      return;
    }
    viewport.innerHTML = `<div class="st-life-item-grid">${items.map(itemMarkup).join('')}</div>`;
  }

  async function onSubmit(event) {
    if (event.target?.id !== 'stLifeForm') return;
    event.preventDefault();
    if (state.busy) return;
    const form = event.target;
    const payload = {
      type: form.elements.type.value,
      title: form.elements.title.value.trim(),
      details: form.elements.details.value.trim(),
      dueDate: form.elements.dueDate.value || null,
      priority: form.elements.priority.value || 'normal',
      progress: Number(form.elements.progress.value) || 0,
      cadence: form.elements.cadence.value || 'daily',
      status: form.elements.status.value || 'active'
    };
    if (!payload.title) return showMessage('Dê um nome para este item antes de salvar.', 'error');
    const editingId = state.editingId;
    state.busy = true;
    const save = document.getElementById('stLifeSave');
    save.disabled = true;
    save.textContent = 'Salvando…';
    try {
      await request(editingId ? `/api/organizer/items/${encodeURIComponent(editingId)}` : '/api/organizer/items', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      const nextType = payload.type;
      closeForm();
      state.type = nextType;
      state.loaded = false;
      await loadData(true);
      const successLabel = { goal: 'Meta criada', project: 'Projeto criado', habit: 'Hábito criado' }[nextType] || 'Item criado';
      showMessage(editingId ? 'Alterações salvas.' : `${successLabel} com sucesso.`, 'success');
    } catch (error) {
      showMessage(error.message || 'Não foi possível salvar este item.', 'error');
    } finally {
      state.busy = false;
      if (save) { save.disabled = false; save.innerHTML = `${state.editingId ? 'Salvar alterações' : 'Salvar item'} <span aria-hidden="true">→</span>`; }
    }
  }

  async function updateItem(itemId, payload) {
    if (state.busy) return;
    state.busy = true;
    try {
      await request(`/api/organizer/items/${encodeURIComponent(itemId)}`, { method: 'PATCH', body: JSON.stringify(payload) });
      state.loaded = false;
      await loadData(true);
      showMessage(payload.status === 'done' ? 'Muito bem! Item concluído.' : payload.status === 'active' ? 'Item reaberto.' : 'Item atualizado.', 'success');
    } catch (error) {
      showMessage(error.message || 'Não foi possível atualizar este item.', 'error');
    } finally {
      state.busy = false;
    }
  }

  async function toggleHabit(itemId, wasDone) {
    if (state.busy) return;
    state.busy = true;
    try {
      await request(`/api/organizer/items/${encodeURIComponent(itemId)}/check`, {
        method: 'POST', body: JSON.stringify({ date: today(), done: !wasDone })
      });
      state.loaded = false;
      await loadData(true);
      showMessage(!wasDone ? 'Hábito registrado. Bom trabalho!' : 'Registro de hoje removido.', 'success');
    } catch (error) {
      showMessage(error.message || 'Não foi possível registrar o hábito.', 'error');
    } finally {
      state.busy = false;
    }
  }

  async function deleteItem(itemId) {
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item || state.busy) return;
    if (!window.confirm(`Excluir ${typeLabels[item.type].toLocaleLowerCase('pt-BR')} “${item.title}”? Os registros de hábito relacionados também serão removidos.`)) return;
    state.busy = true;
    try {
      await request(`/api/organizer/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
      state.loaded = false;
      await loadData(true);
      showMessage('Item excluído.', 'success');
    } catch (error) {
      showMessage(error.message || 'Não foi possível excluir este item.', 'error');
    } finally {
      state.busy = false;
    }
  }

  function onClick(event) {
    const retry = event.target.closest('[data-life-retry]');
    if (retry) { state.loaded = false; loadData(true); return; }
    const create = event.target.closest('[data-life-new]');
    if (create) { openForm(); return; }
    const edit = event.target.closest('[data-life-edit]');
    if (edit) {
      const item = state.items.find((entry) => entry.id === edit.dataset.lifeEdit);
      if (item) openForm(item);
      return;
    }
    const check = event.target.closest('[data-life-habit-check]');
    if (check) { toggleHabit(check.dataset.lifeHabitCheck, check.dataset.lifeChecked === 'true'); return; }
    const status = event.target.closest('[data-life-status]');
    if (status) { updateItem(status.dataset.lifeStatus, { status: status.dataset.lifeNextStatus }); return; }
    const remove = event.target.closest('[data-life-delete]');
    if (remove) deleteItem(remove.dataset.lifeDelete);
  }

  function onPageChange(event) {
    const page = event.detail?.page;
    state.active = page === 'life';
    if (page === 'life') {
      if (!document.getElementById('stLifeForm')) shell();
      loadData(true);
    } else if (page === 'home') {
      // Refresh the homepage summary after login/navigation, even when the
      // organizer panel itself is not the active page.
      loadData(true);
    }
  }

  window.addEventListener('st:pagechange', onPageChange);
  // The initial render may happen before this deferred module is evaluated.
  if (root.classList.contains('active')) {
    state.active = true;
    shell();
    loadData(true);
  }
})();
