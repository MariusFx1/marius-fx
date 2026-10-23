/* MS Prime: checklist înainte de tranzacție (scor live, doar educațional).
   Lotul folosește calcLot / fxIncarca / FX din script.js (aceleași ca pe calculator.html). */
(function () {
  'use strict';
  const form = document.getElementById('ck-form');
  if (!form) return;
  const I = window.I18N || {};
  const T = I.T || (s => s);
  const ROOT = I.root || '';
  const num = (x, d) => (I.num ? I.num(x, { maximumFractionDigits: d }) : String(Math.round(x * 10 ** d) / 10 ** d));
  const $ = id => document.getElementById(id);
  const cards = [...form.querySelectorAll('.ck-card')];
  const arc = $('ck-arc'), pctEl = $('ck-pct'), box = $('ck-score');
  const R = 84, C = 2 * Math.PI * R;
  arc.style.strokeDasharray = C; arc.style.strokeDashoffset = C;
  const val = id => { const s = ($(id).value || '').replace(',', '.').trim(); return s === '' ? NaN : parseFloat(s); };
  const NEWS_PENALTY = 10;
  const ASIA_PAIRS = /JPY|AUD|NZD/;
  let shown = 0, raf = 0;
  let state = { score: 0, tier: 'none', verdict: '', done: 0, lot: null };

  function color(p) {   // roșu (0) → galben (60) → verde (100)
    const h = p < 60 ? (p / 60) * 45 : 45 + ((p - 60) / 40) * 97;
    return 'hsl(' + h.toFixed(0) + ' 85% 55%)';
  }
  function animate(to) {
    cancelAnimationFrame(raf);
    const from = shown, t0 = performance.now(), dur = 650;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      shown = from + (to - from) * e;
      pctEl.textContent = Math.round(shown);
      arc.style.strokeDashoffset = C * (1 - shown / 100);
      arc.style.stroke = color(shown);
      box.style.setProperty('--ck-c', color(shown));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  const checked = name => form.querySelector('input[name="' + name + '"]:checked');
  const dir = () => { const c = checked('dir'); return c ? c.value : ''; };
  const pair = () => $('ck-pair').value;
  /** Textul vizibil (în limba paginii și pe direcția aleasă) dintr-un element cu variante. */
  const visible = (root, sel) => { const el = [...root.querySelectorAll(sel)].find(e => e.getClientRects().length); return el ? el.textContent.trim() : ''; };
  const cardTitle = card => visible(card, '.ck-title b').replace(/^\d+\.\s*/, '');
  const optLabel = input => visible(input.closest('label'), 'b');

  // ---------- lot (identic cu calculator.html) ----------
  function lotUpdate() {
    const amtEl = $('ck-lot-amt'), lotEl = $('ck-lot-lots'), note = $('ck-lot-note'), fx = $('ck-lot-fx');
    const p = pair(), moneda = $('ck-cur').value;
    const soldRaw = ($('ck-bal').value || '').trim(), riscRaw = ($('ck-risk').value || '').trim(), stopRaw = ($('ck-sl').value || '').trim();
    amtEl.textContent = '—'; lotEl.textContent = '—'; fx.textContent = ''; state.lot = null; state.amount = null;
    if (!p) { note.textContent = T('Alege perechea la pasul 1 ca să calculezi lotul.'); return; }
    if (!soldRaw || !riscRaw || !stopRaw) { note.textContent = stopRaw ? T('Completează soldul și riscul %.') : T('Completează soldul, riscul % și stop loss-ul în pipși (pasul 12).'); return; }
    const sold = Math.max(0, parseNum(soldRaw) || 0);
    const risc = Math.min(100, Math.max(0, parseNum(riscRaw) || 0));
    const stop = Math.max(0, parseNum(stopRaw) || 0);
    const r = calcLot({ pereche: p, moneda, sold, risc, stop, rates: FX && FX.rates });
    const fmt = I18N.NF({ style: 'currency', currency: moneda, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const n = (x, d) => I18N.num(x, { minimumFractionDigits: d, maximumFractionDigits: d });
    amtEl.textContent = fmt.format(r.suma); state.amount = Math.round(r.suma * 100) / 100;
    if (!Number.isFinite(r.loturi)) {
      note.textContent = fxStare === 'loading' ? T('Se încarcă cursul live…') : T('Nu am putut încărca cursul live. Verifică conexiunea și reîncarcă pagina.');
    } else {
      lotEl.textContent = n(r.loturi, 2); state.lot = Math.round(r.loturi * 100) / 100;
      const sp = specLot(p);
      note.textContent = T('1 lot standard = {u} unități; 1 pip = {p}.', { u: n(sp.contract, 0), p: I18N.num(sp.pip, { maximumFractionDigits: 4 }) }) +
        ' ' + T('Rezultat educațional — confirmă specificațiile simbolului la broker.');
    }
    fx.textContent = fxCursText(p, moneda);
  }

  // ---------- știri din data/calendar.json (fără evenimente inventate) ----------
  let CAL = null, calState = 'loading';
  function loadCal() {
    fetch(ROOT + 'data/calendar.json?t=' + Date.now(), { cache: 'no-store' })
      .then(r => { if (!r.ok) throw 0; return r.json(); })
      .then(d => { CAL = d && Array.isArray(d.events) ? d : null; calState = CAL ? 'ok' : 'error'; })
      .catch(() => { calState = 'error'; })
      .then(renderNews);
  }
  const fmtWhen = d => d.toLocaleString(I.locale || undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  function renderNews() {
    const el = $('ck-news'), p = pair();
    if (!p) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false; el.className = 'ck-news';
    const curr = p.startsWith('XA') ? [p.slice(3)] : [p.slice(0, 3), p.slice(3)];
    const head = document.createElement('p'); head.className = 'ck-news-h';
    el.innerHTML = '';
    el.appendChild(head);
    if (calState === 'loading') { head.textContent = T('Se încarcă calendarul economic…'); return; }
    const now = Date.now(), until = now + 24 * 3600e3;
    const upd = CAL && Date.parse(CAL.updated);
    if (calState !== 'ok' || !(upd > now - 7 * 864e5)) { el.classList.add('is-na'); head.textContent = T('Calendarul automat nu este disponibil acum. Verifică manual pagina Calendar.'); return; }
    const evs = CAL.events.map(e => Object.assign({}, e, { t: Date.parse(e.date) }))
      .filter(e => e.impact === 'High' && curr.includes(e.country) && e.t >= now - 15 * 60e3 && e.t <= until)
      .sort((a, b) => a.t - b.t);
    const last = Math.max(...CAL.events.map(e => Date.parse(e.date)).filter(Number.isFinite));
    const src = T('Sursa: calendarul ForexFactory al site-ului, actualizat {dt}.', { dt: fmtWhen(new Date(upd)) });
    if (evs.length) {
      el.classList.add('is-high');
      head.textContent = T('Știri high-impact pentru {c} în următoarele 24 h:', { c: curr.join(', ') });
      const ul = document.createElement('ul');
      evs.forEach(e => { const li = document.createElement('li'); const b = document.createElement('b'); b.textContent = fmtWhen(new Date(e.t)); li.append(b, ' · ' + e.country + ' · ' + e.title); ul.appendChild(li); });
      el.appendChild(ul);
    } else {
      el.classList.add('is-clear');
      head.textContent = T('Nicio știre high-impact pentru {c} în următoarele 24 h.', { c: curr.join(', ') });
    }
    const s = document.createElement('p'); s.className = 'ck-news-src';
    s.textContent = src + (last < until ? ' ' + T('Datele acoperă doar până la {dt}.', { dt: fmtWhen(new Date(last)) }) : '');
    el.appendChild(s);
  }

  // ---------- scor ----------
  function update() {
    let score = 0, done = 0, penalty = 0;
    const flags = [], warns = [];
    const asia = form.querySelector('input[name=session][value=asia]');
    asia.dataset.v = pair() && ASIA_PAIRS.test(pair()) ? '1' : '0.4';
    cards.forEach(card => {
      const w = +card.dataset.w, key = card.dataset.key;
      let f = null;
      if (key === 'dir') {
        const st = $('ck-dir-st');
        f = dir() && pair() ? 1 : null;
        st.className = 'ck-status';
        st.textContent = f === null && (dir() || pair()) ? (dir() ? T('Alege perechea.') : T('Alege direcția: Buy sau Sell.')) : '';
        if (st.textContent) st.classList.add('mid');
      } else if (key === 'risk') {
        const r = val('ck-risk'), st = $('ck-risk-st');
        st.className = 'ck-status';
        if (!isNaN(r)) {
          if (!(r > 0)) { f = null; st.textContent = T('Introdu un risc mai mare decât 0%.'); st.classList.add('bad'); }
          else if (r > 3) { f = 0; st.textContent = T('Peste 3%: risc prea mare, scade lotul.'); st.classList.add('bad'); flags.push(T('Risc peste 3% din cont')); }
          else if (r > 2) { f = 0.7; st.textContent = T('Acceptabil, dar 1–2% e mai sănătos.'); st.classList.add('mid'); }
          else { f = 1; st.textContent = T('Risc sănătos, în regulă.'); st.classList.add('ok'); }
        } else st.textContent = '';
      } else if (key === 'rr') {
        const sl = val('ck-sl'), tp = val('ck-tp'), d = val('ck-rr'), st = $('ck-rr-st');
        let rr = NaN, bad = '';
        st.className = 'ck-status';
        if (!isNaN(sl) || !isNaN(tp)) {
          if (sl > 0 && tp > 0) rr = tp / sl;
          else if (!isNaN(sl) && !isNaN(tp)) bad = T('SL și TP trebuie să fie mai mari decât 0.');
        } else if (!isNaN(d)) { if (d > 0) rr = d; else bad = T('Introdu un R:R mai mare decât 0.'); }
        if (bad) { st.textContent = bad; st.classList.add('bad'); }
        else if (!isNaN(rr)) {
          const txt = 'R:R 1:' + num(rr, 2);
          if (rr < 2) { f = 0; st.textContent = txt + ' · ' + T('sub 1:2, nu respectă regula.'); st.classList.add('bad'); flags.push(T('R:R sub 1:2')); }
          else { f = 1; st.textContent = txt + ' · ' + T('minim 2R, în regulă.'); st.classList.add('ok'); }
          state.rr = rr;
        } else st.textContent = '';
      } else {
        const c = card.querySelector('input:checked');
        if (c) f = parseFloat(c.dataset.v);
        if (key === 'news' && c && c.value === 'high') { penalty = NEWS_PENALTY; warns.push(T('Știre high-impact în curând: −{n} puncte', { n: NEWS_PENALTY })); }
      }
      if (f !== null) { done++; score += w * f; }
      card.classList.toggle('is-done', f !== null);
      card.classList.toggle('is-ok', f !== null && f >= 0.7);
      card.classList.toggle('is-bad', f === 0 && w > 0);
      card.querySelector('[data-pts]').textContent = w ? (f === null ? 0 : Math.round(w * f)) + '/' + w : (f === null ? '—' : '✓');
    });
    score = Math.max(0, Math.round(score) - penalty);
    const capped = flags.length > 0;
    let tier, v, sub;
    if (done === 0) { tier = 'none'; v = T('Completează checklist-ul'); sub = T('Alege câte o opțiune în fiecare secțiune.'); }
    else if (capped || score < 60) { tier = 'bad'; v = T('Nu intra'); sub = capped ? T('O regulă obligatorie nu este respectată. Corectează riscul sau R:R-ul înainte de orice intrare.') : T('Prea puține criterii îndeplinite. Așteaptă un setup mai clar.'); }
    else if (score < 85 || done < cards.length) { tier = 'mid'; v = T('Setup mediu: așteaptă mai multă confirmare'); sub = T('Lipsesc câteva elemente. Răbdarea face parte din plan.'); }
    else { tier = 'good'; v = T('Setup puternic: poți intra conform planului'); sub = T('Respectă SL-ul, lotul calculat și nu muta stop loss-ul.'); }
    if (tier === 'mid' && score >= 85) sub = T('Completează toate secțiunile, inclusiv riscul și R:R-ul, pentru verdictul final.');
    if (done > 0 && done < cards.length) sub += ' ' + T('Secțiuni rămase: {n}.', { n: cards.length - done });
    box.dataset.tier = tier;
    $('ck-verdict').textContent = v;
    $('ck-verdict-sub').textContent = sub;
    const list = (id, arr) => { $(id).innerHTML = ''; arr.forEach(t => { const li = document.createElement('li'); li.textContent = t; $(id).appendChild(li); }); };
    list('ck-flags', flags); list('ck-warns', warns);
    $('ck-done').textContent = done;
    $('ck-bar').style.width = (done / cards.length * 100) + '%';
    Object.assign(state, { score, tier, verdict: v, done });
    lotUpdate();
    animate(score);
  }

  // ---------- direcție + H&S ----------
  const trendCard = form.querySelector('.ck-trend');
  function syncDir() {
    form.classList.toggle('ck-is-buy', dir() === 'buy');
    form.classList.toggle('ck-is-sell', dir() === 'sell');
  }
  function syncRev() {
    const rev = !!form.querySelector('input[name=pattern][value="hs"]:checked');
    const st = $('ck-trend-st');
    if (rev !== trendCard.classList.contains('is-rev')) {
      const had = !!trendCard.querySelector('input:checked');
      trendCard.classList.toggle('is-rev', rev);
      trendCard.querySelectorAll('input').forEach(i => { i.checked = false; });
      st.textContent = had ? (rev ? T('Ai ales Head and Shoulders: întrebarea de la pasul 4 s-a schimbat, răspunde din nou.') : T('Pattern-ul nu mai este Head and Shoulders: răspunde din nou la pasul 4.')) : '';
    } else if (trendCard.querySelector('input:checked')) st.textContent = '';
  }
  form.addEventListener('change', () => { syncDir(); syncRev(); });
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', e => e.preventDefault());
  $('ck-pair').addEventListener('change', renderNews);
  $('ck-bal').addEventListener('input', () => formatMii($('ck-bal')));
  $('ck-rr').addEventListener('input', () => { if ($('ck-rr').value) { $('ck-sl').value = ''; $('ck-tp').value = ''; } });
  ['ck-sl', 'ck-tp'].forEach(id => $(id).addEventListener('input', () => { if ($(id).value) $('ck-rr').value = ''; }));
  const actSt = $('ck-act-st');
  function say(msg, cls, link) {
    actSt.className = 'ck-act-st' + (cls ? ' ' + cls : ''); actSt.textContent = msg;
    if (link) { const a = document.createElement('a'); a.href = link[0]; a.textContent = link[1]; actSt.append(' ', a); }
  }
  $('ck-reset').addEventListener('click', () => {
    form.reset(); syncDir(); syncRev(); $('ck-trend-st').textContent = ''; say(''); renderNews(); update();
    form.querySelector('input').focus({ preventScroll: true });
    window.scrollTo({ top: form.getBoundingClientRect().top + scrollY - 90, behavior: 'smooth' });
  });

  // ---------- rezumat (jurnal + imagine) ----------
  function summary() {
    const g = n => { const c = checked(n); return c ? optLabel(c) : ''; };
    return {
      pattern: g('pattern'), candle: g('candle'), tfa: (checked('tfa') || {}).value || '', tfe: (checked('tfe') || {}).value || '',
      session: g('session'), news: g('news')
    };
  }
  const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const SESS = { london: 'Londra', ny: 'New York', overlap: 'Londra', asia: 'Tokyo' };
  $('ck-save').addEventListener('click', () => {
    update();
    if (!dir() || !pair()) { say(T('Alege direcția și perechea (pasul 1) înainte de salvare.'), 'bad'); return; }
    if (!state.done || state.done < 2) { say(T('Completează checklist-ul înainte de salvare.'), 'bad'); return; }
    const s = summary();
    const parts = [T('Checklist MS Prime: {p}% · {v}', { p: state.score, v: state.verdict })];
    if (s.pattern) parts.push(T('Pattern') + ': ' + s.pattern);
    if (s.candle) parts.push(T('Lumânare') + ': ' + s.candle);
    if (s.tfa || s.tfe) parts.push('TF: ' + (s.tfa || '—') + ' / ' + (s.tfe || '—'));
    if (s.session) parts.push(T('Sesiune') + ': ' + s.session);
    if (s.news) parts.push(T('Știri') + ': ' + s.news);
    if (state.rr && !isNaN(state.rr) && cards.find(c => c.dataset.key === 'rr').classList.contains('is-done')) parts.push('R:R 1:' + num(state.rr, 2));
    const now = new Date().toISOString();
    const risk = val('ck-risk'), sess = checked('session');
    const entry = {
      id: (crypto.randomUUID ? crypto.randomUUID() : 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)),
      data: todayISO(), pereche: pair(), directie: dir() === 'buy' ? 'Buy' : 'Sell', sesiune: sess ? SESS[sess.value] : '',
      setup: parts.join(' · ').slice(0, 600), intrare: null, sl: null, tp: null,
      lot: state.lot, riscPct: risk > 0 ? risk : null, riscBani: state.lot != null ? state.amount : null,
      rezultat: '', r: null, plan: '', emotii: '', lectie: '', creat: now, modificat: ''
    };
    try {
      const KEY = 'mariusfx-jurnal-v1';
      const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
      const list = Array.isArray(arr) ? arr : [];
      list.push(entry);
      localStorage.setItem(KEY, JSON.stringify(list));
      say(T('Setup salvat în Jurnal ca tranzacție în desfășurare.'), 'ok', ['jurnal.html', T('Deschide Jurnalul →')]);
    } catch (e) { say(T('Nu am putut salva: browserul blochează stocarea locală.'), 'bad'); }
  });

  // ---------- imagine de distribuit (canvas) ----------
  function loadImg(src) { return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function fit(ctx, text, max) { if (ctx.measureText(text).width <= max) return text; while (text.length && ctx.measureText(text + '…').width > max) text = text.slice(0, -1); return text + '…'; }
  async function drawShare() {
    update();
    const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
    const F = (w, s) => w + ' ' + s + 'px ' + font;
    const col = color(state.score);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0f1829'); g.addColorStop(1, '#070b14');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const rg = ctx.createRadialGradient(W / 2, 420, 40, W / 2, 420, 520); rg.addColorStop(0, col.replace('hsl(', 'hsla(').replace(')', ' / .22)')); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2; rr(ctx, 30, 30, W - 60, H - 60, 36); ctx.stroke();
    // antet: logo + MS Prime
    const logo = await loadImg(ROOT + 'images/logo-bull.png?v=1');
    if (logo) ctx.drawImage(logo, 70, 66, 86, 70);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = F(800, 46); ctx.fillStyle = '#e8eefc'; ctx.fillText('MS', 172, 102);
    const msw = ctx.measureText('MS ').width; ctx.fillStyle = '#4ade80'; ctx.fillText('Prime', 172 + msw, 102);
    ctx.textAlign = 'right'; ctx.font = F(600, 26); ctx.fillStyle = '#8a9bbd';
    ctx.fillText(new Date().toLocaleDateString(I.locale || undefined, { day: 'numeric', month: 'short', year: 'numeric' }), W - 70, 102);
    ctx.textAlign = 'center'; ctx.font = F(700, 34); ctx.fillStyle = '#c7d2ea';
    ctx.fillText(fit(ctx, T('Checklist înainte de tranzacție'), W - 160), W / 2, 196);
    // pereche + direcție
    const d = dir(), p = pair() || '—';
    const dl = d === 'buy' ? 'BUY' : d === 'sell' ? 'SELL' : '';
    ctx.font = F(800, 52); const pw = ctx.measureText(p).width;
    ctx.font = F(800, 30); const dw = dl ? ctx.measureText(dl).width + 44 : 0;
    const tot = pw + (dl ? 24 + dw : 0), x0 = W / 2 - tot / 2;
    ctx.textAlign = 'left'; ctx.font = F(800, 52); ctx.fillStyle = '#ffffff'; ctx.fillText(p, x0, 272);
    if (dl) { const bx = x0 + pw + 24; ctx.fillStyle = d === 'buy' ? 'rgba(34,197,94,.18)' : 'rgba(248,113,113,.18)'; rr(ctx, bx, 248, dw, 50, 25); ctx.fill(); ctx.fillStyle = d === 'buy' ? '#4ade80' : '#f87171'; ctx.font = F(800, 30); ctx.fillText(dl, bx + 22, 274); }
    // inel scor
    const cx = W / 2, cy = 510, r = 160;
    ctx.lineCap = 'round'; ctx.lineWidth = 30; ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    if (state.score > 0) { ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 30; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.score / 100); ctx.stroke(); ctx.shadowBlur = 0; }
    ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.font = F(800, 120); ctx.fillText(state.score + '%', cx, cy - 6);
    ctx.font = F(700, 22); ctx.fillStyle = '#8a9bbd'; ctx.fillText(T('scor setup').toUpperCase(), cx, cy + 70);
    // verdict
    ctx.font = F(800, 38); ctx.fillStyle = state.tier === 'good' ? '#4ade80' : state.tier === 'mid' ? '#fbbf24' : state.tier === 'bad' ? '#f87171' : '#e8eefc';
    ctx.fillText(fit(ctx, (state.tier === 'good' ? '✓ ' : state.tier === 'bad' ? '✕ ' : '') + state.verdict, W - 140), cx, 740);
    // bife
    const items = cards.filter(c => +c.dataset.w > 0);
    const top = 800, rowH = 39, colW = (W - 160) / 2;
    items.forEach((c, i) => {
      const colI = i < 6 ? 0 : 1, row = i < 6 ? i : i - 6;
      const x = 80 + colI * colW, y = top + row * (rowH + 8);
      const ok = c.classList.contains('is-ok'), done = c.classList.contains('is-done');
      ctx.fillStyle = 'rgba(255,255,255,.04)'; rr(ctx, x, y, colW - 20, rowH, 12); ctx.fill();
      ctx.textAlign = 'left'; ctx.font = F(800, 22);
      ctx.fillStyle = ok ? '#4ade80' : done ? (c.classList.contains('is-bad') ? '#f87171' : '#fbbf24') : '#5b6b8c';
      ctx.fillText(ok ? '✓' : done ? (c.classList.contains('is-bad') ? '✕' : '~') : '–', x + 16, y + rowH / 2 + 1);
      ctx.font = F(600, 21); ctx.fillStyle = '#d6def0';
      const pts = c.querySelector('[data-pts]').textContent;
      ctx.fillText(fit(ctx, cardTitle(c), colW - 150), x + 46, y + rowH / 2 + 1);
      ctx.textAlign = 'right'; ctx.fillStyle = '#8a9bbd'; ctx.font = F(700, 19); ctx.fillText(pts, x + colW - 36, y + rowH / 2 + 1);
    });
    // subsol
    ctx.textAlign = 'center'; ctx.font = F(700, 28); ctx.fillStyle = '#4ade80';
    ctx.fillText('mariusfx1.github.io/marius-fx', cx, H - 118);
    ctx.font = F(500, 20); ctx.fillStyle = '#7b8aa8';
    ctx.fillText(fit(ctx, T('Doar educațional. Nu este consultanță financiară.'), W - 160), cx, H - 76);
    return new Promise(res => cv.toBlob(res, 'image/png'));
  }
  $('ck-share').addEventListener('click', async () => {
    const btn = $('ck-share'); btn.disabled = true;
    try {
      const blob = await drawShare();
      if (!blob) throw new Error('blob');
      const name = 'ms-prime-checklist-' + (pair() || 'setup').toLowerCase() + '-' + state.score + '.png';
      const file = new File([blob], name, { type: 'image/png' });
      const mobile = matchMedia('(pointer: coarse)').matches;
      if (mobile && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'MS Prime Checklist', text: (pair() ? pair() + ' · ' : '') + state.score + '% · ' + state.verdict }); say(T('Imagine distribuită.'), 'ok'); return; }
        catch (e) { if (e && e.name === 'AbortError') { say(''); return; } }
      }
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      say(T('Imaginea a fost descărcată.'), 'ok');
    } catch (e) { say(T('Nu am putut genera imaginea.'), 'bad'); }
    finally { btn.disabled = false; }
  });

  syncDir(); syncRev(); update(); renderNews(); loadCal();
  if (typeof fxIncarca === 'function') fxIncarca().then(lotUpdate);
})();
