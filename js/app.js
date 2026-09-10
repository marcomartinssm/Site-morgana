/* ==========================================================================
   App — navegação, carregamento de dados, sincronização e inicialização
   (carregado por último: depende de todos os outros módulos)
   ========================================================================== */

let curPage = 'agenda';
let dataLoaded = false;

const PAGE_TITLES = {
  agenda: 'Agenda — <em>Hoje</em>',
  crm: 'CRM — <em>Clientes</em>',
  fin: 'Financeiro',
  config: 'Configurações',
};
const TOP_BUTTONS = {
  agenda: '+ Novo agendamento',
  crm: '+ Novo lead',
  fin: '+ Lançamento',
  config: '',
};

// ── Modais ──
function openModal(id) {
  $(id).classList.add('open');
}
function closeModal(id) {
  $(id).classList.remove('open');
}

// ── Navegação ──
function goTo(page, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = $('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  $('pageTitle').innerHTML = PAGE_TITLES[page] || page;
  $('topBtn').textContent = TOP_BUTTONS[page] || '';
  $('topBtn2').style.display = page === 'fin' ? 'inline-block' : 'none';
  curPage = page;

  if (page === 'agenda') renderAgenda();
  if (page === 'crm') refreshCRM();
  if (page === 'fin') {
    renderFinanceiro();
    if (!dataLoaded) loadAllData().then(renderFinanceiro);
  }
  if (page === 'config') loadConfigForm();
}

// Botão principal da barra superior (muda conforme a página)
function topAction() {
  if (curPage === 'agenda') openNewApptModal();
  else if (curPage === 'crm') openModal('clientModal');
  else if (curPage === 'fin') toggleAddForm();
}

// Botão secundário (Financeiro → Configurar centros de custo)
function topAction2() {
  if (curPage === 'fin') setFinSection('centros', document.querySelectorAll('.stab')[2]);
}

function renderTopDate() {
  const d = new Date();
  $('topDate').textContent = WDAYS_FULL[d.getDay()] + ', ' + d.getDate() + ' de ' + MONTHS[d.getMonth()] + ' de ' + d.getFullYear();
}

// ── Dados ──
async function loadAllData() {
  showSyncStatus('⟳ Sincronizando...');
  try {
    if (!getSB()) throw new Error('Supabase nao disponivel');

    const tx = await sbLoadTransacoes();
    if (tx) transactions = tx;

    const cc = await sbLoadCatalog('centros_custo');
    if (cc) centros = cc;

    const fp = await sbLoadCatalog('formas_pagamento');
    if (fp) formasPag = fp;

    const webhook = await sbLoadConfig('n8n_webhook_url');
    if (webhook) {
      N8N_WEBHOOK_URL = webhook;
      save('n8n_webhook_url', webhook);
    }

    const cli = await sbLoadClientes();
    if (cli) {
      clients = cli;
      if (curPage === 'crm') refreshCRM();
    }

    const appts = await sbLoadAppts();
    if (appts) {
      apptsByDate = appts;
      if (curPage === 'agenda') {
        renderTimeline();
        renderUpcoming();
      }
    }
  } catch (e) {
    console.warn('loadAllData:', e.message);
  }

  dataLoaded = true;
  showSyncStatus('✓ Online', 2000);

  const activePtab = document.querySelector('.ptab.active');
  if (activePtab) setPeriod(curPeriod, activePtab);
  if (curPage === 'fin') {
    renderSvcs();
    renderFPDonut();
    renderCCSummary();
    renderTxFilters();
    renderTxList();
  }
}

// Atualiza agenda e CRM periodicamente para pegar mudanças de outros dispositivos
function startPolling() {
  setInterval(async () => {
    if (!getSB()) return;

    const appts = await sbLoadAppts();
    if (appts) {
      apptsByDate = appts;
      if (curPage === 'agenda') renderAgenda();
    }

    const cli = await sbLoadClientes();
    if (cli) {
      clients = cli;
      if (curPage === 'crm') refreshCRM();
    }
  }, POLLING_MS);
}

// ── Layout mobile ──
// Reforça via JS o layout de barra inferior (fallback para o Safari do iOS)
function applyMobileLayout() {
  if (window.innerWidth > 768) return;
  const shell = document.querySelector('.shell');
  const sidenav = document.querySelector('.sidenav');
  const main = document.querySelector('.main');
  if (!shell || !sidenav || !main) return;
  shell.style.cssText = 'display:flex;flex-direction:column;height:100%;position:fixed;width:100%;top:0;left:0';
  sidenav.style.cssText = 'order:2;width:100%;height:56px;flex-direction:row;padding:0;gap:0;flex-shrink:0;border-top:0.5px solid rgba(255,255,255,.2);display:flex;align-items:center';
  main.style.cssText = 'order:1;flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0';
  document.querySelectorAll('.nav-logo,.nav-sep').forEach(e => { e.style.display = 'none'; });
  document.querySelectorAll('.nav-item').forEach(e => {
    e.style.cssText = 'flex:1;height:100%;border-radius:0;gap:2px;padding:4px 0;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer';
  });
}

// Fecha a lista de clientes do modal de agendamento ao clicar fora dela
function closeClientDropOnOutsideClick(e) {
  const drop = $('apptClientDrop');
  if (drop && !drop.contains(e.target) && e.target.id !== 'mName') drop.style.display = 'none';
}

// ── Inicialização ──
function init() {
  renderTopDate();
  localStorage.removeItem('mp_appts');   // limpeza de dados de versões antigas
  renderAgenda();
  applyMobileLayout();
  window.addEventListener('resize', applyMobileLayout);
  document.addEventListener('click', closeClientDropOnOutsideClick);
  loadAllData();
  startPolling();
}

init();
