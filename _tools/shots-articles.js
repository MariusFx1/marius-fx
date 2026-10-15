// Capturi pentru secțiunea Articole: desktop 1280 + mobil 390 (RO), plus EN mobil; pagini înalte împărțite în felii.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8765';
const OUT = '/workspace/forex-ms/screenshots';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const JOBS = [
  { lang: '', page: 'articole', vp: [1280, 900], tag: 'ro-desktop', slice: 1500 },
  { lang: '', page: 'articole', vp: [390, 844], tag: 'ro-mobile', slice: 1700 },
  { lang: '', page: 'marime-lot-forex', vp: [1280, 900], tag: 'ro-desktop', slice: 1500 },
  { lang: '', page: 'marime-lot-forex', vp: [390, 844], tag: 'ro-mobile', slice: 1700 },
  { lang: 'en/', page: 'articole', vp: [390, 844], tag: 'en-mobile', slice: 1700 },
  { lang: 'en/', page: 'marime-lot-forex', vp: [390, 844], tag: 'en-mobile', slice: 1700 },
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const j of JOBS) {
    const pg = await b.newPage();
    await pg.setViewport({ width: j.vp[0], height: j.vp[1], deviceScaleFactor: j.vp[0] < 500 ? 2 : 1 });
    await pg.goto(`${BASE}/${j.lang}${j.page}.html`, { waitUntil: 'networkidle0' });
    await pg.evaluate(async () => { for (let y = 0; y <= document.body.scrollHeight; y += 300) { scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 60)); } scrollTo({ top: 0, behavior: 'instant' }); });
    await sleep(1200);
    const h = await pg.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
    const sw = await pg.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    const n = Math.ceil(h / j.slice);
    const name = j.page === 'articole' ? 'index' : j.page;
    for (let i = 0; i < n; i++) {
      const f = `${OUT}/articles-${name}-${j.tag}-${i + 1}of${n}.png`;
      await pg.screenshot({ path: f, clip: { x: 0, y: i * j.slice, width: j.vp[0], height: Math.min(j.slice, h - i * j.slice) }, captureBeyondViewport: true });
      console.log(f);
    }
    console.log(j.lang + j.page, j.tag, 'height', h, 'scrollW/innerW', sw.join('/'));
    await pg.close();
  }
  await b.close();
})();
