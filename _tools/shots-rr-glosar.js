// Capturi: calculator risk/reward (mobil + desktop, cu rezultat și cu eroare), glosar (mobil cu căutare, desktop), home
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8765';
const OUT = '/workspace/forex-ms/screenshots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DESK = { width: 1280, height: 900 };
const MOB = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const typeIn = async (p, id, v) => { await p.$eval('#' + id, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v); };
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  for (const [n, vp] of [['mobile', MOB], ['desktop', DESK]]) {
    await p.setViewport(vp);
    await p.goto(`${BASE}/calculator.html#risc-recompensa`, { waitUntil: 'networkidle2' });
    await p.select('#rr-pereche', 'EURJPY'); await p.select('#rr-moneda', 'GBP');
    await typeIn(p, 'rr-intrare', '177,00'); await typeIn(p, 'rr-sl', '176,40'); await typeIn(p, 'rr-tp', '178,50'); await typeIn(p, 'rr-sold', '8000'); await typeIn(p, 'rr-risc', '1,5');
    await sleep(200);
    await p.evaluate(() => { document.querySelector('.calc-tabs').scrollIntoView({ block: 'start', behavior: 'instant' }); scrollBy(0, -80); });
    await sleep(300);
    await p.screenshot({ path: OUT + `rr-calculator-${n}.png` });
    if (n === 'mobile') {
      await p.$eval('.rr-out', e => e.scrollIntoView({ block: 'start', behavior: 'instant' })); await p.evaluate(() => scrollBy(0, -90)); await sleep(200);
      await p.screenshot({ path: OUT + 'rr-calculator-mobile-result.png' });
      await p.click('input[name="rr-dir"][value="sell"]'); await typeIn(p, 'rr-tp', '179'); await sleep(200);
      await p.$eval('#rr-error', e => e.scrollIntoView({ block: 'center', behavior: 'instant' })); await sleep(200);
      await p.screenshot({ path: OUT + 'rr-calculator-mobile-error.png' });
    }
    await p.goto(`${BASE}/glosar.html`, { waitUntil: 'networkidle2' }); await sleep(200);
    await p.screenshot({ path: OUT + `glosar-${n}.png` });
    await p.type('#gl-q', 'marja'); await sleep(300);
    await p.screenshot({ path: OUT + `glosar-${n}-search.png` });
  }
  await p.setViewport(DESK);
  await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
  await p.evaluate(async () => { for (let y = 0; y <= document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } });
  await sleep(1400);
  await (await p.$('.home-features')).screenshot({ path: OUT + 'home-features-desktop.png' });
  await b.close();
})();
