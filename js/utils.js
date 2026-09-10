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

// ── Ícones SVG (traço no estilo Lucide) ──
const ICONS = {
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
  settings: '<path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  kanban: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  arrowUpRight: '<path d="M7 17 17 7M7 7h10v10"/>',
  trendingUp: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  trendingDown: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
  banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
};
function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
// Preenche os elementos estáticos marcados com data-icon="nome"
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
}

// ── Indicador de sincronização na barra superior ──
function showSyncStatus(text, hideAfterMs) {
  const el = $('syncStatus');
  if (!el) return;
  el.textContent = text;
  el.style.opacity = '1';
  if (hideAfterMs) setTimeout(() => { el.style.opacity = '0'; }, hideAfterMs);
}
