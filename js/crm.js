/* ==========================================================================
   CRM — lista e kanban de clientes, ficha do cliente e procedimentos
   ========================================================================== */

let clients = [];              // carregado do Supabase
let crmView = 'list';          // 'list' | 'kanban'
let stageFilt = 'all';
let selClientId = null;
let procTargetId = null;       // cliente que recebe o procedimento no modal

// ── Criação ──
function newClient(fields) {
  return {
    id: Date.now(),
    phone: '—',
    bday: '—',
    visits: 0,
    spent: 0,
    last: '—',
    procs: [],
    obs: '',
    procedimentos: [],
    av: AVATAR_CLASSES[clients.length % 4],
    ...fields,
  };
}

function addClient(c) {
  clients.unshift(c);
  sbUpsertCliente(c);
  refreshCRM();
}

function refreshCRM() {
  filterCRM();
  if (crmView === 'kanban') renderKanban();
}

// Abre a ficha do cliente a partir de outra tela
function openClientFicha(id) {
  goTo('crm', document.querySelector('[title=Clientes]'));
  setTimeout(() => selClient(id), 80);
}

// ── Filtros e visualização ──
function setCRMView(view, el) {
  crmView = view;
  document.querySelectorAll('.vt-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  $('crmListView').style.display = view === 'list' ? 'block' : 'none';
  $('crmKanbanView').style.display = view === 'kanban' ? 'block' : 'none';
  if (view === 'kanban') renderKanban();
  else filterCRM();
}

function setStageFilt(stage, el) {
  stageFilt = stage;
  document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  if (crmView === 'kanban') renderKanban();
  else filterCRM();
}

function filterCRM() {
  const q = $('crmSearch').value.toLowerCase();
  let list = clients;
  if (stageFilt !== 'all') list = list.filter(c => c.stage === stageFilt);
  if (q) list = list.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  renderCRMList(list);
}

// ── Lista ──
function renderCRMList(list = clients) {
  $('clientList').innerHTML = list.map(c => {
    const st = stageInfo(c.stage);
    const procTags = c.procs.map(p => `<span class="proc-tag proc-tag-grey">${PROC_LABELS[p]}</span>`).join('');
    return `
      <div class="client-card${selClientId === c.id ? ' active' : ''}" onclick="selClient(${c.id})">
        <div class="avatar ${c.av}">${getIn(c.name)}</div>
        <div class="fill">
          <div class="client-card-name">${c.name}</div>
          <div class="tag-row">${procTags}</div>
        </div>
        <div class="client-card-side">
          <span class="stage-pill" style="background:${st.bg};color:${st.color}">${st.label}</span>
          ${c.visits > 0 ? `<div class="client-card-sessions">${c.visits} sessões</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// Seleciona um cliente: painel lateral no desktop, modal no celular
function selClient(id) {
  selClientId = id;
  const c = clients.find(x => x.id === id);
  renderCRMList();
  const html = buildClientDetail(c);

  if (window.innerWidth <= 768) {
    let modal = $('clientDetailModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'clientDetailModal';
      modal.className = 'modal-overlay';
      modal.style.cssText = 'display:flex;z-index:250';
      modal.innerHTML = '<div class="modal modal-detail"><div id="clientDetailInner"></div></div>';
      modal.addEventListener('click', e => {
        if (e.target === modal) {
          modal.style.display = 'none';
          selClientId = null;
        }
      });
      document.body.appendChild(modal);
    }
    $('clientDetailInner').innerHTML = html;
    modal.style.display = 'flex';
  } else {
    $('detailPanel').innerHTML = html;
    $('detailPanel').style.display = '';
  }
}

function buildClientDetail(c) {
  const st = stageInfo(c.stage);

  const procHtml = c.procedimentos && c.procedimentos.length
    ? c.procedimentos.map(p => `
        <div class="proc-item">
          <div class="proc-num">${p.sessao}</div>
          <div class="fill">
            <div class="proc-title">${PROC_LABELS[p.tipo]}<span class="proc-region"> · ${p.regiao}</span></div>
            ${p.obs ? `<div class="proc-obs">${p.obs}</div>` : ''}
          </div>
          <div class="proc-date">${p.data}</div>
        </div>`).join('')
    : '<div class="proc-empty">Nenhum procedimento registrado.</div>';

  const stageOpts = STAGES.map(s => `<option value="${s.id}"${c.stage === s.id ? ' selected' : ''}>${s.label}</option>`).join('');
  const procTags = c.procs.map(p => `<span class="proc-tag proc-tag-lg">${PROC_LABELS[p]}</span>`).join('');
  const perSession = c.visits ? Math.round(c.spent / c.visits) : 0;

  return `
    <div class="detail-panel">
      <div class="dp-top">
        <div class="dp-avatar ${c.av}">${getIn(c.name)}</div>
        <div class="dp-name">${c.name}</div>
        <div class="dp-since">${c.phone} · desde ${c.since}</div>
        <div class="dp-tags">
          <select class="form-select stage-select" style="background:${st.bg};color:${st.color};border-color:${st.color}40" onchange="changeStage(${c.id},this.value)">${stageOpts}</select>
          ${procTags}
        </div>
      </div>
      <div class="dp-stats">
        <div class="dps"><div class="dps-val">${c.visits}</div><div class="dps-label">sessões</div></div>
        <div class="dps"><div class="dps-val">R$${c.spent.toLocaleString('pt-BR')}</div><div class="dps-label">investido</div></div>
        <div class="dps"><div class="dps-val">R$${perSession}</div><div class="dps-label">p/ sessão</div></div>
      </div>
      <div class="dp-section dp-section-bordered">
        <div class="section-label">informações</div>
        <div class="info-row"><span class="info-label">Telefone</span><span>${c.phone}</span></div>
        <div class="info-row"><span class="info-label">Aniversário</span><span>${c.bday}</span></div>
        <div class="info-row"><span class="info-label">Última sessão</span><span>${c.last}</span></div>
        ${c.obs ? `<div class="info-row info-row-top"><span class="info-label">Obs.</span><span class="info-obs">${c.obs}</span></div>` : ''}
      </div>
      <div class="dp-section">
        <div class="dp-section-head">
          <div class="section-label">procedimentos</div>
          <button class="btn-mini" onclick="openProcModal(${c.id})">+ Adicionar</button>
        </div>
        ${procHtml}
      </div>
      <div class="dp-actions">
        <button class="btn-ghost" onclick="goTo('agenda',document.querySelector('[title=Agenda]'))">Agendar</button>
      </div>
    </div>`;
}

function changeStage(id, stage) {
  const c = clients.find(x => x.id === id);
  if (c) {
    c.stage = stage;
    sbUpsertCliente(c);
  }
  renderCRMList();
  if (crmView === 'kanban') renderKanban();
}

// ── Kanban ──
function renderKanban() {
  const q = $('crmSearch').value.toLowerCase();
  const stages = stageFilt === 'all' ? STAGES : STAGES.filter(s => s.id === stageFilt);

  $('kanbanBoard').innerHTML = stages.map(st => {
    let cards = clients.filter(c => c.stage === st.id);
    if (q) cards = cards.filter(c => c.name.toLowerCase().includes(q));
    return `
      <div class="kb-col">
        <div class="kb-col-head" style="border-top:2px solid ${st.color}">
          <span class="kb-col-title" style="color:${st.color}">${st.label}</span>
          <span class="kb-count" style="background:${st.bg};color:${st.color}">${cards.length}</span>
        </div>
        ${cards.map(renderKanbanCard).join('')}
        <button class="kb-add" onclick="openModal('clientModal')">+ Novo</button>
      </div>`;
  }).join('');
}

function renderKanbanCard(c) {
  const procTags = c.procs.map(p => `<span class="proc-tag proc-tag-rose">${PROC_LABELS[p]}</span>`).join('');
  const moves = STAGES.filter(s => s.id !== c.stage).slice(0, 3).map(s => `
    <button class="kb-move" style="background:${s.bg};color:${s.color};border:0.5px solid ${s.color}40"
            onclick="event.stopPropagation();changeStage(${c.id},'${s.id}')">→ ${s.label}</button>`).join('');
  return `
    <div class="kb-card" onclick="selKanban(${c.id})">
      <div class="kb-card-head">
        <div class="avatar avatar-sm ${c.av}">${getIn(c.name)}</div>
        <div class="kb-card-name">${c.name}</div>
      </div>
      <div class="tag-row kb-tags">${procTags}</div>
      <div class="kb-card-meta">${c.phone} · ${c.visits || 0} sessões</div>
      <div class="kb-moves">${moves}</div>
    </div>`;
}

function selKanban(id) {
  selClientId = id;
  setCRMView('list', $('vtList'));
  setTimeout(() => selClient(id), 50);
}

// ── Modal: novo cliente ──
function saveClient() {
  const name = $('cnName').value.trim();
  if (!name) return;
  const procs = [...document.querySelectorAll('#cnProcChips input:checked')].map(x => x.value);
  addClient(newClient({
    name,
    phone: $('cnPhone').value || '—',
    since: 'Abr 2026',
    stage: $('cnStage').value,
    procs,
    obs: $('cnObs').value,
  }));
  closeModal('clientModal');
  $('cnName').value = '';
  document.querySelectorAll('#cnProcChips input').forEach(i => { i.checked = false; });
}

// ── Modal: procedimento ──
function openProcModal(id) {
  procTargetId = id;
  const c = clients.find(x => x.id === id);
  $('pmData').value = fmtDateKey(new Date());
  $('pmSessao').value = (c.procedimentos ? c.procedimentos.length : 0) + 1;
  openModal('procModal');
}

function saveProc() {
  const c = clients.find(x => x.id === procTargetId);
  if (!c) return;
  if (!c.procedimentos) c.procedimentos = [];

  const tipo = $('pmTipo').value;
  const dt = $('pmData').value;
  const data = dt ? fmtDateBR(dt) : new Date().toLocaleDateString('pt-BR');
  c.procedimentos.unshift({
    tipo,
    sessao: parseInt($('pmSessao').value) || 1,
    data,
    regiao: $('pmRegiao').value,
    obs: $('pmObs').value,
  });
  c.visits = c.procedimentos.length;
  c.last = data;
  if (!c.procs.includes(tipo)) c.procs.push(tipo);
  sbUpsertCliente(c);

  closeModal('procModal');
  $('pmRegiao').value = '';
  $('pmObs').value = '';
  selClient(procTargetId);
}
