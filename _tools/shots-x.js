// shots-x.js: home CTA (Telegram + X) și subsol, RO desktop 1280 + mobil 390; verifică overflow orizontal
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8766/marius-fx/', OUT = '/workspace/forex-ms/screenshots/';
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); let bad = 0;
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  for (const [w, mob, tag] of [[1280, false, 'desktop1280'], [390, true, 'mobile390']]) {
    await p.setViewport({ width: w, height: 900, isMobile: mob, hasTouch: mob, deviceScaleFactor: 2 });
    for (const lang of ['', 'en/', 'es/', 'pt/']) for (const f of ['index.html', 'contact.html']) {
      await p.goto(BASE + lang + f, { waitUntil: 'networkidle2' });
      const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, x: [...document.querySelectorAll('a[href="https://x.com/MSPrime1fx"]')].map(a => { const r = a.getBoundingClientRect(); return [a.target, a.rel, Math.round(r.right), a.textContent.trim()]; }) }));
      const ok = o.sw <= o.iw && o.x.every(([t, r, right]) => t === '_blank' && /noopener/.test(r) && right <= o.iw);
      if (!ok) bad++; console.log(ok ? 'ok' : 'FAIL', tag, lang + f, JSON.stringify(o));
    }
    await p.goto(BASE + 'index.html', { waitUntil: 'networkidle2' });
    await p.evaluate(() => document.querySelectorAll('.lang-suggest').forEach(e => e.remove()));
    const cta = await p.$('.hero-social'); await cta.evaluate(e => e.scrollIntoView({ block: 'center' }));
    const r = await p.evaluate(() => { const a = document.querySelector('.hero-note').getBoundingClientRect(), c = document.querySelector('.hero-chips').getBoundingClientRect(); return { y: a.top - 16, h: c.bottom - a.top + 32 }; });
    await p.screenshot({ path: `${OUT}x-home-cta-ro-${tag}.png`, clip: { x: 0, y: r.y + await p.evaluate(() => scrollY), width: w, height: r.h } });
    await p.evaluate(() => document.querySelector('footer').scrollIntoView()); await new Promise(r => setTimeout(r, 800));
    const ft = await p.$('footer'); await ft.screenshot({ path: `${OUT}x-footer-ro-${tag}.png` });
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
