/* ==========================================================================
   Configurações — integrações (webhook do n8n)
   ========================================================================== */

function loadConfigForm() {
  $('cfgN8nUrl').value = N8N_WEBHOOK_URL || '';
}

async function saveConfig() {
  const url = $('cfgN8nUrl').value.trim();
  N8N_WEBHOOK_URL = url;
  save('n8n_webhook_url', url);
  await sbSaveConfig('n8n_webhook_url', url);   // sincroniza entre dispositivos
  alert('Configurações salvas!');
}

function testWebhook() {
  const url = $('cfgN8nUrl').value.trim();
  if (!url) {
    alert('Preencha a URL do webhook primeiro.');
    return;
  }
  postWebhook(url, { event: 'test', message: 'Teste de conexão do sistema Morgana' })
    .then(() => alert('Webhook testado com sucesso! Verifique seu n8n.'))
    .catch(err => alert('Erro ao testar webhook: ' + err.message));
}
