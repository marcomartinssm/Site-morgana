/* ==========================================================================
   Painel — métricas da clínica (resultado, agenda, clientes)
   Os números saem sempre dos dados carregados: `transacoes` para dinheiro,
   `agendamentos` para volume e `clientes` para a base. Nada é fixo no código.
   ========================================================================== */

let pnPeriod = 'jan';      // trocado pelo mês atual na inicialização
let pnSection = 'geral';

// ── Base de dados do período ──
const pnMonthIdx = p => PERIOD_MAP[p].m;            // -1 no anual
const pnDateOf = key => {
  const [y, m, d] = key.split('-');
  return new Date(+y, +m - 1, +d);
};
const pnHoje = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// Agendamentos do período, em lista plana, já com a data resolvida
function pnAppts(p) {
  const m = pnMonthIdx(p);
  const out = [];
  Object.keys(apptsByDate).forEach(key => {
    const d = pnDateOf(key);
    if (d.getFullYear() !== ANO_BASE) return;
    if (m >= 0 && d.getMonth() !== m) return;
    apptsByDate[key].forEach(a => out.push(Object.assign({}, a, { dateKey: key, date: d })));
  });
  return out;
}

// Histórico de atendimentos por cliente (todos os anos).
// `realizados` = concluídos ou confirmados já passados — é o que serve para medir recência;
// `concluidos` = só os de status Concluído, os únicos com valor confiável.
function pnHistoricoClientes() {
  const hoje = pnHoje();
  const map = {};
  const get = id => (map[id] = map[id] || { concluidos: 0, valor: 0, realizados: 0, primeiro: null, ultimo: null });
  Object.keys(apptsByDate).forEach(key => {
    const d = pnDateOf(key);
    apptsByDate[key].forEach(a => {
      if (!a.clientId) return;
      const concluido = a.status === 'done';
      const realizado = concluido || (a.status === 'confirmed' && d <= hoje);
      if (!realizado) return;
      const r = get(a.clientId);
      r.realizados++;
      if (concluido) { r.concluidos++; r.valor += a.valor || 0; }
      if (!r.primeiro || d < r.primeiro) r.primeiro = d;
      if (!r.ultimo || d > r.ultimo) r.ultimo = d;
    });
  });
  return map;
}

// ── Resultado em escada ──
// Em qual linha da escada a despesa entra (regras em DRE_REGRAS)
function dreGrupo(x) {
  const d = (x.d || '').toLowerCase();
  for (const r of DRE_REGRAS) {
    if (r.cc && r.cc !== x.cc) continue;
    if (r.re.test(d)) return r;
  }
  return DRE_GRUPO_OUTROS;
}

const pnIsOperacao = x => CC_OPERACAO.includes(x.cc);

function pnEscada(p) {
  const list = listByRegime(p, 'competencia');
  const op = list.filter(pnIsOperacao);
  const receita = sumValues(op.filter(isIncome));
  const nivel = { variavel: 0, fixo: 0, financiamento: 0 };
  const grupos = {};
  op.filter(x => !isIncome(x)).forEach(x => {
    const g = dreGrupo(x);
    nivel[g.nivel] += x.v;
    const alvo = grupos[g.grupo] = grupos[g.grupo] || { nivel: g.nivel, v: 0, n: 0 };
    alvo.v += x.v;
    alvo.n++;
  });

  const retiradas = sumValues(list.filter(x => x.cc === CC_RETIRADAS && !isIncome(x)));
  const aportes = sumValues(list.filter(x => x.cc === CC_RETIRADAS && isIncome(x)));
  const dizimo = sumValues(list.filter(x => x.cc === CC_DIZIMO && !isIncome(x)));

  const receitaPorCC = {};
  CC_OPERACAO.forEach(cc => {
    receitaPorCC[cc] = {
      i: sumValues(op.filter(x => x.cc === cc && isIncome(x))),
      e: sumValues(op.filter(x => x.cc === cc && !isIncome(x))),
    };
  });

  const margem = receita - nivel.variavel;
  const operacional = margem - nivel.fixo;
  const empresa = operacional - nivel.financiamento;
  const sobra = empresa + aportes - retiradas - dizimo;
  return { receita, nivel, grupos, retiradas, aportes, dizimo, receitaPorCC, margem, operacional, empresa, sobra };
}

