// test-icons.js: toate paginile (4 limbi) desktop 1280 + mobil 390 fără erori, iconuri 200, manifest valid, logo-mark încărcat; screenshot header
const puppeteer = require('puppeteer-core'); const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8766/marius-fx/';
const ROOT = '/workspace/forex-ms', OUT = ROOT + '/screenshots';
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && f !== '404.html');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); let errs = [], fails = 0, n = 0;
  p.on('pageerror', e => errs.push('pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  p.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) errs.push(r.status() + ' ' + r.url()); });
  for (const [vw, mob] of [[1280, false], [390, true]]) {
    await p.setViewport({ width: vw, height: 900, isMobile: mob, hasTouch: mob, deviceScaleFactor: 2 });
    for (const lang of ['', 'en/', 'es/', 'pt/']) for (const f of pages) {
      errs = []; n++;
      await p.goto(BASE + lang + f, { waitUntil: 'networkidle2', timeout: 60000 });
      const r = await p.evaluate(async () => {
        const imgs = [...document.querySelectorAll('.logo-mark img')];
        const links = [...document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"],link[rel="manifest"]')].map(l => l.href);
        const st = await Promise.all(links.map(u => fetch(u).then(x => x.status)));
        const box = imgs[0] && imgs[0].getBoundingClientRect();
        return { n: imgs.length, ok: imgs.every(i => i.complete && i.naturalWidth > 0), links: links.length, bad: links.filter((u, i) => st[i] !== 200), w: box && box.width, v: !!document.querySelector('meta[name="google-site-verification"]') };
      });
      const real = errs.filter(e => !/tradingview|googletagmanager|google-analytics|ERR_|Failed to load resource/i.test(e) || / 4\d\d /.test(e));
      if (!r.n || !r.ok || r.links < 7 || r.bad.length || real.length) { fails++; console.log('FAIL', vw, lang + f, JSON.stringify(r), real); }
      if (f === 'index.html') {
        if (lang === '' && !r.v) { fails++; console.log('FAIL verification meta missing'); }
        await p.screenshot({ path: `${OUT}/header-icon-${(lang || 'ro/').slice(0, 2)}-${mob ? 'mobile390' : 'desktop1280'}.png`, clip: { x: 0, y: 0, width: vw, height: 90 } });
      }
    }
  }
  const m = JSON.parse(await (await fetch(BASE + 'site.webmanifest')).text());
  for (const ic of m.icons) {
    const res = await fetch(new URL(ic.src, BASE)); const buf = Buffer.from(await res.arrayBuffer());
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    if (res.status !== 200 || `${w}x${h}` !== ic.sizes) { fails++; console.log('FAIL manifest icon', ic.src, res.status, w, h); }
  }
  console.log(`manifest: ${m.name}, ${m.icons.length} icons; pages checked: ${n}; failures: ${fails}`);
  await b.close(); process.exit(fails ? 1 : 0);
})();
