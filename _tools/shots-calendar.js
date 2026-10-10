// Capturi calendar.html (calendar propriu): mobil (hero + listă) și desktop. BASE / OUT din env.
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8765';
const OUT = process.env.OUT || '/workspace/forex-ms/screenshots';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  for (const [vp, name] of [
    [{ width: 390, height: 1900, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'calendar-live-mobile-hero-list.png'],
    [{ width: 1280, height: 1250 }, 'calendar-live-desktop.png'],
  ]) {
    const p = await b.newPage(); await p.setViewport(vp);
    await p.goto(`${BASE}/calendar.html`, { waitUntil: 'networkidle0' }); await sleep(800);
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 40)); } });
    await sleep(1400);
    await p.evaluate(() => { const r = document.getElementById('cal-app').getBoundingClientRect(); scrollTo({ top: scrollY + r.top - 84, behavior: 'instant' }); });
    await sleep(900);
    await p.screenshot({ path: `${OUT}/${name}`, captureBeyondViewport: false });
    await p.close();
  }
  await b.close(); console.log('done');
})();