// ── Agenda ──
function pnAgendaStats(p) {
  const hoje = pnHoje();
  const list = pnAppts(p);
  const s = {
    total: list.length, done: 0, cancel: 0, semDesfecho: 0, futuros: 0, reag: 0,
    valorDone: 0, comCliente: 0, comValor: 0, doneSemTx: 0, conf3d: 0, pos: 0,
    porSvc: {}, porDia: [0, 0, 0, 0, 0, 0, 0], porFaixa: FAIXAS_HORARIO.map(() => 0),
  };
  list.forEach(a => {
    s.reag += a.reagendamentos || 0;
    if (a.clientId) s.comCliente++;
    if (a.valor > 0) s.comValor++;
    if (a.conf3dEm) s.conf3d++;
    if (a.posEnviadoEm) s.pos++;
    if (a.status === 'done') {
      s.done++;
      s.valorDone += a.valor || 0;
      if (!a.txId) s.doneSemTx++;
    } else if (a.status === 'cancelled') {
      s.cancel++;
    } else if (a.date < hoje) {
      s.semDesfecho++;
    } else {
      s.futuros++;
    }
    const k = a.svc_key || 'avaliacao';
    s.porSvc[k] = (s.porSvc[k] || 0) + 1;
    s.porDia[a.date.getDay()]++;
    const h = parseInt((a.time || '').split(':')[0], 10);
    const fi = FAIXAS_HORARIO.findIndex(f => h >= f.de && h < f.ate);
    if (fi >= 0) s.porFaixa[fi]++;
  });
  s.encerrados = s.done + s.cancel + s.semDesfecho;
  return s;
}

// ── Clientes ──
function pnClientesStats(p) {
  const m = pnMonthIdx(p);
  const hist = pnHistoricoClientes();
  const hoje = pnHoje();
  const porEstagio = {};
  STAGES.forEach(st => { porEstagio[st.id] = 0; });

  // Os 182 cadastros trazidos de uma importação única entraram todos no mesmo dia;
  // contá-los como captação do mês inflaria o indicador.
  const importado = c => c.since === 'Importado';
  let novos = 0, aniversariantes = 0, comFone = 0, comBday = 0, importados = 0;
  clients.forEach(c => {
    porEstagio[c.stage] = (porEstagio[c.stage] || 0) + 1;
    if (c.phone) comFone++;
    if (/^\d{2}\/\d{2}/.test(c.bday || '')) comBday++;
    if (importado(c)) importados++;
    if (c.createdAt && !importado(c)) {
      const d = new Date(c.createdAt);
      if (d.getFullYear() === ANO_BASE && (m < 0 || d.getMonth() === m)) novos++;
    }
    const bm = parseInt((c.bday || '').split('/')[1], 10);
    if (bm && m >= 0 && bm === m + 1) aniversariantes++;
  });

  // Atendidos no período (só atendimentos concluídos, que são os que têm valor)
  const porCliente = {};
  pnAppts(p).filter(a => a.status === 'done' && a.clientId).forEach(a => {
    const r = porCliente[a.clientId] = porCliente[a.clientId] || { n: 0, v: 0 };
    r.n++;
    r.v += a.valor || 0;
  });
  const ids = Object.keys(porCliente);
  // "Primeira vez" só vale quando o cadastro também nasceu no período: o vínculo entre
  // agendamento e cliente começou em setembro/2026, então um atendimento antigo da mesma
  // pessoa pode existir sem estar ligado a ela.
  const inicioPeriodo = m >= 0 ? new Date(ANO_BASE, m, 1) : new Date(ANO_BASE, 0, 1);
  let primeiraVez = 0;
  ids.forEach(id => {
    const h = hist[id];
    const semHistorico = !h || !h.primeiro || h.primeiro >= inicioPeriodo;
    const cli = clients.find(c => String(c.id) === String(id));
    const cadastroNovo = cli && cli.createdAt && !importado(cli) && new Date(cli.createdAt) >= inicioPeriodo;
    if (semHistorico && cadastroNovo) primeiraVez++;
  });

  const top = ids
    .map(id => ({ cliente: clients.find(c => String(c.id) === String(id)), n: porCliente[id].n, v: porCliente[id].v }))
    .filter(r => r.cliente)
    .sort((a, b) => b.v - a.v);

  // Reativação: cliente ativo parado há muito tempo. Quem não tem nenhum atendimento
  // ligado ao cadastro fica de fora da lista (o vínculo só existe desde setembro/2026)
  // e aparece apenas como contagem.
  const ativos = clients.filter(c => c.stage === 'cliente_ativo');
  const reativar = ativos
    .map(c => {
      const h = hist[c.id];
      const ultimo = h && h.ultimo ? h.ultimo : null;
      return { cliente: c, ultimo, dias: ultimo ? Math.floor((hoje - ultimo) / 86400000) : null };
    })
    .filter(r => r.dias !== null && r.dias >= DIAS_PARA_REATIVAR)
    .sort((a, b) => b.dias - a.dias);
  const semRegistro = ativos.filter(c => !hist[c.id] || !hist[c.id].ultimo).length;

  const receita = ids.reduce((a, id) => a + porCliente[id].v, 0);
  const atendimentos = ids.reduce((a, id) => a + porCliente[id].n, 0);
  return {
    porEstagio, novos, aniversariantes, comFone, comBday, importados, atendidos: ids.length, primeiraVez,
    recorrentes: ids.length - primeiraVez, receita, atendimentos, top, reativar, semRegistro,
    base: clients.length,
  };
}

