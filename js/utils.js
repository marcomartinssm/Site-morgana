/* ==========================================================================
   Utilitários: DOM, armazenamento local, datas e formatação
   ========================================================================== */

const $ = id => document.getElementById(id);

// ── localStorage (prefixo "mp_") ──
function save(key, val) {
  try { localStorage.setItem('mp_' + key, JSON.stringify(val)); } catch (e) {}
}
function load(key, def) {
  try {
    const v = localStorage.getItem('mp_' + key);
    return v ? JSON.parse(v) : def;
  } catch (e) {
    return def;
  }
}

// ── Datas ──
// Chave de data no formato YYYY-MM-DD
function fmtDateKey(d) {
  return d.toISOString().split('T')[0];
}
// YYYY-MM-DD → DD/MM/YYYY
function fmtDateBR(iso) {
  const [y, m, d] = iso.split('-');
  return d + '/' + m + '/' + y;
}
// DD/MM/YYYY (ou DD/MM, assumindo ANO_BASE) → Date
function parseDt(dt) {
  if (!dt || dt === 'hoje') return new Date();
  const p = dt.split('/');
  if (p.length === 2) return new Date(ANO_BASE, parseInt(p[1]) - 1, parseInt(p[0]));
  if (p.length === 3) return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
  return new Date();
}

// ── Formatação ──
function fmtMoney(v) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// Iniciais para o avatar ("Maria Silva" → "MS")
function getIn(name) {
  return name.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase();
}
function firstName(name) {
  return name.split(' ')[0];
}
// Cor de texto legível sobre um fundo hexadecimal
function textColorFor(hex) {
  const lum = parseInt(hex.slice(1, 3), 16) * .299 + parseInt(hex.slice(3, 5), 16) * .587 + parseInt(hex.slice(5, 7), 16) * .114;
  return lum > 150 ? '#2d2020' : '#fff';
}
function stageInfo(id) {
  return STAGES.find(s => s.id === id) || { label: id, color: '#888', bg: '#f5f5f5' };
}

// ── Indicador de sincronização na barra superior ──
function showSyncStatus(text, hideAfterMs) {
  const el = $('syncStatus');
  if (!el) return;
  el.textContent = text;
  el.style.opacity = '1';
  if (hideAfterMs) setTimeout(() => { el.style.opacity = '0'; }, hideAfterMs);
}
