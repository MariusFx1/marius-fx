const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8765';
const OUT = '/workspace/forex-ms/screenshots';
const SPOTS = [['index.html', '.stat-item:last-child', 'home-stat', '.stats, .stat-list, ul'], ['index.html', '.section-sub', 'home-tagline', null], ['intrebari.html', '#semnale', 'faq-semnale', null], ['contact.html', '.fineprint', 'contact', '.contact-info']];
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); const res = {};
  for (const [w, h, n] of [[1280, 900, 'desktop'], [390, 844, 'mobile']]) {
    await p.setViewport({ width: w, height: h });
    for (const [pg, sel, name, par] of SPOTS) {
      await p.goto(`${BASE}/${pg}`, { waitUntil: 'networkidle2' });
      if (pg === 'intrebari.html') await p.evaluate(() => { document.querySelector('#semnale').open = true; });
      await p.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-visible', 'in', 'visible')));
      await p.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), sel);
      await new Promise(r => setTimeout(r, 1500));
      const el = await p.evaluateHandle((s, par) => { const e = document.querySelector(s); return (par && e.closest(par)) || e; }, sel, par);
      const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      res[`${name}@${w}`] = { overflow: ov };
      await el.screenshot({ path: `${OUT}/signals-copy-${name}-${n}.png` });
    }
  }
  console.log(JSON.stringify(res)); await b.close();
})();