// ── Blocos de interface ──
const pnPct = (v, t) => (t > 0 ? Math.round((v / t) * 100) : 0);
const pnCard = (title, body, cls) =>
  `<div class="card ${cls || ''}">${title ? `<div class="card-title">${title}</div>` : ''}${body}</div>`;
const pnEmpty = texto => `<div class="card-empty">${texto}</div>`;

function pnKpi(label, valor, sub, tom) {
  return `<div class="pn-kpi${tom ? ' pn-' + tom : ''}">
    <div class="pn-kpi-label">${label}</div>
    <div class="pn-kpi-val">${valor}</div>
    <div class="pn-kpi-sub">${sub || ''}</div>
  </div>`;
}

// Barras horizontais: [{ nome, v, extra }] com o maior valor ocupando a faixa inteira
function pnBars(rows, formata) {
  if (!rows.length) return pnEmpty('Sem dados no período.');
  const max = Math.max.apply(null, rows.map(r => r.v)) || 1;
  const fmt = formata || (v => String(v));
  return '<div class="pn-bars">' + rows.map((r, i) => `<div class="svc-item">
    <div class="svc-name" title="${r.nome}">${r.nome}</div>
    <div class="svc-bg"><div class="svc-fill" style="width:${Math.max(2, (r.v / max) * 100)}%;background:${r.cor || SVC_COLORS[i % SVC_COLORS.length]}"></div></div>
    <div class="svc-pct">${fmt(r.v)}</div>
  </div>`).join('') + '</div>';
}

// Gráfico de linhas em SVG: series = [{ nome, cor, pontos: [] }]
function pnLineChart(labels, series) {
  const W = 620, H = 220, L = 8, R = 8, T = 14, B = 26;
  const todos = series.reduce((a, s) => a.concat(s.pontos), []);
  const max = Math.max.apply(null, todos.concat([0]));
  const min = Math.min.apply(null, todos.concat([0]));
  const span = (max - min) || 1;
  const x = i => L + (i * (W - L - R)) / Math.max(1, labels.length - 1);
  const y = v => T + (1 - (v - min) / span) * (H - T - B);
  const zero = y(0);

  const linhas = series.map(s => {
    const pts = s.pontos.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
    const dots = s.pontos.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="${s.cor}"/>`).join('');
    return `<polyline points="${pts}" fill="none" stroke="${s.cor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
  }).join('');

  const marcas = labels.map((l, i) => `<text x="${x(i).toFixed(1)}" y="${H - 8}" class="pn-ax">${l}</text>`).join('');
  const legenda = series.map(s => `<span><i class="ldot" style="background:${s.cor}"></i>${s.nome}</span>`).join('');

  return `<div class="pn-chart">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Evolução mensal">
      <line x1="${L}" y1="${zero.toFixed(1)}" x2="${W - R}" y2="${zero.toFixed(1)}" class="pn-zero"/>
      ${linhas}
    </svg>
    <svg viewBox="0 0 ${W} 20" class="pn-chart-ax" preserveAspectRatio="none">${marcas}</svg>
    <div class="legend-row">${legenda}</div>
  </div>`;
}

// Linha do resultado em escada
function dreLinha(label, valor, tipo, nota) {
  return `<div class="dre-line dre-${tipo}">
    <span class="dre-lbl">${label}${nota ? `<em>${nota}</em>` : ''}</span>
    <span class="dre-val">${(tipo === 'menos' ? '− ' : '') + brl(Math.abs(valor))}</span>
  </div>`;
}

