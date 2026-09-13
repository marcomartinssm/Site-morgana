/* ==========================================================================
   Financeiro — KPIs por período, gráficos, lançamentos,
   centros de custo e formas de pagamento
   ========================================================================== */

let curPeriod = 'mar';
let transactions = [];     // carregado do Supabase
let txType = 'income';     // tipo do novo lançamento: 'income' | 'expense'
let txFilter = 'todos';    // filtro da lista de lançamentos
let selCC = null, selFP = null;

// Padrões — substituídos pelos cadastros do Supabase quando existirem
let centros = [
  { id: 'loc',  name: 'Locações',               color: '#f4a5a5', tc: '#8b2020' },
  { id: 'dist', name: 'Distribuição de lucros', color: '#a8c8f0', tc: '#1a4a7a' },
  { id: 'est',  name: 'Estética',               color: '#c8b0e0', tc: '#4a2a70' },
  { id: 'diz',  name: 'Dízimo',                 color: '#6a3d9a', tc: '#fff' },
];
let formasPag = [
  { id: 'pix',  name: 'Pix',               color: '#b8e0c0', tc: '#1a5a2a' },
  { id: 'cred', name: 'Cartão de crédito', color: '#c8dff0', tc: '#1a3a5a' },
  { id: 'bol',  name: 'Boleto',            color: '#d0e8d8', tc: '#2a4a32' },
  { id: 'din',  name: 'Dinheiro',          color: '#1a6a50', tc: '#fff' },
];

// Distribuição "Por serviço" — valores fixos (ainda não calculados a partir dos dados)
const svcs = [
  { n: 'Remoção micropig.', p: 68, c: '#9b7fa6' },
  { n: 'Remoção tatuagem',  p: 22, c: '#5c4470' },
  { n: 'Aluguel sala',      p: 7,  c: '#8a7a6a' },
  { n: 'Outros',            p: 3,  c: '#c2b8cc' },
];

const TX_ICONS = { est: '🔆', loc: '🏠', dist: '💸', diz: '🙏' };

const PERIOD_MAP = {
  jan: { m: 0, label: 'Janeiro' },  fev: { m: 1, label: 'Fevereiro' }, mar: { m: 2, label: 'Março' },
  abr: { m: 3, label: 'Abril' },    mai: { m: 4, label: 'Maio' },      jun: { m: 5, label: 'Junho' },
  jul: { m: 6, label: 'Julho' },    ago: { m: 7, label: 'Agosto' },    set: { m: 8, label: 'Setembro' },
  out: { m: 9, label: 'Outubro' },  nov: { m: 10, label: 'Novembro' }, dez: { m: 11, label: 'Dezembro' },
  ano: { m: -1, label: ANO_BASE + ' — Anual' },
};
const PERIOD_ORDER = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const FALLBACK_CATALOG_ITEM = { name: '—', color: '#eee', tc: '#666' };
const getCC = id => centros.find(c => c.id === id) || FALLBACK_CATALOG_ITEM;
const getFP = id => formasPag.find(f => f.id === id) || FALLBACK_CATALOG_ITEM;
const sumValues = list => list.reduce((a, x) => a + x.v, 0);
const isIncome = x => x.t === 'receita';
const isPendingIncome = x => isIncome(x) && !x.rec;
// Chip colorido de centro de custo / forma de pagamento
const catalogChip = (item, cls, selected, onclick) =>
  `<span class="${cls}${selected ? ' sel' : ''}" style="background:${item.color};color:${item.tc}" onclick="${onclick}">${item.name}</span>`;
const brl = v => 'R$' + v.toLocaleString('pt-BR');

// ── Cálculos ──
// Receita, despesa e lançamentos de um período
function calcPeriod(p) {
  let list = transactions;
  if (p !== 'ano') {
    const { m } = PERIOD_MAP[p];
    list = list.filter(x => {
      const d = parseDt(x.dt);
      return d.getMonth() === m && d.getFullYear() === ANO_BASE;
    });
  }
  return {
    i: sumValues(list.filter(isIncome)),
    e: sumValues(list.filter(x => x.t === 'despesa')),
    list,
  };
}

// Dia em que o dinheiro entrou ou saiu do caixa: receitas pela quitação, despesas pela data do lançamento
const cashDate = x => parseDt(isIncome(x) && x.quit ? x.quit : x.dt);

