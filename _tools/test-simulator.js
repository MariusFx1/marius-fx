// Test: simulatorul de backtesting (simulator.html) la 1280 și 390.
// Rezultatele SL/TP sunt verificate cu un calcul independent (decodare + execuție scrise separat de sim-engine.js).
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://localhost:8765';
const DATA_DIR = '/workspace/forex-ms/data/sim';
let ok = 0, fail = 0;
const assert = (c, m) => { if (c) { ok++; console.log('ok  - ' + m); } else { fail++; console.log('FAIL: ' + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- calcul independent ----------
const files = {};
const SIM_YEARS = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'index.json'))).instruments.EURUSD.H1;
async function series(sym, tf, years) {
  const out = { t: [], o: [], h: [], l: [], c: [] };
  for (const name of (tf === 'H1' ? years.map(y => `${sym}-H1-${y}.json`) : [`${sym}-${tf}.json`])) {
    if (!files[name]) files[name] = BASE.startsWith('http://localhost') ? JSON.parse(fs.readFileSync(path.join(DATA_DIR, name))) : await (await fetch(`${BASE}/data/sim/${name}`)).json();
    const j = files[name], m = 10 ** j.dec; let t = j.t0, pc = null;
    for (let k = 0; k < j.b.length; k += 5) {
      t += j.b[k] * 60; const O = pc == null ? j.b[k + 1] : pc + j.b[k + 1]; const C = O + j.b[k + 4]; pc = C;
      if (out.t.length && t <= out.t[out.t.length - 1]) continue;
      out.t.push(t); out.o.push(O / m); out.h.push((O + j.b[k + 2]) / m); out.l.push((O - j.b[k + 3]) / m); out.c.push(C / m);
    }
  }
  return out;
}
const PIP = { EURUSD: 1e-4, GBPUSD: 1e-4, AUDUSD: 1e-4, USDJPY: .01, GBPJPY: .01, XAUUSD: .1 };
const SPREAD = { EURUSD: 1, GBPUSD: 1.5, AUDUSD: 1.2, USDJPY: 1.2, GBPJPY: 2.5, XAUUSD: 3 };
const r6 = x => Math.round(x * 1e6) / 1e6;
/** Simulează independent o poziție: întoarce indexul barei de ieșire, motivul, prețul. */
function expectExit(d, i0, side, entry, sl, tp, sym) {
  const sp = SPREAD[sym] * PIP[sym];
  for (let k = i0 + 1; k < d.t.length; k++) {
    const add = side === 'buy' ? 0 : sp;   // ieșirea: Buy la Bid, Sell la Ask
    const o = d.o[k] + add, h = d.h[k] + add, l = d.l[k] + add;
    if (side === 'buy') {
      if (o <= sl) return { k, reason: 'SL', price: o, gap: true };
      if (l <= sl) return { k, reason: 'SL', price: sl, both: h >= tp };
      if (h >= tp) return { k, reason: 'TP', price: tp };
    } else {
      if (o >= sl) return { k, reason: 'SL', price: o, gap: true };
      if (h >= sl) return { k, reason: 'SL', price: sl, both: l <= tp };
      if (l <= tp) return { k, reason: 'TP', price: tp };
    }
  }
  return null;
}
async function click(page, sel) { await page.$eval(sel, e => e.scrollIntoView({ block: 'center' })); await page.click(sel); }
const roNum = (x, d) => Number(x).toLocaleString('ro-RO', { minimumFractionDigits: d, maximumFractionDigits: d });

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'], protocolTimeout: 120000 });
  const errors = [];
  async function newPage(vp) {
    const page = await browser.newPage();
    await page.setViewport(vp);
    page.on('pageerror', e => errors.push(`${vp.width} pageerror ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`${vp.width} console ${m.text()}`); });
    page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`${vp.width} ${r.status()} ${r.url()}`); });
    page.on('requestfailed', r => { if (!/tradingview|google|fonts/.test(r.url())) errors.push(`${vp.width} failed ${r.url()}`); });
    return page;
  }
  const S = (page, fn) => page.evaluate(fn);
  async function start(page, o) {
    await page.goto(`${BASE}/simulator.html`, { waitUntil: 'networkidle2' });
    if (await page.$eval('#sim-help', d => d.open)) await click(page, '#sim-help-close');
    await page.select('#sim-sym', o.sym);
    await click(page, `input[name="sim-tf"][value="${o.tf}"]`);
    await click(page, `input[name="sim-mode"][value="${o.date ? 'date' : 'random'}"]`);
    if (o.date) await page.$eval('#sim-date', (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, o.date);
    await page.$eval('.sim-adv-setup', d => { d.open = true; });
    await page.select('#sim-ccy', o.ccy || 'EUR');
    for (const [id, v] of [['#sim-bal', o.bal || '10000'], ['#sim-risk', o.risk || '1']]) { await page.click(id, { clickCount: 3 }); await page.type(id, String(v)); }
    await click(page, '#sim-start');
    if (o.expectError) { await page.waitForFunction(() => !document.getElementById('sim-setup-err').hidden, { timeout: 15000 }); return page.$eval('#sim-setup-err', e => e.textContent); }
    await page.waitForFunction(() => window.__sim && window.__sim.S && !document.getElementById('sim-session').hidden, { timeout: 20000 });
    await page.evaluate(() => { window.__sim.sheet(true); document.getElementById('sim-adv').open = true; });
    await sleep(400);
    return null;
  }
  async function setField(page, id, v) { await page.$eval(id, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, String(v)); }
  const state = page => page.evaluate(() => { const S = window.__sim.S; return { cur: S.cur, t: S.d.t[S.cur], c: S.d.c[S.cur], first: S.firstIdx, pos: S.pos, pending: S.pending, trades: S.trades, balance: S.balance, ended: S.ended, hidden: S.hidden, sym: S.sym, tf: S.tf, startT: S.startT, years: S.years }; });

  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]) {
    const label = vp.width === 1280 ? 'desktop' : 'mobile';
    const page = await newPage(vp);
    const reqs = [];
    page.on('request', r => { if (/data\/sim\//.test(r.url())) reqs.push(r.url().split('/').pop()); });
    await page.evaluateOnNewDocument(() => { if (!sessionStorage.getItem('init')) { localStorage.clear(); sessionStorage.setItem('init', '1'); } });

    // ---------- prima vizită: ajutor + setări ----------
    await page.goto(`${BASE}/simulator.html`, { waitUntil: 'networkidle2' });
    const first = await page.evaluate(() => ({ help: document.getElementById('sim-help').open, steps: document.querySelectorAll('#sim-help ol li').length, title: document.getElementById('sim-help-title').textContent, setup: !document.getElementById('sim-setup').hidden, h1: document.querySelector('h1').textContent, attr: document.querySelector('.sim-attrib').textContent, disc: document.querySelector('.sim-disclaimer').textContent }));
    assert(first.help && first.steps === 5 && first.title === 'Cum folosești simulatorul', `${label}: onboarding dialog opens on first visit (5 steps)`);
    assert(first.setup && first.h1 === 'Simulator de backtesting Forex', `${label}: setup form shown, H1`);
    assert(/HistData\.com/.test(first.attr) && /Lightweight Charts™ v5\.2\.1/.test(first.attr) && /Apache 2\.0/.test(first.attr) && /NOTICE/.test(first.attr), `${label}: attribution (HistData, TradingView LWC 5.2.1, Apache 2.0, NOTICE)`);
    assert(/nu garantează rezultate viitoare/.test(first.disc) && /educațional/.test(first.disc), `${label}: past-performance + educational disclaimer`);
    await click(page, '#sim-help-close'); await sleep(200);
    await page.reload({ waitUntil: 'networkidle2' });
    assert(!(await page.$eval('#sim-help', d => d.open)), `${label}: onboarding not shown again after closing`);

    // ---------- erori la pornire ----------
    let err = await start(page, { sym: 'EURUSD', tf: 'H1', date: '2023-04-10', expectError: true });
    assert(/ore lipsă/.test(err) && /februarie 2023/.test(err), `${label}: date in incomplete source window rejected (${err.slice(0, 90)}…)`);
    err = await start(page, { sym: 'EURUSD', tf: 'H1', bal: '50', expectError: true });
    assert(err === 'Soldul virtual trebuie să fie un număr între 100 și 10.000.000.', `${label}: balance validation`);
    err = await start(page, { sym: 'EURUSD', tf: 'D1', date: '2019-02-01', expectError: true });
    assert(/alege o dată între/.test(err), `${label}: too-early date rejected for D1 (${err.slice(0, 70)}…)`);

    if (label === 'desktop') {
      // ---------- caz cunoscut A: EURUSD H1, Buy, SL 15 / TP 30 pips ----------
      reqs.length = 0;
      await start(page, { sym: 'EURUSD', tf: 'H1', date: '2024-07-10', ccy: 'EUR', bal: '10.000', risk: '1' });
      let st = await state(page);
      const dA = await series('EURUSD', 'H1', [2024]);
      const i0 = dA.t.findIndex(t => t >= Date.UTC(2024, 6, 10) / 1000);
      assert(st.t === dA.t[i0] && st.c === dA.c[i0] && st.balance === 10000, `A: starts at first bar of 2024-07-10 (${new Date(st.t * 1000).toISOString()}), balance 10.000 parsed`);
      assert(!st.hidden && /10\.07\.2024/.test(await page.$eval('#sim-when', e => e.textContent)), 'A: chosen date → date visible');
      const vis = await page.evaluate(() => { const s = window.__sim.series.data(), r = window.__sim.chart.timeScale().getVisibleLogicalRange(); return { n: s.length, last: s[s.length - 1].time, maxT: Math.max(...s.map(b => b.time)), shown: Math.round(r.to - r.from) }; });
      assert(vis.n >= 151 && vis.last === st.t && vis.maxT === st.t && vis.shown >= 150 && vis.shown <= 160, `A: ~150 history bars in view (${vis.shown}, ${vis.n} loaded), last bar = current bar, no future bars`);
      assert(JSON.stringify(reqs.sort()) === JSON.stringify(['EURUSD-D1.json', 'EURUSD-H1-2023.json', 'EURUSD-H1-2024.json', 'index.json']), `A: lazy data load (only past years needed: ${reqs.join(', ')})`);
      assert(await page.$eval('#sim-chart', el => !!el.querySelector('a[href*="tradingview.com"]')), 'A: TradingView attribution logo link on chart');
      await setField(page, '#sim-sl', '15'); await setField(page, '#sim-tp', '30');
      const calc = await page.evaluate(() => ['sim-c-sl', 'sim-c-tp', 'sim-c-rr', 'sim-c-lot', 'sim-c-risk'].map(id => document.getElementById(id).textContent));
      const entryA = r6(dA.c[i0] + 1e-4), pvA = 10 / dA.c[i0];
      const lotA = Math.floor(100 / (15 * pvA) * 100 + 1e-9) / 100;
      assert(calc[0] === '15,0 pips' && calc[1] === '30,0 pips' && calc[2] === '1:2,00' && calc[3] === roNum(lotA, 2), `A: order preview SL/TP pips, R:R 1:2, lot ${lotA} (${calc.join(' | ')})`);
      await click(page, '#sim-place');
      st = await state(page);
      assert(st.pos && Math.abs(st.pos.entry - entryA) < 1e-9 && st.pos.lot === lotA && Math.abs(st.pos.sl - r6(entryA - 0.0015)) < 1e-9, `A: Buy filled at ask ${entryA} (bid + 1 pip), lot ${lotA}, SL ${r6(entryA - 0.0015)}`);
      const lines = await page.evaluate(() => Object.keys(window.__sim.lines).sort().join(','));
      assert(lines === 'entry,sl,tp', `A: entry/SL/TP lines drawn (${lines})`);
      // pas cu pas până se închide
      let steps = 0;
      while (steps < 400 && !(await page.evaluate(() => window.__sim.S.trades.length))) { await click(page, '#sim-next'); steps++; }
      st = await state(page);
      const xA = expectExit(dA, i0, 'buy', entryA, r6(entryA - 0.0015), r6(entryA + 0.003), 'EURUSD');
      const tA = st.trades[0];
      const pipsA = Math.round((xA.price - entryA) / 1e-4 * 10) / 10, moneyA = Math.round(pipsA * pvA * lotA * 100) / 100;
      assert(tA && tA.reason === xA.reason && tA.exitT === dA.t[xA.k] && Math.abs(tA.exit - xA.price) < 1e-9, `A: exit matches independent calc: ${xA.reason} at ${new Date(dA.t[xA.k] * 1000).toISOString()} (${tA && tA.reason})`);
      assert(tA.pips === pipsA && tA.money === moneyA && Math.abs(tA.r - Math.round(pipsA / 15 * 100) / 100) < 1e-9 && st.balance === Math.round((10000 + moneyA) * 100) / 100, `A: pips ${pipsA}, P/L ${moneyA} EUR, R ${tA.r}, balance updated`);
      const mk = await page.evaluate(() => window.__sim.S.markers.map(m => m.shape + ':' + m.text));
      assert(mk.length === 2 && mk[0] === 'arrowUp:Buy' && /^circle:(TP|SL) /.test(mk[1]), `A: entry + exit markers on chart (${mk.join(' | ')})`);
      // tastatura
      const c0 = (await state(page)).cur;
      await page.$eval('#sim-next', b => b.blur()); await page.keyboard.press('ArrowRight');
      const c1 = (await state(page)).cur;
      await page.focus('#sim-sl'); await page.keyboard.press('ArrowRight');
      const c2 = (await state(page)).cur;
      assert(c1 === c0 + 1 && c2 === c1, 'A: → key advances one bar (not while typing in a field)');
      await click(page, '#sim-next10');
      assert((await state(page)).cur === c1 + 10, 'A: +10 bars');
      // redare 10x
      await page.select('#sim-speed', '10'); const p0 = (await state(page)).cur;
      await click(page, '#sim-play'); await sleep(1300);
      const playing = await page.$eval('#sim-play', b => b.getAttribute('aria-pressed') + '|' + b.textContent.trim());
      await click(page, '#sim-play'); const p1 = (await state(page)).cur; await sleep(400);
      assert(playing === 'true|Pauză' && p1 - p0 >= 6 && (await state(page)).cur === p1, `A: Play at 10x advances (${p1 - p0} bars in 1.3s, ${playing}), Pause stops`);

      // validare ordin
      await click(page, 'input[name="sim-unit"][value="price"]');
      const cNow = (await state(page)).c;
      await setField(page, '#sim-sl', (cNow + 0.002).toFixed(5)); await setField(page, '#sim-tp', (cNow + 0.004).toFixed(5));
      await click(page, '#sim-place');
      assert(await page.$eval('#sim-order-err', e => !e.hidden && e.textContent === 'La Buy, stop loss-ul trebuie să fie sub prețul de intrare.'), 'A: validation: Buy with SL above entry rejected');
      await click(page, 'input[name="sim-side"][value="sell"]');
      await setField(page, '#sim-tp', (cNow + 0.001).toFixed(5)); await setField(page, '#sim-sl', (cNow + 0.004).toFixed(5));
      await click(page, '#sim-place');
      assert(await page.$eval('#sim-order-err', e => e.textContent === 'La Sell, take profit-ul trebuie să fie sub prețul de intrare.'), 'A: validation: Sell with TP above entry rejected');
      await click(page, 'input[name="sim-unit"][value="pips"]');
      const conv = await page.evaluate(() => [document.getElementById('sim-sl').value, document.getElementById('sim-tp').value]);
      assert(conv[0] === '40' && conv[1] === '10', `A: switching Preț → Pips converts the values (${conv})`);
          await page.evaluate(() => { window.__sim.S.riskPct = 0.001; });
      await setField(page, '#sim-sl', '50'); await setField(page, '#sim-tp', '100'); await click(page, '#sim-place');
      assert(await page.$eval('#sim-order-err', e => /^Lotul calculat e sub 0,01/.test(e.textContent)), 'A: lot below 0.01 → clear error, no order');
      await page.evaluate(() => { window.__sim.S.riskPct = 1; });

      // ---------- tragere linii (mouse): previzualizare SL ----------
      await click(page, 'input[name="sim-side"][value="buy"]');
      await setField(page, '#sim-sl', '20'); await setField(page, '#sim-tp', '40');
      await page.$eval('#sim-chart', e => e.scrollIntoView({ block: 'center' })); await sleep(1200);
      const geo = await page.evaluate(() => { const r = document.getElementById('sim-chart').getBoundingClientRect(); const L = window.__sim.lines; return { x: r.left + r.width * 0.45, top: r.top, sl: window.__sim.series.priceToCoordinate(L.sl.options().price), tp: window.__sim.series.priceToCoordinate(L.tp.options().price) }; });
      await page.mouse.move(geo.x, geo.top + geo.sl); await page.mouse.down();
      for (let k = 1; k <= 6; k++) await page.mouse.move(geo.x, geo.top + geo.sl + k * 6);
      await page.mouse.up(); await sleep(150);
      const slAfter = Number((await page.$eval('#sim-sl', e => e.value)).replace(',', '.'));
      assert(slAfter > 20.5, `desktop drag: dragging preview SL line down widens SL input (20 → ${slAfter} pips)`);
      // poziție deschisă: trage TP în sus
      await click(page, '#sim-place');
      const before = (await state(page)).pos;
      await page.$eval('#sim-chart', e => e.scrollIntoView({ block: 'center' })); await sleep(1200);
      const g2 = await page.evaluate(() => ({ tp: window.__sim.series.priceToCoordinate(window.__sim.S.pos.tp), r: document.getElementById('sim-chart').getBoundingClientRect().top }));
      await page.mouse.move(geo.x, g2.r + g2.tp); await page.mouse.down();
      for (let k = 1; k <= 5; k++) await page.mouse.move(geo.x, g2.r + g2.tp - k * 5);
      await page.mouse.up(); await sleep(150);
      const after = (await state(page)).pos;
      assert(after && after.tp > before.tp && await page.$eval('#sim-p-tp', (e, v) => Number(e.value) === v, after.tp), `desktop drag: dragging TP line on open position moves TP up (${before.tp} → ${after && after.tp})`);
      // break-even: respins pe minus, acceptat pe plus; apoi închidere manuală
      let beChecked = false;
      for (let k = 0; k < 200; k++) {
        const s = await state(page); if (!s.pos) break;
        const inProfit = s.c > s.pos.entry;
        await click(page, '#sim-be');
        const s2 = await state(page);
        if (!inProfit) { assert(k > 0 || (s2.pos.sl === s.pos.sl && await page.$eval('#sim-pos-err', e => !e.hidden)), 'BE rejected while position is not in profit'); }
        else { assert(s2.pos.be && s2.pos.sl === s2.pos.entry && await page.$eval('#sim-p-sl', (e, v) => Number(e.value) === Number(v.toFixed(5)), s2.pos.entry), 'BE: SL moved to entry when in profit'); beChecked = true; break; }
        await click(page, '#sim-next');
      }
      const sb = await state(page);
      if (sb.pos) {
        const n0 = sb.trades.length; await click(page, '#sim-close');
        const sc = await state(page), t = sc.trades[n0];
        const pv = 10 / sb.c, exp = Math.round(Math.round((sb.c - sb.pos.entry) / 1e-4 * 10) / 10 * pv * sb.pos.lot * 100) / 100;
        assert(!sc.pos && t.reason === 'Manual' && t.exit === sb.c && Math.abs(t.money - exp) < 0.011, `manual close at current bid ${sb.c}: P/L ${t.money} (expected ${exp})`);
      }
      assert(beChecked || sb.trades.length > 1, 'break-even path exercised (or trade closed before profit)');

      // ---------- ordin limit (GBPUSD H4) ----------
      await start(page, { sym: 'GBPUSD', tf: 'H4', date: '2021-06-01', ccy: 'USD' });
      const dC = await series('GBPUSD', 'H1', [2021]);   // execuția se face pe barele H1, oricare ar fi intervalul afișat
      st = await state(page); const iC = dC.t.indexOf(st.t);
      await click(page, 'input[name="sim-kind"][value="limit"]');
      const lim = r6(st.c - 0.0030);
      await setField(page, '#sim-price', lim.toFixed(5)); await setField(page, '#sim-sl', '30'); await setField(page, '#sim-tp', '60');
      await click(page, '#sim-place');
      st = await state(page);
      assert(st.pending && st.pending.kind === 'limit' && st.pending.price === lim && await page.$eval('#sim-pos-title', e => e.textContent) === 'Ordin în așteptare', 'C: buy limit placed (pending panel)');
      let kFill = -1; for (let k = iC + 1; k < dC.t.length; k++) if (dC.l[k] + 1.5e-4 <= lim + 1e-12) { kFill = k; break; }
      for (let k = 0; k < 400; k++) { const s = await state(page); if (s.pos || s.trades.length) break; await click(page, '#sim-next'); }
      st = await state(page);
      const fillExp = Math.min(lim, r6(dC.o[kFill] + 1.5e-4));
      const filled = st.pos || st.trades[0];
      assert(filled && (st.pos ? st.pos.openTime : st.trades[0].entryT) === dC.t[kFill] && Math.abs((st.pos ? st.pos.entry : st.trades[0].entry) - fillExp) < 1e-9, `C: limit filled on the first bar whose ask low reaches ${lim} (${new Date(dC.t[kFill] * 1000).toISOString()})`);
      await click(page, 'input[name="sim-kind"][value="market"]').catch(() => {});

      // ---------- oprire înainte de perioada incompletă ----------
      await start(page, { sym: 'EURUSD', tf: 'H1', date: '2022-12-20' });
      for (let k = 0; k < 20 && !(await state(page)).ended; k++) { await page.evaluate(() => window.__sim.step(3000)); await sleep(250); }
      st = await state(page);
      const msgStop = await page.$eval('#sim-sum-reason', e => e.textContent);
      await page.evaluate(() => document.getElementById('sim-summary').close());
      assert(st.ended && st.t < Date.UTC(2023, 1, 1) / 1000 && /ore lipsă/.test(msgStop) && (await state(page)).years[1] === 2023, `stop before incomplete window (last bar ${new Date(st.t * 1000).toISOString()}), next-year file lazy-loaded`);
    }

    // ---------- sesiune aleatorie: dată ascunsă, tranzacții, statistici, CSV, jurnal ----------
    await start(page, { sym: label === 'desktop' ? 'XAUUSD' : 'XAUUSD', tf: 'D1', date: label === 'desktop' ? null : '2021-03-01', ccy: 'USD', risk: '0.5' });
    let st = await state(page);
    if (label === 'desktop') {
      const hid = await page.evaluate(() => ({ when: document.getElementById('sim-when').textContent, fmt: window.__sim.chart.options().localization.timeFormatter(1600000000), vline: window.__sim.chart.options().crosshair.vertLine.labelVisible }));
      assert(st.hidden && hid.when === 'Data e ascunsă' && hid.fmt === '' && hid.vline === false, 'random period: date hidden (status, time axis, crosshair label)');
    }
    // caz cunoscut B (mobil): XAUUSD D1, Sell în preț
    const yB = new Date(st.t * 1000).getUTCFullYear();
    const dB = await series('XAUUSD', 'H1', [yB - 1, yB, yB + 1].filter(y => SIM_YEARS.includes(y)));   // execuție pe H1 (toți anii disponibili, inclusiv cel curent)
    const iB = dB.t.indexOf(st.t);
    await click(page, 'input[name="sim-side"][value="sell"]');
    await click(page, 'input[name="sim-unit"][value="price"]');
    const slB = r6(st.c + 30), tpB = r6(st.c - 60);
    await setField(page, '#sim-sl', slB.toFixed(2).replace('.', ',')); await setField(page, '#sim-tp', tpB.toFixed(2));
    await click(page, '#sim-place');
    let sB = await state(page);
    const pvB = 10, lotB = Math.floor(50 / (300 * pvB) * 100 + 1e-9) / 100;
    assert(sB.pos && sB.pos.side === 'sell' && sB.pos.entry === st.c && sB.pos.sl === slB && sB.pos.lot === lotB, `${label} B: Sell XAUUSD at bid ${st.c}, SL ${slB} (comma input), lot ${lotB}`);
    if (label === 'mobile') {
      // tragere cu degetul: SL în sus (mai departe de intrare)
      await page.$eval('#sim-chart', e => e.scrollIntoView({ block: 'center' })); await sleep(1200);
      const g = await page.evaluate(() => ({ x: document.getElementById('sim-chart').getBoundingClientRect().left + 120, top: document.getElementById('sim-chart').getBoundingClientRect().top, sl: window.__sim.series.priceToCoordinate(window.__sim.S.pos.sl), y0: scrollY }));
      await page.touchscreen.touchStart(g.x, g.top + g.sl);
      for (let k = 1; k <= 5; k++) await page.touchscreen.touchMove(g.x, g.top + g.sl - k * 4);
      await page.touchscreen.touchEnd(); await sleep(200);
      const sT = await state(page);
      assert(sT.pos.sl > slB && await page.evaluate(y => Math.abs(scrollY - y) < 2, g.y0), `mobile touch drag: SL line moved up (${slB} → ${sT.pos.sl}), page did not scroll`);
      // readuce SL la valoarea testată (pentru calculul independent)
      await page.$eval('#sim-p-sl', (e, v) => { e.value = v; }, slB.toFixed(2)); await click(page, '#sim-p-apply');
      sB = await state(page);
      assert(sB.pos.sl === slB, 'mobile: SL set back via input + Aplică');
    }
    for (let k = 0; k < 300 && !(await state(page)).trades.length; k++) await click(page, '#sim-next');
    let sE = await state(page);
    const xB = expectExit(dB, iB, 'sell', st.c, slB, tpB, 'XAUUSD');
    const tB = sE.trades[0];
    const pipsB = Math.round((st.c - xB.price) / 0.1 * 10) / 10;
    assert(tB && tB.reason === xB.reason && tB.exitT === dB.t[xB.k] && tB.pips === pipsB && tB.money === Math.round(pipsB * pvB * lotB * 100) / 100, `${label} B: Sell exit matches independent calc (${xB.reason}, ${pipsB} pips, ${tB && tB.money} USD)`);
    // încă 2 tranzacții rapide (Buy la piață, închise manual) pentru statistici
    await click(page, 'input[name="sim-unit"][value="pips"]');
    for (let n = 0; n < 2; n++) {
      await click(page, 'input[name="sim-side"][value="buy"]');
      await setField(page, '#sim-sl', '300'); await setField(page, '#sim-tp', '600');
      await click(page, '#sim-place'); await click(page, '#sim-next'); await click(page, '#sim-next');
      if ((await state(page)).pos) await click(page, '#sim-close');
    }
    if (label === 'desktop') {
      const rowsHidden = await page.$$eval('#sim-trades tbody tr', r => r.map(x => x.textContent).join(' '));
      assert(/dată ascunsă/.test(rowsHidden) && !/20\d\d/.test(rowsHidden), 'trade list hides dates during a random session');
    }
    await click(page, '#sim-end'); await sleep(500);
    sE = await state(page);
    const fin = await page.evaluate(() => {
      const g = id => document.getElementById(id).textContent;
      return { reveal: g('sim-reveal'), n: g('sim-s-n'), wr: g('sim-s-wr'), tr: g('sim-s-tr'), ar: g('sim-s-ar'), pf: g('sim-s-pf'), dd: g('sim-s-dd'), net: g('sim-s-net'), rows: document.querySelectorAll('#sim-trades tbody tr').length,
        fmt: window.__sim.chart.options().localization.timeFormatter(1600000000), actions: !document.getElementById('sim-end-actions').hidden, hist: document.querySelectorAll('#sim-history-list li').length, order: document.getElementById('sim-order').hidden, next: document.getElementById('sim-next').disabled };
    });
    const T = sE.trades, wins = T.filter(t => t.money > 0), losses = T.filter(t => t.money < 0);
    const gp = wins.reduce((s, t) => s + t.money, 0), gl = -losses.reduce((s, t) => s + t.money, 0), totR = T.reduce((s, t) => s + t.r, 0);
    let bal = 10000, peak = 10000, dd = 0; for (const t of T) { bal = Math.round((bal + t.money) * 100) / 100; peak = Math.max(peak, bal); dd = Math.max(dd, peak - bal); }
    const sgn = x => (x > 0 ? '+' : x < 0 ? '−' : '');
    const expWr = roNum(wins.length / T.length * 100, 1) + '%';
    const expTr = sgn(totR) + roNum(Math.abs(Math.round(totR * 100) / 100), 2) + 'R';
    const expPf = gl > 0 ? roNum(Math.round(gp / gl * 100) / 100, 2) : gp > 0 ? '∞ (fără pierderi)' : '—';
    assert(sE.ended && /^Perioada reală: XAUUSD D1, \d\d\.\d\d\.20\d\d \d\d:\d\d - \d\d\.\d\d\.20\d\d \d\d:\d\d\.$/.test(fin.reveal) && fin.fmt !== '', `${label}: session end reveals real period (${fin.reveal})`);
    assert(fin.n === String(T.length) && T.length === 3 && fin.rows === 3 && fin.wr === expWr && fin.tr === expTr && fin.pf === expPf, `${label}: stats match independent math (n ${fin.n}, win ${fin.wr}, total ${fin.tr}, PF ${fin.pf})`);
    const expDd = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'USD' }).format(dd);
    assert(fin.dd === expDd && fin.actions && fin.hist >= 1 && fin.order && fin.next, `${label}: max drawdown ${fin.dd}, actions shown, saved to history, controls disabled`);
    const eq = await page.evaluate(() => ({ sum: document.getElementById('sim-summary').open, c: document.querySelector('#sim-sum-eq canvas') !== null }));
    assert(eq.sum && eq.c, `${label}: end summary modal open with equity curve`);
    // CSV
    if (label === 'desktop') {
      const dl = '/tmp/simdl'; fs.rmSync(dl, { recursive: true, force: true }); fs.mkdirSync(dl);
      const cdp = await page.createCDPSession(); await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
      await click(page, '#sim-csv'); let f = null;
      for (let k = 0; k < 30 && !f; k++) { await sleep(150); f = fs.readdirSync(dl).find(x => x.endsWith('.csv')); }
      const txt = f ? fs.readFileSync(path.join(dl, f), 'utf8') : '';
      const lines = txt.replace(/^\ufeff/, '').trim().split('\r\n');
      assert(f && /^simulator-XAUUSD-D1-20\d\d-\d\d-\d\d\.csv$/.test(f) && lines.length === 4 && lines[0].startsWith('Nr;Instrument;Interval;Direcție') && lines[1].split(';')[3] === 'Sell' && /^-?\d+,\d\d$/.test(lines[1].split(';')[16]) && lines[0].endsWith(';Setup;Notă;Strategie'), `CSV export: ${f}, header + 3 rows, ';' separator, decimal comma`);
    }
    // jurnal
    await click(page, '#sim-journal');
    const jr = await page.evaluate(() => ({ msg: document.getElementById('sim-stats-msg').textContent, list: JSON.parse(localStorage.getItem('mariusfx-jurnal-v1') || '[]') }));
    const sims = jr.list.filter(t => t.sursa === 'simulator');
    assert(sims.length === 3 && /Am adăugat 3 tranzacții/.test(jr.msg) && sims[0].pereche === 'XAUUSD' && sims[0].directie === 'Sell' && /^\d{4}-\d\d-\d\d$/.test(sims[0].data) && ['TP', 'SL'].includes(sims[0].rezultat) && sims[1].rezultat === 'Manual' || sims[1].rezultat === 'SL' || sims[1].rezultat === 'TP', `${label}: 'Trimite în jurnal' adds 3 trades (source simulator)`);
    await click(page, '#sim-journal');
    assert(/deja în/.test(await page.$eval('#sim-stats-msg', e => e.textContent)), `${label}: sending again does not duplicate`);
    await page.goto(`${BASE}/jurnal.html`, { waitUntil: 'networkidle2' });
    const jp = await page.evaluate(() => ({ badges: document.querySelectorAll('.jt-src-sim').length, total: document.querySelector('[data-stat="total"]').textContent, link: !!document.querySelector('.jt-sim-link a[href="simulator.html"]') }));
    assert(jp.badges === 3 && jp.total === '3' && jp.link, `${label}: jurnal shows the 3 simulator trades with 'Simulator' badge + link to simulator`);

    // ---------- reluarea unei sesiuni salvate ----------
    await start(page, { sym: 'AUDUSD', tf: 'H4' });
    await click(page, '#sim-next10'); await click(page, '#sim-place');
    const before = await state(page); await sleep(400);
    await page.reload({ waitUntil: 'networkidle2' });
    assert(await page.$eval('#sim-resume', b => !b.hidden), `${label}: 'Continuă sesiunea salvată' offered after reload`);
    await click(page, '#sim-resume');
    await page.waitForFunction(() => window.__sim && window.__sim.S && !document.getElementById('sim-session').hidden, { timeout: 20000 });
    const res = await state(page);
    assert(res.t === before.t && res.sym === 'AUDUSD' && res.hidden === true && JSON.stringify(res.pos) === JSON.stringify(before.pos) && (!res.pos || await page.evaluate(() => !!window.__sim.lines.sl)), `${label}: resumed at same bar with open position + lines`);
    await click(page, '#sim-end'); await sleep(300);

    // ---------- fără depășiri ----------
    const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, wide: [...document.querySelectorAll('.sim-page *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && !e.closest('.sim-table-wrap'); }).map(e => e.className || e.tagName).slice(0, 5) }));
    assert(ov.sw <= ov.w && !ov.wide.length, `${label}: no horizontal overflow (${ov.sw}/${ov.w}) ${ov.wide.join(',')}`);
    await page.close();
  }

  // ---------- meniu, legături, SEO ----------
  const page = await newPage({ width: 1121, height: 800 });
  for (const f of ['index', 'simulator', 'patternuri', 'calculator', 'glosar']) {
    await page.goto(`${BASE}/${f}.html`, { waitUntil: 'networkidle2' });
    const n = await page.evaluate(() => { const li = [...document.querySelectorAll('#nav-links > li')]; const ul = document.getElementById('nav-links').getBoundingClientRect(); const br = document.querySelector('.site-header .brand, .site-header a[href="index.html"]').getBoundingClientRect(); return { n: li.length, rows: new Set(li.map(x => Math.round(x.getBoundingClientRect().top))).size, gap: ul.left - br.right, right: innerWidth - ul.right, sim: li[8] && li[8].textContent.trim(), cur: (document.querySelector('#nav-links a[aria-current="page"]') || {}).textContent }; });
    assert(n.n === 12 && n.rows === 1 && n.gap >= 20 && n.right >= 20 && n.sim === 'Simulator', `nav 1121 ${f}: 12 items on one row, Simulator after Calculator (gap ${Math.round(n.gap)}px, right ${Math.round(n.right)}px)`);
    if (f === 'simulator') assert(n.cur === 'Simulator', 'nav: Simulator marked aria-current on its page');
  }
  await page.setViewport({ width: 1120, height: 800 });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
  assert(await page.$eval('.menu-toggle', b => getComputedStyle(b).display !== 'none'), 'nav 1120: hamburger menu');
  await click(page, '.menu-toggle'); await sleep(500);
  assert(await page.evaluate(() => [...document.querySelectorAll('#nav-links a')].some(a => a.getAttribute('href') === 'simulator.html' && a.getBoundingClientRect().height > 0)), 'nav 1120: Simulator visible in the opened mobile menu');
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
  const home = await page.evaluate(() => ({ spot: !!document.querySelector('.home-features a.sim-spot[href="simulator.html"]'), spotText: (document.querySelector('.sim-spot strong') || {}).textContent, gsc: !!document.querySelector('head meta[name="google-site-verification"][content="O7g1XoiifBLTrr8a1nMvz4BTCeQoflJg5ez10yfZFzg"]'), cards: document.querySelectorAll('.features > li').length }));
  assert(home.spot && home.spotText === 'Simulator de backtesting' && home.cards === 10, 'home: featured simulator block above the 10 feature cards');
  assert(home.gsc, 'home: Google verification tag still in <head>');
  const lec = fs.readFileSync('/workspace/forex-ms/lectie.html', 'utf8');
  assert(/<section class="lc-chapter" id="cap-8"[\s\S]*?href="simulator\.html"[\s\S]*?<\/section>/.test(lec.slice(lec.indexOf('id="cap-8"') - 40, lec.indexOf('id="cap-8"') + 6000)), 'lectie: chapter 8 links to the simulator');
  for (const f of fs.readdirSync('/workspace/forex-ms').filter(x => x.endsWith('.html') && x !== '404.html')) {
    const s = fs.readFileSync('/workspace/forex-ms/' + f, 'utf8');
    const foot = (s.match(/<nav class="footer-col" aria-label="Instrumente">[\s\S]*?<\/nav>/) || [''])[0];
    if (!/href="simulator\.html">Simulator</.test(foot)) assert(false, `footer Instrumente → Simulator on ${f}`);
  }
  assert(true, 'footer Instrumente links to the simulator on every page');
  const sm = fs.readFileSync('/workspace/forex-ms/sitemap.xml', 'utf8');
  assert(sm.includes('<loc>https://mariusfx1.github.io/marius-fx/simulator.html</loc>'), 'sitemap lists simulator.html');
  await page.goto(`${BASE}/simulator.html`, { waitUntil: 'networkidle2' });
  const seo = await page.evaluate(() => ({ t: document.title, d: document.querySelector('meta[name="description"]').content, can: document.querySelector('link[rel="canonical"]').href, og: document.querySelector('meta[property="og:title"]').content, ld: JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent) }));
  const types = seo.ld['@graph'].map(x => x['@type']);
  assert(seo.t === 'Simulator de backtesting Forex gratuit | Marius FX' && seo.d.length <= 160 && seo.can === 'https://mariusfx1.github.io/marius-fx/simulator.html' && seo.og === seo.t, 'simulator SEO: title, description, canonical, OG');
  assert(types.includes('WebPage') && types.includes('WebApplication') && types.includes('BreadcrumbList'), `simulator JSON-LD: ${types.join(', ')}`);
  // fără JavaScript
  const p2 = await newPage({ width: 1280, height: 900 }); await p2.setJavaScriptEnabled(false);
  await p2.goto(`${BASE}/simulator.html`, { waitUntil: 'load' });
  assert(await p2.evaluate(() => getComputedStyle(document.querySelector('.sim-nojs')).display !== 'none' && getComputedStyle(document.getElementById('sim-setup')).display === 'none' && !!document.querySelector('.sim-notes')), 'no-JS: noscript message, setup hidden, notes still readable');
  await p2.close();
  // texte noi: fără em/en dash, diacritice corecte
  for (const f of ['simulator.html', 'sim.js', 'sim-engine.js']) {
    let s = fs.readFileSync('/workspace/forex-ms/' + f, 'utf8');
    if (f === 'simulator.html') s = s.slice(s.indexOf('<main'), s.indexOf('</main>'));
    s = s.replace(/'—'/g, '').replace(/>—</g, '><');
    assert(!/[–—]/.test(s) && !/[şţŞŢ]/.test(s), `${f}: no em/en dashes in new text, comma-below diacritics`);
  }
  assert(errors.length === 0, 'no console/page errors, no failed requests' + (errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''));
  await browser.close();
  console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED', ok, 'ok');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
