// Test: lectie.html + nav nou pe toate paginile + Telegram CTA pe home (desktop 1280 / mobil 390)
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8765';
const SHOTS = process.env.SHOTS || '/workspace/forex-ms/screenshots';
const SKIP_SHOTS = !!process.env.SKIP_SHOTS;
const PAGES = ['index', 'lectie', 'reguli', 'patternuri', 'sesiuni', 'calendar', 'jurnal', 'calculator', 'despre', 'broker', 'contact'];
const NAV = ['lectie.html', 'test.html', 'reguli.html', 'patternuri.html', 'sesiuni.html', 'calendar.html', 'jurnal.html', 'calculator.html', 'simulator.html', 'despre.html', 'broker.html', 'contact.html'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const assert = (c, m) => { if (!c) { fails++; console.error('FAIL:', m); } else console.log('ok  -', m); };
const isThirdParty = t => /tradingview|google|gstatic|fonts\.|favicon/i.test(t);

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(page.url() + ' :: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !isThirdParty(m.text() + (m.location()?.url || ''))) errors.push(page.url() + ' :: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !isThirdParty(r.url())) errors.push(r.status() + ' ' + r.url()); });

  const DESK = { width: 1280, height: 900 };
  const MOB = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

  for (const [label, vp] of [['desktop', DESK], ['mobile', MOB]]) {
    await page.setViewport(vp);
    for (const f of PAGES) {
      await page.goto(`${BASE}/${f}.html`, { waitUntil: 'networkidle2' });
      const info = await page.evaluate(() => ({
        nav: [...document.querySelectorAll('#nav-links a')].map(a => a.getAttribute('href')),
        first: document.querySelector('#nav-links a')?.textContent.trim(),
        css: document.querySelector('link[href*="styles.css"]')?.getAttribute('href'),
        risk: document.querySelector('.footer-risk')?.textContent.trim(),
        sw: document.documentElement.scrollWidth, iw: window.innerWidth,
        current: document.querySelector('#nav-links a[aria-current="page"]')?.getAttribute('href') || null
      }));
      assert(JSON.stringify(info.nav) === JSON.stringify(NAV), `${label} ${f}: nav = Începători + existing links + Calendar after Sesiuni`);
      assert(info.first === 'Începători', `${label} ${f}: first nav label "Începători"`);
      { const v = 52; assert(info.css === `styles.css?v=${v}`, `${label} ${f}: styles.css?v=${v}`); }
      assert(info.risk === 'Forex și CFD-urile cu levier pot duce la pierderea rapidă a banilor. Conținut educațional, nu consultanță financiară.', `${label} ${f}: footer risk line`);
      assert(info.sw <= info.iw, `${label} ${f}: no horizontal overflow (${info.sw} <= ${info.iw})`);
      if (f !== 'index') assert(info.current === f + '.html', `${label} ${f}: aria-current on own link`);
    }

    // nav click-through (mobile: through the hamburger menu)
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
    for (const target of NAV) {
      // simulator.html deschide ajutorul (dialog modal) la prima vizită: îl închidem ca un vizitator
      if (await page.$('#sim-help[open]')) { await page.keyboard.press('Escape'); await sleep(200); }
      if (label === 'mobile') {
        const toggle = await page.$('.menu-toggle');
        assert(await toggle.isIntersectingViewport(), `mobile: menu toggle visible (${page.url().split('/').pop()})`);
        await toggle.click(); await sleep(150);
        const open = await page.$eval('#nav-links', el => el.classList.contains('open') && getComputedStyle(el).display !== 'none');
        assert(open, 'mobile: menu opens');
      }
      // click + așteptăm pagina-țintă încărcată complet. Nu folosim waitForNavigation: navigările servite din
      // prefetch (Speculation Rules) nu emit evenimentele de ciclu de viață pe care le urmărește Puppeteer.
      await page.click(`#nav-links a[href="${target}"]`);
      for (let k = 0; k < 150; k++) {
        try { if (await page.evaluate(t => location.pathname.endsWith('/' + t) && document.readyState === 'complete', target)) break; } catch (_) {}
        await sleep(100);
      }
      await sleep(300);
      assert(page.url().endsWith('/' + target), `${label}: nav click -> ${target}`);
    }

    // lectie specifics
    await page.goto(`${BASE}/lectie.html`, { waitUntil: 'networkidle0' });
    // old v1 progress (9-chapter layout) and junk values must not break the page
    await page.evaluate(() => { localStorage.setItem('mariusfx-lectie-v1', '[1,2,3,9]'); localStorage.setItem('mariusfx-lectie-v2', '[1,9,0,"x",3.5]'); });
    await page.reload({ waitUntil: 'networkidle0' });
    const old = await page.evaluate(() => ({ v1: localStorage.getItem('mariusfx-lectie-v1'), c: document.getElementById('lc-done-count').textContent, total: document.getElementById('lc-total').textContent, max: document.getElementById('lc-progress-bar').getAttribute('aria-valuemax'), start: document.getElementById('lc-start').textContent }));
    assert(old.v1 === null, `${label} lectie: old v1 progress key removed`);
    assert(old.c === '1' && old.start === 'Continuă cu capitolul 2', `${label} lectie: out-of-range/junk saved values ignored ${JSON.stringify(old)}`);
    assert(old.total === '8' && old.max === '8', `${label} lectie: total + aria-valuemax = 8`);
    await page.evaluate(() => localStorage.removeItem('mariusfx-lectie-v2'));
    await page.reload({ waitUntil: 'networkidle0' });
    const lc = await page.evaluate(() => {
      const figs = [...document.querySelectorAll('.lc-fig svg')].map(s => { const r = s.getBoundingClientRect(); return { w: r.width, h: r.height, kids: s.querySelectorAll('rect,path,line,polyline,text,circle').length, title: !!s.querySelector('title') }; });
      return {
        chapters: [...document.querySelectorAll('.lc-chapter')].map(s => s.id),
        retine: document.querySelectorAll('.lc-chapter .lc-retine').length,
        glossToc: !!document.querySelector('.lc-toc .lc-toc-gloss a[href="glosar.html"]'),
        toc: [...document.querySelectorAll('.lc-toc a:not([href="glosar.html"])')].map(a => a.getAttribute('href')),
        figs, ids: [...document.querySelectorAll('[id]')].map(e => e.id),
        btnVisible: [...document.querySelectorAll('.lc-done-btn')].filter(b => !b.hidden).length,
        links: [...document.querySelectorAll('.lc-article a[href$=".html"]')].map(a => a.getAttribute('href')),
        maxRight: Math.max(...[...document.querySelectorAll('.lc-article *')].map(e => e.getBoundingClientRect().right)),
        iw: window.innerWidth,
        mainText: document.querySelector('main').innerText,
        hasCandle: !!document.querySelector('#cap-2 .lc-fig svg'), lot: !!document.querySelector('#cap-6 .lc-steps-box'), rec: !!document.querySelector('#cap-6 .lc-recovery'), rr: !!document.querySelector('#cap-5 #svg-rr-t'),
        desc: document.querySelector('meta[name=description]').content
      };
    });
    assert(lc.chapters.join() === 'cap-1,cap-2,cap-3,cap-4,cap-5,cap-6,cap-7,cap-8', `${label} lectie: 8 chapters`);
    assert(/aproximativ 15 minute de citit/.test(lc.mainText) && /0 din 8 capitole/.test(lc.mainText), `${label} lectie: reading time + chapter count labels`);
    assert(!/@@|—|74%|89%|74–89/.test(lc.mainText), `${label} lectie: no placeholders, em-dashes or the removed statistic`);
    assert(/8 capitole/.test(lc.desc), `${label} lectie: meta description says 8 chapters`);
    assert(lc.hasCandle && lc.lot && lc.rec && lc.rr, `${label} lectie: candle fig (cap 2), R:R (cap 5), lot steps + recovery (cap 6)`);
    assert(/1:30/.test(lc.mainText) && /1:20/.test(lc.mainText) && /1:10/.test(lc.mainText) && /1:5\b/.test(lc.mainText) && /1:2\b/.test(lc.mainText) && /50% din marja/.test(lc.mainText) && /sold negativ/.test(lc.mainText), `${label} lectie: ESMA limits, 50% close-out, negative balance protection`);
    assert(lc.retine === 8, `${label} lectie: a "Reține" box in every chapter`);
    assert(lc.toc.join() === lc.chapters.map(c => '#' + c).join(), `${label} lectie: TOC matches chapters`);
    assert(lc.glossToc, `${label} lectie: TOC links to the glossary`);
    assert(lc.figs.length === 6 && lc.figs.every(f => f.w > 250 && f.h > 150 && f.kids > 8 && f.title), `${label} lectie: 6 SVG diagrams render with size + title ${JSON.stringify(lc.figs.map(f => Math.round(f.w) + 'x' + Math.round(f.h)))}`);
    assert(new Set(lc.ids).size === lc.ids.length, `${label} lectie: unique element ids`);
    assert(lc.btnVisible === 8, `${label} lectie: 8 "Am parcurs capitolul" buttons visible`);
    for (const l of ['sesiuni.html', 'calculator.html', 'jurnal.html', 'reguli.html', 'patternuri.html', 'broker.html']) assert(lc.links.includes(l), `${label} lectie: links to ${l}`);
    assert(lc.maxRight <= lc.iw + 0.5, `${label} lectie: no element past viewport (${Math.round(lc.maxRight)} <= ${lc.iw})`);

    // progress
    await page.click('.lc-done-btn[data-done="1"]');
    await page.click('.lc-done-btn[data-done="2"]');
    let pr = await page.evaluate(() => ({ c: document.getElementById('lc-done-count').textContent, start: document.getElementById('lc-start').textContent, href: document.getElementById('lc-start').getAttribute('href'), toc: [...document.querySelectorAll('.lc-toc a.is-done')].length, ls: localStorage.getItem('mariusfx-lectie-v2') }));
    assert(pr.c === '2' && pr.toc === 2 && pr.ls === '[1,2]', `${label} lectie: progress 2/8 saved ${JSON.stringify(pr)}`);
    assert(pr.start === 'Continuă cu capitolul 3' && pr.href === '#cap-3', `${label} lectie: resume button -> chapter 3`);
    await page.reload({ waitUntil: 'networkidle0' });
    pr = await page.evaluate(() => document.getElementById('lc-done-count').textContent);
    assert(pr === '2', `${label} lectie: progress persists after reload`);
    await page.click('.lc-done-btn[data-done="2"]');
    pr = await page.evaluate(() => localStorage.getItem('mariusfx-lectie-v2'));
    assert(pr === '[1]', `${label} lectie: un-marking works`);

    // checklist
    const boxes = await page.$$('#lc-checklist input');
    for (const b of boxes) await b.click();
    const ck = await page.$eval('#lc-checklist', el => ({ c: el.classList.contains('is-complete'), t: el.querySelector('#lc-check-status').textContent }));
    assert(boxes.length === 8 && ck.c && /Toate cele 8/.test(ck.t), `${label} lectie: checklist completes`);

    // active TOC on scroll
    await page.evaluate(() => document.getElementById('cap-5').scrollIntoView({ behavior: 'instant' }));
    await sleep(400);
    const act = await page.evaluate(() => document.querySelector('.lc-toc a.is-active')?.dataset.ch);
    assert(act === '5', `${label} lectie: TOC highlights chapter 5 after scrolling (got ${act})`);
    await page.evaluate(() => localStorage.removeItem('mariusfx-lectie-v2'));

    // home Telegram CTA
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
    const tg = await page.evaluate(() => {
      const a = document.querySelector('.hero-telegram'); const q = document.querySelector('.hero-note');
      const r = a.getBoundingClientRect(), rq = q.getBoundingClientRect();
      const btns = [...document.querySelectorAll('.cta .btn')].map(b => b.getBoundingClientRect().height);
      return { href: a.href, target: a.target, rel: a.rel, text: a.textContent.trim().replace(/\s+/g, ' '), svg: !!a.querySelector('svg path'), below: r.top >= rq.bottom, prevIsQuote: (a.parentElement.classList.contains('hero-social') ? a.parentElement : a).previousElementSibling === q,
        h: r.height, btnH: Math.max(...btns), chip: !!document.getElementById('hero-session-chip'), tiles: document.querySelectorAll('.pair-tile').length, chart: !!document.querySelector('.hero-chart'), w: r.width, sw: document.documentElement.scrollWidth, iw: innerWidth };
    });
    assert(tg.href === 'https://t.me/+sbQPdX_yA1E5NmM0' && tg.target === '_blank' && /noopener/.test(tg.rel), `${label} home: Telegram link/target/rel`);
    assert(tg.text === 'Intră în comunitatea gratuită pe Telegram' && tg.svg, `${label} home: Telegram text + inline SVG icon`);
    assert(tg.prevIsQuote && tg.below, `${label} home: Telegram button directly under the quote`);
    assert(tg.h <= tg.btnH + 2, `${label} home: Telegram button not taller than hero buttons (${tg.h} vs ${tg.btnH})`);
    assert(tg.chip && tg.tiles === 4 && tg.chart, `${label} home: session chip, 4 TradingView tiles, chart bg intact`);
    assert(tg.sw <= tg.iw, `${label} home: no horizontal overflow`);
  }

  // calculator cross-check of the lesson example (EUR, 1000, 1%, SL 25, 1.10 -> 0,04)
  await page.setViewport(DESK);
  await page.goto(`${BASE}/calculator.html`, { waitUntil: 'networkidle2' });
  await page.select('#pereche', 'EURUSD'); await page.select('#moneda', 'EUR');
  for (const [id, v] of [['sold', '1000'], ['risc', '1'], ['stop', '25'], ['pret', '1,10']]) { await page.$eval('#' + id, el => el.value = ''); await page.type('#' + id, v); }
  const calc = await page.evaluate(() => ({ s: document.getElementById('suma-risc').textContent, l: document.getElementById('loturi').textContent }));
  assert(calc.l === '0,04' && /10,00/.test(calc.s), `calculator agrees with lesson example: ${JSON.stringify(calc)}`);

  assert(errors.length === 0, 'no console/page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));

  if (!SKIP_SHOTS) {
    await page.setViewport(DESK);
    await page.goto(`${BASE}/lectie.html`, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: `${SHOTS}/lectie-desktop-top.png` });
    await page.evaluate(() => { const el = document.getElementById('cap-4'); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 70, behavior: 'instant' }); });
    await sleep(400);
    await page.screenshot({ path: `${SHOTS}/lectie-desktop-cap4.png` });

    await page.setViewport(MOB);
    await page.goto(`${BASE}/lectie.html`, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: `${SHOTS}/lectie-mobile-top.png` });
    const shotAt = async (sel, name, off = 70) => {
      await page.evaluate((s, o) => { const el = document.querySelector(s); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - o, behavior: 'instant' }); }, sel, off);
      await sleep(400);
      await page.screenshot({ path: `${SHOTS}/${name}` });
    };
    await shotAt('#cap-1 .lc-fig', 'lectie-mobile-cap1-spread.png', 120);
    await shotAt('#cap-2 .lc-fig', 'lectie-mobile-cap2-candle.png', 90);
    await shotAt('#cap-4 .lc-table', 'lectie-mobile-cap4-esma.png', 120);
    await shotAt('#cap-5 svg[aria-labelledby="svg-rr-t"]', 'lectie-mobile-cap5-rr.png', 90);
    await shotAt('#cap-6 .lc-steps-box', 'lectie-mobile-cap6-lot.png', 80);
    await shotAt('#cap-6 .lc-recovery', 'lectie-mobile-cap6-recovery.png', 220);
    await page.click('.menu-toggle'); await sleep(200);
    await page.screenshot({ path: `${SHOTS}/lectie-mobile-menu.png` });

    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' }); await sleep(3000);
    await page.evaluate(() => { const el = document.querySelector('.hero-note'); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 420, behavior: 'instant' }); });
    await sleep(500);
    await page.screenshot({ path: `${SHOTS}/home-mobile-telegram.png` });
    await page.setViewport(DESK);
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' }); await sleep(3000);
    await page.screenshot({ path: `${SHOTS}/home-desktop-telegram.png` });
    console.log('screenshots saved to', SHOTS);
  }
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
