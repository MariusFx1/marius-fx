/* MS Prime: traduceri pentru textele generate din JavaScript + selectorul de limbă.
   Româna este limba sursă: pe paginile în română T(text) întoarce chiar textul.
   Pe /en/, /es/, /pt/ dicționarul (i18n/<limba>.js) e încărcat înaintea acestui fișier. */
(function () {
  'use strict';
  const LANGS = ['ro', 'en', 'es', 'pt'];
  const lang = LANGS.includes((document.documentElement.lang || 'ro').slice(0, 2)) ? document.documentElement.lang.slice(0, 2) : 'ro';
  const DICT = (window.I18N_DICT && window.I18N_DICT[lang]) || {};
  const LOCALE = { ro: 'ro-RO', en: 'en-US', es: 'es-ES', pt: 'pt-BR' }[lang];
  const has = Object.prototype.hasOwnProperty;
  function T(s, vars) {
    let r = has.call(DICT, s) ? DICT[s] : s;
    if (vars && typeof vars === 'object') r = r.replace(/\{(\w+)\}/g, (m, k) => (has.call(vars, k) ? vars[k] : m));
    return r;
  }
  const NFC = {};
  function NF(opts) {
    const o = Object.assign({}, opts || {});
    if (lang === 'es' && o.useGrouping === undefined) o.useGrouping = 'always';   // 1.234,56 și la 4 cifre
    const k = JSON.stringify(o);
    return NFC[k] || (NFC[k] = new Intl.NumberFormat(LOCALE, o));
  }
  const num = (x, opts) => NF(opts).format(x);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function weekdays() {   // duminică..sâmbătă, cu majusculă
    const f = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', timeZone: 'UTC' });
    return [0, 1, 2, 3, 4, 5, 6].map(i => cap(f.format(new Date(Date.UTC(2023, 0, 1 + i)))));
  }
  window.T = T;
  window.I18N = {
    lang, locale: LOCALE, T, NF, num, weekdays,
    root: lang === 'ro' ? '' : '../',
    csvSep: lang === 'en' ? ',' : ';',
    csvDec: lang === 'en' ? '.' : ','
  };

  // ---------- selectorul de limbă ----------
  const KEY = 'mfx-lang';
  const remember = l => { try { localStorage.setItem(KEY, l); } catch (e) { /* stocare indisponibilă */ } };
  function wire() {
    const sw = document.querySelector('.lang-switch');
    if (sw) {
      const btn = sw.querySelector('.lang-btn'), menu = sw.querySelector('.lang-menu');
      const set = open => { sw.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open)); menu.hidden = !open; };
      btn.addEventListener('click', e => { e.stopPropagation(); set(menu.hidden); });
      document.addEventListener('click', e => { if (!sw.contains(e.target)) set(false); });
      sw.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { set(false); btn.focus(); } });
      menu.querySelectorAll('a[hreflang]').forEach(a => a.addEventListener('click', () => remember(a.getAttribute('hreflang'))));
    }
    // Sugestie discretă (fără redirecționare) doar pe prima pagină în română, la prima vizită.
    const bar = document.getElementById('lang-suggest');
    if (!bar || lang !== 'ro') return;
    let chosen = null;
    try { chosen = localStorage.getItem(KEY); } catch (e) { return; }
    if (chosen) return;
    const pref = (navigator.languages || [navigator.language || '']).map(l => String(l).slice(0, 2).toLowerCase()).find(l => LANGS.includes(l));
    if (!pref || pref === 'ro') return;
    const opt = bar.querySelector('[data-lang="' + pref + '"]');
    if (!opt) return;
    opt.hidden = false;
    bar.hidden = false;
    opt.querySelector('.lang-suggest-go').addEventListener('click', () => remember(pref));
    bar.querySelector('.lang-suggest-close').addEventListener('click', () => { remember('ro'); bar.hidden = true; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
