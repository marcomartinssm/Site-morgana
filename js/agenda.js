/* ==========================================================================
   Agenda — calendário, linha do tempo do dia, próximos agendamentos
   e modal de novo agendamento / edição
   ========================================================================== */

const today = new Date();
let viewDate = new Date(today);               // mês exibido no calendário
let agendaSelDate = fmtDateKey(new Date());   // dia selecionado (YYYY-MM-DD)
let apptsByDate = {};                         // { 'YYYY-MM-DD': [agendamentos] } — vem do Supabase
let apptLinkedClientId = null;                // cliente vinculado no modal

const STATUS_BADGE = { confirmed: 'badge-confirmed', pending: 'badge-pending', cancelled: 'badge-canceled' };
const STATUS_LABEL = { confirmed: 'Confirmado', pending: 'Pendente', cancelled: 'Cancelado' };
const STATUS_DOT = { confirmed: '#7cbf8e', pending: '#c9a96e' };

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
        Nenhum agendamento para este dia.<br>
        <span>Clique em + Novo agendamento para adicionar.</span>
      </div>`;
    $('tlTotal').textContent = '0';
    $('tlConf').textContent = '0';
    return;
  }

  const sorted = [...dayAppts].sort((a, b) => a.time.localeCompare(b.time));
  const previsto = sorted.filter(a => a.status !== 'cancelled').reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);
  $('tlTotal').textContent = sorted.length;
  $('tlConf').textContent = sorted.filter(a => a.status === 'confirmed').length;
  $('tlPrev').textContent = 'R$' + previsto.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  $('tlBody').innerHTML = sorted.map(renderApptRow).join('');
}

function renderApptRow(a) {
  const linked = a.clientId ? clients.find(x => x.id === a.clientId) : null;
  const isCancelled = a.status === 'cancelled';

  const clientChip = linked
    ? `<span class="appt-client-chip" onclick="openClientFicha(${linked.id})" title="Ver ficha">↗ ${firstName(linked.name)}</span>`
    : '';
  const actions = isCancelled ? '' : `
    <button class="appt-btn appt-btn-edit" onclick="editAppt('${a.id}')" title="Editar">✎</button>
    <button class="appt-btn appt-btn-confirm" onclick="setApptStatus('${a.id}','confirmed')" title="Confirmar">✓</button>
    <button class="appt-btn appt-btn-wpp" data-wpp="${a.id}" onclick="sendWppFromAgenda('${a.id}','${agendaSelDate}')" title="Enviar confirmação WhatsApp">📲</button>
    <button class="appt-btn appt-btn-cancel" onclick="setApptStatus('${a.id}','cancelled')" title="Cancelar">✕</button>`;
  const valor = a.valor
    ? `<span class="appt-valor">R$${parseFloat(a.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>`
    : '';

  return `
    <div class="tl-row${isCancelled ? ' is-cancelled' : ''}">
      <div class="tl-time">${a.time}</div>
      <div class="tl-slot">
        <div class="appt-card ${isCancelled ? 'pending is-cancelled' : a.status}">
          <div class="appt-top">
            <div class="appt-name">${a.name}${clientChip}</div>
            <div class="appt-actions">
              <span class="badge ${STATUS_BADGE[a.status] || 'badge-pending'}">${STATUS_LABEL[a.status] || a.status}</span>
              ${actions}
            </div>
          </div>
          <div class="appt-svc">${a.svc}${a.obs ? ' · ' + a.obs : ''}${valor}</div>
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
  $('upList').innerHTML = future.slice(0, 6).map(a => `
    <div class="up-item" onclick="selectAgendaDate('${a.date}')">
      <div class="up-dot" style="background:${STATUS_DOT[a.status] || '#c9a96e'}"></div>
      <div class="fill">
        <div class="up-name">${firstName(a.name)}</div>
        <div class="up-meta">${fmtDateBR(a.date)} ${a.time} · ${a.svc.split(' ')[0]}</div>
      </div>
    </div>`).join('');
}

// ── Modal de agendamento ──
function openNewApptModal() {
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
  if (a.clientId) {
    linkApptClient(a.clientId);
  } else {
    $('mName').value = a.name;
    $('mName').style.display = '';
  }
  $('apptModal').dataset.editId = id;
  $('apptModal').classList.add('open');
}

function closeApptModal() {
  $('apptModal').classList.remove('open');
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
  const novo = newClient({
    name: nome,
    phone: tel,
    since: 'Agenda',
    stage: 'novo_lead',
    procs: proc && proc !== 'locacao' ? [proc] : [],
    obs: 'Criado via agenda.',
  });
  addClient(novo);

  $('mName').value = nome;
  linkApptClient(novo.id);
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

  // Vincula o procedimento ao cliente (apenas em novos agendamentos)
  if (!editId && linkedC) registerApptOnClient(linkedC, svc_key, dt, obs);

  const arr = getApptDay(dt);
  let savedAppt;
  if (editId) {
    const idx = arr.findIndex(x => String(x.id) === String(editId));
    if (idx >= 0) {
      arr[idx] = { ...arr[idx], time, svc, svc_key, obs, valor, fpag, name, clientId: apptLinkedClientId || arr[idx].clientId };
      savedAppt = arr[idx];
    }
    delete $('apptModal').dataset.editId;
  } else {
    savedAppt = { id: Date.now(), time, name, svc, svc_key, obs, valor, fpag, status: 'pending', clientId: apptLinkedClientId };
    arr.push(savedAppt);
  }

  // Se o agendamento é para outra data, a agenda passa a exibi-la
  agendaSelDate = dt;
  setApptDay(dt, arr);
  if (savedAppt) sbUpsertAppt(dt, savedAppt);
  if (linkedC) sbUpsertCliente(linkedC);

  renderAgenda();
  closeApptModal();
}
