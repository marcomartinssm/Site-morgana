/* ==========================================================================
   Camada de dados — Supabase
   Converte linhas do banco ⇄ objetos usados pela interface.
   ========================================================================== */

let _sb = null;

function getSB() {
  if (!_sb && window.supabase) _sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);
  return _sb;
}

// Executa uma operação de escrita sem interromper a interface em caso de falha
async function sbWrite(label, op) {
  try {
    const sb = getSB();
    if (!sb) return;
    const { error } = await op(sb);
    if (error) console.warn(label + ':', error.message);
  } catch (e) {
    console.warn(label + ':', e.message);
  }
}

// ── Mapeamentos ──
const txFromRow = r => ({
  id: r.id, t: r.tipo, d: r.descricao, cc: r.centro_custo, fp: r.forma_pagto,
  v: parseFloat(r.valor), dt: r.data_br, ic: r.icone || '📋', parc: r.parcelas || 'A vista',
  rec: r.recebido !== false, quit: r.data_quitacao || null,
});
const txToRow = tx => ({
  id: tx.id, tipo: tx.t, descricao: tx.d, centro_custo: tx.cc, forma_pagto: tx.fp,
  valor: tx.v, data_br: tx.dt, icone: tx.ic, parcelas: tx.parc, recebido: tx.rec !== false,
  data_quitacao: tx.quit || null,
});

// Centros de custo e formas de pagamento têm o mesmo formato
const catalogFromRow = r => ({ id: r.id, name: r.nome, color: r.cor, tc: r.cor_texto });
const catalogToRow = c => ({ id: c.id, nome: c.name, cor: c.color, cor_texto: c.tc });

const clienteFromRow = r => ({
  id: r.id, name: r.name, phone: r.phone, bday: r.bday || '—', since: r.since || 'Importado',
  stage: r.stage || 'novo_lead', visits: r.visits || 0, spent: r.spent || 0, last: r.last || '—',
  procs: r.procs || [], obs: r.obs || '', procedimentos: r.procedimentos || [], av: r.av || 'av-rose',
});
const clienteToRow = c => ({
  id: c.id, name: c.name, phone: c.phone, bday: c.bday, since: c.since,
  stage: c.stage, visits: c.visits, spent: c.spent, last: c.last,
  procs: c.procs, obs: c.obs, procedimentos: c.procedimentos || [], av: c.av,
});

const apptFromRow = r => ({
  id: r.id, time: r.time, name: r.name, svc: r.svc, svc_key: r.svc_key || 'avaliacao',
  dur: r.dur || '—', status: r.status || 'pending',
  clientId: r.client_id, obs: r.obs || '',
  valor: parseFloat(r.valor) || 0, fpag: r.fpag || 'pix',
  reagendamentos: r.reagendamentos || 0, txId: r.transacao_id || null,
});
const apptToRow = (dateKey, a) => ({
  id: typeof a.id === 'string' ? parseInt(a.id.replace('a', '')) || Date.now() : a.id,
  date_key: dateKey, time: a.time, name: a.name,
  svc: a.svc, svc_key: a.svc_key || 'avaliacao',
  dur: a.dur || '-', status: a.status,
  client_id: a.clientId || null, obs: a.obs || '',
  valor: a.valor || 0, fpag: a.fpag || 'pix',
  reagendamentos: a.reagendamentos || 0, transacao_id: a.txId || null,
});

// ── Leitura ──
async function sbLoadTransacoes() {
  const { data, error } = await getSB().from('transacoes').select('*').order('data_br', { ascending: true });
  if (error) throw error;
  return data && data.length ? data.map(txFromRow) : null;
}

async function sbLoadCatalog(table) {
  const { data } = await getSB().from(table).select('*');
  return data && data.length ? data.map(catalogFromRow) : null;
}

async function sbLoadConfig(chave) {
  try {
    const { data } = await getSB().from('configuracoes').select('valor').eq('chave', chave).single();
    return data && data.valor ? data.valor : null;
  } catch (e) {
    return null;
  }
}

// Retorna a lista de clientes, ou null se falhar/estiver vazia
async function sbLoadClientes() {
  try {
    const sb = getSB();
    if (!sb) return null;
    // Cadastros duplicados que foram mesclados ficam no banco, mas não aparecem
    const { data, error } = await sb.from('clientes').select('*').is('mesclado_em', null).order('name');
    if (error || !data || !data.length) return null;
    return data.map(clienteFromRow);
  } catch (e) {
    console.warn('sbLoadClientes:', e.message);
    return null;
  }
}

// Retorna agendamentos agrupados por data ({ 'YYYY-MM-DD': [...] }), ou null se falhar
async function sbLoadAppts() {
  try {
    const sb = getSB();
    if (!sb) return null;
    // O Supabase devolve no máximo 1000 linhas por consulta — busca em páginas
    const pageSize = 1000;
    let rows = [];
    for (let page = 0; ; page++) {
      const { data, error } = await sb.from('agendamentos').select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) throw error;
      if (!data || !data.length) break;
      rows = rows.concat(data);
      if (data.length < pageSize) break;
    }
    const byDate = {};
    rows.forEach(r => {
      (byDate[r.date_key] = byDate[r.date_key] || []).push(apptFromRow(r));
    });
    Object.values(byDate).forEach(arr => arr.sort((a, b) => a.time.localeCompare(b.time)));
    return byDate;
  } catch (e) {
    console.warn('sbLoadAppts:', e.message);
    return null;
  }
}

// ── Escrita ──
const sbAddTx = tx => sbWrite('sbAddTx', sb => sb.from('transacoes').insert(txToRow(tx)));
const sbUpdateTxReceipt = tx => sbWrite('sbUpdateTxReceipt', sb => sb.from('transacoes').update({ forma_pagto: tx.fp, recebido: tx.rec, data_quitacao: tx.quit || null }).eq('id', tx.id));
const sbUpdateTx = tx => sbWrite('sbUpdateTx', sb => sb.from('transacoes').update(txToRow(tx)).eq('id', tx.id));
const sbDeleteTx = id => sbWrite('sbDeleteTx', sb => sb.from('transacoes').delete().eq('id', id));
const sbSaveCentros = () => sbWrite('sbSaveCentros', sb => sb.from('centros_custo').upsert(centros.map(catalogToRow)));
const sbSaveFormas = () => sbWrite('sbSaveFormas', sb => sb.from('formas_pagamento').upsert(formasPag.map(catalogToRow)));
const sbUpsertCliente = c => sbWrite('sbUpsertCliente', sb => sb.from('clientes').upsert(clienteToRow(c)));
const sbUpsertAppt = (dateKey, a) => sbWrite('sbUpsertAppt', sb => sb.from('agendamentos').upsert(apptToRow(dateKey, a)));
const sbSaveConfig = (chave, valor) => sbWrite('sbSaveConfig', sb => sb.from('configuracoes').upsert({ chave, valor }));
