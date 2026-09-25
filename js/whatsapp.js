/* ==========================================================================
   WhatsApp — envio de confirmação de agendamento via webhook do n8n
   ========================================================================== */

// URL do webhook (tela de Configurações; sincronizada pelo Supabase)
let N8N_WEBHOOK_URL = load('n8n_webhook_url', '');

function postWebhook(url, payload) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
  });
}

// Telefone do cliente vinculado ao agendamento ('' quando não há)
function apptPhone(appt) {
  const c = appt.clientId ? clients.find(x => String(x.id) === String(appt.clientId)) : null;
  const phone = c ? c.phone : (appt.phone || '');
  return phone && phone !== '—' ? phone : '';
}

// Só envia com webhook configurado, telefone conhecido e sem envio anterior
function canSendPosAtendimento(appt) {
  return !!N8N_WEBHOOK_URL && !!apptPhone(appt) && !appt.posEnviadoEm;
}

// Mensagem de pós-atendimento: o n8n recebe na hora e aguarda o atraso antes de enviar
function sendPosAtendimento(appt, dateKey) {
  if (!canSendPosAtendimento(appt)) return;

  postWebhook(N8N_WEBHOOK_URL, {
    event: 'whatsapp_pos_atendimento',
    apptId: appt.id,
    clientName: appt.name,
    phone: apptPhone(appt),
    service: appt.svc,
    date: fmtDateBR(dateKey),
    time: appt.time,
    delayMinutes: POS_ATENDIMENTO_DELAY_MIN,
    sendAt: new Date(Date.now() + POS_ATENDIMENTO_DELAY_MIN * 60000).toISOString(),
    message: MSG_POS_ATENDIMENTO.replace('{nome}', firstName(appt.name)),
  })
    .then(r => {
      if (!r.ok) throw new Error('webhook respondeu ' + r.status);
      appt.posEnviadoEm = new Date().toISOString();
      sbUpsertAppt(dateKey, appt);
      if (curPage === 'agenda') renderTimeline();
      showSyncStatus('✓ Pós-atendimento programado', 3000);
    })
    .catch(e => {
      console.warn('sendPosAtendimento:', e.message);
      showSyncStatus('⚠ Falha ao programar o pós-atendimento', 4000);
    });
}

function sendWppFromAgenda(apptId, dateKey) {
  if (!N8N_WEBHOOK_URL) {
    alert('Webhook não configurado.\nVá em ⚙ Config → cole a URL do webhook → Salvar.');
    return;
  }
  const arr = getApptDay(dateKey);
  const a = arr.find(x => String(x.id) === String(apptId));
  if (!a) {
    alert('Agendamento não encontrado.');
    return;
  }

  const client = a.clientId ? clients.find(x => String(x.id) === String(a.clientId)) : null;
  const phone = client ? client.phone : (a.phone || '');
  if (!phone || phone === '—') {
    alert('Cliente sem telefone cadastrado.\nAdicione o telefone na ficha do CRM.');
    return;
  }

  const dateBR = fmtDateBR(dateKey);
  const dateLabel = dateKey === fmtDateKey(new Date()) ? 'hoje' : dateBR;
  const message = 'Olá ' + firstName(a.name) + '! 😊 Confirmando seu agendamento de *' + a.svc + '* ' + dateLabel + ' às *' + a.time + '*. Confirma sua presença?';

  postWebhook(N8N_WEBHOOK_URL, {
    event: 'whatsapp_confirmation',
    apptId: a.id,
    clientName: a.name,
    phone,
    service: a.svc,
    date: dateBR,
    time: a.time,
    message,
  })
    .then(r => {
      if (!r.ok) {
        alert('Erro ao enviar. Verifique se o webhook está ativo no n8n.');
        return;
      }
      // Marca como enviado e atualiza na nuvem
      a.confirmationSent = true;
      if (a.status === 'pending') a.status = 'sent';
      setApptDay(dateKey, arr);
      sbUpsertAppt(dateKey, a);
      renderTimeline();

      // Feedback visual rápido no botão
      const btn = document.querySelector(`[data-wpp="${apptId}"]`);
      if (btn) {
        btn.innerHTML = icon('check');
        btn.style.color = '#2f7d53';
        setTimeout(() => { btn.innerHTML = icon('send'); btn.style.color = ''; }, 2000);
      }
    })
    .catch(() => alert('Erro de conexão. Verifique a URL do webhook nas configurações.'));
}
