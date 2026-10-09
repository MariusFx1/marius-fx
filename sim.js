/* ============================================================
   Marius FX: simulator de backtesting (redare bară cu bară)
   Date istorice reale (HistData.com, agregate în H1/H4/D1), grafic TradingView Lightweight Charts.
   Totul rulează local; sesiunile se salvează doar în localStorage.
   ============================================================ */
(() => {
  'use strict';
  const setupForm = document.getElementById('sim-setup');
  const E = window.SimEngine, LW = window.LightweightCharts;
  if (!setupForm || !E || !LW) return;

  const $ = id => document.getElementById(id);
  const DATA = 'data/sim/';
  const KEY_SESS = 'mariusfx-sim-sesiuni-v1', KEY_CUR = 'mariusfx-sim-curenta-v1', KEY_HELP = 'mariusfx-sim-ajutor-v1', KEY_J = 'mariusfx-jurnal-v1';
  const HISTORY = 150, MIN_FUTURE = 300, MAX_SAVED = 30;
  const SPEED_MS = { 1: 900, 2: 450, 5: 180, 10: 90 };
  const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
  const DATA_START = Date.UTC(2019, 0, 2) / 1000, DATA_END = Date.UTC(2025, 11, 31, 21) / 1000;
  const CSS = getComputedStyle(document.documentElement);
  const C = { green: '#22c55e', red: '#ef4444', amber: '#fbbf24', blue: '#60a5fa', text: '#cbd5e1', grid: 'rgba(148,163,184,.07)', border: '#1e2b45' };

  // ---------- utilitare ----------
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignorat */ } }
  };
  /** Numere cu virgulă sau punct: „1,0850”, „1.085”, „10.000”, „10 000”. */
  function num(raw) {
    let s = String(raw == null ? '' : raw).trim().replace(/\s/g, '');
    if (!s) return null;
    const c = s.lastIndexOf(','), d = s.lastIndexOf('.');
    if (c > -1 && d > -1) s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (c > -1) s = (s.match(/,/g).length === 1) ? s.replace(',', '.') : s.replace(/,/g, '');
    else if (d > -1 && s.match(/\./g).length > 1) s = s.replace(/\./g, '');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  }
  /** Sume (sold): acceptă și separatorul de mii românesc „10.000” sau „10.000,50”. */
  const numBal = raw => { const t = String(raw == null ? '' : raw).trim().replace(/\s/g, ''); return /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? num(t.replace(/\./g, '')) : num(t); };
  const nf = (x, min, max) => Number(x).toLocaleString('ro-RO', { minimumFractionDigits: min, maximumFractionDigits: max == null ? min : max });
  const sign = x => (x > 0 ? '+' : x < 0 ? '−' : '');
  const money = (x, ccy, signed) => (signed ? sign(x) : (x < 0 ? '−' : '')) + new Intl.NumberFormat('ro-RO', { style: 'currency', currency: ccy }).format(Math.abs(x));
  const fmtR = x => (x == null ? '—' : sign(x) + nf(Math.abs(x), 2) + 'R');
  const pct = (x, d = 1) => (x == null ? '—' : nf(x * 100, d) + '%');
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmtPrice = (sym, p) => (p == null ? '—' : nf(p, E.INSTR[sym].dec));
  const inputPrice = (sym, p) => p.toFixed(E.INSTR[sym].dec);
  const TZ = 'Europe/Bucharest';
  const dtf = new Intl.DateTimeFormat('ro-RO', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const df = new Intl.DateTimeFormat('ro-RO', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
  const dfLong = new Intl.DateTimeFormat('ro-RO', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtTime = (t, tf) => (tf === 'D1' ? df.format(new Date(t * 1000)) : dtf.format(new Date(t * 1000)).replace(',', ''));
  const isoDate = (t, tf) => {   // AAAA-LL-ZZ (ora României pentru H1/H4, data de tranzacționare pentru D1)
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: tf === 'D1' ? 'UTC' : TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t * 1000));
    return p.slice(0, 10);
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));

  // ---------- date ----------
  const cache = new Map();
  let INDEX = null;
  function loadJson(name) {
    if (!cache.has(name)) {
      cache.set(name, fetch(DATA + name).then(r => { if (!r.ok) throw new Error(r.status + ' ' + name); return r.json(); })
        .then(j => (name === 'index.json' ? j : E.decode(j)))
        .catch(e => { cache.delete(name); throw e; }));
    }
    return cache.get(name);
  }
  const yearOf = t => new Date(t * 1000).getUTCFullYear();
  /** Seria pentru instrument/interval, care acoperă cel puțin anii [y0, y1] (H1 e împărțit pe ani). */
  async function loadSeries(sym, tf, y0, y1) {
    if (tf !== 'H1') return { d: await loadJson(`${sym}-${tf}.json`), years: [2019, 2025] };
    y0 = Math.max(2019, y0); y1 = Math.min(2025, y1);
    const parts = await Promise.all(YEARS.filter(y => y >= y0 && y <= y1).map(y => loadJson(`${sym}-H1-${y}.json`)));
    return { d: parts.reduce((a, b) => E.concat(a, b), null), years: [y0, y1] };
  }
  /** Cursuri istorice (închiderea zilnică) pentru valoarea pipului în moneda contului. */
  async function loadRates(sym, ccy) {
    const need = new Set();
    if (ccy === 'EUR') need.add('EURUSD');
    if (ccy === 'GBP') need.add('GBPUSD');
    if (sym === 'GBPJPY') need.add('USDJPY');
    const out = {};
    for (const p of need) out[p] = await loadJson(`${p}-D1.json`);
    return out;
  }
  function closeAt(d, t) {   // ultima închidere zilnică la sau înainte de t
    let lo = 0, hi = d.n - 1, k = 0;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (d.t[m] <= t) { k = m; lo = m + 1; } else hi = m - 1; }
    return d.c[k];
  }
  function ratesAt(t) {
    const r = { EURUSD: 1, GBPUSD: 1, USDJPY: 1 };
    for (const [p, d] of Object.entries(S.rates)) r[p] = (p === S.sym) ? S.d.c[S.cur] : closeAt(d, t);
    return r;
  }
  const incompleteFor = sym => (INDEX && INDEX.instruments[sym] ? INDEX.instruments[sym].incomplete : []) || [];

  // ---------- stare ----------
  let S = null;            // sesiunea curentă
  let chart = null, series = null, markersApi = null, eqChart = null, eqSeries = null;
  const lines = {};        // linii de preț pe grafic: entry, sl, tp, pend (poziție) și psl, ptp, ppr (previzualizare)
  let playTimer = null, loadingMore = null;

  // ---------- grafic ----------
  function timeLabels(hidden) {
    const tf = S.tf;
    chart.applyOptions({
      timeScale: {
        timeVisible: tf !== 'D1', secondsVisible: false,
        tickMarkFormatter: hidden ? () => '' : (t, type) => {
          const d = new Date(t * 1000), z = tf === 'D1' ? 'UTC' : TZ;
          if (type === 0) return String(new Intl.DateTimeFormat('ro-RO', { timeZone: z, year: 'numeric' }).format(d));
          if (type === 1) return new Intl.DateTimeFormat('ro-RO', { timeZone: z, month: 'short' }).format(d);
          if (type === 2) return new Intl.DateTimeFormat('ro-RO', { timeZone: z, day: 'numeric', month: 'short' }).format(d);
          return new Intl.DateTimeFormat('ro-RO', { timeZone: z, hour: '2-digit', minute: '2-digit' }).format(d);
        }
      },
      crosshair: { vertLine: { labelVisible: !hidden } },
      localization: { locale: 'ro-RO', timeFormatter: hidden ? () => '' : t => fmtTime(t, tf), priceFormatter: p => nf(p, E.INSTR[S.sym].dec) }
    });
  }
  function makeChart() {
    if (chart) { chart.remove(); chart = null; }
    for (const k of Object.keys(lines)) delete lines[k];
    const el = $('sim-chart');
    chart = LW.createChart(el, {
      autoSize: true,
      layout: { background: { type: 'solid', color: '#0b1220' }, textColor: C.text, fontFamily: CSS.getPropertyValue('--font') || 'system-ui', attributionLogo: true },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: C.border, rightOffset: 6, barSpacing: 8, shiftVisibleRangeOnNewBar: true },
      crosshair: { mode: LW.CrosshairMode.Normal },
      handleScroll: { vertTouchDrag: false }
    });
    series = chart.addSeries(LW.CandlestickSeries, {
      upColor: C.green, downColor: C.red, borderUpColor: C.green, borderDownColor: C.red, wickUpColor: C.green, wickDownColor: C.red,
      priceFormat: { type: 'price', precision: E.INSTR[S.sym].dec, minMove: Math.pow(10, -E.INSTR[S.sym].dec) },
      priceLineColor: 'rgba(203,213,225,.5)',
      // scala include mereu nivelurile de intrare, SL, TP și ordinul în așteptare (ca liniile să se vadă și să poată fi trase)
      autoscaleInfoProvider: original => {
        const res = original();
        const lv = Object.values(lines).map(l => l.options().price).filter(Number.isFinite);
        if (res && res.priceRange && lv.length) {
          res.priceRange.minValue = Math.min(res.priceRange.minValue, ...lv);
          res.priceRange.maxValue = Math.max(res.priceRange.maxValue, ...lv);
        }
        return res;
      }
    });
    markersApi = LW.createSeriesMarkers(series, []);
    timeLabels(S.hidden);
  }
  const lwBar = i => ({ time: S.d.t[i], open: S.d.o[i], high: S.d.h[i], low: S.d.l[i], close: S.d.c[i] });
  function setChartData() {
    const from = Math.max(0, S.firstIdx), arr = [];
    for (let i = from; i <= S.cur; i++) arr.push(lwBar(i));
    series.setData(arr);
    markersApi.setMarkers(S.markers.slice());
    chart.timeScale().scrollToRealTime();
  }
  function setLine(key, price, opts) {
    if (price == null || !Number.isFinite(price)) { if (lines[key]) { series.removePriceLine(lines[key]); delete lines[key]; } return; }
    const o = Object.assign({ price, lineWidth: 2, axisLabelVisible: true, lineStyle: LW.LineStyle.Solid }, opts);
    if (lines[key]) lines[key].applyOptions(o); else lines[key] = series.createPriceLine(o);
  }
  function drawLines() {
    const P = S.pos, O = S.pending, prev = !P && !O ? preview() : null;
    setLine('entry', P ? P.entry : null, { color: 'rgba(203,213,225,.85)', lineWidth: 1, lineStyle: LW.LineStyle.Dashed, title: P ? (P.side === 'buy' ? 'Buy' : 'Sell') : '' });
    setLine('pend', O ? O.price : null, { color: C.amber, lineStyle: LW.LineStyle.Dashed, title: O ? (O.side === 'buy' ? 'Buy ' : 'Sell ') + O.kind : '' });
    const sl = P ? P.sl : O ? O.sl : prev && prev.ok ? prev.sl : null;
    const tp = P ? P.tp : O ? O.tp : prev && prev.ok ? prev.tp : null;
    const ghost = !P && !O;
    setLine('sl', sl, { color: ghost ? 'rgba(239,68,68,.6)' : C.red, lineStyle: ghost ? LW.LineStyle.Dashed : LW.LineStyle.Solid, title: P && P.be ? 'SL (BE)' : 'SL' });
    setLine('tp', tp, { color: ghost ? 'rgba(34,197,94,.6)' : C.green, lineStyle: ghost ? LW.LineStyle.Dashed : LW.LineStyle.Solid, title: 'TP' });
    setLine('ppr', ghost && prev && prev.kind !== 'market' && prev.ref ? prev.ref : null, { color: 'rgba(251,191,36,.7)', lineStyle: LW.LineStyle.Dashed, title: 'Ordin' });
  }

  // ---------- tragerea liniilor (mouse + atingere) ----------
  let drag = null;
  function lineAtY(y, tol) {
    let best = null;
    for (const key of ['sl', 'tp', 'pend', 'ppr']) {
      const l = lines[key]; if (!l) continue;
      const yy = series.priceToCoordinate(l.options().price);
      if (yy == null) continue;
      const dist = Math.abs(yy - y);
      if (dist <= tol && (!best || dist < best.dist)) best = { key, dist };
    }
    return best && best.key;
  }
  function chartY(e) { const r = $('sim-chart').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width }; }
  function onDown(e) {
    if (!S || S.ended || !series) return;
    const { y } = chartY(e);
    const key = lineAtY(y, e.pointerType === 'touch' ? 18 : 8);
    if (!key) return;
    drag = { key, id: e.pointerId };
    e.preventDefault(); e.stopPropagation();
    try { $('sim-chart').setPointerCapture(e.pointerId); } catch (_) { /* ignorat */ }
    chart.applyOptions({ handleScroll: false, handleScale: false });
    chart.priceScale('right').applyOptions({ autoScale: false });   // scala fixă cât timp tragi linia
    $('sim-chart').classList.add('is-dragging');
  }
  function onMove(e) {
    const el = $('sim-chart');
    if (!drag) {
      if (e.pointerType === 'mouse' && S && series) el.classList.toggle('can-drag', !!lineAtY(chartY(e).y, 8));
      return;
    }
    e.preventDefault(); e.stopPropagation();
    const p = series.coordinateToPrice(chartY(e).y);
    if (p != null && p > 0) dragTo(drag.key, p, false);
  }
  function onUp(e) {
    if (!drag) return;
    e.preventDefault(); e.stopPropagation();
    const p = series.coordinateToPrice(chartY(e).y);
    if (p != null && p > 0 && e.type !== 'pointercancel') dragTo(drag.key, p, true);
    drag = null;
    chart.applyOptions({ handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false }, handleScale: true });
    $('sim-chart').classList.remove('is-dragging');
    chart.priceScale('right').applyOptions({ autoScale: true });
    afterChange();
  }
  const stopIfDragging = e => { if (drag) { e.stopPropagation(); if (e.cancelable) e.preventDefault(); } };
  function bindDrag() {
    const el = $('sim-chart');
    el.addEventListener('pointerdown', onDown, { capture: true });
    el.addEventListener('pointermove', onMove, { capture: true });
    el.addEventListener('pointerup', onUp, { capture: true });
    el.addEventListener('pointercancel', onUp, { capture: true });
    for (const t of ['mousedown', 'mousemove', 'touchstart', 'touchmove']) el.addEventListener(t, stopIfDragging, { capture: true, passive: false });
  }
  /** Mută o linie trasă pe grafic: actualizează poziția/ordinul sau câmpurile formularului. */
  function dragTo(key, p, final) {
    const sym = S.sym, dec = E.INSTR[sym].dec;
    p = E.round(p, dec);
    if (S.pos) {
      if (key === 'sl') S.pos.slDraft = p; else if (key === 'tp') S.pos.tpDraft = p; else return;
      setLine(key, p, {});
      $(key === 'sl' ? 'sim-p-sl' : 'sim-p-tp').value = inputPrice(sym, p);
      if (final) applyPosLevels();
      return;
    }
    if (S.pending) {
      const k = key === 'pend' ? 'price' : key;
      if (!['price', 'sl', 'tp'].includes(k)) return;
      if (final) {
        const o = Object.assign({}, S.pending, { [k]: p });
        const err = pendingError(o) || E.validateLevels(o.side, o.price, o.sl, o.tp);
        if (err) { showMsg(err, 'warn'); drawLines(); return; }
        const slPips = Math.abs(o.price - o.sl) / E.pipOf(sym), lot = E.lotFor(S.balance * S.riskPct / 100, slPips, o.pipVal);
        if (lot < 0.01) { showMsg('Cu acest stop loss lotul ar fi sub 0,01. Am păstrat nivelul anterior.', 'warn'); drawLines(); return; }
        Object.assign(S.pending, { [k]: p, slPips, lot });
        showMsg('Ordinul a fost modificat: ' + (k === 'price' ? 'preț ' : k.toUpperCase() + ' ') + fmtPrice(sym, p) + '.');
        afterChange();
      } else setLine(key, p, {});
      return;
    }
    // previzualizare: actualizează câmpurile formularului
    const pr = preview();
    if (key === 'ppr') { $('sim-price').value = inputPrice(sym, p); }
    else if (key === 'sl' || key === 'tp') {
      const field = $(key === 'sl' ? 'sim-sl' : 'sim-tp');
      if (unit() === 'pips') { const ref = pr.ref || refPrice(side(), kind()); field.value = nf(Math.abs(ref - p) / E.pipOf(sym), 0, 1).replace(/\s/g, ''); }
      else field.value = inputPrice(sym, p);
    }
    updateCalc();
  }

  // ---------- formular ordin ----------
  const side = () => (document.querySelector('input[name="sim-side"]:checked') || {}).value || 'buy';
  const kind = () => (document.querySelector('input[name="sim-kind"]:checked') || {}).value || 'market';
  const unit = () => (document.querySelector('input[name="sim-unit"]:checked') || {}).value || 'pips';
  const bid = () => S.d.c[S.cur];
  const ask = () => bid() + E.spreadPrice(S.sym);
  function refPrice(sd, kd) {
    if (kd === 'market') return sd === 'buy' ? E.round(ask(), E.INSTR[S.sym].dec + 1) : bid();
    const p = num($('sim-price').value);
    return p > 0 ? p : null;
  }
  function pendingError(o) {
    if (!(o.price > 0)) return 'Scrie prețul ordinului (de exemplu ' + inputPrice(S.sym, bid()) + ').';
    const a = ask(), b = bid(), sp = fmtPrice(S.sym, o.side === 'buy' ? a : b);
    if (o.side === 'buy' && o.kind === 'limit' && o.price >= a) return `Buy limit se pune sub prețul curent (Ask ${sp}). Pentru intrare peste preț folosește Buy stop.`;
    if (o.side === 'buy' && o.kind === 'stop' && o.price <= a) return `Buy stop se pune deasupra prețului curent (Ask ${sp}). Pentru intrare sub preț folosește Buy limit.`;
    if (o.side === 'sell' && o.kind === 'limit' && o.price <= b) return `Sell limit se pune deasupra prețului curent (Bid ${sp}). Pentru intrare sub preț folosește Sell stop.`;
    if (o.side === 'sell' && o.kind === 'stop' && o.price >= b) return `Sell stop se pune sub prețul curent (Bid ${sp}). Pentru intrare peste preț folosește Sell limit.`;
    return null;
  }
  /** Calculează planul din formular (fără să-l execute). */
  function preview() {
    const sd = side(), kd = kind(), sym = S.sym, pip = E.pipOf(sym);
    const ref = refPrice(sd, kd);
    const res = { ok: false, side: sd, kind: kd, ref, sl: null, tp: null };
    if (kd !== 'market') { const e = pendingError({ side: sd, kind: kd, price: ref }); if (e) { res.err = e; return res; } }
    if (!(ref > 0)) { res.err = 'Scrie prețul ordinului.'; return res; }
    const rs = $('sim-sl').value.trim(), rt = $('sim-tp').value.trim();
    const vs = num(rs), vt = rt ? num(rt) : null;
    if (vs == null) { res.err = 'Completează stop loss-ul. Fără stop loss nu putem calcula lotul.'; return res; }
    if (Number.isNaN(vs) || vs <= 0) { res.err = unit() === 'pips' ? 'Stop loss-ul trebuie să fie un număr de pips mai mare decât 0.' : 'Stop loss-ul nu este un preț valid.'; return res; }
    if (Number.isNaN(vt) || (vt != null && vt <= 0)) { res.err = unit() === 'pips' ? 'Take profit-ul trebuie să fie un număr de pips mai mare decât 0 (sau gol).' : 'Take profit-ul nu este un preț valid.'; return res; }
    const dir = sd === 'buy' ? 1 : -1, dec = E.INSTR[sym].dec;
    if (unit() === 'pips') { res.sl = E.round(ref - dir * vs * pip, dec + 1); res.tp = vt == null ? null : E.round(ref + dir * vt * pip, dec + 1); }
    else { res.sl = vs; res.tp = vt; }
    const err = E.validateLevels(sd, ref, res.sl, res.tp);
    if (err) { res.err = err; return res; }
    res.slPips = Math.abs(ref - res.sl) / pip;
    res.tpPips = res.tp == null ? null : Math.abs(res.tp - ref) / pip;
    res.pipVal = E.pipValueAcct(sym, ref, S.ccy, ratesAt(S.d.t[S.cur]));
    res.riskTarget = S.balance * S.riskPct / 100;
    res.lot = E.lotFor(res.riskTarget, res.slPips, res.pipVal);
    res.risk = E.round(res.slPips * res.pipVal * res.lot, 2);
    if (res.lot < 0.01) { res.err = `Lotul calculat e sub 0,01 (stop loss de ${nf(res.slPips, 1)} pips la un risc de ${money(res.riskTarget, S.ccy)}). Micșorează stop loss-ul sau mărește riscul %.`; return res; }
    res.ok = true;
    return res;
  }
  function updateCalc() {
    if (!S || S.ended) return;
    const p = preview(), set = (id, v) => { $(id).textContent = v; };
    set('sim-c-sl', p.slPips != null ? nf(p.slPips, 1) + ' pips' : '—');
    set('sim-c-tp', p.tpPips != null ? nf(p.tpPips, 1) + ' pips' : '—');
    set('sim-c-rr', p.ok && p.tpPips != null ? '1:' + nf(p.tpPips / p.slPips, 2) : '—');
    set('sim-c-lot', p.lot != null && p.lot >= 0.01 ? nf(p.lot, 2) : '—');
    set('sim-c-risk', p.ok ? money(p.risk, S.ccy) + ' (' + nf(p.risk / S.balance * 100, 2) + '%)' : '—');
    const err = $('sim-order-err');
    const showErr = !!p.err && S.touched;
    err.hidden = !showErr; err.textContent = showErr ? p.err : '';
    const btn = $('sim-place');
    btn.textContent = (p.side === 'buy' ? 'Buy' : 'Sell') + (p.kind === 'market' ? ' la piață' : p.kind === 'limit' ? ' limit' : ' stop');
    btn.classList.toggle('is-buy', p.side === 'buy'); btn.classList.toggle('is-sell', p.side === 'sell');
    $('sim-price-wrap').hidden = p.kind === 'market';
    document.querySelectorAll('.sim-unit-lbl').forEach(e => { e.textContent = unit() === 'pips' ? '(pips)' : '(preț)'; });
    drawLines();
  }
  function placeOrder() {
    S.touched = true;
    const p = preview();
    if (!p.ok) { updateCalc(); $('sim-order-err').hidden = false; $('sim-order-err').textContent = p.err; return; }
    const t = S.d.t[S.cur];
    if (p.kind === 'market') {
      S.pos = E.openMarket({ sym: S.sym, side: p.side, bidClose: bid(), sl: p.sl, tp: p.tp, lot: p.lot, pipVal: p.pipVal, time: t, idx: S.cur, type: 'piață' });
      addMarker(t, p.side, 'in');
      showMsg(`${p.side === 'buy' ? 'Buy' : 'Sell'} ${nf(p.lot, 2)} loturi la ${fmtPrice(S.sym, S.pos.entry)}. Risc: ${money(S.pos.riskMoney, S.ccy)}.`);
    } else {
      S.pending = { sym: S.sym, side: p.side, kind: p.kind, price: p.ref, sl: p.sl, tp: p.tp, lot: p.lot, pipVal: p.pipVal, slPips: p.slPips, placedIdx: S.cur, placedT: t };
      showMsg(`Ordin ${p.side === 'buy' ? 'Buy' : 'Sell'} ${p.kind} plasat la ${fmtPrice(S.sym, p.ref)}. Se execută când prețul ajunge acolo.`);
    }
    S.touched = false;
    afterChange();
  }

  // ---------- poziția deschisă ----------
  function renderPos() {
    const P = S.pos, O = S.pending;
    $('sim-order').hidden = !!(P || O) || S.ended;
    $('sim-pos').hidden = !(P || O) || S.ended;
    if (!P && !O) return;
    const x = P || O, sym = S.sym;
    $('sim-pos-title').textContent = P ? 'Poziție deschisă' : 'Ordin în așteptare';
    $('sim-p-side').textContent = (x.side === 'buy' ? 'Buy' : 'Sell') + (O ? ' ' + O.kind : '');
    $('sim-p-entry').textContent = fmtPrice(sym, P ? P.entry : O.price);
    $('sim-p-lot').textContent = nf(x.lot, 2);
    $('sim-p-risk').textContent = money(P ? P.riskMoney : E.round(O.slPips * O.pipVal * O.lot, 2), S.ccy);
    const sl = $('sim-p-sl'), tp = $('sim-p-tp');
    if (document.activeElement !== sl) sl.value = inputPrice(sym, x.sl);
    if (document.activeElement !== tp) tp.value = x.tp == null ? '' : inputPrice(sym, x.tp);
    $('sim-be').hidden = !P;
    $('sim-close').textContent = P ? 'Închide acum' : 'Anulează ordinul';
    const pl = $('sim-p-pl');
    if (P) {
      const r = E.result(P, E.markPrice(P, bid()));
      pl.textContent = `P/L: ${money(r.money, S.ccy, true)} (${sign(r.pips)}${nf(Math.abs(r.pips), 1)} pips, ${fmtR(r.r)})`;
      pl.className = 'sim-pl ' + (r.money > 0 ? 'pos' : r.money < 0 ? 'neg' : '');
    } else { pl.textContent = 'Așteaptă prețul ' + fmtPrice(sym, O.price) + '.'; pl.className = 'sim-pl'; }
  }
  function applyPosLevels() {
    const x = S.pos || S.pending; if (!x) return;
    const err = $('sim-pos-err');
    let sl = S.pos && S.pos.slDraft != null ? S.pos.slDraft : num($('sim-p-sl').value);
    let tp = S.pos && S.pos.tpDraft != null ? S.pos.tpDraft : ($('sim-p-tp').value.trim() ? num($('sim-p-tp').value) : null);
    if (S.pos) { delete S.pos.slDraft; delete S.pos.tpDraft; }
    let msg = null;
    if (!(sl > 0)) msg = 'Stop loss-ul nu este un preț valid.';
    else if (Number.isNaN(tp) || (tp != null && tp <= 0)) msg = 'Take profit-ul nu este un preț valid.';
    else if (S.pos) {
      const cur = E.markPrice(S.pos, bid());   // prețul la care s-ar închide acum
      if (x.side === 'buy' && sl >= cur) msg = `La Buy, stop loss-ul trebuie să rămână sub prețul curent (${fmtPrice(S.sym, cur)}).`;
      else if (x.side === 'sell' && sl <= cur) msg = `La Sell, stop loss-ul trebuie să rămână deasupra prețului curent (${fmtPrice(S.sym, cur)}).`;
      else if (tp != null && x.side === 'buy' && tp <= cur) msg = `La Buy, take profit-ul trebuie să fie deasupra prețului curent (${fmtPrice(S.sym, cur)}).`;
      else if (tp != null && x.side === 'sell' && tp >= cur) msg = `La Sell, take profit-ul trebuie să fie sub prețul curent (${fmtPrice(S.sym, cur)}).`;
    } else msg = E.validateLevels(x.side, x.price, sl, tp);
    if (msg) { err.textContent = msg; err.hidden = false; renderPos(); drawLines(); return false; }
    err.hidden = true;
    const dec = E.INSTR[S.sym].dec;
    if (!S.pos) {
      const slPips = Math.abs(x.price - sl) / E.pipOf(S.sym), lot = E.lotFor(S.balance * S.riskPct / 100, slPips, x.pipVal);
      if (lot < 0.01) { err.textContent = 'Cu acest stop loss lotul ar fi sub 0,01. Alege un stop loss mai apropiat.'; err.hidden = false; return false; }
      x.slPips = slPips; x.lot = lot;
    }
    x.sl = E.round(sl, dec + 1); x.tp = tp == null ? null : E.round(tp, dec + 1);
    if (S.pos) S.pos.be = Math.abs(S.pos.sl - S.pos.entry) < 1e-9;
    showMsg('Nivelurile au fost actualizate: SL ' + fmtPrice(S.sym, x.sl) + (x.tp != null ? ', TP ' + fmtPrice(S.sym, x.tp) : ', fără TP') + '.');
    afterChange();
    return true;
  }
  function moveToBE() {
    const P = S.pos; if (!P) return;
    const cur = E.markPrice(P, bid());
    if (P.side === 'buy' ? cur <= P.entry : cur >= P.entry) {
      $('sim-pos-err').textContent = 'Break-even se poate muta doar când poziția e pe plus (prețul trebuie să fie dincolo de intrare).';
      $('sim-pos-err').hidden = false; return;
    }
    $('sim-pos-err').hidden = true;
    P.sl = P.entry; P.be = true;
    showMsg('Stop loss mutat la break-even (' + fmtPrice(S.sym, P.entry) + '). Dacă prețul revine, ieși cu 0R.');
    afterChange();
  }
  function closeNow(reason) {
    if (S.pending && !S.pos) { S.pending = null; showMsg('Ordinul în așteptare a fost anulat.'); afterChange(); return; }
    if (!S.pos) return;
    closePos({ price: E.markPrice(S.pos, bid()), reason: reason || 'Manual', both: false, gap: false }, S.cur);
    afterChange();
  }
  const REASON = { TP: 'Take profit', SL: 'Stop loss', BE: 'Break-even', Manual: 'Închidere manuală', Final: 'Final sesiune' };
  function closePos(x, i) {
    const P = S.pos, res = E.result(P, x.price);
    const tr = {
      n: S.trades.length + 1, side: P.side, type: P.type, entryT: P.openTime, entry: P.entry, exitT: S.d.t[i], exit: E.round(x.price, E.INSTR[S.sym].dec + 1),
      sl0: P.sl0, tp0: P.tp0, sl: P.sl, lot: P.lot, risk: P.riskMoney, reason: x.reason, both: !!x.both, gap: !!x.gap, pips: res.pips, r: res.r, money: res.money,
      bars: i - P.openIdx
    };
    S.trades.push(tr);
    S.balance = E.round(S.balance + res.money, 2);
    S.pos = null;
    addMarker(S.d.t[i], tr, 'out');
    let m = `${REASON[x.reason]}: ${fmtR(res.r)} (${money(res.money, S.ccy, true)}).`;
    if (x.both) m += ' În aceeași bară au fost atinse și SL, și TP: am considerat SL primul (varianta prudentă).';
    if (x.gap) m += ' Prețul a sărit peste stop loss (gap), așa că ieșirea s-a făcut la deschiderea barei.';
    showMsg(m, res.money > 0 ? 'good' : res.money < 0 ? 'bad' : '');
    renderStats();
  }
  function addMarker(t, x, kind) {
    if (kind === 'in') S.markers.push({ time: t, position: x === 'buy' ? 'belowBar' : 'aboveBar', color: x === 'buy' ? C.green : C.red, shape: x === 'buy' ? 'arrowUp' : 'arrowDown', text: x === 'buy' ? 'Buy' : 'Sell' });
    else S.markers.push({ time: t, position: x.side === 'buy' ? 'aboveBar' : 'belowBar', color: x.money > 0 ? C.green : x.money < 0 ? C.red : C.text, shape: 'circle', text: (x.reason === 'Manual' || x.reason === 'Final' ? 'Închis' : x.reason) + ' ' + fmtR(x.r) });
    S.markers.sort((a, b) => a.time - b.time);
    markersApi.setMarkers(S.markers.slice());
  }

  // ---------- redare ----------
  function nextYearNeeded() { return S.tf === 'H1' && S.years[1] < 2025 && S.cur > S.d.n - 260; }
  function ensureMore() {
    if (!nextYearNeeded() || loadingMore) return loadingMore;
    const y = S.years[1] + 1;
    loadingMore = loadJson(`${S.sym}-H1-${y}.json`).then(d => { S.d = E.concat(S.d, d); S.years[1] = y; }).catch(() => showMsg('Nu am putut încărca datele pentru anul următor. Verifică conexiunea.', 'warn')).finally(() => { loadingMore = null; });
    return loadingMore;
  }
  /** Avansează o bară. Întoarce false dacă nu se mai poate avansa. */
  function advance() {
    if (!S || S.ended) return false;
    const i = S.cur + 1;
    if (i >= S.d.n) {
      if (S.tf === 'H1' && S.years[1] < 2025) { ensureMore(); showMsg('Se încarcă datele următoare…'); return false; }
      endSession('Ai ajuns la finalul datelor disponibile (decembrie 2025).'); return false;
    }
    if (S.d.t[i] >= S.stopT) { endSession('Sesiunea s-a oprit: urmează o perioadă în care sursa are multe ore lipsă, așa că nu o folosim.'); return false; }
    S.cur = i; S.barsPlayed++;
    const b = { o: S.d.o[i], h: S.d.h[i], l: S.d.l[i], c: S.d.c[i] };
    if (S.pending) {
      const fill = E.pendingTriggered(S.pending, b);
      if (fill != null) {
        const O = S.pending; S.pending = null;
        S.pos = E.makePosition({ sym: S.sym, side: O.side, sl: O.sl, tp: O.tp, lot: O.lot, pipVal: O.pipVal, time: S.d.t[i], idx: i, type: O.kind }, E.round(fill, E.INSTR[S.sym].dec + 1));
        addMarker(S.d.t[i], O.side, 'in');
        showMsg(`Ordinul ${O.side === 'buy' ? 'Buy' : 'Sell'} ${O.kind} s-a executat la ${fmtPrice(S.sym, S.pos.entry)}.`);
        const x = E.checkExit(S.pos, b, true);
        if (x) closePos(x, i);
      }
    } else if (S.pos) {
      const x = E.checkExit(S.pos, b);
      if (x) closePos(x, i);
    }
    series.update(lwBar(i));
    ensureMore();
    return true;
  }
  function step(n) {
    if (!S || S.ended) return;
    let moved = 0;
    for (let k = 0; k < n; k++) { const hadPos = !!(S.pos || S.pending), trades = S.trades.length; if (!advance()) break; moved++; if (n > 1 && (S.trades.length !== trades || (!hadPos && S.pos))) break; }
    if (moved) { if (S.pos && !S.pending) { /* noop */ } afterChange(); }
  }
  function setPlaying(on) {
    clearInterval(playTimer); playTimer = null;
    const b = $('sim-play');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.textContent = on ? 'Pauză' : 'Redare';
    if (on) playTimer = setInterval(() => { if (!S || S.ended) return setPlaying(false); if (loadingMore) return; step(1); }, SPEED_MS[$('sim-speed').value] || 900);
  }

  // ---------- afișare generală ----------
  function showMsg(text, tone) { const m = $('sim-msg'); m.textContent = text; m.dataset.tone = tone || ''; }
  function renderAcct() {
    const P = S.pos;
    const open = P ? E.result(P, E.markPrice(P, bid())).money : 0;
    $('sim-balance').textContent = money(S.balance, S.ccy);
    $('sim-equity').textContent = money(S.balance + open, S.ccy);
    const o = $('sim-openpl'); o.textContent = P ? money(open, S.ccy, true) : '—';
    o.className = open > 0 ? 'pos' : open < 0 ? 'neg' : '';
    $('sim-bars').textContent = String(S.barsPlayed);
    $('sim-when').textContent = S.hidden ? 'Data e ascunsă până la final' : fmtTime(S.d.t[S.cur], S.tf);
  }
  function afterChange() {
    if (!S) return;
    renderAcct(); renderPos(); updateCalc(); drawLines();
    save();
  }
  function renderStats() {
    const st = E.stats(S.trades, S.bal0), ccy = S.ccy;
    const set = (id, v) => { $(id).textContent = v; };
    set('sim-s-n', String(st.n)); set('sim-s-wl', st.n ? `${st.wins} câștigate · ${st.losses} pierdute${st.be ? ' · ' + st.be + ' la zero' : ''}` : '');
    set('sim-s-wr', pct(st.winRate)); set('sim-s-tr', st.n ? fmtR(st.totalR) : '—'); set('sim-s-ar', st.n ? fmtR(st.avgR) : '—');
    set('sim-s-pf', st.profitFactor == null ? '—' : st.profitFactor === Infinity ? '∞ (fără pierderi)' : nf(st.profitFactor, 2));
    set('sim-s-dd', st.n ? money(st.maxDD, ccy) : '—'); set('sim-s-ddp', st.n ? pct(st.maxDDPct, 2) + ' din vârful equity' : '');
    set('sim-s-best', st.best ? money(st.best.money, ccy, true) + ' (' + fmtR(st.best.r) + ')' : '—');
    set('sim-s-worst', st.worst ? money(st.worst.money, ccy, true) + ' (' + fmtR(st.worst.r) + ')' : '—');
    set('sim-s-net', st.n ? money(st.net, ccy, true) + ' (' + sign(st.returnPct) + pct(Math.abs(st.returnPct), 2) + ')' : '—');
    set('sim-s-bal', 'Sold: ' + money(st.balance, ccy));
    for (const [id, v] of [['sim-s-tr', st.totalR], ['sim-s-ar', st.avgR], ['sim-s-net', st.net]]) { $(id).classList.toggle('pos', st.n > 0 && v > 0); $(id).classList.toggle('neg', st.n > 0 && v < 0); }
    const tb = $('sim-trades').tBodies[0];
    tb.innerHTML = S.trades.map(t => `<tr>
      <td>${t.n}</td><td><span class="sim-side ${t.side}">${t.side === 'buy' ? 'Buy' : 'Sell'}</span>${t.type !== 'piață' ? ' <small>' + esc(t.type) + '</small>' : ''}</td>
      <td>${S.hidden ? '<small>dată ascunsă</small>' : '<small>' + esc(fmtTime(t.entryT, S.tf)) + '</small>'}<br>${fmtPrice(S.sym, t.entry)}</td>
      <td>${S.hidden ? '<small>după ' + t.bars + (t.bars === 1 ? ' bară' : ' bare') + '</small>' : '<small>' + esc(fmtTime(t.exitT, S.tf)) + '</small>'}<br>${fmtPrice(S.sym, t.exit)}</td>
      <td>${REASON[t.reason]}${t.both ? ' <small>(SL și TP în aceeași bară)</small>' : ''}</td>
      <td class="num">${sign(t.pips)}${nf(Math.abs(t.pips), 1)}</td><td class="num ${t.r > 0 ? 'pos' : t.r < 0 ? 'neg' : ''}">${fmtR(t.r)}</td>
      <td class="num ${t.money > 0 ? 'pos' : t.money < 0 ? 'neg' : ''}">${money(t.money, ccy, true)}</td></tr>`).join('');
    $('sim-trades-empty').hidden = S.trades.length > 0;
    drawEquity(st.curve);
    $('sim-stats').hidden = false;
  }
  function drawEquity(curve) {
    const el = $('sim-eq-chart');
    if (!eqChart) {
      eqChart = LW.createChart(el, {
        autoSize: true, height: 200,
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: C.text, attributionLogo: false },
        grid: { vertLines: { visible: false }, horzLines: { color: C.grid } },
        rightPriceScale: { borderColor: C.border }, timeScale: { visible: false, borderColor: C.border },
        handleScroll: false, handleScale: false, crosshair: { vertLine: { labelVisible: false } },
        localization: { locale: 'ro-RO', priceFormatter: p => nf(p, 0) }
      });
      eqSeries = eqChart.addSeries(LW.BaselineSeries, { baseValue: { type: 'price', price: S.bal0 }, topLineColor: C.green, bottomLineColor: C.red, topFillColor1: 'rgba(34,197,94,.25)', topFillColor2: 'rgba(34,197,94,.02)', bottomFillColor1: 'rgba(239,68,68,.02)', bottomFillColor2: 'rgba(239,68,68,.25)', lineWidth: 2, priceLineVisible: false });
    }
    eqSeries.applyOptions({ baseValue: { type: 'price', price: S.bal0 } });
    eqSeries.setData(curve.map((v, i) => ({ time: 946684800 + i * 86400, value: v })));
    eqChart.timeScale().fitContent();
  }

  // ---------- salvare ----------
  function snapshot() {
    return { v: 1, id: S.id, sym: S.sym, tf: S.tf, ccy: S.ccy, bal0: S.bal0, riskPct: S.riskPct, mode: S.mode, hidden: S.hidden,
      startT: S.startT, curT: S.d.t[S.cur], stopT: S.stopT, balance: S.balance, pos: S.pos, pending: S.pending, trades: S.trades, markers: S.markers, barsPlayed: S.barsPlayed };
  }
  let saveTimer = null;
  function save() { if (!S || S.ended) return; clearTimeout(saveTimer); saveTimer = setTimeout(() => store.set(KEY_CUR, snapshot()), 250); }

  // ---------- pornire / reluare / final ----------
  function setupError(msg) { const e = $('sim-setup-err'); e.textContent = msg || ''; e.hidden = !msg; }
  function readSetup() {
    const sym = $('sim-sym').value, tf = (document.querySelector('input[name="sim-tf"]:checked') || {}).value || 'H1';
    const mode = (document.querySelector('input[name="sim-mode"]:checked') || {}).value || 'random';
    const bal = numBal($('sim-bal').value), risk = num($('sim-risk').value);
    if (!(bal >= 100) || bal > 10000000) return { err: 'Soldul virtual trebuie să fie un număr între 100 și 10.000.000.' };
    if (!(risk > 0) || risk > 10) return { err: 'Riscul pe tranzacție trebuie să fie între 0 și 10% (de exemplu 1 sau 0,5).' };
    return { sym, tf, mode, bal, risk, ccy: $('sim-ccy').value, date: $('sim-date').value };
  }
  const spanSec = (tf, bars) => bars * E.TF_SEC[tf] * 1.45;   // ~1,45: weekenduri și sărbători
  const future = tf => (tf === 'D1' ? 150 : MIN_FUTURE);
  function validStart(sym, tf, T) {
    const lo = DATA_START + spanSec(tf, HISTORY), hi = DATA_END - spanSec(tf, future(tf));
    if (T < lo || T > hi) return { ok: false, lo, hi };
    for (const [a, b] of incompleteFor(sym)) if (T + spanSec(tf, future(tf)) > a && T - spanSec(tf, HISTORY) < b) return { ok: false, lo, hi, bad: [a, b] };
    return { ok: true, lo, hi };
  }
  function dateLimits() {
    const tf = (document.querySelector('input[name="sim-tf"]:checked') || {}).value || 'H1';
    const lo = DATA_START + spanSec(tf, HISTORY), hi = DATA_END - spanSec(tf, future(tf));
    const iso = t => new Date(t * 1000).toISOString().slice(0, 10);
    $('sim-date').min = iso(lo); $('sim-date').max = iso(hi);
    return { lo, hi };
  }
  async function start(e) {
    if (e) e.preventDefault();
    const cfg = readSetup();
    if (cfg.err) return setupError(cfg.err);
    setupError('');
    const btn = $('sim-start'); btn.disabled = true; btn.textContent = 'Se încarcă datele…';
    try {
      INDEX = INDEX || await loadJson('index.json');
      let T;
      if (cfg.mode === 'date') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(cfg.date)) throw new Error('Alege data de start sau folosește „Perioadă aleatorie”.');
        T = Date.UTC(+cfg.date.slice(0, 4), +cfg.date.slice(5, 7) - 1, +cfg.date.slice(8, 10)) / 1000;
        const v = validStart(cfg.sym, cfg.tf, T);
        if (!v.ok) {
          const f = t => dfLong.format(new Date(t * 1000));
          throw new Error(v.bad ? `Pentru ${cfg.sym} sursa are multe ore lipsă între ${f(v.bad[0])} și ${f(v.bad[1] - 86400)}, așa că nu folosim acea perioadă (nici chiar înainte de ea). Alege altă dată.`
            : `Pentru ${cfg.tf} alege o dată între ${f(v.lo)} și ${f(v.hi)}, ca să avem destule bare înainte și după.`);
        }
      } else {
        const { lo, hi } = { lo: DATA_START + spanSec(cfg.tf, HISTORY), hi: DATA_END - spanSec(cfg.tf, future(cfg.tf)) };
        for (let k = 0; k < 500; k++) { const c = lo + Math.random() * (hi - lo); if (validStart(cfg.sym, cfg.tf, c).ok) { T = c; break; } }
      }
      await begin({ id: uid(), sym: cfg.sym, tf: cfg.tf, ccy: cfg.ccy, bal0: cfg.bal, riskPct: cfg.risk, mode: cfg.mode, hidden: cfg.mode === 'random', startT: T });
    } catch (err) {
      setupError(err.message && !/^\d{3} /.test(err.message) && !/fetch|network/i.test(err.message) ? err.message : 'Nu am putut încărca datele. Verifică conexiunea și încearcă din nou.');
    } finally { btn.disabled = false; btn.textContent = 'Pornește sesiunea'; }
  }
  /** Pornește (sau reia) o sesiune. Pentru reluare, `snap` conține curT, tranzacțiile etc. */
  async function begin(cfg, snap) {
    INDEX = INDEX || await loadJson('index.json');
    const tf = cfg.tf, histSpan = spanSec(tf, HISTORY + 20);
    const curT = snap ? snap.curT : cfg.startT;
    const { d, years } = await loadSeries(cfg.sym, tf, yearOf(cfg.startT - histSpan), yearOf(curT) + (tf === 'H1' ? 0 : 0));
    const rates = await loadRates(cfg.sym, cfg.ccy);
    let startIdx = 0; while (startIdx < d.n - 1 && d.t[startIdx] < cfg.startT) startIdx++;
    let cur = startIdx;
    if (snap) { cur = 0; while (cur < d.n - 1 && d.t[cur] < snap.curT) cur++; }
    let stopT = Infinity;
    for (const [a] of incompleteFor(cfg.sym)) if (a > cfg.startT && a < stopT) stopT = a;
    S = Object.assign({}, cfg, {
      d, years: years.slice(), rates, cur, firstIdx: Math.max(0, startIdx - HISTORY), stopT,
      balance: snap ? snap.balance : cfg.bal0, pos: snap ? snap.pos : null, pending: snap ? snap.pending : null,
      trades: snap ? snap.trades : [], markers: snap ? snap.markers : [], barsPlayed: snap ? snap.barsPlayed : 0, ended: false, touched: false
    });
    setupForm.hidden = true;
    $('sim-session').hidden = false;
    $('sim-stats').hidden = true; $('sim-end-actions').hidden = true; $('sim-stats-msg').textContent = ''; $('sim-reveal').textContent = '';
    $('sim-label').textContent = `${cfg.sym} · ${tf}`;
    // valori implicite pentru SL/TP: ~1x amplitudinea mediană a ultimelor 50 de bare
    const mr = E.medianRangePips(d, cur, 50, cfg.sym);
    const sl = Math.max(5, Math.round(mr * 1.5 / 5) * 5 || 20);
    $('sim-sl').value = String(sl); $('sim-tp').value = String(sl * 2); $('sim-price').value = '';
    document.querySelector('input[name="sim-unit"][value="pips"]').checked = true;
    document.querySelector('input[name="sim-kind"][value="market"]').checked = true;
    const I = E.INSTR[cfg.sym];
    $('sim-spread-note').textContent = `Spread fix: ${nf(I.spread, 1)} pips. Sugestie: stop loss-ul implicit (${sl} pips) e cam 1,5 x amplitudinea obișnuită a unei lumânări ${tf}.`;
    makeChart(); setChartData();
    $('sim-pos-err').hidden = true; $('sim-order-err').hidden = true;
    showMsg(snap ? 'Sesiunea a fost reluată de unde ai rămas.' : 'Sesiunea a început. Analizează graficul, apoi avansează sau plasează un ordin.');
    if (S.trades.length) renderStats();
    afterChange();
    $('sim-session').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('sim-next').focus({ preventScroll: true });
  }
  function endSession(reason) {
    if (!S || S.ended) return;
    setPlaying(false);
    if (S.pending) S.pending = null;
    if (S.pos) closePos({ price: E.markPrice(S.pos, bid()), reason: 'Final', both: false, gap: false }, S.cur);
    S.ended = true; S.hidden = false;
    timeLabels(false);
    chart.timeScale().fitContent();
    drawLines();
    const a = S.d.t[Math.max(S.firstIdx + HISTORY, 0)] || S.startT, b = S.d.t[S.cur];
    let startIdx = 0; while (startIdx < S.d.n - 1 && S.d.t[startIdx] < S.startT) startIdx++;
    const period = `${S.sym} ${S.tf}, ${fmtTime(S.d.t[startIdx], S.tf)} - ${fmtTime(b, S.tf)}`;
    $('sim-reveal').textContent = 'Perioada reală: ' + period + '.';
    $('sim-when').textContent = fmtTime(b, S.tf);
    $('sim-order').hidden = true; $('sim-pos').hidden = true;
    ['sim-next', 'sim-next10', 'sim-play', 'sim-end', 'sim-speed'].forEach(id => { $(id).disabled = true; });
    renderStats();
    $('sim-end-actions').hidden = false;
    showMsg((reason ? reason + ' ' : '') + 'Sesiunea s-a încheiat. Mai jos vezi perioada reală și statisticile.');
    // salvează în istoric
    const st = E.stats(S.trades, S.bal0);
    const list = store.get(KEY_SESS, []);
    list.unshift({ id: S.id, sym: S.sym, tf: S.tf, ccy: S.ccy, bal0: S.bal0, riskPct: S.riskPct, from: S.d.t[startIdx], to: b, bars: S.barsPlayed,
      n: st.n, winRate: st.winRate, totalR: st.totalR, net: st.net, trades: S.trades, ended: new Date().toISOString() });
    store.set(KEY_SESS, list.slice(0, MAX_SAVED));
    store.del(KEY_CUR);
    renderHistory();
    $('sim-stats').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function newSession() {
    setPlaying(false);
    S = null;
    if (chart) { chart.remove(); chart = null; }
    if (eqChart) { eqChart.remove(); eqChart = null; eqSeries = null; }
    ['sim-next', 'sim-next10', 'sim-play', 'sim-end', 'sim-speed'].forEach(id => { $(id).disabled = false; });
    $('sim-session').hidden = true; $('sim-stats').hidden = true;
    setupForm.hidden = false;
    $('sim-resume').hidden = !store.get(KEY_CUR, null);
    setupForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('sim-start').focus({ preventScroll: true });
  }

  // ---------- istoric, CSV, jurnal ----------
  function renderHistory() {
    const list = store.get(KEY_SESS, []);
    $('sim-history').hidden = !list.length;
    $('sim-history-list').innerHTML = list.map(s => `<li><strong>${esc(s.sym)} ${esc(s.tf)}</strong> <span>${esc(fmtTime(s.from, s.tf === 'D1' ? 'D1' : 'D1'))} - ${esc(fmtTime(s.to, 'D1'))}</span>
      <span>${s.n} ${s.n === 1 ? 'tranzacție' : 'tranzacții'}</span><span>${s.n ? pct(s.winRate, 0) + ' câștigătoare' : ''}</span>
      <span class="${s.totalR > 0 ? 'pos' : s.totalR < 0 ? 'neg' : ''}">${s.n ? fmtR(s.totalR) : ''}</span><span class="${s.net > 0 ? 'pos' : s.net < 0 ? 'neg' : ''}">${s.n ? money(s.net, s.ccy, true) : ''}</span></li>`).join('');
  }
  function csv() {
    const ccy = S.ccy, dec = E.INSTR[S.sym].dec;
    const n = (x, d) => (x == null ? '' : Number(x).toFixed(d).replace('.', ','));
    const head = ['Nr', 'Instrument', 'Interval', 'Direcție', 'Tip', 'Data intrare', 'Preț intrare', 'SL inițial', 'TP inițial', 'Lot', 'Risc (' + ccy + ')', 'Data ieșire', 'Preț ieșire', 'Motiv', 'Pips', 'R', 'Profit (' + ccy + ')'];
    const rows = S.trades.map(t => [t.n, S.sym, S.tf, t.side === 'buy' ? 'Buy' : 'Sell', t.type, fmtTime(t.entryT, S.tf), n(t.entry, dec + 1), n(t.sl0, dec + 1), n(t.tp0, dec + 1), n(t.lot, 2), n(t.risk, 2), fmtTime(t.exitT, S.tf), n(t.exit, dec + 1), REASON[t.reason], n(t.pips, 1), n(t.r, 2), n(t.money, 2)]);
    const body = [head, ...rows].map(r => r.map(v => { const s = String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
    const blob = new Blob(['\ufeff' + body + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `simulator-${S.sym}-${S.tf}-${isoDate(S.startT, 'D1')}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    $('sim-stats-msg').textContent = 'Fișierul CSV a fost descărcat (' + S.trades.length + ' tranzacții, separator punct și virgulă).';
  }
  const JR = { TP: 'TP', SL: 'SL', BE: 'BE', Manual: 'Manual', Final: 'Manual' };
  function toJournal() {
    if (!S || !S.ended) return;
    let list;
    try { list = JSON.parse(localStorage.getItem(KEY_J) || '[]'); if (!Array.isArray(list)) list = []; }
    catch (e) { $('sim-stats-msg').textContent = 'Nu am putut citi jurnalul din acest browser.'; return; }
    const ids = new Set(list.map(t => t && t.id));
    const now = new Date().toISOString(), dec = E.INSTR[S.sym].dec;
    let added = 0;
    for (const t of S.trades) {
      const id = `sim-${S.id}-${t.n}`;
      if (ids.has(id)) continue;
      list.push({ id, data: isoDate(t.entryT, S.tf), pereche: S.sym, directie: t.side === 'buy' ? 'Buy' : 'Sell', sesiune: '',
        setup: `Simulator (backtesting) · ${S.tf} · ordin ${t.type}`, intrare: E.round(t.entry, dec + 1), sl: t.sl0, tp: t.tp0, lot: t.lot,
        riscPct: S.riskPct, riscBani: t.risk, rezultat: JR[t.reason], r: t.r, plan: '', emotii: '', lectie: '', creat: now, modificat: '', sursa: 'simulator' });
      added++;
    }
    const m = $('sim-stats-msg');
    if (!S.trades.length) { m.textContent = 'Nu ai tranzacții închise de trimis în jurnal.'; return; }
    if (!added) { m.innerHTML = 'Tranzacțiile din această sesiune sunt deja în <a href="jurnal.html">jurnal</a>.'; return; }
    if (!store.set(KEY_J, list)) { m.textContent = 'Nu am putut salva în jurnal (spațiul browserului e plin sau blocat).'; return; }
    m.innerHTML = `Am adăugat ${added} ${added === 1 ? 'tranzacție' : 'tranzacții'} în <a href="jurnal.html">jurnalul tău</a>, marcate cu „Simulator”.`;
  }

  // ---------- evenimente ----------
  function syncSetup() {
    const mode = (document.querySelector('input[name="sim-mode"]:checked') || {}).value;
    $('sim-date-wrap').hidden = mode !== 'date';
    $('sim-mode-hint').textContent = mode === 'date'
      ? 'Cu o dată aleasă de tine, data se vede pe grafic. Atenție la tentația de a folosi ce știi deja despre acea perioadă.'
      : 'Cu „Perioadă aleatorie” data rămâne ascunsă până la finalul sesiunii, ca să nu fii influențat de ce știi deja despre acea perioadă.';
    const { lo, hi } = dateLimits();
    if (mode === 'date' && !$('sim-date').value) $('sim-date').value = new Date(((lo + hi) / 2) * 1000).toISOString().slice(0, 10);
  }
  setupForm.addEventListener('submit', start);
  setupForm.addEventListener('change', syncSetup);
  $('sim-resume').addEventListener('click', async () => {
    const snap = store.get(KEY_CUR, null);
    if (!snap || snap.v !== 1) { $('sim-resume').hidden = true; return; }
    try { await begin({ id: snap.id, sym: snap.sym, tf: snap.tf, ccy: snap.ccy, bal0: snap.bal0, riskPct: snap.riskPct, mode: snap.mode, hidden: snap.hidden, startT: snap.startT }, snap); }
    catch (e) { setupError('Nu am putut relua sesiunea. Pornește una nouă.'); store.del(KEY_CUR); $('sim-resume').hidden = true; }
  });
  $('sim-order').addEventListener('submit', e => { e.preventDefault(); placeOrder(); });
  $('sim-order').addEventListener('input', e => { if (e.target.id === 'sim-sl' || e.target.id === 'sim-tp' || e.target.id === 'sim-price') S.touched = true; updateCalc(); });
  $('sim-order').addEventListener('change', () => { updateCalc(); });
  // la schimbarea unității, convertește valorile existente
  document.querySelectorAll('input[name="sim-unit"]').forEach(r => r.addEventListener('change', () => {
    if (!S) return;
    const ref = refPrice(side(), kind()), pip = E.pipOf(S.sym), dir = side() === 'buy' ? 1 : -1;
    if (!(ref > 0)) return;
    for (const [id, sgn] of [['sim-sl', -1], ['sim-tp', 1]]) {
      const v = num($(id).value); if (!(v > 0)) continue;
      $(id).value = unit() === 'price' ? inputPrice(S.sym, ref + sgn * dir * v * pip) : nf(Math.abs(v - ref) / pip, 0, 1).replace(/\s/g, '');
    }
    updateCalc();
  }));
  $('sim-next').addEventListener('click', () => step(1));
  $('sim-next10').addEventListener('click', () => step(10));
  $('sim-play').addEventListener('click', () => setPlaying(!playTimer));
  $('sim-speed').addEventListener('change', () => { if (playTimer) setPlaying(true); });
  $('sim-end').addEventListener('click', () => endSession(''));
  $('sim-p-apply').addEventListener('click', applyPosLevels);
  $('sim-pos').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.target.id === 'sim-p-sl' || e.target.id === 'sim-p-tp')) { e.preventDefault(); applyPosLevels(); } });
  $('sim-be').addEventListener('click', moveToBE);
  $('sim-close').addEventListener('click', () => closeNow('Manual'));
  $('sim-csv').addEventListener('click', csv);
  $('sim-journal').addEventListener('click', toJournal);
  $('sim-new').addEventListener('click', newSession);
  $('sim-clear').addEventListener('click', () => { store.del(KEY_SESS); renderHistory(); });
  document.addEventListener('keydown', e => {
    if (!S || S.ended || $('sim-session').hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test((e.target.tagName || '')) || e.target.isContentEditable || $('sim-help').open) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });
  // ajutor
  const help = $('sim-help');
  $('sim-help-open').addEventListener('click', () => { if (help.showModal) help.showModal(); else help.setAttribute('open', ''); });
  help.addEventListener('close', () => store.set(KEY_HELP, 1));
  help.addEventListener('click', e => { if (e.target === help) help.close(); });
  bindDrag();

  // inițializare
  setupForm.hidden = false;
  syncSetup();
  $('sim-resume').hidden = !store.get(KEY_CUR, null);
  renderHistory();
  if (!store.get(KEY_HELP, 0) && help.showModal) help.showModal();
  window.__sim = { get S() { return S; }, step, endSession, get chart() { return chart; }, get series() { return series; }, lines };   // pentru teste
})();
