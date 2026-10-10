// Simulator faza 2: instrumente de desen (creare, mutare, capete, ștergere, culoare, magnet, atingere) și indicatori
// (EMA/SMA/BB/RSI/MACD/ATR: valori = motorul, fără lookahead, setări, ascundere, eliminare, panouri, salvare).
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, oks = 0;
const assert = (c, m) => { if (c) { oks++; console.log('ok ' + m); } else { fails++; console.log('FAIL: ' + m); } };
const SIZES0 = [
  { name: 'desktop-1280', vp: { width: 1280, height: 800 } },
  { name: 'desktop-1920', vp: { width: 1920, height: 1080 } },
  { name: 'mobile-portrait', vp: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  { name: 'mobile-landscape', vp: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }
];
const SIZES = process.env.ONLY ? SIZES0.filter(x => x.name === process.env.ONLY) : SIZES0;
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const { name: L, vp } of SIZES) {
    const touch = !!vp.hasTouch, full = L === 'desktop-1280' || L === 'mobile-portrait';
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror ' + e.stack));
    page.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
    await page.setViewport(vp);
    await page.goto(`${BASE}/simulator.html`, { waitUntil: 'networkidle2' });
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('mariusfx-sim-ajutor-v1', '1'); });
    await page.goto(`${BASE}/simulator.html`, { waitUntil: 'networkidle2' });
    await page.evaluate(() => { document.querySelector('.sim-adv-setup').open = true; document.querySelector('input[name="sim-mode"][value="date"]').click(); document.getElementById('sim-date').value = '2024-03-04'; });
    await page.click('#sim-start');
    await page.waitForFunction(() => window.__sim.S && !document.getElementById('sim-session').hidden, { timeout: 20000 });
    await sleep(400);
    const R = await page.evaluate(() => { const r = document.getElementById('sim-chart').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const ph = await page.evaluate(() => window.__sim.chart.panes()[0].getHeight());
    const D = () => page.evaluate(() => JSON.parse(JSON.stringify({ d: SimExtra.state.drawings, tool: SimExtra.tool, sel: SimExtra.selected })));
    const expectPt = (x, y) => page.evaluate((x, y) => { const ts = window.__sim.chart.timeScale(), l = Math.round(ts.coordinateToLogical(x)), S = window.__sim.S; return { t: S.view.time[l], p: window.__sim.series.coordinateToPrice(y), l }; }, x, y);
    const near = (a, b, tol) => Math.abs(a - b) <= tol;
    const pipTol = 0.00012;   // ~1 pixel pe EURUSD la scala implicită
    // gesturi: mouse pe desktop, deget pe mobil
    const press = async (x, y) => { if (touch) await page.touchscreen.touchStart(R.x + x, R.y + y); else { await page.mouse.move(R.x + x, R.y + y); await page.mouse.down(); } };
    const move = async (x, y) => { if (touch) await page.touchscreen.touchMove(R.x + x, R.y + y); else await page.mouse.move(R.x + x, R.y + y); };
    const release = async () => { if (touch) await page.touchscreen.touchEnd(); else await page.mouse.up(); };
    const dragG = async (x1, y1, x2, y2) => { await press(x1, y1); for (let k = 1; k <= 6; k++) await move(x1 + (x2 - x1) * k / 6, y1 + (y2 - y1) * k / 6); await release(); await sleep(120); };
    const tap = async (x, y) => { if (touch) await page.touchscreen.tap(R.x + x, R.y + y); else await page.mouse.click(R.x + x, R.y + y); await sleep(120); };
    const pickTool = async t => {
      if (touch && await page.$eval('#sim-draw', e => e.dataset.open !== 'true')) await page.click('#sim-draw-toggle');
      await page.click(`.ws-dt[data-tool="${t}"]`); await sleep(80);
    };
    const W = R.w, Hm = Math.min(ph, R.h);
    const X1 = Math.round(W * 0.30), X2 = Math.round(W * 0.62), Y1 = Math.round(Hm * 0.62), Y2 = Math.round(Hm * 0.40);

    // ---------- bara de desen ----------
    const tb = await page.evaluate(touch => {
      const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; };
      const tools = [...document.querySelectorAll('.ws-dt[data-tool]')];
      return { toggle: vis(document.getElementById('sim-draw-toggle')), toolsVisible: tools.every(vis), n: tools.length, cursor: document.querySelector('.ws-dt[data-tool="cursor"]').getAttribute('aria-pressed') };
    }, touch);
    assert(tb.n === 6 && tb.cursor === 'true' && (touch ? tb.toggle && !tb.toolsVisible : tb.toolsVisible), `${L}: drawing toolbar ${touch ? 'collapsed behind a pencil button' : 'visible on the left'}, cursor active`);
    if (touch) {
      await page.click('#sim-draw-toggle'); await sleep(80);
      const open = await page.evaluate(() => [...document.querySelectorAll('.ws-dt[data-tool], #sim-magnet, #sim-color, #sim-draw-del, #sim-draw-clear')].every(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }));
      assert(open, `${L}: pencil opens all drawing tools inside the screen`);
      await page.click('#sim-draw-toggle'); await sleep(80);
    }

    // ---------- linie de trend prin tragere ----------
    await pickTool('trend');
    let s = await D();
    assert(s.tool === 'trend' && await page.$eval('#sim-chart', e => e.classList.contains('is-drawing')), `${L}: trend tool active (crosshair cursor)`);
    const e1 = await expectPt(X1, Y1), e2 = await expectPt(X2, Y2);
    await dragG(X1, Y1, X2, Y2);
    s = await D();
    let tr = s.d[0];
    assert(s.d.length === 1 && tr.type === 'trend' && tr.p1.t === e1.t && tr.p2.t === e2.t && near(tr.p1.p, e1.p, pipTol) && near(tr.p2.p, e2.p, pipTol), `${L}: ${touch ? 'finger' : 'mouse'} drag draws a trend line anchored to bar time + price (${tr && tr.p1.p} → ${tr && tr.p2.p})`);
    assert(s.tool === 'cursor' && s.sel === tr.id && await page.$eval('#sim-draw-del', b => !b.disabled), `${L}: after drawing: back to cursor, new line selected, delete enabled`);

    // ---------- mutarea întregii linii ----------
    const mid = { x: (X1 + X2) / 2, y: (Y1 + Y2) / 2 };
    const sy0 = await page.evaluate(() => scrollY);
    await dragG(mid.x, mid.y, mid.x + 40, mid.y + 30);
    s = await D();
    const tr2 = s.d[0];
    const dp1 = tr2.p1.p - tr.p1.p, dp2 = tr2.p2.p - tr.p2.p;
    assert(dp1 < 0 && near(dp1, dp2, 2e-5) && tr2.p1.t > tr.p1.t && tr2.p2.t - tr2.p1.t === tr.p2.t - tr.p1.t, `${L}: dragging the line moves both ends equally (Δprice ${dp1.toFixed(5)}, same time span)`);
    assert(await page.evaluate(y => Math.abs(scrollY - y) < 1, sy0), `${L}: page did not scroll while dragging`);
    // ---------- capătul liniei ----------
    const c = await page.evaluate(id => SimExtra.coordsOf(id), tr2.id);
    await dragG(c.b.x, c.b.y, c.b.x, c.b.y - 40);
    s = await D();
    const tr3 = s.d[0];
    assert(JSON.stringify(tr3.p1) === JSON.stringify(tr2.p1) && tr3.p2.p > tr2.p2.p, `${L}: dragging the end handle changes only that end (${tr2.p2.p} → ${tr3.p2.p})`);

    // ---------- nu se mișcă SL-ul când desenezi peste el; linia SL se trage în continuare în modul cursor ----------
    if (!touch || L === 'mobile-portrait') {
      const sl0 = await page.evaluate(() => window.__sim.lines.sl.options().price);
      const ySL = await page.evaluate(p => window.__sim.series.priceToCoordinate(p), sl0);
      if (ySL > 20 && ySL < Hm - 20) {
        await pickTool('hline');
        await tap(Math.round(W * 0.2), ySL);
        s = await D();
        const sl1 = await page.evaluate(() => window.__sim.lines.sl.options().price);
        assert(s.d.length === 2 && s.d[1].type === 'hline' && sl1 === sl0, `${L}: in drawing mode a press on the SL line draws (does not move SL)`);
        // ștergem linia orizontală (selectată) cu coșul
        await page.evaluate(() => { const d = document.getElementById('sim-draw'); if (d) d.dataset.open = 'true'; });
        await page.click('#sim-draw-del'); await sleep(80);
        s = await D();
        assert(s.d.length === 1 && s.sel == null, `${L}: trash deletes the selected drawing`);
        if (touch) await page.evaluate(() => { document.getElementById('sim-draw').dataset.open = 'false'; });
        // în modul cursor, trasul liniei SL rămâne prioritar
        const y = await page.evaluate(p => window.__sim.series.priceToCoordinate(p), sl0);
        await dragG(Math.round(W * 0.5), y, Math.round(W * 0.5), y + 25);
        const sl2 = await page.evaluate(() => window.__sim.lines.sl.options().price);
        assert(sl2 < sl0 && (await D()).d.length === 1, `${L}: in cursor mode the SL line still drags (${sl0} → ${sl2}), drawings untouched`);
      } else assert(true, `${L}: SL line off-screen, priority check skipped`);
    }

    if (full) {
      // ---------- dreptunghi din două atingeri/clicuri ----------
      await pickTool('rect');
      await tap(Math.round(W * 0.15), Math.round(Hm * 0.3));
      s = await D();
      assert(s.d.length === 1 && s.tool === 'rect', `${L}: first click of rectangle waits for the second point`);
      await tap(Math.round(W * 0.3), Math.round(Hm * 0.45));
      s = await D();
      const rc = s.d[1];
      assert(s.d.length === 2 && rc.type === 'rect' && rc.p1.p > rc.p2.p && rc.p2.t > rc.p1.t, `${L}: second click completes the rectangle`);
      // culoare
      if (touch) await page.evaluate(() => { document.getElementById('sim-draw').dataset.open = 'true'; });
      await page.click('#sim-color'); await sleep(50);
      await page.click('.ws-palette [data-c="#f23645"]'); await sleep(50);
      s = await D();
      assert(s.d[1].color === '#f23645' && await page.$eval('#sim-palette', p => p.hidden), `${L}: palette recolors the selected drawing`);
      if (touch) await page.evaluate(() => { document.getElementById('sim-draw').dataset.open = 'false'; });
      // Fibonacci: nivelurile
      await pickTool('fib');
      await dragG(Math.round(W * 0.45), Math.round(Hm * 0.7), Math.round(W * 0.7), Math.round(Hm * 0.25));
      s = await D();
      const fb = s.d[2];
      assert(fb && fb.type === 'fib' && fb.p2.p > fb.p1.p && fb.color === '#f23645', `${L}: Fibonacci drawn from swing low to high (new drawings use the chosen color)`);
      // magnet: punctul se lipește de O/H/L/C
      if (touch) await page.evaluate(() => { document.getElementById('sim-draw').dataset.open = 'true'; });
      await page.click('#sim-magnet'); await sleep(50);
      if (touch) await page.evaluate(() => { document.getElementById('sim-draw').dataset.open = 'false'; });
      await pickTool('hray');
      const xm = Math.round(W * 0.55);
      const target = await page.evaluate(x => { const ts = window.__sim.chart.timeScale(), l = Math.round(ts.coordinateToLogical(x)), V = window.__sim.S.view; return { l, h: V.h[l], y: window.__sim.series.priceToCoordinate(V.h[l]) }; }, xm);
      await tap(xm, Math.round(target.y - 6));
      s = await D();
      assert(s.d[3] && s.d[3].type === 'hray' && s.d[3].p1.p === target.h, `${L}: magnet snaps to the candle high (${s.d[3] && s.d[3].p1.p} = ${target.h})`);
      // Escape anulează modul de desen; Delete șterge selecția (desktop)
      if (!touch) {
        await page.click('.ws-dt[data-tool="trend"]'); await page.keyboard.press('Escape'); await sleep(50);
        assert((await D()).tool === 'cursor', `${L}: Escape cancels drawing mode`);
        await page.keyboard.down('Alt'); await page.keyboard.press('KeyF'); await page.keyboard.up('Alt'); await sleep(50);
        assert((await D()).tool === 'fib', `${L}: Alt+F selects the Fibonacci tool`);
        await page.keyboard.press('Escape');
        await page.evaluate(() => { const c = SimExtra.coordsOf(SimExtra.state.drawings[3].id); window.__c = c; });
        const ca = await page.evaluate(() => window.__c.a);
        await tap(ca.x + 30, ca.y);
        await page.keyboard.press('Delete'); await sleep(50);
        assert((await D()).d.length === 3, `${L}: click selects the ray, Delete removes it`);
      } else {
        await page.evaluate(() => { document.getElementById('sim-draw').dataset.open = 'true'; });
        await page.click('#sim-draw-del'); await sleep(50);
        await page.evaluate(() => { document.getElementById('sim-draw').dataset.open = 'false'; });
        assert((await D()).d.length === 3, `${L}: trash removes the selected ray`);
      }
      // ---------- schimbarea intervalului: desenele rămân ancorate ----------
      const before = await D();
      await page.click('.ws-tf button[data-tf="H4"]'); await sleep(200);
      const anchored = await page.evaluate(() => SimExtra.state.drawings.every(d => { const c = SimExtra.coordsOf(d.id); return c.a.x != null && c.a.y != null; }));
      const same = JSON.stringify((await D()).d) === JSON.stringify(before.d);
      assert(anchored && same, `${L}: drawings keep their time/price anchors after switching to H4`);
      await page.click('.ws-tf button[data-tf="H1"]'); await sleep(200);
    }

    // ---------- indicatori ----------
    const indBtn = vp.width < 700 ? '.ws-ind-btn2' : '#sim-ind-open';
    const btnVis = await page.$eval(indBtn, b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.right <= innerWidth && r.bottom <= innerHeight; });
    assert(btnVis, `${L}: "Indicatori" button visible`);
    await page.click(indBtn); await sleep(100);
    assert(await page.$eval('#sim-ind', d => d.open), `${L}: indicator dialog opens`);
    for (const t of ['ema', 'ema', 'rsi', 'macd', 'atr', 'bb', 'sma']) { await page.click(`[data-add="${t}"]`); await sleep(60); }
    await page.click('#sim-ind-close'); await sleep(150);
    const ind = await page.evaluate(() => SimExtra.state.indicators.map(c => ({ id: c.id, type: c.type, len: c.len, color: c.color })));
    assert(ind.length === 7 && ind[0].len === 20 && ind[1].len === 50 && ind[0].color !== ind[1].color, `${L}: two EMA instances (20 and 50) with different colors`);
    assert(await page.evaluate(() => SimExtra.paneCount()) === 4, `${L}: RSI, MACD and ATR each get their own pane under the chart`);
    // valorile = motorul pe barele afișate (fără viitor)
    const check = () => page.evaluate(() => {
      const S = window.__sim.S, E = window.SimEngine, V = S.view, n = V.c.length, out = {};
      for (const c of SimExtra.state.indicators) {
        const v = SimExtra.values(c.id);
        const ref = c.type === 'ema' ? { main: E.ema(V.c, c.len) } : c.type === 'sma' ? { main: E.sma(V.c, c.len) } : c.type === 'rsi' ? { main: E.rsi(V.c, c.len) } : c.type === 'atr' ? { main: E.atr(V.h, V.l, V.c, c.len) } : c.type === 'bb' ? E.bollinger(V.c, c.len, c.mult) : (m => ({ line: m.line, signal: m.signal, hist: m.hist }))(E.macd(V.c, c.fast, c.slow, c.signal));
        out[c.id] = Object.keys(ref).filter(k => ['main', 'up', 'mid', 'lo', 'line', 'signal', 'hist'].includes(k)).every(k => v[k].length === n && Math.abs(v[k][n - 1] - ref[k][n - 1]) < 1e-12 && Math.abs(v[k][n - 30] - ref[k][n - 30]) < 1e-12);
      }
      return { ok: Object.values(out).every(Boolean), n, lastT: V.time[n - 1], cur: S.d.t[S.cur] };
    });
    let ck = await check();
    assert(ck.ok && ck.lastT === ck.cur, `${L}: all 7 indicators equal the engine on visible bars only (last = current bar)`);
    const ema0 = await page.evaluate(id => Array.from(SimExtra.values(id).main), ind[0].id);
    await page.click('#sim-next'); await sleep(100);
    await page.click('#sim-next10'); await sleep(200);
    ck = await check();
    const ema1 = await page.evaluate(id => Array.from(SimExtra.values(id).main), ind[0].id);
    const unchanged = ema0.slice(0, ema0.length).every((v, k) => (Number.isNaN(v) && Number.isNaN(ema1[k])) || Math.abs(v - ema1[k]) < 1e-12);
    assert(ck.ok && ema1.length > ema0.length && unchanged, `${L}: after replay steps values extend, past values never change (no repainting / lookahead)`);
    const sd = await page.evaluate(id => { const s = window.__sim.chart.panes()[0].getSeries(); return s.length; }, ind[0].id);
    assert(sd === 1 + 2 + 3 + 1, `${L}: main pane has candles + 2 EMA + 3 BB + SMA series (${sd})`);
    // legenda
    const lg = await page.evaluate(() => [...document.querySelectorAll('#sim-ind-legend .ind-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
    assert(lg.length === 7 && /^EMA 20 \d,\d{5}/.test(lg[0]) && /^RSI 14 \d{1,3},\d\d/.test(lg[2]) && /^ATR 14 \d,\d{5}/.test(lg[4]), `${L}: legend shows name + value (${lg[0]} | ${lg[2]} | ${lg[4]})`);
    if (!touch) assert(/pips/.test(lg[4]), `${L}: ATR legend also in pips (${lg[4]})`);
    // ascundere / setări / eliminare din legendă
    await page.click(`#sim-ind-legend [data-id="${ind[0].id}"] [data-act="vis"]`); await sleep(80);
    const vis = await page.evaluate(() => window.__sim.chart.panes()[0].getSeries()[1].options().visible);
    assert(vis === false && await page.$eval(`#sim-ind-legend [data-id="${ind[0].id}"]`, r => r.classList.contains('is-off')), `${L}: eye hides EMA 20 (series invisible, row dimmed)`);
    await page.click(`#sim-ind-legend [data-id="${ind[0].id}"] [data-act="vis"]`); await sleep(80);
    await page.click(`#sim-ind-legend [data-id="${ind[0].id}"] [data-act="cfg"]`); await sleep(100);
    const focused = await page.evaluate(() => document.activeElement && document.activeElement.dataset.f);
    assert(await page.$eval('#sim-ind', d => d.open) && focused === 'len', `${L}: gear opens settings focused on the length`);
    const setLen = v => page.evaluate((id, v) => { const i = document.querySelector(`#sim-ind-list [data-id="${id}"] input[data-f="len"]`); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, ind[0].id, v);
    await setLen('0');
    let cfg = await page.evaluate(id => ({ len: SimExtra.state.indicators.find(c => c.id === id).len, bad: document.querySelector(`#sim-ind-list [data-id="${id}"] input[data-f="len"]`).getAttribute('aria-invalid') }), ind[0].id);
    assert(cfg.len === 20 && cfg.bad === 'true', `${L}: invalid length 0 rejected (marked, value kept)`);
    await setLen('34');
    cfg = await page.evaluate(id => ({ len: SimExtra.state.indicators.find(c => c.id === id).len, name: document.querySelector(`#sim-ind-list [data-id="${id}"] strong`).textContent }), ind[0].id);
    ck = await check();
    assert(cfg.len === 34 && cfg.name === 'EMA 34' && ck.ok, `${L}: length 34 applied and recomputed`);
    // MACD: rapidă ≥ lentă e respinsă
    const macd = ind.find(c => c.type === 'macd');
    const badMacd = await page.evaluate(id => { const i = document.querySelector(`#sim-ind-list [data-id="${id}"] input[data-f="fast"]`); i.value = '30'; i.dispatchEvent(new Event('input', { bubbles: true })); return { f: SimExtra.state.indicators.find(c => c.id === id).fast, bad: i.getAttribute('aria-invalid') }; }, macd.id);
    assert(badMacd.f === 12 && badMacd.bad === 'true', `${L}: MACD fast ≥ slow rejected`);
    await page.click(`#sim-ind-list [data-id="${macd.id}"] [data-act="del"]`); await sleep(100);
    await page.click('#sim-ind-close'); await sleep(100);
    assert(await page.evaluate(() => SimExtra.paneCount()) === 3 && (await page.evaluate(() => SimExtra.state.indicators.length)) === 6, `${L}: MACD removed, its pane gone`);
    await page.click(`#sim-ind-legend [data-id="${ind.find(c => c.type === 'rsi').id}"] [data-act="del"]`); await sleep(100);
    assert(await page.evaluate(() => SimExtra.paneCount()) === 2, `${L}: RSI removed from the legend ×`);
    // legenda urmează cursorul (desktop)
    if (!touch) {
      const hx = Math.round(W * 0.4);
      await page.mouse.move(R.x + hx, R.y + Math.round(Hm * 0.5)); await sleep(100);
      const hov = await page.evaluate((x, id) => { const l = Math.round(window.__sim.chart.timeScale().coordinateToLogical(x)); const v = SimExtra.values(id).main[l]; return { want: v.toLocaleString('ro-RO', { minimumFractionDigits: 5, maximumFractionDigits: 5 }), got: document.querySelector(`#sim-ind-legend [data-id="${id}"] .ind-vals b`).textContent }; }, hx, ind[0].id);
      assert(hov.want === hov.got, `${L}: legend shows the value under the crosshair (${hov.got})`);
      await page.mouse.move(5, 5);
    }

    // ---------- salvare și reluare ----------
    const saved = await page.evaluate(() => JSON.stringify(SimExtra.save()));
    await page.evaluate(() => document.getElementById('sim-back').click()); await sleep(400);
    await page.goto(`${BASE}/simulator.html`, { waitUntil: 'networkidle2' });
    await page.click('#sim-resume');
    await page.waitForFunction(() => window.__sim.S && !document.getElementById('sim-session').hidden, { timeout: 20000 });
    await sleep(400);
    const back = await page.evaluate(() => JSON.stringify(SimExtra.save()));
    ck = await check();
    assert(back === saved && ck.ok && await page.evaluate(() => document.querySelectorAll('#sim-ind-legend .ind-row').length) === 5, `${L}: drawings + indicators restored on resume (values recomputed)`);
    // ștergere totală cu confirmare (două apăsări)
    if (touch) await page.evaluate(() => { document.getElementById('sim-draw').dataset.open = 'true'; });
    await page.click('#sim-draw-clear'); await sleep(50);
    const still = (await D()).d.length;
    await page.click('#sim-draw-clear'); await sleep(50);
    assert(still > 0 && (await D()).d.length === 0, `${L}: "clear all" asks for a second press, then removes all drawings`);
    // fără depășiri de ecran
    const ov = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight);
    assert(ov, `${L}: no overflow with drawings + indicators`);
    // bara de sus: un rând (desktop/peisaj) sau două (telefon portret), niciodată trei
    const rows = await page.evaluate(() => new Set([...document.querySelectorAll('.ws-bar button, .ws-bar select')].filter(e => e.getBoundingClientRect().width > 0).map(e => Math.round(e.getBoundingClientRect().top / 20))).size);
    assert(rows <= (vp.width < 700 ? 2 : 1), `${L}: toolbar keeps ${vp.width < 700 ? 'two rows' : 'one row'} with the new buttons (${rows})`);
    await page.screenshot({ path: `/workspace/shots/draw-${L}.png` });
    assert(errors.length === 0, `${L}: no console/page errors ${errors.slice(0, 3).join(' | ')}`);
    await page.close();
  }
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED', oks, 'ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
