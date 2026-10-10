/* Glosar (glosar.html): căutare live (fără diacritice obligatorii) + literele A-Z care nu au rezultate devin inactive. */
(function () {
  'use strict';
  const q = document.getElementById('gl-q');
  if (!q) return;
  const tools = document.getElementById('gl-tools');
  const count = document.getElementById('gl-count');
  const empty = document.getElementById('gl-empty');
  const groups = [...document.querySelectorAll('.gl-group')];
  const terms = [...document.querySelectorAll('.gl-term')];
  const az = [...document.querySelectorAll('.gl-az a[data-l]')];
  const total = terms.length;
  const fold = s => s.replace(/\u015F/g, '\u0219').replace(/\u0163/g, '\u021B').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const termeni = n => n === 1 ? T('1 termen') : (n < 20 ? T('{n} termeni', { n }) : T('{n} de termeni', { n }));

  function apply() {
    const words = fold(q.value.trim()).split(/\s+/).filter(Boolean);
    let shown = 0;
    terms.forEach(t => {
      const ok = words.every(w => t.dataset.s.includes(w));
      t.hidden = !ok;
      if (ok) shown++;
    });
    groups.forEach(g => {
      const any = g.querySelector('.gl-term:not([hidden])');
      g.hidden = !any;
      const a = az.find(x => x.dataset.l === g.id.slice(-1).toUpperCase());
      if (a) { a.classList.toggle('is-off', !any); if (any) a.removeAttribute('aria-disabled'); else a.setAttribute('aria-disabled', 'true'); }
    });
    empty.hidden = shown > 0;
    count.textContent = words.length ? (shown ? (shown === 1 ? T('{x} găsit din {t}', { x: termeni(shown), t: total }) : T('{x} găsiți din {t}', { x: termeni(shown), t: total })) : T('Niciun rezultat')) : termeni(total);
  }
  az.forEach(a => a.addEventListener('click', e => { if (a.getAttribute('aria-disabled') === 'true') e.preventDefault(); }));
  q.addEventListener('input', apply);
  q.addEventListener('keydown', e => { if (e.key === 'Escape' && q.value) { q.value = ''; apply(); } });
  tools.hidden = false;
  // ?q=termen în adresă: căutare directă
  const pre = new URLSearchParams(location.search).get('q');
  if (pre) { q.value = pre; }
  apply();
})();