// Saldo acumulado (fluxo de caixa) desde o saldo inicial até o final do período — receitas a receber não entram
function getSaldoCaixa(p) {
  return transactions.reduce((saldo, x) => {
    if (isPendingIncome(x)) return saldo;
    if (p !== 'ano') {
      const d = cashDate(x);
      if (d.getFullYear() !== ANO_BASE || d.getMonth() > PERIOD_MAP[p].m) return saldo;
    }
    return saldo + (isIncome(x) ? x.v : -x.v);
  }, SALDO_INICIAL);
}

// Variação em relação ao mês anterior
function getPeriodLabel(p) {
  if (p === 'ano') return { id: 'Anual ' + ANO_BASE, ed: 'Anual ' + ANO_BASE, pd: 'Anual ' + ANO_BASE };
  const prevIdx = PERIOD_ORDER.indexOf(p) - 1;
  if (prevIdx < 0) return { id: 'base ' + ANO_BASE, ed: 'base ' + ANO_BASE, pd: 'base ' + ANO_BASE };

  const c = calcPeriod(p);
  const prev = calcPeriod(PERIOD_ORDER[prevIdx]);
  const prevLabel = PERIOD_MAP[PERIOD_ORDER[prevIdx]].label.slice(0, 3).toLowerCase();
  const pct = (v, r) => r > 0 ? Math.round((v - r) / r * 100) : 0;
  const delta = (cur, before, base) => (cur - before >= 0 ? '▲ ' : '▼ ') + Math.abs(pct(cur, base)) + '% vs ' + prevLabel;
  const liq = c.i - c.e, prevLiq = prev.i - prev.e;
  return {
    id: delta(c.i, prev.i, prev.i),
    ed: delta(c.e, prev.e, prev.e),
    pd: delta(liq, prevLiq, prevLiq || 1),
  };
}

// Barras do gráfico: 4 semanas do mês, ou 4 trimestres no anual
function getBarData(p) {
  if (p === 'ano') {
    return [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]].map(months => {
      let i = 0, e = 0;
      months.forEach(m => {
        const r = calcPeriod(PERIOD_ORDER[m]);
        i += r.i;
        e += r.e;
      });
      return { i, e };
    });
  }
  const weeks = [{ i: 0, e: 0 }, { i: 0, e: 0 }, { i: 0, e: 0 }, { i: 0, e: 0 }];
  calcPeriod(p).list.forEach(x => {
    const day = parseDt(x.dt).getDate();
    const w = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
    if (isIncome(x)) weeks[w].i += x.v;
    else weeks[w].e += x.v;
  });
  return weeks;
}

// ── Período e seções ──
function renderFinanceiro() {
  setPeriod(curPeriod, document.querySelector('.ptab.active'));
  renderSvcs();
  renderFPDonut();
  renderCCSummary();
  renderTxFilters();
  renderTxList();
}

function setPeriod(p, el) {
  if (!el) return;
  document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  curPeriod = p;

  const c = calcPeriod(p);
  const lucro = c.i - c.e;
  $('kI').textContent = 'R$ ' + fmtMoney(c.i);
  $('kE').textContent = 'R$ ' + fmtMoney(c.e);
  $('kP').textContent = (lucro >= 0 ? '+R$ ' : '-R$ ') + fmtMoney(Math.abs(lucro));
  $('kP').style.color = lucro >= 0 ? '#2e7d4f' : '#b85050';
  $('kT').textContent = 'R$ ' + fmtMoney(getSaldoCaixa(p));

  const lbl = getPeriodLabel(p);
  $('kId').textContent = lbl.id;
  $('kEd').textContent = lbl.ed;
  $('kPd').textContent = lbl.pd;
  $('kTd').textContent =
    p === 'jan' ? 'Saldo inicial: R$ ' + fmtMoney(SALDO_INICIAL) :
    p === 'ano' ? 'Acumulado ' + ANO_BASE :
    'Acumulado até ' + PERIOD_MAP[p].label.slice(0, 3);

  const labels = p === 'ano' ? ['Q1', 'Q2', 'Q3', 'Q4'] : ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
  renderBars(getBarData(p), labels);
  if ($('fsec-lancamentos').classList.contains('active')) renderTxList();
}