// ── Seções ──
function pnRenderGeral(p) {
  const e = pnEscada(p);
  const a = pnAgendaStats(p);
  const c = pnClientesStats(p);
  const prevIdx = PERIOD_ORDER.indexOf(p) - 1;
  const prev = p !== 'ano' && prevIdx >= 0 ? pnEscada(PERIOD_ORDER[prevIdx]) : null;
  const vs = (cur, before) => {
    if (!prev || !before) return '';
    const pct = Math.round(((cur - before) / Math.abs(before)) * 100);
    return (pct >= 0 ? '▲ ' : '▼ ') + Math.abs(pct) + '% vs ' + PERIOD_MAP[PERIOD_ORDER[prevIdx]].label.slice(0, 3).toLowerCase();
  };
  const margemPct = pnPct(e.empresa, e.receita);
  const payout = pnPct(e.retiradas, e.empresa);
  const ticket = a.done ? a.valorDone / a.done : 0;

  const kpis = `<div class="pn-kpis">
    ${pnKpi('Receita da operação', brl(e.receita), vs(e.receita, prev && prev.receita) || 'Estética + Locações', 'brand')}
    ${pnKpi('Resultado da empresa', brl(e.empresa), margemPct + '% da receita', e.empresa >= 0 ? 'good' : 'bad')}
    ${pnKpi('Retiradas da sócia', brl(e.retiradas), e.empresa > 0 ? payout + '% do resultado' : 'sem resultado no período', payout > 80 ? 'warn' : '')}
    ${pnKpi('Sobra do mês', brl(e.sobra), 'depois das retiradas e do dízimo', e.sobra >= 0 ? 'good' : 'bad')}
  </div>`;

  const kpis2 = `<div class="pn-kpis">
    ${pnKpi('Atendimentos concluídos', a.done, a.total + ' agendamentos no período')}
    ${pnKpi('Ticket médio', brl(ticket), 'por atendimento concluído')}
    ${pnKpi('Clientes atendidos', c.atendidos, c.primeiraVez + ' no primeiro atendimento')}
    ${pnKpi('Novos cadastros', c.novos, 'base de ' + c.base + ' clientes, fora os importados')}
  </div>`;

  const labels = PERIOD_ORDER.map(k => PERIOD_MAP[k].label.slice(0, 3));
  const serie = fn => PERIOD_ORDER.map(k => fn(pnEscada(k)));
  const grafico = pnCard('Evolução do ano', pnLineChart(labels, [
    { nome: 'Receita', cor: 'var(--brand-500)', pontos: serie(x => x.receita) },
    { nome: 'Resultado da empresa', cor: '#2f7d53', pontos: serie(x => x.empresa) },
    { nome: 'Retiradas', cor: '#c0463f', pontos: serie(x => x.retiradas) },
  ]));

  const alerta = e.empresa > 0 && payout > 80
    ? `<div class="pn-alert">As retiradas consumiram <b>${payout}%</b> do resultado ${p === 'ano' ? 'do ano' : 'do mês'}. Sobrou ${brl(e.sobra)} no caixa.</div>`
    : '';

  return kpis + kpis2 + alerta + grafico;
}

