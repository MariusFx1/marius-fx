const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8765'; const OUT = '/workspace/forex-ms/screenshots';
const LANG = process.env.L || '';
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  for (const [w, h, n] of [[1280, 900, 'desktop'], [390, 844, 'mobile']]) {
    await p.setViewport({ width: w, height: h });
    await p.goto(`${BASE}/${LANG}despre.html`, { waitUntil: 'networkidle2' });
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 250) { scrollTo(0, y); await new Promise(r => setTimeout(r, 200)); } scrollTo(0, 0); });
    await new Promise(r => setTimeout(r, 800));
    const ov = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, wide: [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.className).slice(0, 5) }));
    console.log(n, JSON.stringify(ov));
    await p.screenshot({ path: `${process.env.PFX || OUT + '/despre-new-'}${LANG ? LANG.replace('/', '') + '-' : ''}${n}.png`, fullPage: true });
  }
  console.log('errors', errs); await b.close();
})();
