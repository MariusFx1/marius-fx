// Usage: TAG=before|after BASE=http://localhost:8765 node shots-premium.js
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8765';
const TAG = process.env.TAG || 'after';
const OUT = process.env.SHOTS || '/workspace/forex-ms/screenshots';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  const shots = [];
  async function snap(name, opts = {}) { const f = `${OUT}/premium-${TAG}-${name}.png`; await p.screenshot({ path: f, ...opts }); shots.push(f); }
  async function revealAll() { // scroll through so IntersectionObserver reveals fire, then back to top
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 60)); } window.scrollTo({ top: 0, behavior: 'instant' }); });
    await sleep(900);
  }
  for (const [vp, label] of [[{ width: 1280, height: 800 }, 'desktop'], [{ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'mobile']]) {
    await p.setViewport(vp);
    for (const page of ['index', 'calculator', 'reguli']) {
      await p.goto(`${BASE}/${page}.html`, { waitUntil: 'networkidle2' });
      await sleep(page === 'index' ? 4000 : 800);
      await revealAll();
      await snap(`${page === 'index' ? 'home' : page}-${label}`);
      await snap(`${page === 'index' ? 'home' : page}-${label}-full`, { fullPage: true });
    }
    if (label === 'mobile') {
      await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' }); await sleep(2500);
      await p.click('.menu-toggle'); await sleep(600);
      await snap('menu-mobile-open');
    }
  }
  console.log(shots.join('\n'));
  await b.close();
})();
