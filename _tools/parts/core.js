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
    return `${base}  ${money(m, S.ccy, true)}  ${r >= 0 ? '+' : '−'}${nf(Math.abs(r), 2)}R`;
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
    if (!S.ended && S.showPreview) {
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

