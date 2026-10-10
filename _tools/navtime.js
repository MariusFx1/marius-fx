// navtime.js [base]: timp de navigare pagină->pagină (click în nav), mobil throttled, rece și cald.
// Măsoară: click -> FCP al paginii noi și click -> tot conținutul din viewport complet vizibil (opacity 1).
const puppeteer = require('puppeteer-core');
const BASE = process.argv[2] || 'https://mariusfx1.github.io/marius-fx';
const ROUTE = ['index.html', 'lectie.html', 'calculator.html', 'simulator.html', 'calendar.html', 'index.html'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function run(b, label) {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cdp = await p.createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const rows = [];
  for (let pass = 0; pass < 2; pass++) {           // 0 = rece, 1 = cald (același context, cache plin)
    await p.goto(`${BASE}/${ROUTE[0]}`, { waitUntil: 'load' }); await sleep(1500);
    for (let i = 1; i < ROUTE.length; i++) {
      const to = ROUTE[i];
      await p.evaluate(to => { window.__t0 = Date.now(); sessionStorage.setItem('t0', String(Date.now())); }, to);
      // hover/touch apoi click pe link (ca un utilizator real); fallback la location
      const t0 = Date.now();
      await p.evaluate(to => { const a = [...document.querySelectorAll('a[href]')].find(a => a.getAttribute('href').replace(/^\.\//, '') === (to === 'index.html' ? './' : to) || a.getAttribute('href') === to);
        if (a) { a.dispatchEvent(new Event('touchstart', { bubbles: true })); a.click(); } else location.href = to; }, to);
      const want = to === 'index.html' ? '/' : '/' + to;
      for (let k = 0; k < 200; k++) { try { if (await p.evaluate(w => (location.pathname.endsWith(w) || (w === '/' && location.pathname.endsWith('/index.html'))) && document.readyState !== 'loading', want)) break; } catch (_) {} await sleep(50); }
      const r = await p.evaluate(async () => {
        const fcp = () => (performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint') || {}).startTime;
        const inView = el => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 && r.width > 0; };
        const vis = () => !document.getAnimations().some(an => { const t = an.effect && an.effect.target; const tm = an.effect && an.effect.getComputedTiming();
            return t && tm && isFinite(tm.endTime) && an.playState !== 'finished' && inView(t); })
          && ![...document.querySelectorAll('.reveal:not(.is-revealed)')].some(inView);
        const start = performance.now();
        while (!vis() && performance.now() - start < 6000) await new Promise(r => requestAnimationFrame(r));
        const nt = performance.getEntriesByType('navigation')[0];
        return { fcp: fcp(), visible: performance.now(), ttfb: nt.responseStart, prefetched: nt.deliveryType || (nt.transferSize === 0 ? 'cache' : 'net') };
      });
      const clickToNavStart = 0;
      rows.push({ pass: pass ? 'warm' : 'cold', to, ttfb: Math.round(r.ttfb), fcp: Math.round(r.fcp), visible: Math.round(r.visible), via: r.prefetched });
      await sleep(1200);
    }
  }
  await ctx.close();
  return rows;
}
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const rows = await run(b);
  for (const r of rows) console.log(r.pass.padEnd(5), r.to.padEnd(16), 'TTFB', String(r.ttfb).padStart(5), 'FCP', String(r.fcp).padStart(5), 'visible', String(r.visible).padStart(5), r.via);
  for (const pass of ['cold', 'warm']) { const x = rows.filter(r => r.pass === pass); const avg = k => Math.round(x.reduce((s, r) => s + r[k], 0) / x.length); console.log(`AVG ${pass}: FCP ${avg('fcp')} ms, fully visible ${avg('visible')} ms`); }
  await b.close();
})();
