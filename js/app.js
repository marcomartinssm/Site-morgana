/* ==========================================================================
   App — navegação, carregamento de dados, sincronização e inicialização
   (carregado por último: depende de todos os outros módulos)
   ========================================================================== */

let curPage = 'agenda';
let dataLoaded = false;

const PAGE_TITLES = {
  agenda: 'Agenda',
  crm: 'Clientes',
  fin: 'Financeiro',
  config: 'Configurações',
};
const TOP_BUTTONS = {
  agenda: 'Novo agendamento',
  crm: 'Novo lead',
  fin: 'Novo lançamento',
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
  document.querySelector('.content').scrollTop = 0;

  $('pageTitle').textContent = PAGE_TITLES[page] || page;
  const btnLabel = TOP_BUTTONS[page] || '';
  $('topBtn').innerHTML = icon('plus') + '<span>' + btnLabel + '</span>';
  $('topBtn').hidden = !btnLabel;
  $('topBtn2').hidden = page !== 'fin';
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

// Fecha a lista de clientes do modal de agendamento ao clicar fora dela
function closeClientDropOnOutsideClick(e) {
  const drop = $('apptClientDrop');
  if (drop && !drop.contains(e.target) && e.target.id !== 'mName') drop.style.display = 'none';
}

// ── Inicialização ──
function init() {
  hydrateIcons();
  renderTopDate();
  localStorage.removeItem('mp_appts');   // limpeza de dados de versões antigas
  renderAgenda();
  document.addEventListener('click', closeClientDropOnOutsideClick);
  loadAllData();
  startPolling();
}

init();
