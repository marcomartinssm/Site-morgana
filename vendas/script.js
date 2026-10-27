/* ==========================================================================
   Página de vendas — comportamento (acordeão, entrada suave, WhatsApp)
   ========================================================================== */

// Número do WhatsApp e mensagem que já chega escrita para a cliente
const WHATSAPP = '5548998061234';
const MSG = 'Oi, Morgana! Vim pelo site e quero fazer a avaliação da minha remoção.';
const linkWpp = () => 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(MSG);

['ctaWpp', 'stickyWpp', 'footWpp'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.href = linkWpp();
    el.target = '_blank';
    el.rel = 'noopener';
  }
});

// Perguntas: abre uma e fecha as outras
document.querySelectorAll('.q-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const q = btn.parentElement;
    const abrindo = !q.classList.contains('open');
    document.querySelectorAll('.q').forEach(o => o.classList.remove('open'));
    if (abrindo) q.classList.add('open');
  });
});

// Entrada suave das seções conforme a rolagem
const obs = new IntersectionObserver(entradas => {
  entradas.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('vis');
      obs.unobserve(e.target);
    }
  });
}, { rootMargin: '0px 0px -12% 0px' });

document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

// Alterna entre o rascunho comentado e a página como a cliente vai ver
const toggle = document.getElementById('revToggle');
toggle.addEventListener('click', () => {
  const limpo = document.body.classList.toggle('limpo');
  toggle.textContent = limpo ? 'Revisão: ver o que falta' : 'Revisão: mostrando o que falta';
});

document.getElementById('ano').textContent = new Date().getFullYear();
