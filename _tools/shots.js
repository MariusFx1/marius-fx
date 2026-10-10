// Capturi de ecran pentru raport: BASE=... OUT=... node shots.js
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8765', OUT = process.env.OUT || '/workspace/shots';
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  async function open(vp) {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept());
    await page.setViewport(vp);
    await page.goto(`${BASE}/simulator.html?shot=${Date.now()}`, { waitUntil: 'networkidle2' });
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('mariusfx-sim-ajutor-v1', '1'); });
    await page.goto(`${BASE}/simulator.html?shot=${Date.now()}`, { waitUntil: 'networkidle2' });
    return page;
  }
  async function start(page, date, strat, x) {
    x = x || {};
    await page.evaluate((date, strat, x) => {
      const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
      document.querySelector('input[name="sim-mode"][value="date"]').click(); document.getElementById('sim-date').value = date;
      if (strat) { set('sim-st-name', strat.name); set('sim-st-setups', strat.setups); set('sim-st-rules', strat.rules); set('sim-st-check', strat.check); }
      if (x.risk) set('sim-risk', x.risk);
      document.getElementById('sim-ch-on').checked = !!x.ch;
      if (x.ch) { set('sim-ch-target', x.ch[0]); set('sim-ch-daily', x.ch[1]); set('sim-ch-total', x.ch[2]); }
      document.getElementById('sim-start').scrollIntoView({ block: 'center', behavior: 'instant' });
    }, date, strat, x);
    await page.click('#sim-start');
    await page.waitForFunction(() => window.__sim.S && !document.getElementById('sim-session').hidden, { timeout: 30000 });
    await sleep(400);
  }
  const place = (page, side, tag, note) => page.evaluate((side, tag, note) => {
    window.__sim.selectTab('order');
    document.querySelector(`input[name="sim-side"][value="${side}"]`).click();
    document.getElementById('sim-setup-tag').value = tag || ''; document.getElementById('sim-note').value = note || '';
    document.getElementById('sim-place').click();
  }, side, tag, note);
  async function drag(page, a, b, touch) {
    const r = await page.evaluate(() => { const e = document.querySelector('.sim-chart').getBoundingClientRect(); return { x: e.left, y: e.top, w: e.width, h: e.height }; });
    const P = p => [r.x + p[0] * r.w, r.y + p[1] * r.h];
    const [x1, y1] = P(a), [x2, y2] = P(b);
    if (touch) {
      const c = await page.target().createCDPSession();
      const t = (type, x, y) => c.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await t('touchStart', x1, y1); for (let k = 1; k <= 6; k++) await t('touchMove', x1 + (x2 - x1) * k / 6, y1 + (y2 - y1) * k / 6); await t('touchEnd'); await sleep(150);
      return;
    }
    await page.mouse.move(x1, y1); await page.mouse.down(); for (let k = 1; k <= 8; k++) await page.mouse.move(x1 + (x2 - x1) * k / 8, y1 + (y2 - y1) * k / 8); await page.mouse.up(); await sleep(150);
  }
  async function indicators(page, list, btn) {
    await page.click(btn); await sleep(200);
    for (const t of list) { await page.click(`[data-add="${t}"]`); await sleep(80); }
    await page.click('#sim-ind-close'); await sleep(300);
  }
  const STRAT = { name: 'Pullback EMA', setups: 'Pullback, Breakout', rules: 'Doar în direcția EMA 50 de pe H4. SL sub ultimul swing, TP 1:2.', check: 'Trend clar pe H4\nRetragere la EMA\nR:R minim 1:2' };

  // 1. desktop 1280: desene + indicatori + 2 poziții
  let page = await open({ width: 1280, height: 800 });
  await start(page, '2024-03-05', STRAT);
  await page.evaluate(() => window.__sim.step(12));
  await indicators(page, ['ema', 'bb', 'rsi'], '#sim-ind-open');
  await page.click('.ws-dt[data-tool="trend"]'); await drag(page, [0.18, 0.62], [0.55, 0.38]);
  await page.click('.ws-dt[data-tool="fib"]'); await drag(page, [0.35, 0.22], [0.62, 0.55]);
  await page.click('.ws-dt[data-tool="hline"]'); await drag(page, [0.4, 0.3], [0.4, 0.3]);
  await page.click('.ws-dt[data-tool="cursor"]');
  await place(page, 'buy', 'Pullback', 'Retragere la EMA');
  await page.evaluate(() => window.__sim.step(3));
  await place(page, 'sell', 'Breakout', 'Respingere la rezistență');
  await page.evaluate(() => { window.__sim.step(2); window.__sim.selectTab('order'); });
  await page.mouse.move(5, 5); await sleep(500);
  await page.screenshot({ path: `${OUT}/desktop-1280-drawings-indicators-2-positions.png` });
  // 2. statistici detaliate: câteva tranzacții, apoi fila Statistici
  await page.evaluate(() => window.__sim.closeAll());
  for (const [s, tg] of [['buy', 'Pullback'], ['sell', 'Breakout'], ['buy', 'Pullback'], ['sell', 'Pullback'], ['buy', 'Breakout'], ['buy', 'Pullback']]) {
    await place(page, s, tg); await page.evaluate(() => { for (let k = 0; k < 40 && window.__sim.S.positions.length; k++) window.__sim.step(1); if (window.__sim.S.positions.length) window.__sim.closeAll(); });
  }
  await page.evaluate(() => { window.__sim.selectTab('stats'); });
  await sleep(500);
  await page.screenshot({ path: `${OUT}/detailed-stats-session-1.png` });
  await page.evaluate(() => { document.getElementById('sim-detail').scrollIntoView({ block: 'start', behavior: 'instant' }); }); await sleep(300);
  await page.screenshot({ path: `${OUT}/detailed-stats-session-2.png` });
  await page.evaluate(() => window.__sim.endSession()); await sleep(600);
  await page.screenshot({ path: `${OUT}/session-summary.png` });
  const leave = async () => { await page.evaluate(() => { const d = document.getElementById('sim-summary'); if (d.open) document.getElementById('sim-sum-close').click(); }); await page.click('#sim-back'); await page.waitForFunction(() => document.getElementById('sim-session').hidden); await sleep(300); };
  // tranzacționare simplă, doar cu ce e pe grafic: direcția ultimelor 5 bare (fără să vadă viitorul)
  const trade = (n, tags) => page.evaluate(async (n, tags) => {
    const sim = window.__sim;
    for (let k = 0; k < n && !sim.S.ended; k++) {
      const S = sim.S, side = S.d.c[S.cur] >= S.d.c[S.cur - 5] ? 'buy' : 'sell';
      sim.selectTab('order');
      document.querySelector(`input[name="sim-side"][value="${side}"]`).click();
      document.getElementById('sim-setup-tag').value = tags[k % tags.length];
      document.getElementById('sim-place').click();
      for (let j = 0; j < 60 && S.positions.length && !S.ended; j++) sim.step(1);
      if (!S.ended) { if (S.positions.length) sim.closeAll(); sim.step(3); }
    }
  }, n, tags);
  await leave();
  const BRK = { name: 'Breakout range', setups: 'Breakout, Retest', rules: 'Intru la închiderea în afara range-ului asiatic. SL în mijlocul range-ului.', check: 'Range clar\nVolatilitate normală' };
  await start(page, '2024-08-06', BRK); await trade(9, ['Breakout', 'Retest', 'Breakout']); await page.evaluate(() => window.__sim.endSession()); await sleep(300); await leave();
  await start(page, '2023-10-03', STRAT); await trade(7, ['Pullback']); await page.evaluate(() => window.__sim.endSession()); await sleep(300); await leave();
  // provocare: risc 2%, țintă 4%, până trece sau pică (sau max. 60 de tranzacții)
  await start(page, '2024-10-08', BRK, { risk: '2', ch: ['4', '5', '10'] });
  await trade(60, ['Breakout', 'Retest']);
  if (!(await page.evaluate(() => window.__sim.S.ended))) await page.evaluate(() => window.__sim.endSession());
  await sleep(700);
  console.log('challenge:', await page.evaluate(() => JSON.stringify({ st: window.__sim.S.challenge.status, n: window.__sim.S.trades.length })));
  await page.screenshot({ path: `${OUT}/challenge-result.png` });
  await leave();
  await page.evaluate(() => { document.getElementById('sim-h-compare').scrollIntoView({ block: 'start', behavior: 'instant' }); scrollBy(0, -150); }); await sleep(300);
  await page.screenshot({ path: `${OUT}/strategy-comparison.png` });
  await page.evaluate(() => { document.getElementById('sim-h-detail').scrollIntoView({ block: 'start', behavior: 'instant' }); scrollBy(0, -80); }); await sleep(300);
  await page.screenshot({ path: `${OUT}/detailed-stats-history.png` });
  await page.close();

  // 3. mobil portret: instrumente de desen deschise + indicatori
  page = await open({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await start(page, '2024-03-05');
  await page.evaluate(() => window.__sim.step(8));
  await indicators(page, ['ema', 'rsi'], '.ws-ind-btn2');
  await page.click('#sim-draw-toggle'); await sleep(200);
  await page.click('.ws-dt[data-tool="trend"]'); await sleep(100);
  await drag(page, [0.25, 0.6], [0.7, 0.35], true);
  await page.click('#sim-draw-toggle'); await sleep(300);
  await page.screenshot({ path: `${OUT}/mobile-390-tools-open.png` });
  await page.close();
  await browser.close();
  console.log('shots in', OUT, fs.readdirSync(OUT).join(', '), 'errors', errors.length, errors.slice(0, 3).join(' | '));
})();
