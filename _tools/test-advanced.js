// Funcții avansate ale simulatorului (faza 1): schimbarea intervalului în sesiune (ceas H1 comun, fără lookahead),
// poziții multiple, ordine în așteptare simultane, închidere parțială, închide tot, reluare (inclusiv salvări vechi v1), date 2026.
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, oks = 0;
const assert = (c, m) => { if (c) { oks++; console.log('ok ' + m); } else { fails++; console.log('FAIL: ' + m); } };
const SIZES0 = [
  { name: 'desktop-1280', vp: { width: 1280, height: 800 } },
  { name: 'mobile-portrait', vp: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  { name: 'mobile-landscape', vp: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }
];
const SIZES = process.env.ONLY ? SIZES0.filter(x => x.name === process.env.ONLY) : SIZES0;
const KEY_CUR = 'mariusfx-sim-curenta-v1';
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const { name: L, vp } of SIZES) {
    const full = L === 'desktop-1280';
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror ' + e.stack));
    page.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
    page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(r.status() + ' ' + r.url()); });
    await page.setViewport(vp);
    await page.goto(`${BASE}/simulator.html`, { waitUntil: 'networkidle2' });
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('mariusfx-sim-ajutor-v1', '1'); });
    // butoanele din panou: pe mobil (portret) panoul e o foaie de jos care trebuie deschisă
    const act = (sel) => page.evaluate(s => { window.__sim.sheet && window.__sim.sheet(true); const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); e.click(); }, sel);
    const setVal = (sel, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
    const startAt = async (sym, tf, date) => {
      await page.goto(`${BASE}/simulator.html`, { waitUntil: 'networkidle2' });
      await page.evaluate((sym, tf, date) => {
        document.querySelector('.sim-adv-setup').open = true;
        document.getElementById('sim-sym').value = sym; document.getElementById('sim-sym').dispatchEvent(new Event('change', { bubbles: true }));
        document.querySelector(`input[name="sim-tf"][value="${tf}"]`).click();
        if (date) { document.querySelector('input[name="sim-mode"][value="date"]').click(); document.getElementById('sim-date').value = date; }
      }, sym, tf, date);
      await page.click('#sim-start');
      await page.waitForFunction(() => window.__sim.S && !document.getElementById('sim-session').hidden, { timeout: 20000 });
      await sleep(300);
    };
    const tfBtn = async tf => { await page.click(`.ws-tf button[data-tf="${tf}"]`); await sleep(150); };
    // verificare independentă a graficului: barele afișate = agregarea H1 până la ora curentă (bara în formare inclusă), nimic din viitor
    const viewCheck = () => page.evaluate(() => {
      const S = window.__sim.S, E = window.SimEngine, data = window.__sim.series.data(), tf = S.tf;
      const last = data[data.length - 1], b0 = E.bucketStart(S.d.t[S.cur], tf);
      let i0 = S.cur; while (i0 > 0 && E.bucketStart(S.d.t[i0 - 1], tf) === b0) i0--;
      let h = -Infinity, l = Infinity; for (let i = i0; i <= S.cur; i++) { h = Math.max(h, S.d.h[i]); l = Math.min(l, S.d.l[i]); }
      return { tf, lastT: last.time, b0, ok: last.open === S.d.o[i0] && last.high === h && last.low === l && last.close === S.d.c[S.cur],
        future: data.some(b => b.time > b0), label: document.getElementById('sim-label').textContent, pressed: [...document.querySelectorAll('.ws-tf button[aria-pressed="true"]')].map(b => b.dataset.tf).join() };
    });
    const st = () => page.evaluate(() => { const S = window.__sim.S; return { cur: S.cur, t: S.d.t[S.cur], tf: S.tf, positions: S.positions.map(p => ({ id: p.id, n: p.n, lot: p.lot, lot0: p.lot0, side: p.side, entry: p.entry, sl: p.sl, tp: p.tp, realized: p.realized || 0, parts: (p.closes || []).length })), orders: S.orders.map(o => ({ id: o.id, kind: o.kind, price: o.price })), trades: S.trades, balance: S.balance, sel: S.sel, ended: S.ended }; });

    // ---------- 1. schimbarea intervalului în sesiune ----------
    await startAt('EURUSD', 'H1', '2024-07-10');
    const vis = await page.evaluate(() => [...document.querySelectorAll('.ws-tf button')].map(b => { const r = b.getBoundingClientRect(); return r.width > 20 && r.height >= 24 && r.right <= innerWidth && r.bottom <= innerHeight; }).every(Boolean));
    assert(vis, `${L}: H1/H4/D1 buttons visible in the toolbar`);
    let s0 = await st(), v = await viewCheck();
    assert(v.tf === 'H1' && v.ok && !v.future && v.pressed === 'H1', `${L}: H1 view, last bar = current hour`);
    await tfBtn('H4');
    let s1 = await st(); v = await viewCheck();
    assert(s1.cur === s0.cur && v.tf === 'H4' && v.ok && !v.future && v.label === 'EURUSD · H4' && v.pressed === 'H4', `${L}: switch to H4 keeps the clock; forming H4 candle built only from past H1 bars`);
    await tfBtn('D1');
    s1 = await st(); v = await viewCheck();
    assert(s1.cur === s0.cur && v.ok && !v.future && v.pressed === 'D1', `${L}: switch to D1 keeps the clock; forming daily candle = H1 bars so far today`);
    await page.click('#sim-next'); await sleep(100);
    let s2 = await st(); v = await viewCheck();
    const dayEnd = await page.evaluate(() => { const S = window.__sim.S, E = window.SimEngine; return E.isBucketEnd(S.d, S.cur, 'D1'); });
    assert(s2.cur > s1.cur && s2.cur - s1.cur <= 24 && dayEnd && v.ok && !v.future, `${L}: Next on D1 advances to the end of the trading day (${s2.cur - s1.cur} H1 bars)`);
    await page.click('#sim-next'); await sleep(100);
    let s3 = await st(); v = await viewCheck();
    assert(s3.cur - s2.cur >= 20 && s3.cur - s2.cur <= 24 && v.ok && !v.future, `${L}: next full day = ${s3.cur - s2.cur} H1 bars, daily candle complete`);
    await tfBtn('H4'); await page.click('#sim-next'); await sleep(100);
    const s4 = await st(); v = await viewCheck();
    assert(s4.cur - s3.cur >= 1 && s4.cur - s3.cur <= 4 && v.ok, `${L}: Next on H4 = ${s4.cur - s3.cur} H1 bars`);
    await tfBtn('H1');
    v = await viewCheck();
    assert(v.ok && v.lastT === s4.t && !v.future, `${L}: back to H1 shows the current hour as last candle`);

    // ---------- 2. poziții multiple și ordine ----------
    await act('#sim-place');   // Buy la piață cu SL/TP implicite
    await page.evaluate(() => document.querySelector('input[name="sim-side"][value="sell"]').click());
    await act('#sim-place');   // Sell la piață
    let p = await st();
    const keys = await page.evaluate(() => Object.keys(window.__sim.rawLines).sort().join());
    const titles = await page.evaluate(() => Object.values(window.__sim.rawLines).map(l => l.options().title).join('|'));
    assert(p.positions.length === 2 && p.positions[0].side === 'buy' && p.positions[1].side === 'sell', `${L}: two open positions at once (Buy + Sell)`);
    assert(keys === 'e:1,e:2,sl:1,sl:2,tp:1,tp:2' && /#1 SL/.test(titles) && /#2 TP/.test(titles), `${L}: each position has its own labeled entry/SL/TP lines (${keys})`);
    // ordin limit în plus
    await page.evaluate(() => { document.querySelector('input[name="sim-side"][value="buy"]').click(); document.getElementById('sim-adv').open = true; document.querySelector('input[name="sim-kind"][value="limit"]').click(); });
    const lim = await page.evaluate(() => { const S = window.__sim.S; return (S.d.c[S.cur] - 0.0050).toFixed(5); });
    await setVal('#sim-price', lim);
    await act('#sim-place');
    p = await st();
    const rows = await page.evaluate(() => [...document.querySelectorAll('#sim-pos-list .ws-pos-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
    assert(p.orders.length === 1 && p.orders[0].kind === 'limit' && rows.length === 3 && /#3 limit/.test(rows[2]), `${L}: buy limit added alongside 2 positions; list shows 3 rows`);
    await page.evaluate(() => document.querySelector('input[name="sim-kind"][value="market"]').click());
    // selectarea poziției #1 din listă
    await act('#sim-pos-list [data-id="1"]');
    const sel = await page.evaluate(() => ({ title: document.getElementById('sim-pos-title').textContent, pressed: document.querySelector('#sim-pos-list [data-id="1"]').getAttribute('aria-pressed') }));
    assert(sel.title === 'Poziție deschisă #1' && sel.pressed === 'true', `${L}: selecting #1 in the list shows its details (${sel.title})`);
    // închidere parțială 50% pentru #1
    const before = await st(), P1 = before.positions[0];
    await act('[data-part="50"]');
    p = await st();
    const P1b = p.positions.find(x => x.id === 1);
    const half = Math.floor(P1.lot * 50 + 1e-9) / 100;
    assert(P1b && Math.abs(P1b.lot - (P1.lot - half)) < 1e-9 && P1b.lot0 === P1.lot && p.trades.length === before.trades.length && P1b.parts === 1 && Math.abs(p.balance - (before.balance + P1b.realized)) < 0.006, `${L}: partial close 50% of #1 (${P1.lot} → ${P1b && P1b.lot}), realized ${P1b && P1b.realized} added to balance, trade still open`);
    // lot exact
    await setVal('#sim-part-lot', '0,01'); await act('#sim-part-go');
    p = await st();
    assert(Math.abs(p.positions.find(x => x.id === 1).lot - (P1b.lot - 0.01)) < 1e-9, `${L}: partial close of exact lot 0,01 (comma input)`);
    await setVal('#sim-part-lot', '0'); await act('#sim-part-go');
    const perr = await page.$eval('#sim-pos-err', e => !e.hidden && e.textContent);
    assert(perr && /lot/i.test(perr), `${L}: invalid partial lot → friendly error`);
    // închide tot (reținem părțile #1 ca să verificăm totalul tranzacției)
    const nT = p.trades.length;
    const pre1 = await page.evaluate(() => { const S = window.__sim.S, E = window.SimEngine, P = JSON.parse(JSON.stringify(S.positions.find(x => x.id === 1))); E.closePart(P, E.markPrice(P, S.d.c[S.cur]), P.lot, 'Manual', 0); const m = E.summarize(P); return { money: m.money, r: m.r, parts: m.parts }; });
    await act('#sim-close-all');
    p = await st();
    const t1 = p.trades.find(t => t.pid === 1);
    assert(p.positions.length === 0 && p.orders.length === 1 && p.trades.length === nT + 2 && t1 && t1.parts === 3 && t1.lot === P1.lot, `${L}: "Închide tot" closes both positions (pending order kept); #1 recorded as one trade with 3 parts`);
    assert(t1.money === pre1.money && t1.r === pre1.r && pre1.parts === 3, `${L}: trade #1 total = its 3 parts (money ${t1.money} = ${pre1.money}, R ${t1.r} = ${pre1.r})`);
    // anulează ordinul
    await act('#sim-pos-list [data-id="3"]'); await act('#sim-close');
    p = await st();
    assert(p.orders.length === 0 && !(await page.evaluate(() => Object.keys(window.__sim.rawLines).some(k => /^o/.test(k)))), `${L}: pending order cancelled, its lines removed`);

    if (full) {
      // ---------- 3. execuția SL/TP pe H1 chiar și în vederea D1 ----------
      await tfBtn('D1');
      await setVal('#sim-sl', '8'); await setVal('#sim-tp', '30');
      await act('#sim-place');
      const P = (await st()).positions[0], openIdx = (await st()).cur;
      for (let k = 0; k < 30 && (await st()).positions.length; k++) { await page.click('#sim-next'); await sleep(30); }
      const s = await st(), tr = s.trades[s.trades.length - 1];
      const expK = await page.evaluate((P, i0) => { const S = window.__sim.S; for (let i = i0 + 1; i <= S.cur; i++) { if (S.d.l[i] <= P.sl) return { k: i, why: 'SL' }; if (S.d.h[i] >= P.tp) return { k: i, why: 'TP' }; } return null; }, P, openIdx);
      const exitT = expK && await page.evaluate(k => window.__sim.S.d.t[k], expK.k);
      assert(tr && expK && tr.exitT === exitT && tr.reason === expK.why, `D1 view: SL/TP checked on every H1 bar (exit ${tr && tr.reason} at H1 ${new Date(exitT * 1000).toISOString()})`);
      await tfBtn('H1');
    }

    // ---------- 4. reluare (format v2) ----------
    await act('#sim-place');
    await tfBtn('H4');
    const snapBefore = await st();
    await page.evaluate(() => window.__sim.S && document.getElementById('sim-back').click());
    await sleep(500);
    await page.goto(`${BASE}/simulator.html`, { waitUntil: 'networkidle2' });
    const canResume = await page.$eval('#sim-resume', e => !e.hidden);
    await page.click('#sim-resume');
    await page.waitForFunction(() => window.__sim.S && !document.getElementById('sim-session').hidden, { timeout: 20000 });
    await sleep(300);
    let r = await st(); v = await viewCheck();
    assert(canResume && r.cur === snapBefore.cur && r.tf === 'H4' && r.positions.length === snapBefore.positions.length && JSON.stringify(r.positions) === JSON.stringify(snapBefore.positions) && r.trades.length === snapBefore.trades.length && v.ok && v.pressed === 'H4', `${L}: resume restores clock, view TF (H4), positions and trades`);
    const lk = await page.evaluate(() => Object.keys(window.__sim.rawLines).length);
    assert(lk === 3, `${L}: resumed position lines redrawn (${lk})`);

    // ---------- 5. salvare veche (v1, o singură poziție, D1) → se reia corect ----------
    if (full) {
      await page.evaluate(() => document.getElementById('sim-back').click()); await sleep(300);
      const v1 = await page.evaluate(KEY => {
        // construim o salvare v1 realistă: D1, bara curentă = o zi; poziție Buy
        const s = JSON.parse(localStorage.getItem(KEY));
        const E = window.SimEngine;
        const dayT = E.bucketStart(s.curT, 'D1');
        const P = Object.assign({}, s.positions[0]); delete P.id; delete P.n; delete P.lot0;
        const v1 = { v: 1, id: 'old1', sym: s.sym, tf: 'D1', ccy: s.ccy, bal0: s.bal0, riskPct: s.riskPct, mode: s.mode, hidden: s.hidden, startT: s.startT, curT: dayT, stopT: s.stopT, balance: s.balance, pos: P, pending: null, trades: s.trades, markers: [{ time: dayT, position: 'belowBar', color: '#089981', shape: 'arrowUp', text: 'Buy' }], barsPlayed: 5 };
        localStorage.setItem(KEY, JSON.stringify(v1));
        return { dayT, entry: P.entry };
      }, KEY_CUR);
      await page.goto(`${BASE}/simulator.html`, { waitUntil: 'networkidle2' });
      await page.click('#sim-resume');
      await page.waitForFunction(() => window.__sim.S && !document.getElementById('sim-session').hidden, { timeout: 20000 });
      await sleep(300);
      r = await st(); v = await viewCheck();
      const endOfDay = await page.evaluate(() => { const S = window.__sim.S, E = window.SimEngine; return E.bucketStart(S.d.t[S.cur], 'D1') === E.bucketStart(S.d.t[S.cur], 'D1') && E.isBucketEnd(S.d, S.cur, 'D1'); });
      assert(r.tf === 'D1' && v.lastT === v1.dayT && endOfDay && r.positions.length === 1 && r.positions[0].entry === v1.entry && r.positions[0].id === 1, `old v1 save resumes on the same daily bar (end of that day) with its position`);
      const mk = await page.evaluate(() => window.__sim.S.markers.every(m => Number.isFinite(m.t)));
      assert(mk, 'old v1 markers converted');
    }

    // ---------- 6. date 2026 până la final ----------
    if (full) {
      await startAt('XAUUSD', 'H1', '2026-08-20');
      let s = await st();
      assert(new Date(s.t * 1000).getUTCFullYear() === 2026 && new Date(s.t * 1000).getUTCMonth() === 7, `2026 data: XAUUSD session starts in Aug 2026 (${new Date(s.t * 1000).toISOString()})`);
      await tfBtn('D1');
      for (let k = 0; k < 40 && !(await st()).ended; k++) { await page.click('#sim-next'); await sleep(30); }
      s = await st();
      const reason = await page.$eval('#sim-sum-reason', e => e.textContent);
      const lastT = await page.evaluate(() => window.__sim.S.d.t[window.__sim.S.d.n - 1]);
      assert(s.ended && /finalul datelor disponibile \(septembrie 2026\)/.test(reason) && new Date(lastT * 1000).toISOString().slice(0, 10) === '2026-09-24', `2026 data: replay reaches the end of data (24.09.2026) cleanly: "${reason}"`);
      await page.keyboard.press('Escape');
      // data aleasă prea aproape de final → mesaj clar
      await page.evaluate(() => document.getElementById('sim-back').click()); await sleep(300);
      await page.goto(`${BASE}/simulator.html`, { waitUntil: 'networkidle2' });
      await page.evaluate(() => { document.querySelector('.sim-adv-setup').open = true; document.querySelector('input[name="sim-mode"][value="date"]').click(); document.getElementById('sim-date').value = '2026-09-20'; });
      await page.click('#sim-start'); await sleep(800);
      const err = await page.$eval('#sim-setup-err', e => !e.hidden && e.textContent);
      assert(err && /2026/.test(err), `date too close to end of data → clear message: ${err}`);
      const mx = await page.$eval('#sim-date', e => e.max);
      assert(mx >= '2026-08-01' && mx <= '2026-09-10', `date picker max follows index.json (${mx})`);
    }

    const ov = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    assert(ov, `${L}: no horizontal overflow`);
    assert(errors.length === 0, `${L}: no console/page errors ${errors.slice(0, 3).join(' | ')}`);
    await page.close();
  }
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED', oks, 'ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
