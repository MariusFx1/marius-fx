// ===== Lecție pentru începători: progres capitole (doar în browser), cuprins activ, bară de citire, checklist =====
(function () {
  'use strict';
  const KEY = 'mariusfx-lectie-v1';
  const TOTAL = 9;
  const chapters = Array.from(document.querySelectorAll('.lc-chapter[data-ch]'));
  if (!chapters.length) return;

  // --- progres salvat local (fără server) ---
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      return new Set(Array.isArray(raw) ? raw.map(Number).filter(n => n >= 1 && n <= TOTAL) : []);
    } catch (e) { return new Set(); }
  }
  function save(set) {
    try { localStorage.setItem(KEY, JSON.stringify(Array.from(set).sort((a, b) => a - b))); } catch (e) { /* stocare indisponibilă */ }
  }
  let done = load();

  const countEl = document.getElementById('lc-done-count');
  const fillEl = document.getElementById('lc-progress-fill');
  const barEl = document.getElementById('lc-progress-bar');
  const startEl = document.getElementById('lc-start');
  const tocLinks = Array.from(document.querySelectorAll('.lc-toc a[data-ch]'));
  const doneBtns = Array.from(document.querySelectorAll('.lc-done-btn[data-done]'));

  function render() {
    const n = done.size;
    if (countEl) countEl.textContent = String(n);
    if (fillEl) fillEl.style.width = (n / TOTAL * 100) + '%';
    if (barEl) barEl.setAttribute('aria-valuenow', String(n));
    tocLinks.forEach(a => a.classList.toggle('is-done', done.has(Number(a.dataset.ch))));
    doneBtns.forEach(b => {
      const on = done.has(Number(b.dataset.done));
      b.classList.toggle('is-done', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.querySelector('.lc-done-label').textContent = on ? 'Capitol parcurs' : 'Am parcurs capitolul';
    });
    if (startEl) {
      let next = 1;
      while (next <= TOTAL && done.has(next)) next++;
      if (n === 0) { startEl.textContent = 'Începe cu capitolul 1'; startEl.href = '#cap-1'; }
      else if (next > TOTAL) { startEl.textContent = 'Ai parcurs tot cursul. Recapitulează'; startEl.href = '#cap-1'; }
      else { startEl.textContent = 'Continuă cu capitolul ' + next; startEl.href = '#cap-' + next; }
    }
  }
  doneBtns.forEach(b => {
    b.hidden = false;
    b.addEventListener('click', () => {
      const ch = Number(b.dataset.done);
      if (done.has(ch)) done.delete(ch); else done.add(ch);
      save(done); render();
    });
  });
  render();

  // --- capitolul curent în cuprins ---
  function setActive(ch) {
    tocLinks.forEach(a => {
      const on = a.dataset.ch === String(ch);
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
  }
  function updateActive() {
    const line = window.innerHeight * 0.3;
    let current = null;
    for (const s of chapters) {
      if (s.getBoundingClientRect().top <= line) current = s.dataset.ch;
    }
    setActive(current);
  }

  // --- bara de citire ---
  const readbar = document.getElementById('lc-readbar');
  const article = document.querySelector('.lc-article');
  function updateReadbar() {
    if (!readbar || !article) return;
    const r = article.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    readbar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  }
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { updateActive(); updateReadbar(); ticking = false; });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  // --- lista de verificare (nu se salvează) ---
  const list = document.getElementById('lc-checklist');
  const status = document.getElementById('lc-check-status');
  if (list && status) {
    const boxes = Array.from(list.querySelectorAll('input[type="checkbox"]'));
    const upd = () => {
      const c = boxes.filter(b => b.checked).length;
      const all = c === boxes.length;
      list.classList.toggle('is-complete', all);
      status.textContent = all
        ? 'Toate cele ' + boxes.length + ' puncte sunt bifate. Tranzacția respectă procesul tău (nu înseamnă că va fi câștigătoare).'
        : c + ' din ' + boxes.length + ' bifate. Dacă un punct lipsește, nu intri.';
    };
    boxes.forEach(b => b.addEventListener('change', upd));
  }
})();
