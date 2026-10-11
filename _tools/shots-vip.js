const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8765';
const OUT = '/workspace/forex-ms/screenshots';
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const res = {};
  for (const lang of ['', 'en/', 'es/', 'pt/']) for (const [w, h, n] of [[1280, 900, 'desktop'], [390, 844, 'mobile']]) {
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    for (const pg of ['index.html', 'contact.html']) {
      await p.goto(`${BASE}/${lang}${pg}`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 600));
      const r = await p.evaluate(() => {
        const out = [];
        document.querySelectorAll('.vip-discord, .vip-discord *, .vip-discord-disc, .social-vip, .footer-vip').forEach(e => { const b = e.getBoundingClientRect(); if (b.right > innerWidth + 0.5 || b.left < -0.5) out.push(e.className); });
        const v = document.querySelector('.vip-discord');
        return { docOverflow: document.documentElement.scrollWidth > innerWidth, out, h: v && Math.round(v.getBoundingClientRect().height), btn: v && v.querySelector('a').textContent, footer: !!document.querySelector('.footer-vip') };
      });
      res[`${lang || 'ro/'}${pg}@${w}`] = r;
      if (lang === '' && pg === 'index.html') {
        const el = await p.$('.vip-discord');
        await p.evaluate(() => scrollTo(0, 0));
        await new Promise(r => setTimeout(r, 300));
        const box = await p.evaluate(() => { const a = document.querySelector('.hero-social').getBoundingClientRect(), c = document.querySelector('.vip-discord-disc').getBoundingClientRect(); return { y: a.top + scrollY - 24, b: c.bottom + scrollY + 24 }; });
        await p.screenshot({ path: `${OUT}/vip-discord-ro-${n}.png`, clip: { x: 0, y: Math.max(0, box.y), width: w, height: box.b - Math.max(0, box.y) }, captureBeyondViewport: true });
      }
    }
  }
  console.log(JSON.stringify(res, null, 1));
  await b.close();
})();