function pnRenderFin(p) {
  const e = pnEscada(p);
  const escada = pnCard('Resultado em escada', `
    ${dreLinha('Receita da operação', e.receita, 'base', 'Estética + Locações')}
    ${dreLinha('Custos variáveis', e.nivel.variavel, 'menos', 'comissões, materiais e insumos')}
    ${dreLinha('Margem de contribuição', e.margem, 'sub', pnPct(e.margem, e.receita) + '% da receita')}
    ${dreLinha('Despesas fixas', e.nivel.fixo, 'menos', 'sala, impostos, marketing, deslocamento')}
    ${dreLinha('Resultado operacional', e.operacional, 'sub', pnPct(e.operacional, e.receita) + '% da receita')}
    ${dreLinha('Financiamento da máquina', e.nivel.financiamento, 'menos', 'parcela, seguro e suporte')}
    ${dreLinha('Resultado da empresa', e.empresa, 'total', pnPct(e.empresa, e.receita) + '% da receita')}
    <div class="dre-sep">Destinação do lucro — não é custo de operar</div>
    ${e.aportes ? dreLinha('Aportes e estornos', e.aportes, 'base') : ''}
    ${dreLinha('Retiradas da sócia', e.retiradas, 'menos', 'centro de custo "Distribuição de lucros"')}
    ${dreLinha('Dízimo', e.dizimo, 'menos')}
    ${dreLinha('Sobra do mês', e.sobra, 'total')}
  `);

  const niveis = { variavel: 'Variável', fixo: 'Fixa', financiamento: 'Financiamento' };
  const grupos = Object.keys(e.grupos)
    .map(g => ({ nome: g + ' · ' + niveis[e.grupos[g].nivel], v: e.grupos[g].v }))
    .sort((x, y) => y.v - x.v);

  const porCC = CC_OPERACAO.map(cc => ({ nome: getCC(cc).name, v: e.receitaPorCC[cc].i, cor: getCC(cc).color }))
    .sort((x, y) => y.v - x.v);

  const resultadoCC = CC_OPERACAO.map(cc => {
    const r = e.receitaPorCC[cc];
    const liq = r.i - r.e;
    return `<div class="pn-row">
      <span class="pn-row-name">${getCC(cc).name}</span>
      <span class="pn-row-sub">${brl(r.i)} − ${brl(r.e)}</span>
      <span class="pn-row-val ${liq >= 0 ? 'pos' : 'neg'}">${brl(liq)}</span>
    </div>`;
  }).join('');

  const list = listByRegime(p, 'competencia');
  const porFP = formasPag.map(f => ({
    nome: f.name, cor: f.color,
    v: sumValues(list.filter(x => isIncome(x) && pnIsOperacao(x) && x.fp === f.id)),
  })).filter(r => r.v > 0).sort((a, b) => b.v - a.v);

  const aReceber = sumValues(transactions.filter(isPendingIncome));
  const aPagar = sumValues(transactions.filter(isPendingExpense));
  const pend = pnCard('Pendências (todo o ano)', `
    <div class="pn-row"><span class="pn-row-name">A receber</span><span class="pn-row-sub">${transactions.filter(isPendingIncome).length} lançamentos</span><span class="pn-row-val pos">${brl(aReceber)}</span></div>
    <div class="pn-row"><span class="pn-row-name">A pagar</span><span class="pn-row-sub">${transactions.filter(isPendingExpense).length} lançamentos</span><span class="pn-row-val neg">${brl(aPagar)}</span></div>
  `);

  return escada
    + `<div class="fin-grid-2">
        ${pnCard('Receita por centro de custo', pnBars(porCC, brl))}
        ${pnCard('Resultado por centro de custo', resultadoCC || pnEmpty('Sem dados no período.'))}
       </div>`
    + `<div class="fin-grid-2">
        ${pnCard('Despesas por grupo', pnBars(grupos, brl))}
        ${pnCard('Receita por forma de recebimento', pnBars(porFP, brl))}
       </div>`
    + pend;
}

function pnRenderAgenda(p) {
  const s = pnAgendaStats(p);
  const kpis = `<div class="pn-kpis">
    ${pnKpi('Agendamentos', s.total, s.futuros + ' ainda por acontecer')}
    ${pnKpi('Concluídos', s.done, s.encerrados ? pnPct(s.done, s.encerrados) + '% dos encerrados' : '—', 'good')}
    ${pnKpi('Cancelados', s.cancel, s.encerrados ? pnPct(s.cancel, s.encerrados) + '% dos encerrados' : '—', s.cancel ? 'bad' : '')}
    ${pnKpi('Reagendamentos', s.reag, 'mudanças de dia ou horário')}
  </div>`;

  const svcRows = Object.keys(s.porSvc)
    .map(k => ({ nome: SVC_SHORT_LABELS[k] || k, v: s.porSvc[k] }))
    .sort((a, b) => b.v - a.v);
  const diaRows = WDAYS.map((d, i) => ({ nome: d, v: s.porDia[i] })).filter(r => r.v > 0);
  const faixaRows = FAIXAS_HORARIO.map((f, i) => ({ nome: f.label, v: s.porFaixa[i] }));

  const pendencia = s.semDesfecho
    ? `<div class="pn-alert">${s.semDesfecho} agendamento${s.semDesfecho > 1 ? 's' : ''} já passou e segue sem desfecho (nem concluído, nem cancelado). Sem isso a taxa de conclusão fica incompleta.</div>`
    : '';

  const autom = pnCard('Automações de WhatsApp', `
    <div class="pn-row"><span class="pn-row-name">Confirmação 3 dias antes</span><span class="pn-row-sub">enviadas no período</span><span class="pn-row-val">${s.conf3d}</span></div>
    <div class="pn-row"><span class="pn-row-name">Pós-atendimento</span><span class="pn-row-sub">${s.done ? pnPct(s.pos, s.done) + '% dos concluídos' : 'nenhum concluído'}</span><span class="pn-row-val">${s.pos}</span></div>
  `);

  return kpis + pendencia
    + `<div class="fin-grid-2">
        ${pnCard('Agendamentos por procedimento', pnBars(svcRows))}
        ${pnCard('Agendamentos por dia da semana', pnBars(diaRows))}
       </div>`
    + `<div class="fin-grid-2">
        ${pnCard('Agendamentos por faixa de horário', pnBars(faixaRows))}
        ${autom}
       </div>`;
}

