/* ============================================================
   Marius FX — Jurnal de tranzacționare în browser
   Datele se salvează DOAR în localStorage-ul vizitatorului.
   Nimic nu este trimis pe server; nu există cont sau sincronizare.
   ============================================================ */
(() => {
  'use strict';
  const form = document.getElementById('jt-form');
  if (!form) return;

  const STORAGE_KEY = 'mariusfx-jurnal-v1';
  const $ = id => document.getElementById(id);
  const PAIR_SELECT = $('jt-pereche');
  const KNOWN_PAIRS = new Set([...PAIR_SELECT.options].map(o => o.value).filter(v => v && v !== '__alta'));
  const RESULTS = ['TP', 'SL', 'BE', 'Manual'];
  const SESSIONS = ['Sydney', 'Tokyo', 'Londra', 'New York'];

  // ---------- stocare ----------
  let storageOk = true;
  let memory = [];
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data.map(sanitize).filter(Boolean) : [];
    } catch (e) {
      storageOk = false;
      return memory;
    }
  }
  function save(trades) {
    memory = trades;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
      storageOk = true;
    } catch (e) {
      storageOk = false;
    }
    $('jt-storage-error').hidden = storageOk;
  }

  // ---------- utilitare ----------
  /** Numere cu punct sau virgulă: „1,08500”, „1.085”, „2,350.50”, „-0,5”. */
  function num(raw) {
    if (raw == null) return null;
    let s = String(raw).trim().replace(/\s/g, '').replace(/^\+/, '').replace(/[−–]/g, '-');
    if (!s) return null;
    const c = s.lastIndexOf(','), d = s.lastIndexOf('.');
    if (c > -1 && d > -1) s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (c > -1) s = (s.match(/,/g).length === 1) ? s.replace(',', '.') : s.replace(/,/g, '');
    else if (d > -1 && s.match(/\./g).length > 1) s = s.replace(/\./g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const finite = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const round2 = n => Math.round(n * 100) / 100;
  const fmtR = n => (n == null ? '—' : (n > 0 ? '+' : n < 0 ? '−' : '') + I18N.num(Math.abs(round2(n)), { maximumFractionDigits: 2 }) + 'R');
  const fmtNum = n => (n == null ? '' : String(n));
  /** Prețuri afișate cu zecimalele obișnuite ale perechii (1.08500, 191.500, 2350.50). */
  function priceDecimals(pair, v) {
    if (/JPY/.test(pair)) return 3;
    if (/^XA[UG]/.test(pair)) return 2;
    if (/^(US30|NAS100|US500|GER40|UK100)$/.test(pair)) return 1;
    return Math.abs(v) < 50 ? 5 : 2;
  }
  const fmtPrice = (pair, v) => {
    if (v == null) return '';
    const d = priceDecimals(pair, v);
    const own = (String(v).split('.')[1] || '').length;   // nu tăia zecimale scrise de utilizator
    return v.toFixed(Math.max(d, Math.min(own, 8)));
  };
  const fmtDate = iso => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? (I18N.lang === 'ro' ? iso.split('-').reverse().join('.') : new Date(iso + 'T12:00:00').toLocaleDateString(I18N.locale, { day: '2-digit', month: '2-digit', year: 'numeric' })) : iso || '—');
  const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

  function plannedRR(t) {
    if (t.intrare == null || t.sl == null || t.tp == null) return null;
    const risk = Math.abs(t.intrare - t.sl);
    if (!risk) return null;
    return round2(Math.abs(t.tp - t.intrare) / risk);
  }
  /** Tranzacțiile în desfășurare (fără rezultat) nu au încă un rezultat în R.
      R-ul eventual salvat pentru ele (date vechi) e ignorat la afișare, statistici și export,
      dar nu e șters din localStorage. */
  const isOpen = t => !t.rezultat;
  const resultR = t => (isOpen(t) ? null : t.r);
  function autoR(rezultat, rr) {
    if (rezultat === 'TP') return rr;
    if (rezultat === 'SL') return -1;
    if (rezultat === 'BE') return 0;
    return null;
  }

  /** Curăță o tranzacție (din storage sau din backup importat). */
  function sanitize(o) {
    if (!o || typeof o !== 'object') return null;
    const data = str(o.data, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
    const pereche = str(o.pereche, 20).toUpperCase();
    if (!pereche) return null;
    const n = v => { const x = typeof v === 'string' ? num(v) : v; return finite(x); };
    return {
      id: str(o.id, 60) || uid(),
      data, pereche,
      directie: ['Buy', 'Sell'].includes(o.directie) ? o.directie : '',
      sesiune: SESSIONS.includes(o.sesiune) ? o.sesiune : '',
      setup: str(o.setup, 600),
      intrare: n(o.intrare), sl: n(o.sl), tp: n(o.tp),
      lot: n(o.lot), riscPct: n(o.riscPct), riscBani: n(o.riscBani),
      rezultat: RESULTS.includes(o.rezultat) ? o.rezultat : '',
      r: n(o.r),
      plan: ['Da', 'Nu'].includes(o.plan) ? o.plan : '',
      emotii: str(o.emotii, 200),
      lectie: str(o.lectie, 600),
      creat: str(o.creat, 30) || new Date().toISOString(),
      modificat: str(o.modificat, 30) || '',
      sursa: o.sursa === 'simulator' ? 'simulator' : ''
    };
  }

  const sortTrades = list => [...list].sort((a, b) => (b.data.localeCompare(a.data)) || (b.creat.localeCompare(a.creat)));

  function computeStats(list) {
    const withR = list.filter(t => resultR(t) != null);
    const wins = withR.filter(t => t.r > 0).length;
    const losses = withR.filter(t => t.r < 0).length;
    const totalR = round2(withR.reduce((s, t) => s + t.r, 0));
    const da = list.filter(t => t.plan === 'Da').length;
    const answered = da + list.filter(t => t.plan === 'Nu').length;
    return {
      total: list.length, castigate: wins, pierdute: losses,
      rata: withR.length ? wins / withR.length : null,
      totalR, rMediu: withR.length ? totalR / withR.length : null,
      plan: answered ? da / answered : null,
      deschise: list.filter(isOpen).length
    };
  }
  const pct = v => (v == null ? '—' : I18N.num(Math.round(v * 1000) / 10) + '%');

  // ---------- stare ----------
  let trades = load();
  let editingId = null;
  $('jt-storage-error').hidden = storageOk;

  // ---------- formular ----------
  const F = {
    data: $('jt-data'), pereche: PAIR_SELECT, alta: $('jt-pereche-alta'), altaWrap: $('jt-pereche-alta-wrap'),
    sesiune: $('jt-sesiune'), intrare: $('jt-intrare'), sl: $('jt-sl'), tp: $('jt-tp'), rezultat: $('jt-rezultat'),
    r: $('jt-r'), setup: $('jt-setup'), lot: $('jt-lot'), risc: $('jt-risc'), riscBani: $('jt-risc-bani'),
    emotii: $('jt-emotii'), lectie: $('jt-lectie'), rr: $('jt-rr'), err: $('jt-form-error'),
    submit: $('jt-submit'), cancel: $('jt-cancel'), title: $('jt-form-title'), editing: $('jt-editing'), more: $('jt-more')
  };
  const radio = name => form.querySelector(`input[name="${name}"]:checked`);
  const setRadio = (name, val) => form.querySelectorAll(`input[name="${name}"]`).forEach(i => { i.checked = i.value === val; });
  let rManual = false;   // utilizatorul a scris singur Rezultatul în R

  function formPrices() {
    return { intrare: num(F.intrare.value), sl: num(F.sl.value), tp: num(F.tp.value) };
  }
  function updateRR() {
    const p = formPrices();
    const ok = [p.intrare, p.sl, p.tp].every(v => v != null && !Number.isNaN(v));
    const rr = ok ? plannedRR(p) : null;
    let warn = '';
    const dir = radio('directie')?.value;
    if (ok && dir === 'Buy' && !(p.sl < p.intrare && p.tp > p.intrare)) warn = T('La Buy, SL e sub intrare și TP deasupra.');
    if (ok && dir === 'Sell' && !(p.sl > p.intrare && p.tp < p.intrare)) warn = T('La Sell, SL e deasupra intrării și TP sub.');
    F.rr.innerHTML = T('R:R planificat:') + ' <b>' + (rr != null ? '1:' + I18N.num(rr) : '—') + '</b>' +
      (warn ? ' <span class="jt-rr-warn">· ' + warn + '</span>' : '');
    const open = !F.rezultat.value;
    if (open) { rManual = false; F.r.value = ''; }
    else if (!rManual) {
      const a = autoR(F.rezultat.value, rr);
      F.r.value = a == null ? '' : String(a).replace('.', ',');
    }
    F.r.disabled = open;
    F.r.placeholder = open ? T('se completează la închidere') : F.rezultat.value === 'Manual' ? T('scrie tu, ex.: 0,6') : T('ex.: 2 sau -1');
  }
  ['input', 'change'].forEach(ev => {
    [F.intrare, F.sl, F.tp].forEach(el => el.addEventListener(ev, updateRR));
  });
  form.querySelectorAll('input[name="directie"]').forEach(i => i.addEventListener('change', updateRR));
  F.rezultat.addEventListener('change', () => {
    rManual = false;
    updateRR();
    if (F.rezultat.value === 'Manual') F.r.focus();
  });
  F.r.addEventListener('input', () => { rManual = F.r.value.trim() !== ''; });
  F.pereche.addEventListener('change', () => {
    const other = F.pereche.value === '__alta';
    F.altaWrap.hidden = !other;
    if (other) F.alta.focus();
  });

  function resetForm() {
    form.reset();
    editingId = null;
    rManual = false;
    F.data.value = todayISO();
    F.altaWrap.hidden = true;
    F.err.hidden = true;
    F.title.textContent = T('Adaugă o tranzacție');
    F.submit.textContent = T('Salvează tranzacția');
    F.cancel.hidden = true;
    F.editing.hidden = true;
    form.classList.remove('is-editing');
    updateRR();
  }

  function fillForm(t) {
    resetForm();
    editingId = t.id;
    F.data.value = t.data;
    if (KNOWN_PAIRS.has(t.pereche)) F.pereche.value = t.pereche;
    else { F.pereche.value = '__alta'; F.altaWrap.hidden = false; F.alta.value = t.pereche; }
    setRadio('directie', t.directie);
    F.sesiune.value = t.sesiune;
    F.intrare.value = fmtPrice(t.pereche, t.intrare); F.sl.value = fmtPrice(t.pereche, t.sl); F.tp.value = fmtPrice(t.pereche, t.tp);
    F.rezultat.value = t.rezultat;
    const auto = autoR(t.rezultat, plannedRR(t));
    const r = resultR(t);
    rManual = r != null && r !== auto;
    F.r.value = r == null ? '' : String(r).replace('.', ',');
    setRadio('plan', t.plan);
    F.setup.value = t.setup; F.lot.value = fmtNum(t.lot); F.risc.value = fmtNum(t.riscPct);
    F.riscBani.value = fmtNum(t.riscBani); F.emotii.value = t.emotii; F.lectie.value = t.lectie;
    if (t.setup || t.lot != null || t.riscPct != null || t.riscBani != null || t.emotii || t.lectie) F.more.open = true;
    F.title.textContent = T('Editează tranzacția');
    F.submit.textContent = T('Salvează modificările');
    F.cancel.hidden = false;
    F.editing.hidden = false;
    F.editing.textContent = fmtDate(t.data) + ' · ' + t.pereche;
    form.classList.add('is-editing');
    updateRR();
  }

  function readForm() {
    const errors = [];
    const data = F.data.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) errors.push('data');
    let pereche = F.pereche.value === '__alta' ? F.alta.value.trim().toUpperCase() : F.pereche.value;
    if (!pereche) errors.push('perechea');
    const directie = radio('directie')?.value || '';
    if (!directie) errors.push(T('direcția (Buy/Sell)'));
    const fields = { intrare: F.intrare, sl: F.sl, tp: F.tp, lot: F.lot, riscPct: F.risc, riscBani: F.riscBani, r: F.r };
    const labels = { intrare: T('Intrare'), sl: 'Stop loss', tp: 'Take profit', lot: T('Lot'), riscPct: T('Risc %'), riscBani: T('Risc în bani'), r: T('Rezultat în R') };
    const nums = {};
    for (const [k, el] of Object.entries(fields)) {
      const v = num(el.value);
      if (Number.isNaN(v)) errors.push(labels[k] + ' ' + T('(număr)'));
      nums[k] = Number.isNaN(v) ? null : v;
    }
    if (nums.riscPct != null && (nums.riscPct < 0 || nums.riscPct > 100)) errors.push(T('Risc % (între 0 și 100)'));
    if (errors.length) return { errors };
    if (!F.rezultat.value) nums.r = null;   // în desfășurare: fără rezultat în R
    const prev = editingId ? trades.find(t => t.id === editingId) : null;
    return {
      trade: sanitize({
        id: editingId || uid(), data, pereche, directie, sesiune: F.sesiune.value,
        setup: F.setup.value, ...nums, rezultat: F.rezultat.value, plan: radio('plan')?.value || '',
        emotii: F.emotii.value, lectie: F.lectie.value,
        creat: prev ? prev.creat : new Date().toISOString(), modificat: prev ? new Date().toISOString() : '', sursa: prev ? prev.sursa : ''
      })
    };
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const { trade, errors } = readForm();
    if (errors) {
      F.err.textContent = T('Completează sau corectează: {x}.', { x: errors.join(', ') });
      F.err.hidden = false;
      return;
    }
    const wasEditing = !!editingId;
    if (wasEditing) trades = trades.map(t => (t.id === trade.id ? trade : t));
    else trades.push(trade);
    save(trades);
    resetForm();
    render(trade.id);
    status(wasEditing ? T('Modificările au fost salvate.') : T('Tranzacția a fost salvată în jurnalul tău.'));
  });
  F.cancel.addEventListener('click', () => { resetForm(); status(T('Editarea a fost anulată.')); });

  // ---------- listă + statistici ----------
  const list = $('jt-list');
  function render(highlightId) {
    const sorted = sortTrades(trades);
    const s = computeStats(trades);
    const set = (k, v) => { document.querySelector(`[data-stat="${k}"]`).textContent = v; };
    set('total', s.total); set('castigate', s.castigate); set('pierdute', s.pierdute);
    set('rata', pct(s.rata)); set('totalR', fmtR(s.totalR)); set('rMediu', s.rMediu == null ? '—' : fmtR(s.rMediu));
    set('plan', pct(s.plan));
    const openEl = document.querySelector('[data-stat="deschise"]');
    openEl.textContent = s.deschise ? T('{n} în desfășurare', { n: s.deschise }) : '';
    openEl.hidden = !s.deschise;
    const totalEl = document.querySelector('[data-stat="totalR"]');
    totalEl.classList.toggle('pos', s.totalR > 0); totalEl.classList.toggle('neg', s.totalR < 0);
    $('jt-count').textContent = s.total ? (s.total === 1 ? T('1 tranzacție') : T('{n} tranzacții', { n: s.total })) + (s.deschise ? ' · ' + T('{n} în desfășurare', { n: s.deschise }) : '') : '';
    $('jt-empty').hidden = s.total > 0;
    ['jt-export-xlsx', 'jt-export-json', 'jt-clear'].forEach(id => { $(id).disabled = s.total === 0; });

    list.innerHTML = sorted.map(t => {
      const rr = plannedRR(t);
      const r = resultR(t);
      const resClass = t.rezultat ? 'res-' + t.rezultat.toLowerCase() : 'res-open';
      const rClass = r == null ? '' : r > 0 ? 'pos' : r < 0 ? 'neg' : '';
      const meta = [
        t.intrare != null ? T('Intrare') + ' <b>' + esc(fmtPrice(t.pereche, t.intrare)) + '</b>' : '',
        t.sl != null ? 'SL <b>' + esc(fmtPrice(t.pereche, t.sl)) + '</b>' : '',
        t.tp != null ? 'TP <b>' + esc(fmtPrice(t.pereche, t.tp)) + '</b>' : '',
        rr != null ? 'R:R <b>1:' + esc(I18N.num(rr)) + '</b>' : '',
        t.lot != null ? T('Lot') + ' <b>' + esc(t.lot) + '</b>' : '',
        t.riscPct != null ? T('Risc') + ' <b>' + esc(I18N.num(t.riscPct)) + '%</b>' : '',
        t.riscBani != null ? T('Risc în bani') + ' <b>' + esc(I18N.num(t.riscBani)) + '</b>' : ''
      ].filter(Boolean).map(x => '<span>' + x + '</span>').join('');
      const notes = [['Setup', t.setup], [T('Emoții'), t.emotii], [T('Lecție'), t.lectie]]
        .filter(([, v]) => v).map(([k, v]) => '<p><b>' + k + ':</b> ' + esc(v) + '</p>').join('');
      return `<li class="jt-item${t.id === highlightId ? ' is-new' : ''}" data-id="${esc(t.id)}">
        <div class="jt-item-top">
          <div class="jt-item-main">
            <span class="jt-date">${esc(fmtDate(t.data))}</span>
            <strong class="jt-pair">${esc(t.pereche)}</strong>
            ${t.directie ? `<span class="jt-dir dir-${t.directie.toLowerCase()}">${esc(t.directie)}</span>` : ''}
            ${t.sesiune ? `<span class="jt-sess">${esc(T(t.sesiune))}</span>` : ''}
            ${t.sursa === 'simulator' ? '<span class="jt-sess jt-src-sim" title="' + T('Adăugată din simulatorul de backtesting') + '">' + T('Simulator') + '</span>' : ''}
          </div>
          <div class="jt-item-result">
            <span class="jt-res ${resClass}">${t.rezultat ? esc(t.rezultat) : T('În desfășurare')}</span>
            <b class="jt-rval ${rClass}">${r == null ? '' : esc(fmtR(r))}</b>
          </div>
        </div>
        ${meta ? `<div class="jt-meta">${meta}</div>` : ''}
        ${notes ? `<div class="jt-notes-text">${notes}</div>` : ''}
        <div class="jt-item-foot">
          <span class="jt-plan ${t.plan ? 'plan-' + t.plan.toLowerCase() : ''}">${t.plan === 'Da' ? T('✓ Plan respectat') : t.plan === 'Nu' ? T('✗ Plan nerespectat') : T('Plan: necompletat')}</span>
          <span class="jt-actions">
            <button type="button" class="jt-act" data-act="edit">${T('Editează')}</button>
            <button type="button" class="jt-act jt-act-del" data-act="delete">${T('Șterge')}</button>
          </span>
        </div>
      </li>`;
    }).join('');
  }

  list.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('.jt-item').dataset.id;
    const t = trades.find(x => x.id === id);
    if (!t) return;
    if (btn.dataset.act === 'edit') {
      fillForm(t);
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => F.data.focus({ preventScroll: true }), 350);
    } else if (btn.dataset.act === 'delete') {
      if (!confirm(T('Ștergi tranzacția din {d} ({p})?\nNu o mai poți recupera decât dintr-un backup.', { d: fmtDate(t.data), p: t.pereche }))) return;
      trades = trades.filter(x => x.id !== id);
      save(trades);
      if (editingId === id) resetForm();
      render();
      status(T('Tranzacția a fost ștearsă.'));
    }
  });

  let statusTimer;
  function status(msg, isError) {
    const el = $('jt-status');
    el.textContent = msg;
    el.classList.toggle('is-error', !!isError);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { el.textContent = ''; }, 6000);
  }

  // ---------- descărcare fișiere ----------
  function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  $('jt-export-json').addEventListener('click', () => {
    const payload = { aplicatie: 'Marius FX — jurnal de tranzacționare', versiune: 1, exportat: new Date().toISOString(), tranzactii: sortTrades(trades).reverse() };
    download(`jurnal-marius-fx-backup-${todayISO()}.json`, new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    status(T('Backup descărcat. Păstrează fișierul într-un loc sigur (ex.: Drive, e-mail către tine).'));
  });

  $('jt-import-btn').addEventListener('click', () => $('jt-import').click());
  $('jt-import').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let incoming;
    try {
      const parsed = JSON.parse(await file.text());
      const arr = Array.isArray(parsed) ? parsed : parsed.tranzactii || parsed.trades;
      if (!Array.isArray(arr)) throw new Error('format');
      incoming = arr.map(sanitize).filter(Boolean);
    } catch (err) {
      status(T('Fișierul nu pare un backup valid al jurnalului (.json).'), true);
      return;
    }
    if (!incoming.length) { status(T('Backup-ul nu conține nicio tranzacție.'), true); return; }
    const existing = new Set(trades.map(t => t.id));
    const fresh = incoming.filter(t => !existing.has(t.id));
    if (trades.length && !confirm(T('Backup-ul conține {a} tranzacții. Le adaug la cele {b} existente?\n(Tranzacțiile care există deja nu se dublează.)', { a: incoming.length, b: trades.length }))) return;
    trades = trades.concat(fresh);
    save(trades);
    render();
    status((fresh.length === 1 ? T('Am importat 1 tranzacție') : T('Am importat {n} tranzacții', { n: fresh.length })) + (incoming.length - fresh.length ? ' ' + T('({n} existau deja).', { n: incoming.length - fresh.length }) : '.'));
  });

  $('jt-clear').addEventListener('click', () => {
    if (!trades.length) return;
    if (!confirm(T('Ștergi TOATE cele {n} tranzacții din acest browser?\nAcțiunea nu poate fi anulată. Exportă un backup înainte, dacă vrei să le păstrezi.', { n: trades.length }))) return;
    trades = [];
    save(trades);
    resetForm();
    render();
    status(T('Jurnalul a fost golit.'));
  });

  // ---------- export .xlsx (fără biblioteci externe) ----------
  const COLS = [
    [T('Nr.'), 6], [T('Data'), 12], [T('Pereche'), 11], [T('Direcție'), 10], [T('Sesiune'), 12], [T('Setup / motiv intrare'), 32],
    [T('Preț intrare'), 12], ['Stop loss', 12], ['Take profit', 12], [T('Lot'), 8], [T('Risc %'), 8], [T('Risc în bani'), 12],
    [T('R:R planificat'), 11], [T('Rezultat'), 11], [T('Rezultat în R'), 11], [T('Am respectat planul?'), 12], [T('Emoții'), 20],
    [T('Lecție / ce îmbunătățesc'), 36]
  ];
  const xmlEsc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const colName = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const dateSerial = iso => { const [y, m, d] = iso.split('-').map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; };

  // stiluri: 0 normal · 1 antet · 2 dată · 3 preț · 4 două zecimale · 5 text lung · 6 titlu · 7 procent · 8 R · 9 R:R
  function cell(ref, v, style) {
    const s = style ? ` s="${style}"` : '';
    if (v == null || v === '') return style ? `<c r="${ref}"${s}/>` : '';
    if (typeof v === 'number') return `<c r="${ref}"${s}><v>${v}</v></c>`;
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  }
  function sheetXml(rows, widths, opts = {}) {
    const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
    const pane = opts.freeze ? `<pane ySplit="${opts.freeze}" topLeftCell="A${opts.freeze + 1}" activePane="bottomLeft" state="frozen"/>` : '';
    const body = rows.map((r, ri) => {
      const ht = r.height ? ` ht="${r.height}" customHeight="1"` : '';
      return `<row r="${ri + 1}"${ht}>` + r.cells.map(([v, st], ci) => cell(colName(ci) + (ri + 1), v, st)).join('') + '</row>';
    }).join('');
    const filter = opts.filter ? `<autoFilter ref="${opts.filter}"/>` : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<sheetViews><sheetView workbookViewId="0"${opts.tab ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews>` +
      `<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${body}</sheetData>${filter}</worksheet>`;
  }
  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="5"><numFmt numFmtId="168" formatCode="&quot;1:&quot;0.0#"/><numFmt numFmtId="164" formatCode="dd\\.mm\\.yyyy"/><numFmt numFmtId="165" formatCode="0.00000"/>' +
    '<numFmt numFmtId="166" formatCode="0.0&quot;%&quot;"/><numFmt numFmtId="167" formatCode="+0.00&quot;R&quot;;-0.00&quot;R&quot;;0.00&quot;R&quot;"/></numFmts>' +
    '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="14"/><color rgb="FF0B1F3A"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF0B1F3A"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left style="thin"><color rgb="FFD5DCE6"/></left><right style="thin"><color rgb="FFD5DCE6"/></right><top style="thin"><color rgb="FFD5DCE6"/></top><bottom style="thin"><color rgb="FFD5DCE6"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="10">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment vertical="center"/></xf>' +
    '<xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="168" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function buildXlsx(list) {
    const chron = sortTrades(list).reverse();
    const rows = [{ height: 32, cells: COLS.map(([h]) => [h, 1]) }];
    chron.forEach((t, i) => {
      const rr = plannedRR(t);
      rows.push({ cells: [
        [i + 1, 4], [dateSerial(t.data), 2], [t.pereche, 0], [t.directie, 0], [t.sesiune, 0], [t.setup, 5],
        [t.intrare, 3], [t.sl, 3], [t.tp, 3], [t.lot, 4], [t.riscPct, 7], [t.riscBani, 4],
        [rr, 9], [t.rezultat || T('În desfășurare'), 0], [resultR(t), 8], [t.plan ? T(t.plan) : t.plan, 0], [t.emotii, 5], [t.lectie, 5]
      ].map(([v, s], k) => (k === 0 ? [v, 0] : [v, s])) });
    });
    const s = computeStats(list);
    const sum = [
      { height: 24, cells: [[T('Rezumat — jurnalul tău Marius FX'), 6]] },
      { cells: [[T('Exportat la {d}', { d: fmtDate(todayISO()) }), 0]] },
      { cells: [] },
      { height: 22, cells: [[T('Indicator'), 1], [T('Valoare'), 1]] },
      { cells: [[T('Total tranzacții'), 0], [s.total, 0]] },
      { cells: [[T('În desfășurare (fără rezultat în R)'), 0], [s.deschise, 0]] },
      { cells: [[T('Câștigate'), 0], [s.castigate, 0]] },
      { cells: [[T('Pierdute'), 0], [s.pierdute, 0]] },
      { cells: [[T('Rata de câștig'), 0], [pct(s.rata), 0]] },
      { cells: [['Total R', 0], [s.totalR, 8]] },
      { cells: [[T('R mediu'), 0], [s.rMediu == null ? '—' : round2(s.rMediu), s.rMediu == null ? 0 : 8]] },
      { cells: [[T('% tranzacții cu planul respectat'), 0], [pct(s.plan), 0]] },
      { cells: [] },
      { cells: [[T('Date salvate doar pe dispozitivul tău. Conținut educațional, nu consultanță financiară.'), 0]] }
    ];
    const lastRef = colName(COLS.length - 1) + rows.length;
    const files = {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="' + T('Jurnal') + '" sheetId="1" r:id="rId1"/><sheet name="' + T('Rezumat') + '" sheetId="2" r:id="rId2"/></sheets>' +
        (chron.length ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${T('Jurnal')}!$A$1:$${lastRef.replace(/(\d+)$/, '$$$1')}</definedName></definedNames>` : '') +
        '</workbook>',
      'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'xl/styles.xml': STYLES,
      'xl/worksheets/sheet1.xml': sheetXml(rows, COLS.map(c => c[1]), { freeze: 1, tab: true, filter: chron.length ? 'A1:' + lastRef : '' }),
      'xl/worksheets/sheet2.xml': sheetXml(sum, [36, 16])
    };
    return zip(files);
  }

  // ZIP minimal (fără compresie)
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = bytes => { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder();
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const parts = [], central = [];
    let offset = 0;
    for (const [name, content] of Object.entries(files)) {
      const nameB = enc.encode(name), data = enc.encode(content), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nameB.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nameB, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nameB.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), nameB);
      offset += 30 + nameB.length + data.length;
    }
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    const count = Object.keys(files).length;
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, count, true); end.setUint16(10, count, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  $('jt-export-xlsx').addEventListener('click', () => {
    if (!trades.length) return;
    download(`jurnal-marius-fx-${todayISO()}.xlsx`, buildXlsx(trades));
    status(T('Fișierul Excel a fost descărcat.'));
  });

  // pentru testare
  window.MariusJurnal = { computeStats, plannedRR, num, buildXlsx: () => buildXlsx(trades) };

  resetForm();
  render();
})();
