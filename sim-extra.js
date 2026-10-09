/* Simulator Marius FX: desene (linii, zone, Fibonacci) și indicatori (EMA, SMA, Bollinger, RSI, MACD, ATR).
   Se încarcă înainte de sim.js, care apelează window.SimExtra.* (load, save, onData, onCrosshair, busy). */
(function () {
  'use strict';
  const PALETTE = ['#2962ff', '#f7a600', '#089981', '#f23645', '#e040fb', '#d1d4dc'];
  const $ = id => document.getElementById(id);
  let X = null;              // contextul sesiunii: chart, series, S, E, LW, C, nf, esc, fmtPrice, showMsg, persist
  let st = blank();
  let tool = 'cursor', selId = null, pending = null, dragD = null, prim = null, bound = false, clearArm = 0;
  const live = new Map();    // id indicator → { series: [], lines: [] }
  let hoverIdx = null;
  function blank() { return { drawings: [], indicators: [], magnet: false, color: PALETTE[0], seq: 0 }; }
  const touchLike = () => matchMedia('(pointer: coarse)').matches;
  const ready = () => !!(X && X.chart && X.S && X.S.view && X.S.view.time.length);

  // ---------- timp ↔ coordonată (desenele sunt ancorate în timp + preț, deci rămân la locul lor când schimbi intervalul) ----------
  const tfSec = () => X.E.TF_SEC[X.S.tf];
  function timeToLogical(t) {
    const T = X.S.view.time, n = T.length, tf = tfSec();
    if (t >= T[n - 1]) return n - 1 + (t - T[n - 1]) / tf;
    if (t <= T[0]) return (t - T[0]) / tf;
    let lo = 0, hi = n - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (T[m] <= t) lo = m; else hi = m - 1; }
    return lo + Math.min(1, (t - T[lo]) / Math.min(T[lo + 1] - T[lo], tf));
  }
  function logicalToTime(l) {
    const T = X.S.view.time, n = T.length, tf = tfSec();
    if (l >= n - 1) return Math.round(T[n - 1] + (l - (n - 1)) * tf);
    if (l <= 0) return Math.round(T[0] + l * tf);
    const k = Math.floor(l), f = l - k;
    return Math.round(T[k] + f * Math.min(T[k + 1] - T[k], tf));
  }
  const xOf = t => X.chart.timeScale().logicalToCoordinate(timeToLogical(t));
  const yOf = p => X.series.priceToCoordinate(p);
  /** Punctul de sub cursor: timpul barei celei mai apropiate (sau în viitor, pe grila intervalului) și prețul (cu magnet opțional). */
  function pointAt(x, y) {
    const ts = X.chart.timeScale();
    let l = ts.coordinateToLogical(x);
    if (l == null) return null;
    l = Math.round(l);
    let p = X.series.coordinateToPrice(y);
    if (p == null) return null;
    const V = X.S.view, n = V.time.length;
    if (st.magnet && l >= 0 && l < n) {
      let best = null;
      for (const v of [V.o[l], V.h[l], V.l[l], V.c[l]]) { const d = Math.abs(yOf(v) - y); if (d < 40 && (!best || d < best.d)) best = { v, d }; }
      if (best) p = best.v;
    }
    return { t: logicalToTime(l), p: X.E.round(p, X.E.INSTR[X.S.sym].dec + 1) };
  }

  // ---------- desenare ----------
  const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const fibPrice = (d, lv) => d.p2.p + (d.p1.p - d.p2.p) * lv;   // ca în TradingView: 0 la punctul final, 1 la cel inițial
  function coords(d) {
    const a = { x: xOf(d.p1.t), y: yOf(d.p1.p) };
    const b = d.p2 ? { x: xOf(d.p2.t), y: yOf(d.p2.p) } : null;
    return { a, b };
  }
  const alpha = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0');
  function drawOne(ctx, d, W, sel) {
    const { a, b } = coords(d);
    if (a.x == null || a.y == null || (d.p2 && (b.x == null || b.y == null))) return;
    ctx.strokeStyle = d.color; ctx.fillStyle = d.color;
    ctx.lineWidth = sel ? 2 : 1;
    const px = v => Math.round(v) + 0.5;
    ctx.beginPath();
    if (d.type === 'hline') { ctx.moveTo(0, px(a.y)); ctx.lineTo(W, px(a.y)); ctx.stroke(); }
    else if (d.type === 'hray') { ctx.moveTo(a.x, px(a.y)); ctx.lineTo(W, px(a.y)); ctx.stroke(); }
    else if (d.type === 'trend') { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    else if (d.type === 'rect') {
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
      ctx.fillStyle = alpha(d.color, 0.14); ctx.fillRect(x, y, w, h);
      ctx.strokeRect(px(x), px(y), Math.round(w), Math.round(h));
    } else if (d.type === 'fib') {
      const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
      const y382 = yOf(fibPrice(d, 0.382)), y618 = yOf(fibPrice(d, 0.618));
      ctx.fillStyle = alpha(d.color, 0.10); ctx.fillRect(x1, Math.min(y382, y618), x2 - x1, Math.abs(y618 - y382));   // „zona de aur”
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif'; ctx.textBaseline = 'bottom'; ctx.fillStyle = d.color;
      for (const lv of FIB) {
        const pr = fibPrice(d, lv), y = px(yOf(pr));
        ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
        ctx.fillText(`${X.nf(lv, 3).replace(/0+$/, '').replace(/,$/, '')} (${X.fmtPrice(X.S.sym, pr)})`, x1 + 3, y - 2);
      }
      ctx.setLineDash([3, 3]); ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    if (sel) for (const q of (b ? [a, b] : [a])) {
      ctx.beginPath(); ctx.arc(q.x, q.y, touchLike() ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#131722'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = d.color; ctx.stroke();
    }
  }
  class Prim {
    constructor() {
      this._view = { zOrder: () => 'top', renderer: () => ({ draw: target => target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        if (!ready()) return;
        for (const d of st.drawings) drawOne(context, d, mediaSize.width, d.id === selId);
        if (pending && pending.p2) drawOne(context, pending, mediaSize.width, true);
      }) }) };
    }
    attached(p) { this.req = p.requestUpdate; }
    detached() { this.req = null; }
    paneViews() { return [this._view]; }
    priceAxisViews() {
      if (!ready()) return [];
      return st.drawings.filter(d => d.type === 'hline' || d.type === 'hray').map(d => ({
        coordinate: () => yOf(d.p1.p) ?? -100, text: () => X.fmtPrice(X.S.sym, d.p1.p), textColor: () => '#fff', backColor: () => d.color, visible: () => true, tickVisible: () => true
      }));
    }
    hitTest(x, y) {
      if (!ready()) return null;
      const h = hit(x, y);
      if (!h) return null;
      return { cursorStyle: tool !== 'cursor' ? 'crosshair' : h.handle ? 'pointer' : 'move', externalId: 'd' + h.d.id, zOrder: 'top' };
    }
  }
  const redraw = () => { if (prim && prim.req) prim.req(); };

  // ---------- selecție și coliziune ----------
  function distSeg(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
    let t = L ? ((px - a.x) * dx + (py - a.y) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  }
  function hit(x, y) {
    const tol = touchLike() ? 14 : 6;
    for (let k = st.drawings.length - 1; k >= 0; k--) {
      const d = st.drawings[k], { a, b } = coords(d);
      if (a.x == null || a.y == null) continue;
      if (d.id === selId || touchLike()) {
        if (Math.hypot(x - a.x, y - a.y) <= tol + 2) return { d, handle: 'p1' };
        if (b && Math.hypot(x - b.x, y - b.y) <= tol + 2) return { d, handle: 'p2' };
      }
      if (d.type === 'hline' && Math.abs(y - a.y) <= tol) return { d };
      if (d.type === 'hray' && x >= a.x - tol && Math.abs(y - a.y) <= tol) return { d };
      if (!b || b.x == null) continue;
      if (d.type === 'trend' && distSeg(x, y, a, b) <= tol) return { d };
      if (d.type === 'rect' || d.type === 'fib') {
        const x1 = Math.min(a.x, b.x) - tol, x2 = Math.max(a.x, b.x) + tol, y1 = Math.min(a.y, b.y) - tol, y2 = Math.max(a.y, b.y) + tol;
        if (x >= x1 && x <= x2 && y >= y1 && y <= y2) return { d };
      }
    }
    return null;
  }
  /** Distanța (px) de la punct la cel mai apropiat desen (capete, linii, margini de zonă, niveluri Fibonacci). */
  function drawingDist(x, y) {
    if (!ready() || !st.drawings.length) return Infinity;
    let best = Infinity;
    for (const d of st.drawings) {
      const { a, b } = coords(d);
      if (a.x == null || a.y == null) continue;
      best = Math.min(best, Math.hypot(x - a.x, y - a.y));
      if (d.type === 'hline') best = Math.min(best, Math.abs(y - a.y));
      if (d.type === 'hray' && x >= a.x) best = Math.min(best, Math.abs(y - a.y));
      if (!b || b.x == null) continue;
      best = Math.min(best, Math.hypot(x - b.x, y - b.y));
      if (d.type === 'trend') best = Math.min(best, distSeg(x, y, a, b));
      const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
      if (d.type === 'rect') { const c1 = { x: x1, y: a.y }, c2 = { x: x2, y: a.y }, c3 = { x: x1, y: b.y }, c4 = { x: x2, y: b.y }; best = Math.min(best, distSeg(x, y, c1, c2), distSeg(x, y, c3, c4), distSeg(x, y, c1, c3), distSeg(x, y, c2, c4)); }
      if (d.type === 'fib' && x >= x1 && x <= x2) for (const lv of FIB) best = Math.min(best, Math.abs(y - yOf(fibPrice(d, lv))));
    }
    return best;
  }
  function select(id) {
    selId = id;
    $('sim-draw-del').disabled = id == null;
    const d = st.drawings.find(z => z.id === id);
    if (d) setSwatch(d.color);
    redraw();
  }
  function setSwatch(c) { $('sim-color-sw').style.background = c; }
  const NAMES = { hline: 'Linie orizontală', hray: 'Rază orizontală', trend: 'Linie de trend', rect: 'Dreptunghi', fib: 'Fibonacci' };
  const HINT = {
    hline: 'Linie orizontală: atinge sau dă clic pe nivelul dorit.', hray: 'Rază orizontală: atinge sau dă clic de unde pornește.',
    trend: 'Linie de trend: trage de la primul punct la al doilea (sau două clicuri).', rect: 'Dreptunghi: trage de la un colț la colțul opus (sau două clicuri).',
    fib: 'Fibonacci: trage de la începutul mișcării (de exemplu minimul) la final (maximul). Nivelurile 0,382-0,618 sunt evidențiate.'
  };
  function setTool(t) {
    if (pending) pending = null;
    tool = t;
    document.querySelectorAll('.ws-dt[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t ? 'true' : 'false'));
    const el = $('sim-chart');
    el.classList.toggle('is-drawing', t !== 'cursor');
    if (X && X.chart) X.chart.applyOptions({ handleScroll: t === 'cursor' ? { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false } : false, handleScale: t === 'cursor' });
    if (t !== 'cursor' && X) X.showMsg(HINT[t] + ' Esc anulează.');
    redraw();
  }
  const persist = () => { if (X && X.persist) X.persist(); };
  function addDrawing(d) {
    d.id = ++st.seq; d.color = d.color || st.color;
    st.drawings.push(d);
    select(d.id); setTool('cursor'); persist();
    X.showMsg(`${NAMES[d.type]} adăugată. O poți muta trăgând de ea sau șterge cu tasta Delete / coșul din bara de desen.`);
  }
  function delSelected() {
    if (selId == null) return;
    st.drawings = st.drawings.filter(d => d.id !== selId);
    select(null); persist();
  }

  // ---------- interacțiune pe grafic ----------
  function local(e) { const r = $('sim-chart').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  const paneH = () => (X.chart.panes()[0] ? X.chart.panes()[0].getHeight() : 1e9);
  function swallow(e) { e.preventDefault(); e.stopImmediatePropagation(); }
  function onDown(e) {
    if (!ready() || e.defaultPrevented || (e.button != null && e.button > 0)) return;
    const { x, y } = local(e);
    if (y > paneH() || x > X.chart.timeScale().width()) return;   // doar în panoul principal (nu pe scale sau pe panourile indicatorilor)
    if (tool !== 'cursor') {
      swallow(e);
      const pt = pointAt(x, y); if (!pt) return;
      if (tool === 'hline' || tool === 'hray') { addDrawing({ type: tool, p1: pt }); return; }
      if (pending) { pending.p2 = pt; const d = pending; pending = null; if (d.p1.t !== d.p2.t || d.p1.p !== d.p2.p) addDrawing({ type: d.type, p1: d.p1, p2: d.p2 }); return; }
      pending = { type: tool, p1: pt, p2: pt, color: st.color, x0: x, y0: y, moved: false, id: -1 };
      try { $('sim-chart').setPointerCapture(e.pointerId); } catch (_) { /* ignorat */ }
      redraw();
      return;
    }
    const h = hit(x, y);
    if (!h) { if (selId != null) select(null); return; }
    swallow(e);
    select(h.d.id);
    dragD = { d: h.d, handle: h.handle, x0: x, y0: y, orig: JSON.parse(JSON.stringify(h.d)), l0: X.chart.timeScale().coordinateToLogical(x), p0: X.series.coordinateToPrice(y) };
    try { $('sim-chart').setPointerCapture(e.pointerId); } catch (_) { /* ignorat */ }
    X.chart.applyOptions({ handleScroll: false, handleScale: false });
    X.chart.priceScale('right').applyOptions({ autoScale: false });
  }
  function onMove(e) {
    if (!ready()) return;
    if (pending) {
      swallow(e);
      const { x, y } = local(e), pt = pointAt(x, y);
      if (pt) { pending.p2 = pt; if (Math.hypot(x - pending.x0, y - pending.y0) > 6) pending.moved = true; redraw(); }
      return;
    }
    if (!dragD) return;
    swallow(e);
    const { x, y } = local(e), d = dragD.d, o = dragD.orig;
    if (dragD.handle) { const pt = pointAt(x, y); if (pt) d[dragD.handle] = pt; }
    else {
      const l = X.chart.timeScale().coordinateToLogical(x), p = X.series.coordinateToPrice(y);
      if (l == null || p == null) return;
      const dl = Math.round(l - dragD.l0), dp = p - dragD.p0, dec = X.E.INSTR[X.S.sym].dec + 1;
      d.p1 = { t: logicalToTime(timeToLogical(o.p1.t) + dl), p: X.E.round(o.p1.p + dp, dec) };
      if (o.p2) d.p2 = { t: logicalToTime(timeToLogical(o.p2.t) + dl), p: X.E.round(o.p2.p + dp, dec) };
    }
    redraw();
  }
  function onUp(e) {
    if (pending) {
      swallow(e);
      if (pending.moved) { const d = pending; pending = null; addDrawing({ type: d.type, p1: d.p1, p2: d.p2 }); }
      // altfel: un singur clic → așteptăm al doilea clic pentru punctul final
      return;
    }
    if (!dragD) return;
    swallow(e);
    dragD = null;
    X.chart.applyOptions({ handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false }, handleScale: true });
    X.chart.priceScale('right').applyOptions({ autoScale: true });
    persist(); redraw();
  }
  // graficul ascultă și mouse/touch: le oprim cât timp desenăm sau tragem un desen
  const stopLegacy = e => { if (pending || dragD || (tool !== 'cursor' && (e.type === 'mousedown' || e.type === 'touchstart'))) { e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); } };
  function bind() {
    if (bound) return; bound = true;
    const el = $('sim-chart');
    el.addEventListener('pointerdown', onDown, { capture: true });
    el.addEventListener('pointermove', onMove, { capture: true });
    el.addEventListener('pointerup', onUp, { capture: true });
    el.addEventListener('pointercancel', e => { if (pending && !pending.moved) return; onUp(e); }, { capture: true });
    for (const t of ['mousedown', 'mousemove', 'touchstart', 'touchmove']) el.addEventListener(t, stopLegacy, { capture: true, passive: false });
    document.querySelectorAll('.ws-dt[data-tool]').forEach(b => b.addEventListener('click', () => { setTool(tool === b.dataset.tool && b.dataset.tool !== 'cursor' ? 'cursor' : b.dataset.tool); if (matchMedia('(max-width: 699px), (max-height: 520px)').matches) toggleBar(false); /* pe ecrane mici bara se strânge, ca să ai loc de desenat */ }));
    $('sim-draw-toggle').addEventListener('click', () => toggleBar($('sim-draw').dataset.open !== 'true'));
    $('sim-magnet').addEventListener('click', () => { st.magnet = !st.magnet; $('sim-magnet').setAttribute('aria-pressed', String(st.magnet)); persist(); X && X.showMsg(st.magnet ? 'Magnet pornit: punctele se lipesc de O/H/L/C ale lumânării.' : 'Magnet oprit.'); });
    $('sim-draw-del').addEventListener('click', delSelected);
    $('sim-draw-clear').addEventListener('click', () => {
      if (!st.drawings.length) { X && X.showMsg('Nu ai desene pe grafic.'); return; }
      if (Date.now() - clearArm > 4000) { clearArm = Date.now(); X.showMsg(`Apasă din nou pe coș ca să ștergi toate cele ${st.drawings.length} desene.`, 'warn'); return; }
      clearArm = 0; st.drawings = []; select(null); persist(); X.showMsg('Toate desenele au fost șterse.');
    });
    const pal = $('sim-palette');
    pal.innerHTML = PALETTE.map(c => `<button type="button" class="ws-sw" data-c="${c}" style="background:${c}" aria-label="Culoarea ${c}"></button>`).join('');
    $('sim-color').addEventListener('click', () => { const open = pal.hidden; pal.hidden = !open; $('sim-color').setAttribute('aria-expanded', String(open)); });
    pal.addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      st.color = b.dataset.c; setSwatch(st.color);
      const d = st.drawings.find(z => z.id === selId); if (d) { d.color = st.color; redraw(); }
      pal.hidden = true; $('sim-color').setAttribute('aria-expanded', 'false'); persist();
    });
    document.addEventListener('keydown', e => {
      if (!ready() || $('sim-session').hidden || document.querySelector('dialog[open]')) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName || '')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selId != null) { e.preventDefault(); delSelected(); return; }
      if (e.key === 'Escape' && (pending || tool !== 'cursor' || selId != null)) { pending = null; setTool('cursor'); select(null); return; }
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const m = { KeyH: 'hline', KeyJ: 'hray', KeyT: 'trend', KeyR: 'rect', KeyF: 'fib', KeyC: 'cursor' }[e.code];
        if (m) { e.preventDefault(); setTool(m); }
      }
    });
    // indicatori
    document.querySelectorAll('.ws-ind-btn').forEach(b => b.addEventListener('click', () => openInd()));
    $('sim-ind-close').addEventListener('click', () => $('sim-ind').close());
    $('sim-ind').addEventListener('click', e => { if (e.target === $('sim-ind')) $('sim-ind').close(); });
    document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => addInd(b.dataset.add)));
    $('sim-ind-list').addEventListener('input', onIndInput);
    $('sim-ind-list').addEventListener('click', onIndClick);
    $('sim-ind-legend').addEventListener('click', onIndClick);
  }
  function toggleBar(open) { $('sim-draw').dataset.open = String(open); $('sim-draw-toggle').setAttribute('aria-expanded', String(open)); }

  // ---------- indicatori ----------
  const DEF = {
    ema: { len: 20, color: '#f7a600' }, sma: { len: 50, color: '#2962ff' }, bb: { len: 20, mult: 2, color: '#2962ff' },
    rsi: { len: 14, color: '#7e57c2' }, macd: { fast: 12, slow: 26, signal: 9, color: '#2962ff' }, atr: { len: 14, color: '#f23645' }
  };
  const OSC = new Set(['rsi', 'macd', 'atr']);
  const indName = c => ({ ema: `EMA ${c.len}`, sma: `SMA ${c.len}`, bb: `BB ${c.len}, ${X.nf(c.mult, 0, 1)}`, rsi: `RSI ${c.len}`, macd: `MACD ${c.fast} ${c.slow} ${c.signal}`, atr: `ATR ${c.len}` }[c.type]);
  function compute(c) {
    const V = X.S.view, cl = V.c, E = X.E;
    switch (c.type) {
      case 'ema': return { main: E.ema(cl, c.len) };
      case 'sma': return { main: E.sma(cl, c.len) };
      case 'bb': { const b = E.bollinger(cl, c.len, c.mult); return { up: b.up, mid: b.mid, lo: b.lo }; }
      case 'rsi': return { main: E.rsi(cl, c.len) };
      case 'macd': { const m = E.macd(cl, c.fast, c.slow, c.signal); return { hist: m.hist, line: m.line, signal: m.signal }; }
      case 'atr': return { main: E.atr(V.h, V.l, cl, c.len) };
    }
    return {};
  }
  const pts = (arr, k0) => { const T = X.S.view.time, out = []; for (let k = k0 || 0; k < T.length; k++) out.push(Number.isFinite(arr[k]) ? { time: T[k], value: arr[k] } : { time: T[k] }); return out; };
  function histPts(h, k0) {
    const T = X.S.view.time, out = [];
    for (let k = k0 || 0; k < T.length; k++) {
      if (!Number.isFinite(h[k])) { out.push({ time: T[k] }); continue; }
      const up = h[k] >= 0, rising = Number.isFinite(h[k - 1]) ? h[k] >= h[k - 1] : true;
      out.push({ time: T[k], value: h[k], color: up ? (rising ? '#26a69a' : '#b2dfdb') : (rising ? '#ffcdd2' : '#ef5350') });
    }
    return out;
  }
  /** (Re)creează seriile tuturor indicatorilor; oscilatoarele primesc fiecare panoul lor sub grafic. */
  function rebuild() {
    for (const [, L] of live) for (const s of L.series) { try { X.chart.removeSeries(s); } catch (_) { /* ignorat */ } }
    live.clear();
    // panourile goale rămase se elimină (de la coadă)
    for (let i = X.chart.panes().length - 1; i > 0; i--) { try { X.chart.removePane(i); } catch (_) { /* ignorat */ } }
    const LW = X.LW, dec = X.E.INSTR[X.S.sym].dec;
    const base = { priceLineVisible: false, crosshairMarkerVisible: false, lastValueVisible: true, lineWidth: 1 };
    let pane = 0;
    for (const c of st.indicators) {
      const L = { series: [], keys: [] };
      const add = (key, def, opts, pi) => { const s = X.chart.addSeries(def, Object.assign({}, base, opts, { visible: c.visible !== false }), pi); L.series.push(s); L.keys.push(key); return s; };
      const pf = d => ({ type: 'custom', minMove: Math.pow(10, -d), formatter: v => X.nf(v, d) });   // zecimale românești, precizie pe indicator
      if (c.type === 'ema' || c.type === 'sma') add('main', LW.LineSeries, { color: c.color, priceFormat: pf(dec), lineWidth: 2 }, 0);
      else if (c.type === 'bb') {
        add('up', LW.LineSeries, { color: c.color, priceFormat: pf(dec) }, 0);
        add('mid', LW.LineSeries, { color: '#ff6d00', priceFormat: pf(dec), lastValueVisible: false }, 0);
        add('lo', LW.LineSeries, { color: c.color, priceFormat: pf(dec) }, 0);
      } else {
        pane += 1;
        if (c.type === 'rsi') {
          const s = add('main', LW.LineSeries, { color: c.color, priceFormat: pf(2), autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) }, pane);
          for (const [v, sty] of [[70, LW.LineStyle.Dashed], [50, LW.LineStyle.Dotted], [30, LW.LineStyle.Dashed]]) s.createPriceLine({ price: v, color: 'rgba(120,123,134,.6)', lineWidth: 1, lineStyle: sty, axisLabelVisible: false });
        } else if (c.type === 'macd') {
          add('hist', LW.HistogramSeries, { priceFormat: pf(dec + 1), lastValueVisible: false }, pane);
          add('line', LW.LineSeries, { color: c.color, priceFormat: pf(dec + 1) }, pane);
          add('signal', LW.LineSeries, { color: '#ff6d00', priceFormat: pf(dec + 1) }, pane);
        } else add('main', LW.LineSeries, { color: c.color, priceFormat: pf(dec) }, pane);
      }
      live.set(c.id, L);
    }
    // înălțimi relative: graficul principal 1, fiecare oscilator ~22% din el (mai puțin pe ecrane mici)
    const panes = X.chart.panes(), f = matchMedia('(max-width: 699px), (max-height: 520px)').matches ? 0.18 : 0.24;
    panes.forEach((pn, i) => pn.setStretchFactor(i === 0 ? 1 : f));
    refresh(true);
  }
  let lastLen = 0;
  /** Recalculează valorile din barele afișate (până la bara curentă). full = setData; altfel actualizează doar coada. */
  function refresh(full) {
    if (!ready()) return;
    const n = X.S.view.time.length;
    const k0 = full || n < lastLen || n - lastLen > 60 ? null : Math.max(0, lastLen - 1);
    for (const c of st.indicators) {
      const L = live.get(c.id); if (!L) continue;
      const v = compute(c);
      c._v = v;
      L.keys.forEach((key, i) => {
        const s = L.series[i], data = key === 'hist' ? histPts(v.hist, k0 == null ? 0 : k0) : pts(v[key], k0 == null ? 0 : k0);
        if (k0 == null) s.setData(data); else for (const p of data) s.update(p);
      });
    }
    lastLen = n;
    renderLegend();
  }
  function fmtVal(c, key, k) {
    const v = c._v && c._v[key] ? c._v[key][k] : NaN;
    if (!Number.isFinite(v)) return '—';
    if (c.type === 'rsi') return X.nf(v, 2);
    if (c.type === 'atr') return X.fmtPrice(X.S.sym, v) + ' (' + X.nf(v / X.E.pipOf(X.S.sym), 1) + ' pips)';
    if (c.type === 'macd') return X.nf(v, X.E.INSTR[X.S.sym].dec + 1);
    return X.fmtPrice(X.S.sym, v);
  }
  const ICON = {
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    off: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.7 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  function renderLegend() {
    const el = $('sim-ind-legend'); if (!el || !ready()) return;
    const n = X.S.view.time.length, k = hoverIdx != null && hoverIdx >= 0 && hoverIdx < n ? hoverIdx : n - 1;
    el.innerHTML = st.indicators.map(c => {
      const keys = c.type === 'bb' ? ['up', 'mid', 'lo'] : c.type === 'macd' ? ['line', 'signal', 'hist'] : ['main'];
      const vals = keys.map(key => `<b>${X.esc(fmtVal(c, key, k))}</b>`).join(' ');
      const off = c.visible === false;
      return `<div class="ind-row${off ? ' is-off' : ''}" data-id="${c.id}"><span class="ind-name" style="color:${c.color}">${X.esc(indName(c))}</span> <span class="ind-vals">${vals}</span>` +
        `<span class="ind-btns"><button type="button" data-act="vis" aria-pressed="${!off}" aria-label="${off ? 'Arată' : 'Ascunde'} ${X.esc(indName(c))}" title="${off ? 'Arată' : 'Ascunde'}">${off ? ICON.off : ICON.eye}</button>` +
        `<button type="button" data-act="cfg" aria-label="Setări ${X.esc(indName(c))}" title="Setări">${ICON.gear}</button>` +
        `<button type="button" data-act="del" aria-label="Elimină ${X.esc(indName(c))}" title="Elimină">${ICON.x}</button></span></div>`;
    }).join('');
  }
  function addInd(type) {
    if (!ready()) return;
    const used = new Set(st.indicators.map(c => c.color));
    const c = Object.assign({ id: ++st.seq, type, visible: true }, JSON.parse(JSON.stringify(DEF[type])));
    if (st.indicators.some(z => z.type === type)) { const free = PALETTE.find(p => !used.has(p)); if (free) c.color = free; if (type === 'ema' || type === 'sma') c.len = type === 'ema' ? 50 : 200; }
    if (st.indicators.length >= 10) { X.showMsg('Maximum 10 indicatori, ca graficul să rămână clar.', 'warn'); return; }
    st.indicators.push(c);
    rebuild(); renderIndList(); persist();
    X.showMsg(`${indName(c)} adăugat.${OSC.has(type) ? ' Apare într-un panou sub grafic.' : ''}`);
  }
  function delInd(id) { st.indicators = st.indicators.filter(c => c.id !== id); rebuild(); renderIndList(); persist(); }
  const FIELDS = {
    ema: [['len', 'Lungime', 1, 500, 1]], sma: [['len', 'Lungime', 1, 500, 1]], rsi: [['len', 'Lungime', 2, 200, 1]], atr: [['len', 'Lungime', 1, 200, 1]],
    bb: [['len', 'Lungime', 2, 500, 1], ['mult', 'Deviații', 0.5, 5, 0.1]],
    macd: [['fast', 'Rapidă', 1, 200, 1], ['slow', 'Lentă', 2, 400, 1], ['signal', 'Semnal', 1, 100, 1]]
  };
  function renderIndList() {
    const ul = $('sim-ind-list'); if (!ul) return;
    $('sim-ind-empty').hidden = st.indicators.length > 0;
    ul.innerHTML = st.indicators.map(c => `<li data-id="${c.id}"><div class="ind-li-head"><strong style="color:${c.color}">${X.esc(indName(c))}</strong>
      <button type="button" class="ws-link" data-act="del">Elimină</button></div>
      <div class="ind-li-fields">${FIELDS[c.type].map(([f, lbl, mn, mx, stp]) => `<label>${lbl} <input type="number" inputmode="decimal" data-f="${f}" min="${mn}" max="${mx}" step="${stp}" value="${c[f]}"></label>`).join('')}
      <span class="ind-li-colors" role="group" aria-label="Culoare">${PALETTE.map(p => `<button type="button" class="ws-sw${p === c.color ? ' is-on' : ''}" data-color="${p}" style="background:${p}" aria-label="Culoarea ${p}" aria-pressed="${p === c.color}"></button>`).join('')}</span></div></li>`).join('');
  }
  function onIndInput(e) {
    const inp = e.target.closest('input[data-f]'); if (!inp) return;
    const li = inp.closest('[data-id]'), c = st.indicators.find(z => z.id === +li.dataset.id); if (!c) return;
    const spec = FIELDS[c.type].find(f => f[0] === inp.dataset.f), v = Number(String(inp.value).replace(',', '.'));
    const ok = Number.isFinite(v) && v >= spec[2] && v <= spec[3] && (spec[4] !== 1 || Number.isInteger(v)) && !(c.type === 'macd' && ((inp.dataset.f === 'fast' && v >= c.slow) || (inp.dataset.f === 'slow' && v <= c.fast)));
    inp.setAttribute('aria-invalid', String(!ok));
    if (!ok) return;
    c[inp.dataset.f] = v;
    li.querySelector('.ind-li-head strong').textContent = indName(c);
    refresh(true); persist();
  }
  function onIndClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    const row = b.closest('[data-id]'); if (!row) return;
    const id = +row.dataset.id, c = st.indicators.find(z => z.id === id); if (!c) return;
    if (b.dataset.color) { c.color = b.dataset.color; rebuild(); renderIndList(); persist(); return; }
    if (b.dataset.act === 'del') { delInd(id); return; }
    if (b.dataset.act === 'vis') { c.visible = c.visible === false; const L = live.get(id); if (L) L.series.forEach(s => s.applyOptions({ visible: c.visible })); renderLegend(); persist(); return; }
    if (b.dataset.act === 'cfg') openInd(id);
  }
  function openInd(focusId) {
    renderIndList();
    const d = $('sim-ind'); if (!d.open) d.showModal();
    if (focusId != null) { const inp = d.querySelector(`[data-id="${focusId}"] input`); if (inp) inp.focus(); }
  }

  // ---------- API pentru sim.js ----------
  window.SimExtra = {
    load(saved, ctx) {
      X = ctx; bind();
      st = Object.assign(blank(), saved ? JSON.parse(JSON.stringify(saved)) : {});
      st.drawings = (st.drawings || []).filter(d => d && d.p1 && NAMES[d.type]);
      st.indicators = (st.indicators || []).filter(c => c && DEF[c.type]);
      selId = null; pending = null; dragD = null; tool = 'cursor'; hoverIdx = null; lastLen = 0;
      live.clear();
      prim = new Prim(); X.series.attachPrimitive(prim);
      setTool('cursor'); select(null); setSwatch(st.color); toggleBar(false);
      $('sim-magnet').setAttribute('aria-pressed', String(!!st.magnet));
      rebuild(); renderIndList();
    },
    unload() { X = null; prim = null; live.clear(); pending = null; dragD = null; tool = 'cursor'; selId = null; lastLen = 0; const d = $('sim-ind'); if (d && d.open) d.close(); $('sim-chart').classList.remove('is-drawing'); },
    save() { return { drawings: st.drawings, indicators: st.indicators.map(c => { const o = Object.assign({}, c); delete o._v; return o; }), magnet: st.magnet, color: st.color, seq: st.seq }; },
    onData(full) { if (!ready() || !live.size && !st.drawings.length) { lastLen = ready() ? X.S.view.time.length : 0; return; } refresh(full); redraw(); },
    onCrosshair(p) { if (!ready()) return; hoverIdx = p && p.logical != null && p.time != null ? Math.round(p.logical) : null; if (st.indicators.length) renderLegend(); },
    busy() { return tool !== 'cursor' || !!pending || !!dragD; },
    drawingDist(x, y) { return drawingDist(x, y); },
    // pentru teste
    get state() { return st; }, get tool() { return tool; }, get selected() { return selId; },
    paneCount() { return X && X.chart ? X.chart.panes().length : 0; },
    coordsOf(id) { const d = st.drawings.find(z => z.id === id); if (!d) return null; const c = coords(d); return { a: c.a, b: c.b }; },
    values(id) { const c = st.indicators.find(z => z.id === id); return c && c._v; }
  };
})();