function pnRenderClientes(p) {
  const c = pnClientesStats(p);
  const freq = c.atendidos ? c.atendimentos / c.atendidos : 0;
  const ticketCliente = c.atendidos ? c.receita / c.atendidos : 0;

  const kpis = `<div class="pn-kpis">
    ${pnKpi('Base de clientes', c.base, c.porEstagio.cliente_ativo + ' ativos · ' + c.importados + ' vieram de importação')}
    ${pnKpi('Atendidos no período', c.atendidos, c.primeiraVez + ' no primeiro atendimento · ' + c.recorrentes + ' da base')}
    ${pnKpi('Receita por cliente', brl(ticketCliente), freq.toFixed(1).replace('.', ',') + ' atendimentos por cliente')}
    ${pnKpi('Para reativar', c.reativar.length, 'ativos parados há ' + DIAS_PARA_REATIVAR + '+ dias', c.reativar.length ? 'warn' : '')}
  </div>`;

  const funil = STAGES.map(st => ({ nome: st.label, v: c.porEstagio[st.id] || 0, cor: st.color }));

  const top = c.top.slice(0, 10).map(r => `<div class="pn-row">
    <span class="pn-row-name">${r.cliente.name}</span>
    <span class="pn-row-sub">${r.n} atendimento${r.n > 1 ? 's' : ''}</span>
    <span class="pn-row-val">${brl(r.v)}</span>
  </div>`).join('');

  const reativar = c.reativar.slice(0, 12).map(r => `<div class="pn-row">
    <span class="pn-row-name">${r.cliente.name}</span>
    <span class="pn-row-sub">último atendimento em ${fmtDateBR(fmtDateKey(r.ultimo))}</span>
    <span class="pn-row-val">${r.dias}d</span>
  </div>`).join('')
  + (c.semRegistro ? `<div class="pn-row"><span class="pn-row-name">+ ${c.semRegistro} clientes ativos sem atendimento vinculado</span><span class="pn-row-sub">cadastro antigo: o vínculo com a agenda começou em setembro</span><span class="pn-row-val">—</span></div>` : '');

  const extra = pnCard('Outros indicadores da base', `
    <div class="pn-row"><span class="pn-row-name">Aniversariantes do mês</span><span class="pn-row-sub">${c.comBday ? 'oportunidade de contato' : 'nenhum cadastro tem data de nascimento ainda'}</span><span class="pn-row-val">${c.aniversariantes}</span></div>
    <div class="pn-row"><span class="pn-row-name">Cadastros com telefone</span><span class="pn-row-sub">${pnPct(c.comFone, c.base)}% da base</span><span class="pn-row-val">${c.comFone}</span></div>
    <div class="pn-row"><span class="pn-row-name">Em régua de nutrição</span><span class="pn-row-sub">estágio Nutrição</span><span class="pn-row-val">${c.porEstagio.nutricao || 0}</span></div>
  `);

  return kpis
    + `<div class="fin-grid-2">
        ${pnCard('Funil do CRM', pnBars(funil))}
        ${extra}
       </div>`
    + `<div class="fin-grid-2">
        ${pnCard('Clientes que mais geraram receita', top || pnEmpty('Nenhum atendimento concluído com cliente vinculado no período.'))}
        ${pnCard('Reativação', reativar || pnEmpty('Nenhum cliente ativo parado há ' + DIAS_PARA_REATIVAR + ' dias.'))}
       </div>`;
}

