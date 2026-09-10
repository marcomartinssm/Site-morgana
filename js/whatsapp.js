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
        btn.textContent = '✅';
        btn.style.color = '#2e7d4f';
        setTimeout(() => { btn.textContent = '📲'; btn.style.color = '#25d366'; }, 2000);
      }
    })
    .catch(() => alert('Erro de conexão. Verifique a URL do webhook nas configurações.'));
}
