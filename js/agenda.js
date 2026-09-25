/* ==========================================================================
   Agenda — calendário, linha do tempo do dia, próximos agendamentos
   e modal de novo agendamento / edição
   ========================================================================== */

const today = new Date();
let viewDate = new Date(today);               // mês exibido no calendário
let agendaSelDate = fmtDateKey(new Date());   // dia selecionado (YYYY-MM-DD)
let apptsByDate = {};                         // { 'YYYY-MM-DD': [agendamentos] } — vem do Supabase
let apptLinkedClientId = null;                // cliente vinculado no modal

const STATUS_BADGE = { confirmed: 'badge-confirmed', pending: 'badge-pending', sent: 'badge-sent', done: 'badge-done', cancelled: 'badge-canceled' };
const STATUS_LABEL = { confirmed: 'Confirmado', pending: 'Pendente', sent: 'Enviado', done: 'Concluído', cancelled: 'Cancelado' };
const STATUS_DOT = { confirmed: '#4caf7a', pending: '#e0a93b', sent: '#5b8fd0', done: '#2f7d53' };

function getApptDay(dateStr) {
  return apptsByDate[dateStr] || [];
}
function setApptDay(dateStr, arr) {
  apptsByDate[dateStr] = arr;
}
function findAppt(dateStr, id) {
  return getApptDay(dateStr).find(x => String(x.id) === String(id));
}
const isActiveAppt = a => a.name && a.status !== 'cancelled';

function renderAgenda() {
  renderCal();
  renderTimeline();
  renderUpcoming();
}
function selectAgendaDate(dateStr) {
  agendaSelDate = dateStr;
  renderAgenda();
}