// Mostra o que ainda falta preencher para as métricas fecharem — a base de 2027
function pnRenderDados(p) {
  const s = pnAgendaStats(p);
  const c = pnClientesStats(p);
  // arredonda para baixo: 234 de 235 é 99%, não 100% — o que falta tem de aparecer
  const linha = (nome, ok, total, nota) => {
    const pct = total > 0 ? Math.floor((ok / total) * 100) : 0;
    const tom = pct >= 95 ? 'pos' : pct >= 70 ? '' : 'neg';
    return `<div class="pn-row">
      <span class="pn-row-name">${nome}</span>
      <span class="pn-row-sub">${nota || ''}</span>
      <span class="pn-row-val ${tom}">${ok}/${total} · ${pct}%</span>
    </div>`;
  };
  const semCC = transactions.filter(x => !centros.some(cc => cc.id === x.cc)).length;

  const agenda = pnCard('Agenda do período', `
    ${linha('Vinculados a um cliente do CRM', s.comCliente, s.total, 'sem isso não há receita por cliente')}
    ${linha('Com valor preenchido', s.comValor, s.total, 'base do ticket médio')}
    ${linha('Com desfecho (concluído ou cancelado)', s.done + s.cancel, s.total - s.futuros, 'entre os que já passaram')}
    ${linha('Concluídos com receita lançada', s.done - s.doneSemTx, s.done, 'liga o atendimento ao financeiro')}
  `);

  const crm = pnCard('Cadastro de clientes', `
    ${linha('Com telefone', c.comFone, c.base, 'sem telefone não há WhatsApp nem nutrição')}
    ${linha('Com data de nascimento', c.comBday, c.base, 'abre a campanha de aniversário')}
  `);

  const fin = pnCard('Financeiro do ano', `
    ${linha('Lançamentos com centro de custo válido', transactions.length - semCC, transactions.length)}
    ${linha('Receitas já recebidas', transactions.filter(x => isIncome(x) && x.rec).length, transactions.filter(isIncome).length, 'o resto fica fora do regime de caixa')}
    ${linha('Despesas já pagas', transactions.filter(x => !isIncome(x) && x.rec).length, transactions.filter(x => !isIncome(x)).length)}
  `);

  const nota = `<div class="pn-note">
    <b>O que já é confiável:</b> o financeiro desde janeiro de ${ANO_BASE} (lançamento a lançamento) e a agenda desde
    setembro de ${ANO_BASE}, quando os atendimentos passaram a ser concluídos e vinculados ao cliente.
    Antes disso os agendamentos vieram de importação, sem cliente nem procedimento,
    e por isso as métricas de cliente e de ticket só fecham a partir de setembro.
  </div>`;

  return nota + `<div class="fin-grid-2">${agenda}${fin}</div><div class="fin-grid-2">${crm}</div>`;
}

// ── Navegação da tela ──
const PN_SECTIONS = {
  geral: pnRenderGeral, fin: pnRenderFin, agenda: pnRenderAgenda,
  clientes: pnRenderClientes, dados: pnRenderDados,
};

function renderPainel() {
  if (!$('page-painel')) return;
  $('pnPeriodLabel').textContent = PERIOD_MAP[pnPeriod].label;
  Object.keys(PN_SECTIONS).forEach(k => {
    const el = $('pn-' + k);
    if (!el) return;
    el.innerHTML = k === pnSection ? PN_SECTIONS[k](pnPeriod) : '';
    el.classList.toggle('active', k === pnSection);
  });
  hydrateIcons($('page-painel'));
}

function setPainelPeriod(p, el) {
  pnPeriod = p;
  document.querySelectorAll('#pnTabs .ptab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderPainel();
}

function setPainelSection(s, el) {
  pnSection = s;
  document.querySelector('.content').scrollTop = 0;
  document.querySelectorAll('#pnStabs .stab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderPainel();
}

// Abre no mês atual (ou no anual, se o ano corrente não for o ano-base)
function initPainel() {
  const hoje = new Date();
  pnPeriod = hoje.getFullYear() === ANO_BASE ? PERIOD_ORDER[hoje.getMonth()] : 'ano';
  const tabs = document.querySelectorAll('#pnTabs .ptab');
  const idx = pnPeriod === 'ano' ? tabs.length - 1 : PERIOD_ORDER.indexOf(pnPeriod);
  tabs.forEach((t, i) => t.classList.toggle('active', i === idx));
}