function setFinSection(section, el) {
  document.querySelectorAll('.stab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('.fin-section').forEach(x => x.classList.remove('active'));
  $('fsec-' + section).classList.add('active');

  if (section === 'lancamentos') { renderTxList(); renderTxFilters(); }
  if (section === 'centros') { renderCCDetail(); renderCatalogManage('cc'); }
  if (section === 'pagamentos') { renderFPDetail(); renderCatalogManage('fp'); }
}

// ── Visão geral ──
function renderBars(weeks, labels) {
  const max = Math.max(...weeks.map(x => x.i), 1);
  $('barChart').innerHTML = weeks.map((x, i) => `
    <div class="bar-group">
      <div class="bar-wrap">
        <div class="bar bi" style="height:${Math.round(x.i / max * 100)}%"></div>
        <div class="bar be" style="height:${Math.round(x.e / max * 100)}%"></div>
      </div>
      <div class="bar-lbl">${labels[i]}</div>
    </div>`).join('');
}

function renderSvcs() {
  $('svcList').innerHTML = svcs.map(s => `
    <div class="svc-item">
      <span class="svc-name">${s.n}</span>
      <div class="svc-bg"><div class="svc-fill" style="width:${s.p}%;background:${s.c}"></div></div>
      <span class="svc-pct">${s.p}%</span>
    </div>`).join('');
}

// Rosca de receitas por forma de pagamento (SVG)
function renderFPDonut() {
  const tot = {};
  formasPag.forEach(f => { tot[f.id] = 0; });
  transactions.filter(isIncome).forEach(x => { if (tot[x.fp] !== undefined) tot[x.fp] += x.v; });
  const total = Object.values(tot).reduce((a, b) => a + b, 0) || 1;

  const R = 36, r = 20, C = 45;
  const pt = (radius, ang) => (C + radius * Math.cos(ang)).toFixed(1) + ',' + (C + radius * Math.sin(ang)).toFixed(1);
  let ang = -Math.PI / 2, paths = '';
  formasPag.forEach(f => {
    const pct = tot[f.id] / total;
    const end = ang + pct * 2 * Math.PI;
    const large = pct * 2 * Math.PI > Math.PI ? 1 : 0;
    if (pct > 0.01) {
      paths += `<path d="M${pt(R, ang)} A${R},${R} 0 ${large},1 ${pt(R, end)} L${pt(r, end)} A${r},${r} 0 ${large},0 ${pt(r, ang)} Z" fill="${f.color}" stroke="#fff" stroke-width="1"/>`;
    }
    ang = end;
  });
  $('fpDonut').innerHTML = paths;

  $('fpLegend').innerHTML = formasPag.map(f => `
    <div class="fp-leg-item">
      <div class="fp-leg-dot" style="background:${f.color}"></div>
      <span class="fp-leg-name">${f.name}</span>
      <span class="fp-leg-pct">${Math.round(tot[f.id] / total * 100)}%</span>
    </div>`).join('');
}

function renderCCSummary() {
  const tot = {};
  centros.forEach(c => { tot[c.id] = 0; });
  transactions.filter(x => x.t === 'despesa').forEach(x => { if (tot[x.cc] !== undefined) tot[x.cc] += x.v; });
  const total = Object.values(tot).reduce((a, b) => a + b, 0) || 1;

  $('ccSummary').innerHTML = centros.map(cc => {
    const pct = Math.round(tot[cc.id] / total * 100);
    return `
      <div class="cc-sum-card">
        <span class="pill" style="background:${cc.color};color:${cc.tc}">${cc.name}</span>
        <div class="cc-sum-val">${brl(tot[cc.id])}</div>
        <div class="cc-sum-pct">${pct}% das despesas</div>
        <div class="cc-sum-bar"><div class="cc-sum-fill" style="width:${pct}%;background:${cc.color}"></div></div>
      </div>`;
  }).join('');
}

// ── Novo lançamento ──
function toggleAddForm() {
  const form = $('addForm');
  form.classList.toggle('open');
  if (form.classList.contains('open')) {
    $('fDt').value = fmtDateKey(new Date());
    selCC = null;
    selFP = null;
    renderFormChips();
  }
}

function renderFormChips() {
  $('formCCChips').innerHTML = centros.map(c => catalogChip(c, 'cc-chip', selCC === c.id, `selCC='${c.id}';renderFormChips()`)).join('');
  $('formFPChips').innerHTML = formasPag.map(f => catalogChip(f, 'fp-chip', selFP === f.id, `selFP='${f.id}';renderFormChips()`)).join('');
}

function setTxType(t) {
  txType = t;
  $('btnI').className = 'type-btn' + (t === 'income' ? ' ti' : '');
  $('btnE').className = 'type-btn' + (t === 'expense' ? ' te' : '');
}

function afterTxChange() {
  setPeriod(curPeriod, document.querySelector('.ptab.active'));
  renderTxList();
  renderCCSummary();
  renderFPDonut();
}

function addTx() {
  const desc = $('fDesc').value.trim();
  const val = parseFloat($('fVal').value);
  if (!desc || !val) return;

  const dt = $('fDt').value;
  const novo = {
    id: 'tx' + Date.now(),
    t: txType === 'income' ? 'receita' : 'despesa',
    d: desc,
    cc: selCC || 'est',
    fp: selFP || 'pix',
    v: val,
    dt: dt ? fmtDateBR(dt) : 'hoje',
    ic: TX_ICONS[selCC] || '📋',
    parc: $('fParc').value,
    rec: txType !== 'income',   // receitas novas aguardam confirmação de recebimento
  };
  transactions.unshift(novo);
  sbAddTx(novo);

  toggleAddForm();
  $('fDesc').value = '';
  $('fVal').value = '';
  afterTxChange();
}

// Centro de custo da receita de um agendamento: locação ou estética
const apptCostCenter = appt => (appt.svc_key === 'locacao' || /^loca/i.test(appt.svc || '') ? 'loc' : 'est');

// Receita lançada automaticamente ao concluir um agendamento
function addApptIncome(appt, dateKey, valor) {
  const cc = apptCostCenter(appt);
  const novo = {
    id: 'tx' + Date.now(),
    t: 'receita',
    d: appt.name + ' · ' + appt.svc,
    cc,
    fp: appt.fpag || 'pix',
    v: valor,
    dt: fmtDateBR(dateKey),
    ic: TX_ICONS[cc] || '📋',
    parc: 'À vista',
    rec: false,
  };
  transactions.unshift(novo);
  sbAddTx(novo);
  if (curPage === 'fin') afterTxChange();
  return novo;
}

// Receita de um atendimento concluído: pelo vínculo salvo ou, nos antigos, pela descrição e data
function findApptIncome(appt, dateKey) {
  if (appt.txId) return transactions.find(t => t.id === appt.txId) || null;
  return transactions.find(t => isIncome(t) && t.d === appt.name + ' · ' + appt.svc && t.dt === fmtDateBR(dateKey)) || null;
}

function deleteTx(id) {
  if (!confirm('Excluir este lançamento?')) return;
  const idx = transactions.findIndex(x => x.id === id);
  if (idx >= 0) transactions.splice(idx, 1);
  sbDeleteTx(id);
  afterTxChange();
}

// ── Lançamentos ──
function renderTxFilters() {
  const chip = item => {
    const active = txFilter === item.id;
    const style = active ? ` style="background:${item.color};color:${item.tc};border-color:${item.color}"` : '';
    return `<div class="tx-filter-chip${active ? ' active' : ''}"${style} onclick="setTxFilter('${item.id}',this)">${item.name}</div>`;
  };
  $('ccFilterChips').innerHTML = centros.map(chip).join('');
  $('fpFilterChips').innerHTML = formasPag.map(chip).join('');
}

function setTxFilter(f, el) {
  txFilter = f;
  document.querySelectorAll('.tx-filter-chip').forEach(c => {
    c.classList.remove('active');
    c.removeAttribute('style');
  });
  const item = centros.find(x => x.id === f) || formasPag.find(x => x.id === f);
  if (item) el.style.cssText = `background:${item.color};color:${item.tc};border-color:${item.color}`;
  el.classList.add('active');
  renderTxList();
  renderTxFilters();
}

function renderTxList() {
  const periodList = calcPeriod(curPeriod).list;
  renderTxSummary(periodList.filter(isPendingIncome));

  let list = periodList;
  if (txFilter === 'income') list = list.filter(isIncome);
  else if (txFilter === 'expense') list = list.filter(x => x.t === 'despesa');
  else if (txFilter === 'pendente') list = list.filter(isPendingIncome);
  else if (txFilter !== 'todos') list = list.filter(x => x.cc === txFilter || x.fp === txFilter);

  // Receitas primeiro; cada grupo em ordem de data
  list = [...list].sort((a, b) => a.t === b.t ? parseDt(a.dt) - parseDt(b.dt) : (isIncome(a) ? -1 : 1));

  if (!list.length) {
    $('txList').innerHTML = '<div class="tx-empty">Nenhum lançamento para este período</div>';
    return;
  }

  let lastType = null;
  $('txList').innerHTML = list.map(x => {
    const cc = getCC(x.cc), fp = getFP(x.fp);
    const income = isIncome(x);
    let sep = '';
    if (x.t !== lastType) {
      lastType = x.t;
      sep = `<div class="tx-sep">${income ? 'Receitas — por data' : 'Despesas — por vencimento'}</div>`;
    }
    const pending = isPendingIncome(x);
    const receiptBadge = !income ? ''
      : pending ? '<span class="mini-badge mini-badge-pending">A receber</span>'
      : `<button class="mini-badge mini-badge-received" onclick="undoReceipt('${x.id}')" title="Quitado em ${x.quit || x.dt} — clique para desmarcar">${icon('check')}Recebido${x.quit && x.quit !== x.dt ? ' ' + x.quit.slice(0, 5) : ''}</button>`;
    return sep + `
      <div class="tx-item">
        <div class="tx-icon ${income ? 'ico-i' : 'ico-e'}">${x.ic}</div>
        <div class="fill">
          <div class="tx-name">${x.d}</div>
          <div class="tx-sub">
            ${receiptBadge}
            <span class="mini-badge" style="background:${cc.color};color:${cc.tc}">${cc.name}</span>
            <span class="mini-badge" style="background:${fp.color};color:${fp.tc}">${fp.name}</span>
            ${x.parc && !/^[AÀ] vista$/.test(x.parc) ? `<span class="mini-badge mini-badge-gold">${x.parc}</span>` : ''}
          </div>
        </div>
        ${pending ? `<button class="tx-receive" onclick="openReceiptModal('${x.id}')" title="Confirmar recebimento">${icon('checkCircle')}<span>Confirmar recebimento</span></button>` : ''}
        <div class="tx-amount">
          <div class="${income ? 'tv-i' : 'tv-e'}">${income ? '+' : '-'}${brl(x.v)}</div>
          <div class="tx-date">${x.dt}</div>
        </div>
        ${x.id ? `<button class="tx-del" onclick="deleteTx('${x.id}')" title="Excluir">${icon('trash')}</button>` : ''}
      </div>`;
  }).join('');
}

// ── Confirmação de recebimento ──
let receiptTxId = null;
let receiptFP = null;

function renderTxSummary(pending) {
  $('txSummary').innerHTML = pending.length ? `
    <div class="tx-summary">
      <span class="tx-summary-icon">${icon('clock')}</span>
      <div class="fill">
        <div class="tx-summary-title">A receber no período</div>
        <div class="tx-summary-sub">${pending.length} ${pending.length === 1 ? 'lançamento aguardando' : 'lançamentos aguardando'} confirmação</div>
      </div>
      <div class="tx-summary-val">R$ ${fmtMoney(sumValues(pending))}</div>
    </div>` : '';
}

function openReceiptModal(id) {
  const tx = transactions.find(x => x.id === id);
  if (!tx) return;
  receiptTxId = id;
  receiptFP = tx.fp;
  $('rcDesc').textContent = tx.d;
  $('rcVal').textContent = 'R$ ' + fmtMoney(tx.v);
  $('rcDate').textContent = 'Competência ' + tx.dt;
  $('rcQuit').value = fmtDateKey(new Date());
  renderReceiptChips();
  openModal('receiptModal');
}

function renderReceiptChips() {
  $('rcFPChips').innerHTML = formasPag.map(f => catalogChip(f, 'fp-chip', receiptFP === f.id, `receiptFP='${f.id}';renderReceiptChips()`)).join('');
}

function saveReceipt() {
  const tx = transactions.find(x => x.id === receiptTxId);
  if (!tx) return;
  if (!formasPag.some(f => f.id === receiptFP)) {
    alert('Escolha a forma de recebimento.');
    return;
  }
  const quitKey = $('rcQuit').value;
  if (!quitKey) {
    alert('Informe a data de quitação.');
    return;
  }
  tx.fp = receiptFP;
  tx.rec = true;
  tx.quit = fmtDateBR(quitKey);
  sbUpdateTxReceipt(tx);
  closeModal('receiptModal');
  afterTxChange();
}

function undoReceipt(id) {
  const tx = transactions.find(x => x.id === id);
  if (!tx || !confirm('Marcar "' + tx.d + '" como não recebido?')) return;
  tx.rec = false;
  tx.quit = null;
  sbUpdateTxReceipt(tx);
  afterTxChange();
}

// ── Centros de custo e formas de pagamento ──
function totalsBy(field, items) {
  const tot = {};
  items.forEach(it => { tot[it.id] = { i: 0, e: 0, count: 0 }; });
  transactions.forEach(x => {
    const t = tot[x[field]];
    if (!t) return;
    if (isIncome(x)) t.i += x.v;
    else t.e += x.v;
    t.count++;
  });
  return tot;
}

const statCardHead = (item, count) => `
  <div class="stat-card-head">
    <span class="pill pill-lg" style="background:${item.color};color:${item.tc}">${item.name}</span>
    <span class="stat-card-count">${count} lançamentos</span>
  </div>`;
const miniStat = (value, label, cls) =>
  `<div class="cc-mini"><div class="cc-mini-val ${cls}">${value}</div><div class="cc-mini-lbl">${label}</div></div>`;

function renderCCDetail() {
  const tot = totalsBy('cc', centros);
  $('ccDetail').innerHTML = centros.map(cc => {
    const t = tot[cc.id];
    const saldo = t.i - t.e;
    const recent = transactions.filter(x => x.cc === cc.id).slice(0, 3).map(x => `
      <div class="cc-hist-item">
        <span class="cc-hist-name">${x.d}</span>
        <span class="cc-hist-val ${x.t === 'income' ? 'text-pos' : 'text-neg'}">${isIncome(x) ? '+' : '-'}R$${x.v}</span>
      </div>`).join('');
    return `
      <div class="cc-stat-card">
        ${statCardHead(cc, t.count)}
        <div class="cc-stat-inner">
          ${miniStat(brl(t.i), 'Receitas', 'text-pos')}
          ${miniStat(brl(t.e), 'Despesas', 'text-neg')}
          ${miniStat(brl(Math.abs(saldo)), 'Saldo', saldo >= 0 ? 'text-pos' : 'text-neg')}
        </div>
        ${recent}
      </div>`;
  }).join('');
}

function renderFPDetail() {
  const tot = totalsBy('fp', formasPag);
  const totalIncome = sumValues(transactions.filter(isIncome)) || 1;
  $('fpDetail').innerHTML = formasPag.map(fp => {
    const t = tot[fp.id];
    const pct = Math.round(t.i / totalIncome * 100);
    return `
      <div class="fp-stat-card">
        ${statCardHead(fp, t.count)}
        <div class="fp-stat-inner">
          ${miniStat(brl(t.i), 'Receitas', 'text-pos')}
          ${miniStat(brl(t.e), 'Despesas', 'text-neg')}
        </div>
        <div class="fp-pct">${pct}% das receitas</div>
        <div class="fp-bar"><div class="fp-bar-fill" style="width:${pct}%;background:${fp.color}"></div></div>
      </div>`;
  }).join('');
}

// Cadastros editáveis: 'cc' (centros de custo) e 'fp' (formas de pagamento)
const CATALOGS = {
  cc: {
    get items() { return centros; },
    set items(v) { centros = v; },
    prefix: 'cc', form: 'addCCForm', nameInput: 'newCCName', colorInput: 'newCCColor', list: 'ccManageList',
    save: () => sbSaveCentros(),
    refresh() { renderCCDetail(); renderCatalogManage('cc'); renderFormChips(); renderCCSummary(); },
  },
  fp: {
    get items() { return formasPag; },
    set items(v) { formasPag = v; },
    prefix: 'fp', form: 'addFPForm', nameInput: 'newFPName', colorInput: 'newFPColor', list: 'fpManageList',
    save: () => sbSaveFormas(),
    refresh() { renderFPDetail(); renderCatalogManage('fp'); renderFormChips(); renderFPDonut(); },
  },
};

function renderCatalogManage(kind) {
  const cat = CATALOGS[kind];
  $(cat.list).innerHTML = cat.items.map(it => `
    <div class="manage-item">
      <div class="manage-dot" style="background:${it.color}"></div>
      <div class="manage-name">${it.name}</div>
      <button class="manage-del" onclick="deleteCatalogItem('${kind}','${it.id}')" title="Excluir">${icon('trash')}</button>
    </div>`).join('');
}

function toggleCatalogForm(kind) {
  const form = $(CATALOGS[kind].form);
  form.style.display = form.style.display === 'none' ? 'flex' : 'none';
}

function addCatalogItem(kind) {
  const cat = CATALOGS[kind];
  const name = $(cat.nameInput).value.trim();
  const color = $(cat.colorInput).value;
  if (!name) return;
  cat.items.push({ id: cat.prefix + Date.now(), name, color, tc: textColorFor(color) });
  $(cat.nameInput).value = '';
  cat.save();
  cat.refresh();
}

function deleteCatalogItem(kind, id) {
  const cat = CATALOGS[kind];
  cat.items = cat.items.filter(it => it.id !== id);
  cat.save();
  cat.refresh();
}