// ── Calendário ──
function renderCal() {
  const y = viewDate.getFullYear(), m = viewDate.getMonth();
  $('calTitle').textContent = MONTHS[m].slice(0, 3) + ' ' + y;

  const first = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevMonthDays = new Date(y, m, 0).getDate();

  let html = WDAYS.map(d => `<div class="cal-day-name">${d}</div>`).join('');
  for (let i = 0; i < first; i++) {
    html += `<div class="cal-day other">${prevMonthDays - first + i + 1}</div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
    let cls = 'cal-day';
    if (isToday) cls += ' today';
    else if (dateStr === agendaSelDate) cls += ' sel';
    if (getApptDay(dateStr).some(isActiveAppt)) cls += ' has';
    html += `<div class="${cls}" onclick="selectAgendaDate('${dateStr}')">${d}</div>`;
  }
  $('calGrid').innerHTML = html;
}

function changeMonth(dir) {
  viewDate.setMonth(viewDate.getMonth() + dir);
  renderCal();
}

// ── Linha do tempo do dia ──
function renderTimeline() {
  const dayAppts = getApptDay(agendaSelDate);
  const d = new Date(agendaSelDate + 'T12:00:00');
  $('tlDay').textContent = d.getDate() + ' de ' + MONTHS[d.getMonth()] + ' de ' + d.getFullYear();

  if (!dayAppts.length) {
    $('tlBody').innerHTML = `
      <div class="tl-empty">
        <div class="tl-empty-icon">${icon('calendar')}</div>
        <div class="tl-empty-title">Nenhum agendamento para este dia</div>
        <span>Clique em “Novo agendamento” para adicionar.</span>
      </div>`;
    $('tlTotal').textContent = '0';
    $('tlConf').textContent = '0';
    $('tlPrev').textContent = 'R$ ' + fmtMoney(0);
    return;
  }

  const sorted = [...dayAppts].sort((a, b) => a.time.localeCompare(b.time));
  const previsto = sorted.filter(a => a.status !== 'cancelled').reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);
  $('tlTotal').textContent = sorted.length;
  $('tlConf').textContent = sorted.filter(a => a.status === 'confirmed').length;
  $('tlPrev').textContent = 'R$ ' + fmtMoney(previsto);

  $('tlBody').innerHTML = sorted.map(renderApptRow).join('');
}

function renderApptRow(a) {
  const linked = a.clientId ? clients.find(x => x.id === a.clientId) : null;
  const isCancelled = a.status === 'cancelled';
  const isDone = a.status === 'done';
  const resched = a.reagendamentos
    ? `<span class="appt-tag-resched">${icon('refresh')}Reagendado${a.reagendamentos > 1 ? ' ' + a.reagendamentos + 'x' : ''}</span>`
    : '';
  const posChip = a.posEnviadoEm
    ? `<span class="appt-tag-pos" title="Pós-atendimento enviado em ${fmtDateBR(a.posEnviadoEm.slice(0, 10))}">${icon('send')}Pós enviado</span>`
    : '';

  const clientChip = linked
    ? `<span class="appt-client-chip" onclick="openClientFicha(${linked.id})" title="Ver ficha">${icon('arrowUpRight')}${firstName(linked.name)}</span>`
    : '';
  const editBtn = `<button class="appt-btn appt-btn-edit" onclick="editAppt('${a.id}')" title="Editar">${icon('pencil')}</button>`;
  // Concluídos e cancelados só têm o editar: a situação é trocada dentro da edição
  const actions = isCancelled || isDone ? `<div class="appt-actions">${editBtn}</div>` : `
    <div class="appt-actions">
      <button class="appt-btn appt-btn-done" onclick="concludeAppt('${a.id}')" title="Concluir atendimento">${icon('checkCheck')}<span>Concluir</span></button>
      ${editBtn}
      <button class="appt-btn appt-btn-confirm" onclick="setApptStatus('${a.id}','confirmed')" title="Confirmar">${icon('check')}</button>
      <button class="appt-btn appt-btn-wpp" data-wpp="${a.id}" onclick="sendWppFromAgenda('${a.id}','${agendaSelDate}')" title="Enviar confirmação WhatsApp">${icon('send')}</button>
      <button class="appt-btn appt-btn-cancel" onclick="setApptStatus('${a.id}','cancelled')" title="Cancelar">${icon('x')}</button>
    </div>`;
  const valor = a.valor ? `<span class="appt-valor">R$ ${fmtMoney(parseFloat(a.valor))}</span>` : '';

  return `
    <div class="tl-row${isCancelled ? ' is-cancelled' : ''}${isDone ? ' is-done' : ''}">
      <div class="tl-time">${a.time}</div>
      <div class="tl-slot">
        <div class="appt-card ${isCancelled ? 'is-cancelled' : a.status}">
          <div class="appt-main">
            <div class="appt-name">${a.name}${clientChip}${resched}${posChip}</div>
            <div class="appt-svc">${a.svc}${a.obs ? ' · ' + a.obs : ''}</div>
          </div>
          <div class="appt-meta">
            ${valor}
            <span class="badge ${STATUS_BADGE[a.status] || 'badge-pending'}">${STATUS_LABEL[a.status] || a.status}</span>
            ${actions}
          </div>
        </div>
      </div>
    </div>`;
}

function setApptStatus(id, status) {
  const arr = getApptDay(agendaSelDate);
  const a = arr.find(x => String(x.id) === String(id));
  if (!a) return;
  a.status = status;
  setApptDay(agendaSelDate, arr);
  sbUpsertAppt(agendaSelDate, a);
  renderTimeline();
}

// Texto da confirmação: o que acontece ao concluir um atendimento
function conclusionEffects(appt) {
  const valor = parseFloat(appt.valor) || 0;
  const client = appt.clientId ? clients.find(x => x.id === appt.clientId) : null;
  const effects = [];
  if (valor > 0) {
    effects.push('• lançar R$ ' + fmtMoney(valor) + ' como receita a receber no Financeiro');
    if (client) effects.push('• somar o valor ao "investido" de ' + firstName(client.name));
  } else {
    effects.push('• sem valor informado: nada será lançado no Financeiro');
  }
  if (canSendPosAtendimento(appt)) {
    effects.push('• enviar a mensagem de pós-atendimento no WhatsApp em ' + POS_ATENDIMENTO_DELAY_MIN + ' minutos');
  }
  return '\n\nIsso vai:\n' + effects.join('\n');
}

// Aplica a conclusão: soma o valor no "investido" do cliente e lança a receita no Financeiro
function applyConclusion(appt, dateKey) {
  appt.status = 'done';
  sendPosAtendimento(appt, dateKey);   // o n8n aguarda o atraso antes de mandar
  const valor = parseFloat(appt.valor) || 0;
  if (valor <= 0) return;
  const client = appt.clientId ? clients.find(x => x.id === appt.clientId) : null;
  if (client) {
    client.spent = (parseFloat(client.spent) || 0) + valor;
    sbUpsertCliente(client);
  }
  // Receita já recebida que ficou de uma conclusão desfeita: reaproveita em vez de duplicar
  const kept = appt.txId ? transactions.find(t => t.id === appt.txId) : null;
  appt.txId = kept ? kept.id : addApptIncome(appt, dateKey, valor).id;   // vínculo usado se o atendimento for editado depois
}

function concludeAppt(id) {
  const arr = getApptDay(agendaSelDate);
  const a = arr.find(x => String(x.id) === String(id));
  if (!a || a.status === 'done') return;
  if (!confirm('Concluir o atendimento de ' + a.name + '?' + conclusionEffects(a))) return;

  applyConclusion(a, agendaSelDate);
  setApptDay(agendaSelDate, arr);
  sbUpsertAppt(agendaSelDate, a);
  renderTimeline();
}

// Desfaz a conclusão: tira o valor do "investido" e exclui a receita que ainda estava a receber.
// Receita já recebida continua no Financeiro. Devolve false se o usuário desistir.
function undoConclusion(before, beforeDate, after) {
  const valor = parseFloat(before.valor) || 0;
  const client = (before.clientId && clients.find(c => c.id === before.clientId)) || null;
  const tx = findApptIncome(before, beforeDate);
  const effects = [];
  if (client && valor > 0) effects.push('• tirar R$ ' + fmtMoney(valor) + ' do "investido" de ' + firstName(client.name));
  if (tx && !tx.rec) effects.push('• excluir a receita a receber de R$ ' + fmtMoney(tx.v) + ' do Financeiro');
  if (tx && tx.rec) effects.push('• a receita de R$ ' + fmtMoney(tx.v) + ' já foi recebida e continua no Financeiro (exclua em Lançamentos se não valer mais)');
  const detail = effects.length ? '\n\nIsso vai:\n' + effects.join('\n') : '';
  if (!confirm('Desfazer a conclusão do atendimento de ' + before.name + '?' + detail)) return false;

  if (client && valor > 0) {
    client.spent = Math.max(0, (parseFloat(client.spent) || 0) - valor);
    sbUpsertCliente(client);
  }
  if (tx && !tx.rec) {
    transactions.splice(transactions.indexOf(tx), 1);
    sbDeleteTx(tx.id);
    after.txId = null;
  } else {
    after.txId = tx ? tx.id : null;
  }
  return true;
}

// Edição de um atendimento já concluído: mantém a receita e o "investido" coerentes com os novos dados.
// Devolve false se o usuário desistir na confirmação.
function syncConcludedAppt(before, beforeDate, after, afterDate) {
  const oldVal = parseFloat(before.valor) || 0;
  const newVal = parseFloat(after.valor) || 0;
  const oldClient = (before.clientId && clients.find(c => c.id === before.clientId)) || null;
  const newClient = (after.clientId && clients.find(c => c.id === after.clientId)) || null;
  const tx = findApptIncome(before, beforeDate);
  const desc = after.name + ' · ' + after.svc;
  const newDt = fmtDateBR(afterDate);

  const spentChanges = oldClient === newClient ? !!oldClient && oldVal !== newVal : !!(oldVal || newVal);
  // Só cria receita se o atendimento foi concluído sem valor; se a receita existia e foi excluída, respeita a exclusão
  const createIncome = !tx && newVal > 0 && oldVal <= 0;
  const effects = [];
  if (tx && newVal > 0 && (tx.v !== newVal || tx.dt !== newDt || tx.d !== desc || (!tx.rec && tx.fp !== after.fpag))) {
    effects.push('• atualizar a receita no Financeiro' + (tx.v !== newVal ? ' (R$ ' + fmtMoney(tx.v) + ' → R$ ' + fmtMoney(newVal) + ')' : ''));
  }
  if (createIncome) effects.push('• lançar R$ ' + fmtMoney(newVal) + ' como receita a receber no Financeiro');
  if (tx && newVal <= 0) effects.push('• a receita de R$ ' + fmtMoney(tx.v) + ' continua no Financeiro (exclua em Lançamentos se não valer mais)');
  if (spentChanges) effects.push('• ajustar o "investido" da cliente');
  if (effects.length && !confirm('Este atendimento já foi concluído. Salvar também vai:\n' + effects.join('\n'))) return false;

  // "Investido": um único ajuste por cliente
  const setSpent = (c, delta) => {
    c.spent = Math.max(0, (parseFloat(c.spent) || 0) + delta);
    sbUpsertCliente(c);
  };
  if (oldClient === newClient) {
    if (oldClient && oldVal !== newVal) setSpent(oldClient, newVal - oldVal);
  } else {
    if (oldClient && oldVal) setSpent(oldClient, -oldVal);
    if (newClient && newVal) setSpent(newClient, newVal);
  }

  // Receita no Financeiro
  if (tx && newVal > 0) {
    tx.v = newVal;
    tx.dt = newDt;
    tx.d = desc;
    tx.cc = apptCostCenter(after);
    tx.ic = TX_ICONS[tx.cc] || tx.ic;
    if (!tx.rec) tx.fp = after.fpag;   // depois de recebida, vale a forma confirmada
    sbUpdateTx(tx);
  } else if (createIncome) {
    after.txId = addApptIncome(after, afterDate, newVal).id;
  }
  if (tx) after.txId = tx.id;
  return true;
}

// ── Próximos agendamentos ──
function renderUpcoming() {
  const todayStr = fmtDateKey(new Date());
  const future = [];
  Object.entries(apptsByDate).sort().forEach(([date, arr]) => {
    if (date >= todayStr) arr.filter(isActiveAppt).forEach(a => future.push({ ...a, date }));
  });
  future.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  if (!future.length) {
    $('upList').innerHTML = '<div class="up-empty">Nenhum agendamento futuro.</div>';
    return;
  }
  $('upList').innerHTML = future.slice(0, 6).map(a => {
    const [, m, d] = a.date.split('-');
    return `
      <div class="up-item" onclick="selectAgendaDate('${a.date}')">
        <div class="up-date"><span class="up-day">${d}</span><span class="up-month">${MONTHS[m - 1].slice(0, 3)}</span></div>
        <div class="fill">
          <div class="up-name">${a.name}</div>
          <div class="up-meta">${a.time} · ${a.svc}</div>
        </div>
        <div class="up-dot" style="background:${STATUS_DOT[a.status] || STATUS_DOT.pending}" title="${STATUS_LABEL[a.status] || ''}"></div>
      </div>`;
  }).join('');
}

// ── Modal de agendamento ──
function openNewApptModal() {
  $('apptModalTitle').textContent = 'Novo agendamento';
  $('mStatusGroup').hidden = true;
  $('mDate').value = fmtDateKey(new Date());
  clearApptClient();
  $('mName').value = '';
  $('mObs').value = '';
  $('apptModal').classList.add('open');
  setTimeout(() => $('mName').focus(), 100);
}

function editAppt(id) {
  const a = findAppt(agendaSelDate, id);
  if (!a) return;
  $('mDate').value = agendaSelDate;
  $('mTime').value = a.time;
  $('mSvc').value = a.svc_key || 'avaliacao';
  $('mVal').value = a.valor || '';
  $('mFpag').value = a.fpag || 'pix';
  $('mObs').value = a.obs || '';
  $('mStatus').value = a.status;
  $('mStatusGroup').hidden = false;
  if (a.clientId) {
    linkApptClient(a.clientId);
  } else {
    $('mName').value = a.name;
    $('mName').style.display = '';
  }
  $('apptModal').dataset.editId = id;
  $('apptModal').dataset.editDate = agendaSelDate;
  $('apptModalTitle').textContent = a.status === 'done' ? 'Editar atendimento concluído' : 'Editar agendamento';
  $('apptModal').classList.add('open');
}

function closeApptModal() {
  $('apptModal').classList.remove('open');
  delete $('apptModal').dataset.editId;
  delete $('apptModal').dataset.editDate;
  $('mStatusGroup').hidden = true;
  clearApptClient();
  $('mName').value = '';
  $('mVal').value = '';
  $('mObs').value = '';
  ['leadName', 'leadPhone'].forEach(id => {
    $(id).value = '';
    $(id).style.borderColor = '';
  });
}

// Busca de cliente enquanto digita o nome
function searchApptClient(q) {
  if (apptLinkedClientId) return;
  const drop = $('apptClientDrop');
  const noClient = $('apptNoClient');
  q = (q || '').trim();
  if (!q) {
    drop.style.display = 'none';
    noClient.style.display = 'none';
    return;
  }

  const matches = clients.filter(c => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  if (matches.length) {
    noClient.style.display = 'none';
    drop.style.display = 'block';
    drop.innerHTML = matches.map(c => {
      const st = stageInfo(c.stage);
      return `
        <div class="client-drop-item" onclick="linkApptClient(${c.id})">
          <div class="avatar avatar-sm ${c.av}">${getIn(c.name)}</div>
          <div class="fill">
            <div class="client-drop-name">${c.name}</div>
            <div class="client-drop-phone">${c.phone}</div>
          </div>
          <span class="stage-pill stage-pill-xs" style="background:${st.bg};color:${st.color}">${st.label}</span>
        </div>`;
    }).join('');
  } else {
    // Nenhum cliente encontrado: oferece criar um lead
    drop.style.display = 'none';
    noClient.style.display = 'block';
    if (!$('leadName').value) $('leadName').value = q;
    noClient.querySelector('button').textContent = '+ Criar lead "' + q + '"';
  }
}

function linkApptClient(id) {
  const c = clients.find(x => x.id === id);
  if (!c) return;
  apptLinkedClientId = id;
  $('mName').value = c.name;
  $('apptClientDrop').style.display = 'none';
  $('apptNoClient').style.display = 'none';

  const av = $('apptClientAv');
  av.textContent = getIn(c.name);
  av.className = 'avatar avatar-sm ' + c.av;
  $('apptClientName').textContent = c.name;
  $('apptClientStage').textContent = stageInfo(c.stage).label + ' · ' + c.phone;
  $('apptClientBadge').style.display = 'flex';
  $('mName').style.display = 'none';
}

function clearApptClient() {
  apptLinkedClientId = null;
  $('apptClientBadge').style.display = 'none';
  $('apptClientDrop').style.display = 'none';
  $('apptNoClient').style.display = 'none';
  const inp = $('mName');
  inp.style.display = '';
  inp.value = '';
  inp.focus();
}

function createLeadFromAppt() {
  const nameInput = $('leadName'), phoneInput = $('leadPhone');
  const nome = nameInput.value.trim();
  const tel = phoneInput.value.trim();
  for (const [input, value] of [[nameInput, nome], [phoneInput, tel]]) {
    if (!value) {
      input.style.borderColor = '#b85050';
      input.focus();
      return;
    }
  }
  nameInput.style.borderColor = '';
  phoneInput.style.borderColor = '';

  const proc = $('mSvc').value;
  const cliente = addOrMergeClient({
    name: nome,
    phone: tel,
    since: 'Agenda',
    stage: 'novo_lead',
    procs: proc && proc !== 'locacao' ? [proc] : [],
    obs: 'Criado via agenda.',
  });

  $('mName').value = cliente.name;
  linkApptClient(cliente.id);
  $('apptNoClient').style.display = 'none';
}

// Ao agendar um procedimento, atualiza a ficha e o estágio do cliente
function registerApptOnClient(c, svcKey, dateKey, obs) {
  if (PROCS_COM_SESSAO.includes(svcKey)) {
    if (!c.procedimentos) c.procedimentos = [];
    const sessao = c.procedimentos.filter(p => p.tipo === svcKey).length + 1;
    c.procedimentos.unshift({ tipo: svcKey, sessao, data: fmtDateBR(dateKey), regiao: '', obs: obs || 'Agendado' });
    c.visits = c.procedimentos.length;
    c.last = fmtDateBR(dateKey);
    if (!c.procs.includes(svcKey)) c.procs.push(svcKey);
    if (c.stage === 'novo_lead' || c.stage === 'nutricao') c.stage = 'cliente_ativo';
  } else if (svcKey === 'avaliacao') {
    c.last = fmtDateBR(dateKey);
    if (c.stage === 'novo_lead') c.stage = 'nutricao';
  }
}

function saveAppt() {
  const linkedC = apptLinkedClientId ? clients.find(x => x.id === apptLinkedClientId) : null;
  const name = linkedC ? linkedC.name : $('mName').value.trim();
  if (!name) {
    alert('Informe o cliente.');
    return;
  }

  const dt = $('mDate').value || agendaSelDate;
  const time = $('mTime').value;
  const svc_key = $('mSvc').value;
  const obs = $('mObs').value.trim();
  const valor = parseFloat($('mVal').value) || 0;
  const fpag = $('mFpag').value || 'pix';
  const svc = SVC_SHORT_LABELS[svc_key] || svc_key;
  const editId = $('apptModal').dataset.editId;
  const editDate = $('apptModal').dataset.editDate;

  // Vincula o procedimento ao cliente (apenas em novos agendamentos)
  if (!editId && linkedC) registerApptOnClient(linkedC, svc_key, dt, obs);

  let savedAppt;
  if (editId) {
    const origArr = getApptDay(editDate);
    const orig = origArr.find(x => String(x.id) === String(editId));
    if (orig) {
      savedAppt = { ...orig, time, svc, svc_key, obs, valor, fpag, name, clientId: apptLinkedClientId || orig.clientId };
      const newStatus = $('mStatus').value || orig.status;
      const moved = dt !== editDate || time !== orig.time;
      if (orig.status === 'done' && newStatus === 'done') {
        // Continua concluído: mudar dia/horário é correção, não reagendamento
        if (!syncConcludedAppt(orig, editDate, savedAppt, dt)) return;
      } else if (orig.status === 'done') {
        // Desconcluir
        if (!undoConclusion(orig, editDate, savedAppt)) return;
        savedAppt.status = newStatus;
      } else if (newStatus === 'done') {
        // Concluir pela edição (ex.: acertar a data do atendimento e já concluir)
        if (!confirm('Concluir o atendimento de ' + name + '?' + conclusionEffects(savedAppt))) return;
        applyConclusion(savedAppt, dt);
      } else {
        savedAppt.status = newStatus;
        if (moved) {
          // Mudou dia ou horário: conta como reagendamento; sem troca manual da situação, volta a Pendente
          savedAppt.reagendamentos = (orig.reagendamentos || 0) + 1;
          if (newStatus === orig.status) savedAppt.status = 'pending';
        }
      }
      setApptDay(editDate, origArr.filter(x => x !== orig));
    }
  } else {
    savedAppt = { id: Date.now(), time, name, svc, svc_key, obs, valor, fpag, status: 'pending', clientId: apptLinkedClientId, reagendamentos: 0 };
  }

  if (savedAppt) {
    setApptDay(dt, [...getApptDay(dt), savedAppt].sort((x, y) => x.time.localeCompare(y.time)));
    sbUpsertAppt(dt, savedAppt);
  }
  // Se o agendamento é para outra data, a agenda passa a exibi-la
  agendaSelDate = dt;
  if (linkedC) sbUpsertCliente(linkedC);

  renderAgenda();
  closeApptModal();
}
