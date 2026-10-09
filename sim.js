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
  // intervalul datelor vine din data/sim/index.json (se actualizează odată cu datele)
  let YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], LAST_YEAR = 2026;
  const DATA_START = Date.UTC(2019, 0, 2) / 1000;
  let DATA_END = Date.UTC(2026, 8, 24, 21) / 1000, DATA_END_LABEL = 'septembrie 2026';   // valori de rezervă până se citește index.json
  function applyIndex(ix) {
    if (!ix || !ix.to) return;
    const [y, m, d] = ix.to.split('-').map(Number);
    DATA_END = Date.UTC(y, m - 1, d, 21) / 1000;
    DATA_END_LABEL = new Intl.DateTimeFormat('ro-RO', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(DATA_END * 1000));
    const any = Object.values(ix.instruments || {})[0];
    if (any && Array.isArray(any.H1)) { YEARS = any.H1.slice(); LAST_YEAR = Math.max(...YEARS); }
  }
  const CSS = getComputedStyle(document.documentElement);
  const C = { green: '#089981', red: '#f23645', amber: '#f7a600', blue: '#2962ff', text: '#b2b5be', grid: 'rgba(42,46,57,.6)', border: '#2a2e39', bg: '#131722' };

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
  const loadYear = (sym, y) => loadJson(`${sym}-H1-${y}.json`);
  /** Barele H1 pentru anii [y0, y1] (ceasul de bază al simulatorului; H4 și D1 se construiesc din ele). */
  async function loadSeries(sym, y0, y1) {
    y0 = Math.max(YEARS[0], y0); y1 = Math.min(LAST_YEAR, y1);
    const parts = await Promise.all(YEARS.filter(y => y >= y0 && y <= y1).map(y => loadYear(sym, y)));
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
  let S = null;            // sesiunea curentă: S.d = barele H1 (ceasul de bază), S.cur = indexul H1 curent, S.tf = intervalul afișat
  let chart = null, series = null, markersApi = null, eqChart = null, eqSeries = null;
  const lines = {};        // linii de preț: e:/sl:/tp:<id> (poziții), o:/osl:/otp:<id> (ordine), psl/ptp/ppr (previzualizare)
  let playTimer = null, loadingMore = null, legendHover = false, sumChart = null;
  const VIEW_BARS = 150;   // câte bare din intervalul afișat se văd la început (restul istoricului e la derulare)

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
      layout: { background: { type: 'solid', color: C.bg }, textColor: C.text, fontSize: 12, fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif", attributionLogo: true, panes: { separatorColor: C.border, separatorHoverColor: 'rgba(41,98,255,.35)' } },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: C.border, rightOffset: 6, barSpacing: 8, shiftVisibleRangeOnNewBar: true },
      crosshair: { mode: LW.CrosshairMode.Normal, vertLine: { color: '#758696', style: LW.LineStyle.Dashed, labelBackgroundColor: '#363a45' }, horzLine: { color: '#758696', style: LW.LineStyle.Dashed, labelBackgroundColor: '#363a45' } },
      handleScroll: { vertTouchDrag: false }
    });
    series = chart.addSeries(LW.CandlestickSeries, {
      upColor: C.green, downColor: C.red, borderUpColor: C.green, borderDownColor: C.red, wickUpColor: C.green, wickDownColor: C.red,
      priceFormat: { type: 'price', precision: E.INSTR[S.sym].dec, minMove: Math.pow(10, -E.INSTR[S.sym].dec) },
      priceLineColor: 'rgba(203,213,225,.5)',
      // scala include mereu nivelurile pozițiilor și ordinelor (ca liniile să se vadă și să poată fi trase)
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
    chart.subscribeCrosshairMove(p => {
      const d = p && p.time != null && series ? p.seriesData.get(series) : null;
      legendHover = !!d; legend(d || null);
      if (window.SimExtra && SimExtra.onCrosshair) SimExtra.onCrosshair(p);
    });
  }
  const V = () => S.view;
  const lwBar = k => ({ time: V().time[k], open: V().o[k], high: V().h[k], low: V().l[k], close: V().c[k] });
  const lastBar = () => lwBar(V().time.length - 1);
  /** Legenda OHLC din colțul stânga sus (ca în TradingView): bara de sub cursor sau ultima bară. */
  function legend(bar) {
    if (!S || !S.view) return;
    const b = bar || lastBar(), f = p => fmtPrice(S.sym, p), up = b.close >= b.open;
    const ch = b.close - b.open, pc = b.open ? ch / b.open * 100 : 0;
    $('sim-legend').innerHTML = `<strong>${esc(S.sym)} · ${esc(S.tf)}</strong>` +
      (S.hidden ? '' : `<span class="lg-t">${esc(fmtTime(b.time, S.tf))}</span>`) +
      `<span class="${up ? 'up' : 'dn'}"><i>O</i>${f(b.open)} <i>H</i>${f(b.high)} <i>L</i>${f(b.low)} <i>C</i>${f(b.close)} <em>${ch >= 0 ? '+' : '−'}${f(Math.abs(ch))} (${ch >= 0 ? '+' : '−'}${nf(Math.abs(pc), 2)}%)</em></span>`;
  }
  /** Marcajele se păstrează cu ora H1; pe grafic se pun pe bara intervalului afișat care o conține. */
  function renderMarkers() {
    if (!markersApi) return;
    const last = V().time[V().time.length - 1];
    markersApi.setMarkers(S.markers.map(m => Object.assign({}, m, { time: E.bucketStart(m.t, S.tf) })).filter(m => m.time <= last).sort((a, b) => a.time - b.time));
  }
  /** Recalculează barele intervalului afișat din H1 (până la ora curentă) și redesenează. */
  function setChartData(keepRange) {
    S.view = E.aggregate(S.d, S.cur, S.tf);
    const n = S.view.time.length, arr = new Array(n);
    for (let k = 0; k < n; k++) arr[k] = lwBar(k);
    const range = keepRange ? chart.timeScale().getVisibleLogicalRange() : null;
    series.setData(arr);
    renderMarkers();
    if (range) chart.timeScale().setVisibleLogicalRange(range);
    else chart.timeScale().setVisibleLogicalRange({ from: n - VIEW_BARS, to: n - 1 + 6 });
    if (window.SimExtra && SimExtra.onData) SimExtra.onData(true);
  }
  function setLine(key, price, opts) {
    if (price == null || !Number.isFinite(price)) { if (lines[key]) { series.removePriceLine(lines[key]); delete lines[key]; } return; }
    const o = Object.assign({ price, lineWidth: 1, axisLabelVisible: true, lineStyle: LW.LineStyle.Solid }, opts);
    if (lines[key]) lines[key].applyOptions(o); else lines[key] = series.createPriceLine(o);
  }
  const posById = id => S.positions.find(p => p.id === id) || null;
  const ordById = id => S.orders.find(o => o.id === id) || null;
  /** Eticheta liniei SL/TP: rezultatul în bani și R dacă prețul ajunge acolo. x = { side, entry, lot, pipVal, risk }. */
  function levelLabel(base, x, price) {
    if (!x || price == null) return base;
    const dir = x.side === 'buy' ? 1 : -1, pips = (price - x.entry) * dir / E.pipOf(S.sym);
    const m = pips * x.pipVal * x.lot, r = x.risk > 0 ? m / x.risk : 0;
    const rs = `${r >= 0 ? '+' : '−'}${nf(Math.abs(r), 2)}R`;
    // pe grafice înguste etichetele scurte nu acoperă legenda; suma în bani rămâne în panou
    return $('sim-chart').clientWidth < 560 ? `${base} ${rs}` : `${base}  ${money(m, S.ccy, true)}  ${rs}`;
  }
  const posInfo = P => ({ side: P.side, entry: P.entry, lot: P.lot, pipVal: P.pipVal, risk: P.riskMoney * (P.lot / (P.lot0 || P.lot)) });
  const ordInfo = O => ({ side: O.side, entry: O.price, lot: O.lot, pipVal: O.pipVal, risk: O.slPips * O.pipVal * O.lot });
  const tag = x => (S.positions.length + S.orders.length > 1 ? '#' + x.n + ' ' : '');
  function drawLines() {
    if (!series) return;
    const want = new Set();
    const put = (key, price, opts) => { if (price == null) return; want.add(key); setLine(key, price, opts); };
    const sel = S.sel;
    for (const P of S.positions) {
      const s = sel === P.id, w = s ? 2 : 1, t = tag(P);
      put('e:' + P.id, P.entry, { color: 'rgba(203,213,225,.85)', lineWidth: 1, lineStyle: LW.LineStyle.Dashed, title: `${t}${P.side === 'buy' ? 'Buy' : 'Sell'} ${nf(P.lot, 2)}` });
      put('sl:' + P.id, P.sl, { color: C.red, lineWidth: w, title: levelLabel(t + (P.be ? 'SL (BE)' : 'SL'), posInfo(P), P.sl) });
      put('tp:' + P.id, P.tp, { color: C.green, lineWidth: w, title: levelLabel(t + 'TP', posInfo(P), P.tp) });
    }
    for (const O of S.orders) {
      const t = tag(O), w = sel === O.id ? 2 : 1;
      put('o:' + O.id, O.price, { color: C.amber, lineWidth: w, lineStyle: LW.LineStyle.Dashed, title: `${t}${O.side === 'buy' ? 'Buy' : 'Sell'} ${O.kind} ${nf(O.lot, 2)}` });
      put('osl:' + O.id, O.sl, { color: 'rgba(242,54,69,.8)', lineWidth: w, lineStyle: LW.LineStyle.Dotted, title: levelLabel(t + 'SL', ordInfo(O), O.sl) });
      put('otp:' + O.id, O.tp, { color: 'rgba(8,153,129,.85)', lineWidth: w, lineStyle: LW.LineStyle.Dotted, title: levelLabel(t + 'TP', ordInfo(O), O.tp) });
    }
    // previzualizarea ordinului din bilet (linii punctate, se pot trage)
    if (!S.ended && S.showPreview && !S.positions.length && !S.orders.length) {
      const pr = preview();
      if (pr.ok) {
        const x = { side: pr.side, entry: pr.ref, lot: pr.lot, pipVal: pr.pipVal, risk: pr.risk };
        put('psl', pr.sl, { color: 'rgba(242,54,69,.65)', lineStyle: LW.LineStyle.Dashed, title: levelLabel('SL', x, pr.sl) });
        put('ptp', pr.tp, { color: 'rgba(8,153,129,.7)', lineStyle: LW.LineStyle.Dashed, title: levelLabel('TP', x, pr.tp) });
      }
      if (pr.kind !== 'market' && pr.ref) put('ppr', pr.ref, { color: 'rgba(247,166,0,.75)', lineStyle: LW.LineStyle.Dashed, title: 'Ordin' });
    }
    for (const k of Object.keys(lines)) if (!want.has(k)) { series.removePriceLine(lines[k]); delete lines[k]; }
  }

  // ---------- tragerea liniilor (mouse + atingere) ----------
  let drag = null;
  const DRAGGABLE = /^(sl|tp|o|osl|otp):|^(psl|ptp|ppr)$/;
  function lineAtY(y, tol) {
    let best = null;
    for (const key of Object.keys(lines)) {
      if (!DRAGGABLE.test(key)) continue;
      const yy = series.priceToCoordinate(lines[key].options().price);
      if (yy == null) continue;
      const dist = Math.abs(yy - y);
      // la egalitate are prioritate elementul selectat
      const pri = S.sel && key.endsWith(':' + S.sel) ? -0.5 : 0;
      if (dist <= tol && (!best || dist + pri < best.dist)) best = { key, dist: dist + pri };
    }
    return best && best.key;
  }
  function chartY(e) { const r = $('sim-chart').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width }; }
  function onDown(e) {
    if (!S || S.ended || !series || (window.SimExtra && SimExtra.busy && SimExtra.busy())) return;
    const { y } = chartY(e);
    const key = lineAtY(y, e.pointerType === 'touch' ? 18 : 8);
    if (!key) return;
    drag = { key, id: e.pointerId };
    e.preventDefault(); e.stopPropagation();
    try { $('sim-chart').setPointerCapture(e.pointerId); } catch (_) { /* ignorat */ }
    chart.applyOptions({ handleScroll: false, handleScale: false });
    chart.priceScale('right').applyOptions({ autoScale: false });   // scala fixă cât timp tragi linia
    $('sim-chart').classList.add('is-dragging');
    const id = key.includes(':') ? +key.split(':')[1] : null;
    if (id != null && S.sel !== id) { S.sel = id; renderPos(); }
  }
  function onMove(e) {
    const el = $('sim-chart');
    if (!drag) {
      if (e.pointerType === 'mouse' && S && series && !(window.SimExtra && SimExtra.busy && SimExtra.busy())) el.classList.toggle('can-drag', !!lineAtY(chartY(e).y, 8));
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
    const key = drag.key;
    drag = null;
    chart.applyOptions({ handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false }, handleScale: true });
    $('sim-chart').classList.remove('is-dragging');
    chart.priceScale('right').applyOptions({ autoScale: true });
    if (p != null && p > 0 && e.type !== 'pointercancel') dragTo(key, p, true);
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
  /** Mută o linie trasă pe grafic: actualizează poziția/ordinul sau câmpurile biletului. */
  function dragTo(key, p, final) {
    const sym = S.sym, dec = E.INSTR[sym].dec;
    p = E.round(p, dec);
    const [kind, idS] = key.split(':'), id = idS == null ? null : +idS;
    if (kind === 'sl' || kind === 'tp') {
      const P = posById(id); if (!P) return;
      if (!final) { setLine(key, p, { title: levelLabel(tag(P) + (kind === 'sl' ? 'SL' : 'TP'), posInfo(P), p) }); if (S.sel === id) $(kind === 'sl' ? 'sim-p-sl' : 'sim-p-tp').value = inputPrice(sym, p); return; }
      const err = setLevels(P, kind === 'sl' ? p : P.sl, kind === 'tp' ? p : P.tp);
      if (err) { showMsg(err, 'warn'); showPosErr(err); }
      return;
    }
    if (kind === 'o' || kind === 'osl' || kind === 'otp') {
      const O = ordById(id); if (!O) return;
      const field = kind === 'o' ? 'price' : kind === 'osl' ? 'sl' : 'tp';
      if (!final) { setLine(key, p, field === 'price' ? {} : { title: levelLabel(tag(O) + field.toUpperCase(), ordInfo(Object.assign({}, O, { [field]: p })), p) }); return; }
      const o = Object.assign({}, O, { [field]: p });
      const err = pendingError(o) || E.validateLevels(o.side, o.price, o.sl, o.tp);
      if (err) { showMsg(err, 'warn'); drawLines(); return; }
      const slPips = Math.abs(o.price - o.sl) / E.pipOf(sym), lot = E.lotFor(S.balance * S.riskPct / 100, slPips, o.pipVal);
      if (lot < 0.01) { showMsg('Cu acest stop loss lotul ar fi sub 0,01. Am păstrat nivelul anterior.', 'warn'); drawLines(); return; }
      Object.assign(O, { [field]: p, slPips, lot });
      showMsg('Ordinul a fost modificat: ' + (field === 'price' ? 'preț ' : field.toUpperCase() + ' ') + fmtPrice(sym, p) + '.');
      return;
    }
    // previzualizare: actualizează câmpurile biletului
    const pr = preview();
    if (kind === 'ppr') { $('sim-price').value = inputPrice(sym, p); }
    else {
      const field = $(kind === 'psl' ? 'sim-sl' : 'sim-tp');
      if (unit() === 'pips') { const ref = pr.ref || refPrice(side(), ordKind()); field.value = nf(Math.abs(ref - p) / E.pipOf(sym), 0, 1).replace(/\s/g, ''); }
      else field.value = inputPrice(sym, p);
    }
    updateCalc();
  }

  // ---------- bilet de ordin ----------
  const side = () => (document.querySelector('input[name="sim-side"]:checked') || {}).value || 'buy';
  const ordKind = () => (document.querySelector('input[name="sim-kind"]:checked') || {}).value || 'market';
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
  /** Calculează planul din bilet (fără să-l execute). */
  function preview() {
    const sd = side(), kd = ordKind(), sym = S.sym, pip = E.pipOf(sym);
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
    if (!p.ok) { updateCalc(); $('sim-order-err').hidden = false; $('sim-order-err').textContent = p.err; return false; }
    const t = S.d.t[S.cur], id = ++S.seq;
    if (p.kind === 'market') {
      const P = E.openMarket({ sym: S.sym, side: p.side, bidClose: bid(), sl: p.sl, tp: p.tp, lot: p.lot, pipVal: p.pipVal, time: t, idx: S.cur, type: 'piață' });
      Object.assign(P, { id, n: id, lot0: P.lot, setup: currentSetup() });
      S.positions.push(P); S.sel = id;
      addMarker(t, p.side, 'in');
      showMsg(`${tag(P)}${p.side === 'buy' ? 'Buy' : 'Sell'} ${nf(p.lot, 2)} loturi la ${fmtPrice(S.sym, P.entry)}. Risc: ${money(P.riskMoney, S.ccy)}.`);
    } else {
      const O = { id, n: id, sym: S.sym, side: p.side, kind: p.kind, price: p.ref, sl: p.sl, tp: p.tp, lot: p.lot, pipVal: p.pipVal, slPips: p.slPips, placedIdx: S.cur, placedT: t, setup: currentSetup() };
      S.orders.push(O); S.sel = id;
      showMsg(`Ordin ${p.side === 'buy' ? 'Buy' : 'Sell'} ${p.kind} plasat la ${fmtPrice(S.sym, p.ref)}. Se execută când prețul ajunge acolo.`);
    }
    S.touched = false;
    afterChange();
    return true;
  }
  const currentSetup = () => { const el = $('sim-setup-tag'); return el ? el.value.trim().slice(0, 40) : ''; };

  // ---------- poziții deschise ----------
  const selItem = () => posById(S.sel) || ordById(S.sel) || S.positions[0] || S.orders[0] || null;
  function showPosErr(msg) { const e = $('sim-pos-err'); e.textContent = msg || ''; e.hidden = !msg; }
  function openPL(P) { return E.round((E.markPrice(P, bid()) - P.entry) * (P.side === 'buy' ? 1 : -1) / E.pipOf(S.sym) * P.pipVal * P.lot, 2); }
  function renderPos() {
    const items = [...S.positions, ...S.orders];
    $('sim-pos').hidden = !items.length || S.ended;
    $('sim-order').hidden = !!S.ended;
    const list = $('sim-pos-list');
    list.hidden = !items.length || S.ended;
    $('sim-close-all').hidden = S.positions.length < 2 || S.ended;
    $('sim-pos-count').textContent = String(items.length);
    list.innerHTML = items.map(x => {
      const isP = !!posById(x.id) && S.positions.includes(x), pl = isP ? openPL(x) : null;
      return `<li><button type="button" class="ws-pos-row${x.id === (selItem() || {}).id ? ' is-sel' : ''}" data-id="${x.id}" aria-pressed="${x.id === (selItem() || {}).id}">` +
        `<span class="sim-side ${x.side}">${x.side === 'buy' ? 'Buy' : 'Sell'}</span> <span>#${x.n}${isP ? '' : ' ' + esc(x.kind)} · ${nf(x.lot, 2)} lot</span>` +
        `<b class="${pl > 0 ? 'pos' : pl < 0 ? 'neg' : ''}">${isP ? money(pl, S.ccy, true) : fmtPrice(S.sym, x.price)}</b></button></li>`;
    }).join('');
    const x = selItem();
    if (!x || S.ended) return;
    const P = posById(x.id), O = P ? null : x, sym = S.sym;
    $('sim-pos-title').textContent = (P ? 'Poziție deschisă' : 'Ordin în așteptare') + (items.length > 1 ? ' #' + x.n : '');
    $('sim-p-side').textContent = (x.side === 'buy' ? 'Buy' : 'Sell') + (O ? ' ' + O.kind : '');
    $('sim-p-entry').textContent = fmtPrice(sym, P ? P.entry : O.price);
    $('sim-p-lot').textContent = nf(x.lot, 2) + (P && P.lot0 && P.lot0 !== P.lot ? ' din ' + nf(P.lot0, 2) : '');
    $('sim-p-risk').textContent = money(P ? P.riskMoney : E.round(O.slPips * O.pipVal * O.lot, 2), S.ccy);
    const sl = $('sim-p-sl'), tp = $('sim-p-tp');
    if (document.activeElement !== sl) sl.value = inputPrice(sym, x.sl);
    if (document.activeElement !== tp) tp.value = x.tp == null ? '' : inputPrice(sym, x.tp);
    $('sim-be').hidden = !P; $('sim-partial').hidden = !P;
    $('sim-close').textContent = P ? 'Închide acum' : 'Anulează ordinul';
    const pl = $('sim-p-pl');
    if (P) {
      const m = openPL(P), pips = (E.markPrice(P, bid()) - P.entry) * (P.side === 'buy' ? 1 : -1) / E.pipOf(sym);
      const rNow = (m + (P.realized || 0)) / P.riskMoney;
      pl.textContent = `P/L: ${money(m, S.ccy, true)} (${sign(pips)}${nf(Math.abs(pips), 1)} pips, ${fmtR(E.round(m / P.riskMoney, 2))})` + (P.realized ? ` · realizat ${money(P.realized, S.ccy, true)} · total ${fmtR(E.round(rNow, 2))}` : '');
      pl.className = 'sim-pl ' + (m > 0 ? 'pos' : m < 0 ? 'neg' : '');
    } else { pl.textContent = 'Așteaptă prețul ' + fmtPrice(sym, O.price) + '.'; pl.className = 'sim-pl'; }
  }
  /** Schimbă SL/TP pentru o poziție sau un ordin. Întoarce un mesaj de eroare sau null. */
  function setLevels(x, sl, tp) {
    const P = posById(x.id);
    let msg = null;
    if (!(sl > 0)) msg = 'Stop loss-ul nu este un preț valid.';
    else if (Number.isNaN(tp) || (tp != null && tp <= 0)) msg = 'Take profit-ul nu este un preț valid.';
    else if (P) {
      const cur = E.markPrice(P, bid());   // prețul la care s-ar închide acum
      if (x.side === 'buy' && sl >= cur) msg = `La Buy, stop loss-ul trebuie să rămână sub prețul curent (${fmtPrice(S.sym, cur)}).`;
      else if (x.side === 'sell' && sl <= cur) msg = `La Sell, stop loss-ul trebuie să rămână deasupra prețului curent (${fmtPrice(S.sym, cur)}).`;
      else if (tp != null && x.side === 'buy' && tp <= cur) msg = `La Buy, take profit-ul trebuie să fie deasupra prețului curent (${fmtPrice(S.sym, cur)}).`;
      else if (tp != null && x.side === 'sell' && tp >= cur) msg = `La Sell, take profit-ul trebuie să fie sub prețul curent (${fmtPrice(S.sym, cur)}).`;
    } else msg = E.validateLevels(x.side, x.price, sl, tp);
    if (msg) { drawLines(); renderPos(); return msg; }
    const dec = E.INSTR[S.sym].dec;
    if (!P) {
      const slPips = Math.abs(x.price - sl) / E.pipOf(S.sym), lot = E.lotFor(S.balance * S.riskPct / 100, slPips, x.pipVal);
      if (lot < 0.01) { drawLines(); return 'Cu acest stop loss lotul ar fi sub 0,01. Alege un stop loss mai apropiat.'; }
      x.slPips = slPips; x.lot = lot;
    }
    x.sl = E.round(sl, dec + 1); x.tp = tp == null ? null : E.round(tp, dec + 1);
    if (P) P.be = Math.abs(P.sl - P.entry) < 1e-9;
    showPosErr('');
    showMsg(tag(x) + 'Nivelurile au fost actualizate: SL ' + fmtPrice(S.sym, x.sl) + (x.tp != null ? ', TP ' + fmtPrice(S.sym, x.tp) : ', fără TP') + '.');
    afterChange();
    return null;
  }
  function applyPosLevels() {
    const x = selItem(); if (!x) return false;
    const sl = num($('sim-p-sl').value), tp = $('sim-p-tp').value.trim() ? num($('sim-p-tp').value) : null;
    const err = setLevels(x, sl, tp);
    if (err) { showPosErr(err); return false; }
    return true;
  }
  function moveToBE() {
    const P = posById((selItem() || {}).id); if (!P) return;
    const cur = E.markPrice(P, bid());
    if (P.side === 'buy' ? cur <= P.entry : cur >= P.entry) { showPosErr('Break-even se poate muta doar când poziția e pe plus (prețul trebuie să fie dincolo de intrare).'); return; }
    showPosErr('');
    P.sl = P.entry; P.be = true;
    showMsg(tag(P) + 'Stop loss mutat la break-even (' + fmtPrice(S.sym, P.entry) + '). Dacă prețul revine, restul poziției iese la 0.');
    afterChange();
  }
  /** Închide (complet) elementul selectat sau anulează ordinul. */
  function closeNow(reason) {
    const x = selItem(); if (!x) return;
    if (ordById(x.id) && !posById(x.id)) { S.orders = S.orders.filter(o => o.id !== x.id); S.sel = null; showMsg('Ordinul în așteptare a fost anulat.'); afterChange(); return; }
    closeFull(x, { price: E.markPrice(x, bid()), reason: reason || 'Manual', both: false, gap: false }, S.cur);
    afterChange();
  }
  function closeAll() {
    for (const P of [...S.positions]) closeFull(P, { price: E.markPrice(P, bid()), reason: 'Manual', both: false, gap: false }, S.cur);
    showMsg('Toate pozițiile au fost închise.');
    afterChange();
  }
  /** Închidere parțială: frac (0..1) sau lot exact. */
  function closePartial(frac, lotExact) {
    const P = posById((selItem() || {}).id); if (!P) return;
    const lot = lotExact != null ? Math.floor(lotExact * 100 + 1e-9) / 100 : E.partialLot(P, frac);
    if (!(lot >= 0.01)) { showPosErr('Lotul de închis trebuie să fie de cel puțin 0,01.'); return; }
    if (lot >= P.lot - 1e-9) { closeFull(P, { price: E.markPrice(P, bid()), reason: 'Manual', both: false, gap: false }, S.cur); afterChange(); return; }
    const part = E.closePart(P, E.markPrice(P, bid()), lot, 'Parțial', S.d.t[S.cur]);
    S.balance = E.round(S.balance + part.money, 2);
    S.markers.push({ t: S.d.t[S.cur], position: P.side === 'buy' ? 'aboveBar' : 'belowBar', color: part.money >= 0 ? C.green : C.red, shape: 'square', text: `#${P.n} ${nf(lot, 2)}` });
    renderMarkers();
    showPosErr('');
    showMsg(`${tag(P)}Închidere parțială ${nf(lot, 2)} loturi: ${money(part.money, S.ccy, true)} (${fmtR(E.round(part.r, 2))}). Rămân ${nf(P.lot, 2)} loturi.`, part.money > 0 ? 'good' : part.money < 0 ? 'bad' : '');
    afterChange();
  }
  const REASON = { TP: 'Take profit', SL: 'Stop loss', BE: 'Break-even', Manual: 'Închidere manuală', Final: 'Final sesiune', 'Parțial': 'Închidere parțială', Provocare: 'Regulă provocare' };
  /** Închide restul poziției și înregistrează tranzacția (cu toate părțile). */
  function closeFull(P, x, i) {
    const part = E.closePart(P, x.price, P.lot, x.reason, S.d.t[i]);
    S.balance = E.round(S.balance + part.money, 2);
    const sm = E.summarize(P);
    const tr = {
      n: S.trades.length + 1, pid: P.n, sym: S.sym, side: P.side, type: P.type, entryT: P.openTime, entry: P.entry, exitT: S.d.t[i], exit: E.round(sm.exit, E.INSTR[S.sym].dec + 1),
      sl0: P.sl0, tp0: P.tp0, sl: P.sl, lot: sm.lot0, risk: P.riskMoney, reason: x.reason, both: !!x.both, gap: !!x.gap, pips: sm.pips, r: sm.r, money: sm.money,
      bars: i - P.openIdx, parts: sm.parts, setup: P.setup || '', note: P.note || ''
    };
    S.trades.push(tr);
    S.positions = S.positions.filter(p => p !== P);
    if (S.sel === P.id) S.sel = null;
    addMarker(S.d.t[i], tr, 'out');
    let m = `${tag(P) || ''}${REASON[x.reason]}: ${fmtR(tr.r)} (${money(tr.money, S.ccy, true)})${sm.parts > 1 ? ', cu închideri parțiale' : ''}.`;
    if (x.both) m += ' În aceeași bară H1 au fost atinse și SL, și TP: am considerat SL primul (varianta prudentă).';
    if (x.gap) m += ' Prețul a sărit peste stop loss (gap), așa că ieșirea s-a făcut la deschiderea barei.';
    showMsg(m, tr.money > 0 ? 'good' : tr.money < 0 ? 'bad' : '');
    renderStats();
    if (window.SimExtra && SimExtra.onTrade) SimExtra.onTrade(tr);
  }
  function addMarker(t, x, kind) {
    if (kind === 'in') S.markers.push({ t, position: x === 'buy' ? 'belowBar' : 'aboveBar', color: x === 'buy' ? C.green : C.red, shape: x === 'buy' ? 'arrowUp' : 'arrowDown', text: x === 'buy' ? 'Buy' : 'Sell' });
    else S.markers.push({ t, position: x.side === 'buy' ? 'aboveBar' : 'belowBar', color: x.money > 0 ? C.green : x.money < 0 ? C.red : C.text, shape: 'circle', text: (x.reason === 'Manual' || x.reason === 'Final' ? 'Închis' : x.reason) + ' ' + fmtR(x.r) });
    renderMarkers();
  }

  // ---------- redare (ceasul e mereu H1; un pas = o bară din intervalul afișat) ----------
  function nextYearNeeded() { return S.years[1] < LAST_YEAR && S.cur > S.d.n - 260; }
  function ensureMore() {
    if (!nextYearNeeded() || loadingMore) return loadingMore;
    const y = S.years[1] + 1;
    loadingMore = loadYear(S.sym, y).then(d => { S.d = E.concat(S.d, d); S.years[1] = y; }).catch(() => showMsg('Nu am putut încărca datele pentru perioada următoare. Verifică conexiunea.', 'warn')).finally(() => { loadingMore = null; });
    return loadingMore;
  }
  /** Avansează o bară H1: execută ordinele, verifică SL/TP pe toate pozițiile, aplică regulile provocării. */
  function advance() {
    if (!S || S.ended) return false;
    const i = S.cur + 1;
    if (i >= S.d.n) {
      if (S.years[1] < LAST_YEAR) { ensureMore(); showMsg('Se încarcă datele următoare…'); return false; }
      endSession('Ai ajuns la finalul datelor disponibile (' + DATA_END_LABEL + ').'); return false;
    }
    if (S.d.t[i] >= S.stopT) { endSession('Sesiunea s-a oprit: urmează o perioadă în care sursa are multe ore lipsă, așa că nu o folosim.'); return false; }
    const balanceStart = S.balance;
    S.cur = i; S.barsPlayed++;
    const b = { o: S.d.o[i], h: S.d.h[i], l: S.d.l[i], c: S.d.c[i] };
    let events = 0;
    // pozițiile deja deschise
    for (const P of [...S.positions]) { const x = E.checkExit(P, b); if (x) { closeFull(P, x, i); events++; } }
    // ordinele în așteptare
    for (const O of [...S.orders]) {
      const fill = E.pendingTriggered(O, b);
      if (fill == null) continue;
      S.orders = S.orders.filter(o => o !== O);
      const P = E.makePosition({ sym: S.sym, side: O.side, sl: O.sl, tp: O.tp, lot: O.lot, pipVal: O.pipVal, time: S.d.t[i], idx: i, type: O.kind }, E.round(fill, E.INSTR[S.sym].dec + 1));
      Object.assign(P, { id: O.id, n: O.n, lot0: P.lot, setup: O.setup || '' });
      S.positions.push(P); events++;
      addMarker(S.d.t[i], O.side, 'in');
      showMsg(`${tag(P)}Ordinul ${O.side === 'buy' ? 'Buy' : 'Sell'} ${O.kind} s-a executat la ${fmtPrice(S.sym, P.entry)}.`);
      const x = E.checkExit(P, b, true);
      if (x) closeFull(P, x, i);
    }
    if (window.SimExtra && SimExtra.onBar) SimExtra.onBar(i, b, balanceStart);
    // graficul: actualizează bara în formare sau adaugă una nouă
    E.appendBar(S.view, S.d, i, S.tf);
    series.update(lastBar());
    ensureMore();
    return events ? 'event' : true;
  }
  /** n bare din intervalul afișat. La +10, oprește la primul eveniment (intrare/ieșire). */
  function step(n) {
    if (!S || S.ended) return;
    let moved = 0;
    outer: for (let k = 0; k < n; k++) {
      do {
        const r = advance();
        if (!r) break outer;
        moved++;
        if (r === 'event' && n > 1) break outer;
        if (S.ended) break outer;
      } while (!E.isBucketEnd(S.d, S.cur, S.tf));
    }
    if (moved) { if (window.SimExtra && SimExtra.onData) SimExtra.onData(false); afterChange(); }
  }
  function setPlaying(on) {
    clearInterval(playTimer); playTimer = null;
    const b = $('sim-play');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.classList.toggle('is-on', !!on);
    $('sim-play-lbl').textContent = on ? 'Pauză' : 'Redare';
    b.title = on ? 'Pauză (Space)' : 'Redare (Space)';
    if (on) playTimer = setInterval(() => { if (!S || S.ended) return setPlaying(false); if (loadingMore) return; step(1); }, SPEED_MS[$('sim-speed').value] || 900);
  }
  /** Schimbă intervalul afișat în sesiune. Ceasul (ora curentă) rămâne același; bara curentă a intervalului mare e construită doar din H1 trecute. */
  function setTF(tf) {
    if (!S || !E.TF_SEC[tf] || tf === S.tf) return;
    S.tf = tf;
    document.querySelectorAll('.ws-tf button').forEach(b => b.setAttribute('aria-pressed', b.dataset.tf === tf ? 'true' : 'false'));
    $('sim-label').textContent = `${S.sym} · ${tf}`;
    timeLabels(S.hidden);
    setChartData(false);
    legend(null);
    afterChange();
    showMsg(`Interval ${tf}. „Bara următoare” avansează o bară ${tf}; SL și TP se verifică în continuare pe fiecare oră (H1).`);
  }

  // ---------- afișare generală ----------
  let toastTimer = null;
  function showMsg(text, tone) {
    const m = $('sim-msg'); m.textContent = text; m.dataset.tone = tone || '';
    m.classList.toggle('is-on', !!text);
    clearTimeout(toastTimer);
    if (text) toastTimer = setTimeout(() => m.classList.remove('is-on'), tone === 'bad' || tone === 'warn' ? 7000 : 4500);
  }
  const openTotal = () => S.positions.reduce((s, P) => s + openPL(P), 0);
  function renderAcct() {
    const open = openTotal();
    $('sim-balance').textContent = money(S.balance, S.ccy);
    $('sim-equity').textContent = money(S.balance + open, S.ccy);
    const o = $('sim-openpl'); o.textContent = S.positions.length ? money(open, S.ccy, true) : '—';
    o.className = open > 0 ? 'pos' : open < 0 ? 'neg' : '';
    $('sim-bars').textContent = String(S.barsPlayed);
    $('sim-when').textContent = S.hidden ? 'Data e ascunsă' : fmtTime(S.d.t[S.cur], 'H1');
    $('sim-bid').textContent = fmtPrice(S.sym, bid());
    $('sim-ask').textContent = nf(ask(), E.INSTR[S.sym].dec);
    $('sim-spread').textContent = nf(E.INSTR[S.sym].spread, 1);
    if (!legendHover) legend(null);
  }
  function afterChange() {
    if (!S) return;
    renderAcct(); renderPos(); updateCalc(); drawLines();
    if (window.SimExtra && SimExtra.onChange) SimExtra.onChange();
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
    const held = t => { const h = Math.max(1, Math.round((t.exitT - t.entryT) / 3600)); return h < 48 ? h + ' h' : nf(h / 24, 0, 1) + ' zile'; };
    tb.innerHTML = S.trades.map(t => `<tr>
      <td>${t.n}</td><td><span class="sim-side ${t.side}">${t.side === 'buy' ? 'Buy' : 'Sell'}</span>${t.type !== 'piață' ? ' <small>' + esc(t.type) + '</small>' : ''}${t.setup ? '<br><small class="sim-tag">' + esc(t.setup) + '</small>' : ''}</td>
      <td>${S.hidden ? '<small>dată ascunsă</small>' : '<small>' + esc(fmtTime(t.entryT, 'H1')) + '</small>'}<br>${fmtPrice(S.sym, t.entry)}</td>
      <td>${S.hidden ? '<small>după ' + held(t) + '</small>' : '<small>' + esc(fmtTime(t.exitT, 'H1')) + '</small>'}<br>${fmtPrice(S.sym, t.exit)}</td>
      <td>${REASON[t.reason]}${t.parts > 1 ? ' <small>(' + t.parts + ' părți)</small>' : ''}${t.both ? ' <small>(SL și TP în aceeași bară)</small>' : ''}</td>
      <td class="num">${sign(t.pips)}${nf(Math.abs(t.pips), 1)}</td><td class="num ${t.r > 0 ? 'pos' : t.r < 0 ? 'neg' : ''}">${fmtR(t.r)}</td>
      <td class="num ${t.money > 0 ? 'pos' : t.money < 0 ? 'neg' : ''}">${money(t.money, ccy, true)}</td></tr>`).join('');
    $('sim-trades-empty').hidden = S.trades.length > 0;
    $('sim-tcount').textContent = String(S.trades.length);
    if (!$('sim-stats').hidden) drawEquity(st.curve);
    if (window.SimExtra && SimExtra.onStats) SimExtra.onStats();
    return st;
  }
  function eqChartOn(el) {
    const ch = LW.createChart(el, {
        autoSize: true, height: 200,
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: C.text, attributionLogo: false },
        grid: { vertLines: { visible: false }, horzLines: { color: C.grid } },
        rightPriceScale: { borderColor: C.border }, timeScale: { visible: false, borderColor: C.border },
        handleScroll: false, handleScale: false, crosshair: { vertLine: { labelVisible: false } },
        localization: { locale: 'ro-RO', priceFormatter: p => nf(p, 0) }
      });
    return { ch, se: ch.addSeries(LW.BaselineSeries, { baseValue: { type: 'price', price: S.bal0 }, topLineColor: C.green, bottomLineColor: C.red, topFillColor1: 'rgba(8,153,129,.25)', topFillColor2: 'rgba(8,153,129,.02)', bottomFillColor1: 'rgba(242,54,69,.02)', bottomFillColor2: 'rgba(242,54,69,.25)', lineWidth: 2, priceLineVisible: false }) };
  }
  function drawEquity(curve, el) {
    let c;
    if (el) { if (!sumChart) sumChart = eqChartOn(el); c = sumChart; }
    else { if (!eqChart) { const x = eqChartOn($('sim-eq-chart')); eqChart = x.ch; eqSeries = x.se; } c = { ch: eqChart, se: eqSeries }; }
    c.se.applyOptions({ baseValue: { type: 'price', price: S.bal0 } });
    c.se.setData(curve.map((v, i) => ({ time: 946684800 + i * 86400, value: v })));
    c.ch.timeScale().fitContent();
  }

  // ---------- salvare ----------
  function snapshot() {
    return { v: 2, id: S.id, sym: S.sym, tf: S.tf, ccy: S.ccy, bal0: S.bal0, riskPct: S.riskPct, mode: S.mode, hidden: S.hidden,
      startT: S.startT, curT: S.d.t[S.cur], stopT: S.stopT, balance: S.balance, positions: S.positions, orders: S.orders, seq: S.seq, sel: S.sel,
      trades: S.trades, markers: S.markers, barsPlayed: S.barsPlayed, strategy: S.strategy || null, challenge: S.challenge || null,
      extra: window.SimExtra && SimExtra.save ? SimExtra.save() : null };
  }
  /** Sesiuni salvate de versiunea anterioară (o singură poziție, date pe intervalul ales) → formatul nou. */
  function upgradeSnap(sn) {
    if (!sn || sn.v === 2) return sn;
    if (sn.v !== 1) return null;
    const positions = [], orders = []; let seq = 0;
    if (sn.pos) positions.push(Object.assign({}, sn.pos, { id: ++seq, n: seq, lot0: sn.pos.lot }));
    if (sn.pending) orders.push(Object.assign({}, sn.pending, { id: ++seq, n: seq }));
    // la v1, curT era începutul barei curente din intervalul ales: ora H1 corespunzătoare e ultima din acea bară
    const markers = (sn.markers || []).map(m => Object.assign({}, m, { t: m.time }));
    return Object.assign({}, sn, { v: 2, positions, orders, seq, sel: null, markers, curBucket: sn.curT });
  }
  let saveTimer = null;
  function save() { if (!S || S.ended) return; clearTimeout(saveTimer); saveTimer = setTimeout(() => { if (S && !S.ended) store.set(KEY_CUR, snapshot()); }, 250); }

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
      INDEX = INDEX || await loadJson('index.json'); applyIndex(INDEX);
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
    INDEX = INDEX || await loadJson('index.json'); applyIndex(INDEX);
    const tf = cfg.tf;
    // istoric H1 suficient și pentru vederea D1 (~150 de zile de tranzacționare înainte de start)
    const curT = snap ? (snap.curBucket != null ? snap.curBucket + E.TF_SEC[snap.tf] : snap.curT) : cfg.startT;
    const { d, years } = await loadSeries(cfg.sym, yearOf(cfg.startT - spanSec('D1', HISTORY + 10)), yearOf(curT));
    const rates = await loadRates(cfg.sym, cfg.ccy);
    let startIdx = 0; while (startIdx < d.n - 1 && d.t[startIdx] < cfg.startT) startIdx++;
    let cur = startIdx;
    if (snap && snap.curBucket != null) { cur = 0; while (cur < d.n - 1 && E.bucketStart(d.t[cur + 1], snap.tf) <= snap.curBucket) cur++; }
    else if (snap) { cur = 0; while (cur < d.n - 1 && d.t[cur] < snap.curT) cur++; }
    let stopT = Infinity;
    for (const [a] of incompleteFor(cfg.sym)) if (a > cfg.startT && a < stopT) stopT = a;
    S = Object.assign({}, cfg, {
      d, years: years.slice(), rates, cur, startIdx, stopT, view: null,
      balance: snap ? snap.balance : cfg.bal0, positions: snap ? snap.positions : [], orders: snap ? snap.orders : [], seq: snap ? snap.seq || 0 : 0, sel: snap ? snap.sel : null,
      trades: snap ? snap.trades : [], markers: snap ? snap.markers : [], barsPlayed: snap ? snap.barsPlayed : 0, ended: false, touched: false, showPreview: true,
      strategy: snap ? snap.strategy || cfg.strategy || null : cfg.strategy || null
    });
    // compatibilitate (teste, cod vechi): prima poziție și primul ordin
    Object.defineProperties(S, { pos: { get() { return this.positions[0] || null; } }, pending: { get() { return this.orders[0] || null; } } });
    document.querySelectorAll('.ws-tf button').forEach(b => b.setAttribute('aria-pressed', b.dataset.tf === tf ? 'true' : 'false'));
    enterApp();
    $('sim-stats-msg').textContent = ''; $('sim-reveal').textContent = '';
    ['sim-next', 'sim-next10', 'sim-play', 'sim-speed'].forEach(id => { $(id).disabled = false; });
    $('sim-end').textContent = 'Termină'; $('sim-end').title = 'Termină sesiunea și vezi rezultatele';
    $('sim-label').textContent = `${cfg.sym} · ${tf}`;
    $('sim-risk-ws').value = nf(cfg.riskPct, 0, 2).replace(/\s/g, '');
    $('sim-adv').open = false;
    selectTab('order');
    // valori implicite pentru SL/TP: ~1,5 x amplitudinea mediană a ultimelor 50 de bare ale intervalului ales
    const vw = E.aggregate(d, cur, tf), vd = { h: vw.h, l: vw.l };
    const mr = E.medianRangePips(vd, vw.h.length - 1, 50, cfg.sym);
    const sl = Math.max(5, Math.round(mr * 1.5 / 5) * 5 || 20);
    $('sim-sl').value = String(sl); $('sim-tp').value = String(sl * 2); $('sim-price').value = '';
    document.querySelector('input[name="sim-unit"][value="pips"]').checked = true;
    document.querySelector('input[name="sim-kind"][value="market"]').checked = true;
    const I = E.INSTR[cfg.sym];
    $('sim-spread-note').textContent = `Spread fix: ${nf(I.spread, 1)} pips. Sugestie: stop loss-ul implicit (${sl} pips) e cam 1,5 x amplitudinea obișnuită a unei lumânări ${tf}.`;
    makeChart(); setChartData();
    if (window.SimExtra && SimExtra.load) SimExtra.load(snap ? snap.extra : null, { chart, series, S, E, LW, C, $, nf, esc, fmtPrice, money, showMsg, legendRefresh: () => legend(null) });
    $('sim-pos-err').hidden = true; $('sim-order-err').hidden = true;
    showMsg(snap ? 'Sesiunea a fost reluată de unde ai rămas.' : 'Sesiunea a început. Analizează graficul, apoi avansează sau plasează un ordin.');
    renderStats();
    afterChange();
    $('sim-next').focus({ preventScroll: true });
  }
  function endSession(reason) {
    if (!S || S.ended) return;
    setPlaying(false);
    S.orders = [];
    for (const P of [...S.positions]) closeFull(P, { price: E.markPrice(P, bid()), reason: 'Final', both: false, gap: false }, S.cur);
    S.ended = true; S.hidden = false;
    timeLabels(false);
    { const n = S.view.time.length; let k = 0; while (k < n - 1 && S.view.time[k + 1] <= E.bucketStart(S.d.t[S.startIdx], S.tf)) k++; chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, k - 30), to: n + 3 }); }
    drawLines();
    const b = S.d.t[S.cur], startIdx = S.startIdx;
    const period = `${S.sym} ${S.tf}, ${fmtTime(S.d.t[startIdx], 'H1')} - ${fmtTime(b, 'H1')}`;
    $('sim-reveal').textContent = 'Perioada reală: ' + period + '.';
    $('sim-when').textContent = fmtTime(b, 'H1');
    $('sim-order').hidden = true; $('sim-pos').hidden = true;
    ['sim-next', 'sim-next10', 'sim-play', 'sim-speed'].forEach(id => { $(id).disabled = true; });
    $('sim-end').textContent = 'Rezultate'; $('sim-end').title = 'Arată rezultatele sesiunii';
    const st0 = renderStats();
    legend(null);
    showMsg('');
    $('sim-sum-reason').textContent = (reason ? reason + ' ' : '') + 'Sesiunea s-a încheiat.';
    const g = (id, v) => { $(id).textContent = v; };
    g('sim-m-n', String(st0.n)); g('sim-m-wl', $('sim-s-wl').textContent); g('sim-m-wr', $('sim-s-wr').textContent); g('sim-m-tr', $('sim-s-tr').textContent);
    g('sim-m-pf', $('sim-s-pf').textContent); g('sim-m-dd', $('sim-s-dd').textContent); g('sim-m-net', $('sim-s-net').textContent); g('sim-m-bal', $('sim-s-bal').textContent);
    $('sim-m-tr').className = $('sim-s-tr').className; $('sim-m-net').className = $('sim-s-net').className;
    openSummary();
    // salvează în istoric
    const st = E.stats(S.trades, S.bal0);
    const list = store.get(KEY_SESS, []);
    list.unshift({ id: S.id, sym: S.sym, tf: S.tf, ccy: S.ccy, bal0: S.bal0, riskPct: S.riskPct, from: S.d.t[startIdx], to: b, bars: S.barsPlayed,
      n: st.n, winRate: st.winRate, totalR: st.totalR, net: st.net, maxDDPct: st.maxDDPct, trades: S.trades, ended: new Date().toISOString(),
      strategy: S.strategy || null, challenge: S.challenge ? { status: S.challenge.status, reason: S.challenge.reason, targetPct: S.challenge.targetPct, dailyPct: S.challenge.dailyPct, totalPct: S.challenge.totalPct } : null });
    store.set(KEY_SESS, list.slice(0, MAX_SAVED));
    store.del(KEY_CUR);
    renderHistory();
  }
  function openSummary() {
    const d = $('sim-summary');
    if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
    drawEquity(E.stats(S.trades, S.bal0).curve, $('sim-sum-eq'));
  }
  function closeSummary() { const d = $('sim-summary'); if (d.open) { if (d.close) d.close(); else d.removeAttribute('open'); } }
  /** Curăță sesiunea din memorie (cea neterminată rămâne salvată pentru reluare). */
  function teardown() {
    setPlaying(false);
    clearTimeout(saveTimer);
    if (S && !S.ended) store.set(KEY_CUR, snapshot());
    closeSummary();
    S = null;
    if (chart) { chart.remove(); chart = null; series = null; }
    if (eqChart) { eqChart.remove(); eqChart = null; eqSeries = null; }
    if (sumChart) { sumChart.ch.remove(); sumChart = null; }
    showMsg('');
  }
  /** „Sesiune nouă”: pornește imediat o sesiune cu aceleași setări, fără să ieși din spațiul de lucru. */
  async function newSession() {
    teardown();
    await start();
    if (!S) leaveApp();   // dacă pornirea a eșuat, arată eroarea în pagina de setări
  }

  // ---------- spațiul de lucru pe tot ecranul (cu istoric pentru butonul Înapoi) ----------
  const ws = $('sim-session');
  const others = () => [...document.body.children].filter(e => e !== ws && e !== help && e.tagName !== 'SCRIPT');
  function enterApp() {
    if (document.documentElement.classList.contains('sim-app-on')) return;
    document.documentElement.classList.add('sim-app-on');
    ws.hidden = false;
    others().forEach(e => { e.inert = true; });
    if (!(history.state && history.state.simApp)) history.pushState({ simApp: 1 }, '', '#sesiune');
    sheet(false);
  }
  function leaveApp() {
    teardown();
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    document.documentElement.classList.remove('sim-app-on');
    ws.hidden = true;
    others().forEach(e => { e.inert = false; });
    $('sim-resume').hidden = !store.get(KEY_CUR, null);
    renderHistory();
    if (location.hash === '#sesiune') history.replaceState(null, '', location.pathname + location.search);
    setupForm.scrollIntoView({ block: 'start' });
    $('sim-start').focus({ preventScroll: true });
  }
  function goBack() {
    if (history.state && history.state.simApp) history.back();   // popstate → leaveApp
    else leaveApp();
  }
  window.addEventListener('popstate', () => {
    if (document.documentElement.classList.contains('sim-app-on') && !(history.state && history.state.simApp)) leaveApp();
  });

  // file: Ordin / Tranzacții / Statistici
  const TABS = ['order', 'trades', 'stats'];
  function selectTab(name) {
    for (const t of TABS) {
      const on = t === name, b = $('sim-tab-' + t);
      b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
      $(t === 'stats' ? 'sim-stats' : 'sim-pane-' + t).hidden = !on;
    }
    if (name === 'stats' && S) requestAnimationFrame(() => drawEquity(E.stats(S.trades, S.bal0).curve));
  }
  function sheet(open) {
    $('sim-panel').dataset.open = open ? 'true' : 'false';
    $('sim-sheet').setAttribute('aria-expanded', open ? 'true' : 'false');
    $('sim-sheet').setAttribute('aria-label', open ? 'Ascunde panoul' : 'Arată panoul');
  }
  TABS.forEach((t, i) => {
    const b = $('sim-tab-' + t);
    b.addEventListener('click', () => { selectTab(t); sheet(true); });
    b.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault(); e.stopPropagation();
      const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
      selectTab(n); $('sim-tab-' + n).focus();
    });
  });
  $('sim-sheet').addEventListener('click', () => sheet($('sim-panel').dataset.open !== 'true'));
  // ecran complet (Fullscreen API, unde există)
  const fsBtn = $('sim-fs');
  if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
    fsBtn.hidden = false;
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen().catch(() => showMsg('Browserul nu a permis ecranul complet.', 'warn'));
    });
    document.addEventListener('fullscreenchange', () => {
      const on = !!document.fullscreenElement;
      fsBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      fsBtn.setAttribute('aria-label', on ? 'Ieși din ecranul complet' : 'Ecran complet');
      fsBtn.title = on ? 'Ieși din ecranul complet' : 'Ecran complet';
    });
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
    const rows = S.trades.map(t => [t.n, S.sym, S.tf, t.side === 'buy' ? 'Buy' : 'Sell', t.type, fmtTime(t.entryT, 'H1'), n(t.entry, dec + 1), n(t.sl0, dec + 1), n(t.tp0, dec + 1), n(t.lot, 2), n(t.risk, 2), fmtTime(t.exitT, 'H1'), n(t.exit, dec + 1), REASON[t.reason], n(t.pips, 1), n(t.r, 2), n(t.money, 2)]);
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
      list.push({ id, data: isoDate(t.entryT, 'H1'), pereche: S.sym, directie: t.side === 'buy' ? 'Buy' : 'Sell', sesiune: '',
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
    const snap = upgradeSnap(store.get(KEY_CUR, null));
    if (!snap) { $('sim-resume').hidden = true; return; }
    try { await begin({ id: snap.id, sym: snap.sym, tf: snap.tf, ccy: snap.ccy, bal0: snap.bal0, riskPct: snap.riskPct, mode: snap.mode, hidden: snap.hidden, startT: snap.startT }, snap); }
    catch (e) { setupError('Nu am putut relua sesiunea. Pornește una nouă.'); store.del(KEY_CUR); $('sim-resume').hidden = true; }
  });
  $('sim-order').addEventListener('submit', e => { e.preventDefault(); placeOrder(); });
  $('sim-order').addEventListener('input', e => { if (e.target.id === 'sim-sl' || e.target.id === 'sim-tp' || e.target.id === 'sim-price') S.touched = true; updateCalc(); });
  $('sim-order').addEventListener('change', () => { updateCalc(); });
  // la schimbarea unității, convertește valorile existente
  document.querySelectorAll('input[name="sim-unit"]').forEach(r => r.addEventListener('change', () => {
    if (!S) return;
    const ref = refPrice(side(), ordKind()), pip = E.pipOf(S.sym), dir = side() === 'buy' ? 1 : -1;
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
  $('sim-end').addEventListener('click', () => { if (S && S.ended) openSummary(); else endSession(''); });
  $('sim-back').addEventListener('click', goBack);
  $('sim-exit').addEventListener('click', goBack);
  $('sim-sum-close').addEventListener('click', closeSummary);
  $('sim-summary').addEventListener('click', e => { if (e.target === $('sim-summary')) closeSummary(); });
  $('sim-help-ws').addEventListener('click', () => { if (help.showModal) help.showModal(); else help.setAttribute('open', ''); });
  $('sim-risk-ws').addEventListener('input', () => {
    const r = num($('sim-risk-ws').value);
    if (S && r > 0 && r <= 10) { S.riskPct = r; $('sim-risk-ws').removeAttribute('aria-invalid'); }
    else $('sim-risk-ws').setAttribute('aria-invalid', 'true');
  });
  $('sim-p-apply').addEventListener('click', applyPosLevels);
  $('sim-pos').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.target.id === 'sim-p-sl' || e.target.id === 'sim-p-tp')) { e.preventDefault(); applyPosLevels(); } });
  $('sim-be').addEventListener('click', moveToBE);
  $('sim-close-all').addEventListener('click', closeAll);
  document.querySelectorAll('[data-part]').forEach(b => b.addEventListener('click', () => closePartial(+b.dataset.part / 100)));
  $('sim-part-go').addEventListener('click', () => { const v = num($('sim-part-lot').value); if (!(v > 0)) { showPosErr('Scrie lotul de închis (de exemplu 0,10).'); return; } closePartial(null, v); });
  $('sim-pos-list').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (!b || !S) return; S.sel = +b.dataset.id; showPosErr(''); renderPos(); drawLines(); });
  document.querySelectorAll('.ws-tf button').forEach(b => b.addEventListener('click', () => setTF(b.dataset.tf)));
  $('sim-close').addEventListener('click', () => closeNow('Manual'));
  $('sim-csv').addEventListener('click', csv);
  $('sim-journal').addEventListener('click', toJournal);
  $('sim-new').addEventListener('click', newSession);
  $('sim-clear').addEventListener('click', () => { store.del(KEY_SESS); renderHistory(); });
  document.addEventListener('keydown', e => {
    if (!S || S.ended || $('sim-session').hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test((e.target.tagName || '')) || e.target.isContentEditable || $('sim-help').open || $('sim-summary').open) return;
    const onBtn = /^(BUTTON|A|SUMMARY)$/.test(e.target.tagName || '') || e.target.getAttribute('role') === 'tab';
    if (e.key === 'ArrowRight' && e.target.getAttribute('role') !== 'tab') { e.preventDefault(); step(1); }
    else if ((e.key === ' ' || e.code === 'Space') && !onBtn) { e.preventDefault(); setPlaying(!playTimer); }
    else if (e.key === 'b' || e.key === 'B' || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      document.querySelector(`input[name="sim-side"][value="${/b/i.test(e.key) ? 'buy' : 'sell'}"]`).checked = true;
      updateCalc(); placeOrder();
    } else if (e.key === 'Escape' && $('sim-panel').dataset.open === 'true') sheet(false);
  });
  // etichetele liniilor se scurtează/lungesc după lățimea graficului
  let rzT = null;
  window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (S && series) drawLines(); }, 150); });
  // ajutor
  const help = $('sim-help');
  $('sim-help-open').addEventListener('click', () => { if (help.showModal) help.showModal(); else help.setAttribute('open', ''); });
  help.addEventListener('close', () => store.set(KEY_HELP, 1));
  help.addEventListener('click', e => { if (e.target === help) help.close(); });
  bindDrag();
  document.body.appendChild(ws); document.body.appendChild(help);
  if (location.hash === '#sesiune') history.replaceState(null, '', location.pathname + location.search);

  // inițializare
  setupForm.hidden = false;
  syncSetup();
  loadJson('index.json').then(ix => { INDEX = ix; applyIndex(ix); syncSetup(); }).catch(() => {});
  $('sim-resume').hidden = !store.get(KEY_CUR, null);
  renderHistory();
  if (!store.get(KEY_HELP, 0) && help.showModal) help.showModal();
  window.__sim = { get S() { return S; }, step, endSession, selectTab, sheet, setTF, closePartial, closeAll, get view() { return S && S.view; }, get chart() { return chart; }, get series() { return series; }, rawLines: lines,
    get lines() {   // vedere compatibilă: prima poziție / primul ordin / previzualizarea
      const L = {}, P = S && S.positions[0], O = S && S.orders[0];
      if (P) { L.entry = lines['e:' + P.id]; L.sl = lines['sl:' + P.id]; L.tp = lines['tp:' + P.id]; }
      else if (O) { L.pend = lines['o:' + O.id]; L.sl = lines['osl:' + O.id]; L.tp = lines['otp:' + O.id]; }
      else { L.sl = lines.psl; L.tp = lines.ptp; L.ppr = lines.ppr; }
      for (const k of Object.keys(L)) if (!L[k]) delete L[k];
      return L;
    } };   // pentru teste
})();
