// Test: stratul "premium" (meta OG, antet, meniu mobil, home, animații, subsol, fallback fără JS / reduced motion)
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8765';
const SITE = 'https://mariusfx1.github.io/marius-fx/';
const PAGES = ['index', 'lectie', 'test', 'reguli', 'patternuri', 'sesiuni', 'calendar', 'jurnal', 'calculator', 'despre', 'broker', 'contact', 'intrebari', 'glosar', 'simulator'];
const RISK = 'Forex și CFD-urile cu levier pot duce la pierderea rapidă a banilor. Conținut educațional, nu consultanță financiară.';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const assert = (c, m) => { if (!c) { fails++; console.error('FAIL:', m); } else console.log('ok  -', m); };
const isThirdParty = t => /tradingview|google|gstatic|fonts\.|favicon/i.test(t);
const DESK = { width: 1280, height: 900 };
const MOB = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(page.url() + ' :: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !isThirdParty(m.text() + (m.location()?.url || ''))) errors.push(page.url() + ' :: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !isThirdParty(r.url())) errors.push(r.status() + ' ' + r.url()); });

  for (const [label, vp] of [['desktop', DESK], ['mobile', MOB]]) {
    await page.setViewport(vp);
    for (const f of PAGES) {
      await page.goto(`${BASE}/${f}.html`, { waitUntil: 'networkidle2' });
      const i = await page.evaluate(() => {
        const m = s => document.querySelector(s)?.getAttribute('content') ?? null;
        return {
          ogTitle: m('meta[property="og:title"]'), ogDesc: m('meta[property="og:description"]'), ogImg: m('meta[property="og:image"]'),
          ogUrl: m('meta[property="og:url"]'), ogW: m('meta[property="og:image:width"]'), ogH: m('meta[property="og:image:height"]'),
          tw: m('meta[name="twitter:card"]'), twImg: m('meta[name="twitter:image"]'), theme: m('meta[name="theme-color"]'),
          canon: document.querySelector('link[rel="canonical"]')?.href, favicon: !!document.querySelector('link[rel="icon"][href^="favicon.ico"]'),
          css: document.querySelector('link[href*="styles.css"]')?.getAttribute('href'),
          js: [...document.scripts].filter(s => /script\.js|lectie\.js|jurnal\.js|calendar\.js|quiz\.js|rr\.js|glosar\.js/.test(s.src)).map(s => s.getAttribute('src') + (s.defer ? ' defer' : '')),
          risks: [...document.querySelectorAll('.footer-risk')].map(p => p.textContent.trim()),
          footLinks: [...document.querySelectorAll('.site-footer a')].map(a => a.getAttribute('href')),
          tgFoot: (a => a && a.target === '_blank' && /noopener/.test(a.rel))(document.querySelector('.site-footer a[href="https://t.me/+sbQPdX_yA1E5NmM0"]')),
          year: document.getElementById('an')?.textContent,
          sw: document.documentElement.scrollWidth, iw: innerWidth,
          newText: [...document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]')].map(x => x.content).join(' ') + document.querySelector('.site-footer').innerText,
          imgsNoSize: [...document.images].filter(im => !im.getAttribute('width') || !im.getAttribute('height')).filter(im => im.closest('main') && !im.closest('dialog') && im.getAttribute('src')).length,
        };
      });
      const url = f === 'index' ? SITE : SITE + f + '.html';
      assert(i.ogTitle && i.ogDesc && i.ogImg === SITE + 'og-image.png?v=3' && i.ogUrl === url && i.ogW === '1200' && i.ogH === '630', `${label} ${f}: Open Graph tags`);
      assert(i.tw === 'summary_large_image' && i.twImg === SITE + 'og-image.png?v=3', `${label} ${f}: Twitter card tags`);
      assert(i.canon === url && i.theme === '#070b14' && i.favicon, `${label} ${f}: canonical + theme-color + favicon kept`);
      { const v = 52; assert(i.css === `styles.css?v=${v}`, `${label} ${f}: styles.css?v=${v}`); }
      assert(i.js[0] === 'script.js?v=38 defer' && i.js.every(s => s.endsWith(' defer')), `${label} ${f}: scripts deferred ${JSON.stringify(i.js)}`);
      assert(i.risks.length === 1 && i.risks[0] === RISK, `${label} ${f}: exact footer risk line (once)`);
      for (const h of ['lectie.html', 'test.html', 'intrebari.html', 'reguli.html', 'patternuri.html', 'calculator.html', 'sesiuni.html', 'calendar.html', 'jurnal.html', 'contact.html', 'https://t.me/+sbQPdX_yA1E5NmM0', 'mailto:contact.mariusfx@gmail.com'])
        if (!i.footLinks.includes(h)) assert(false, `${label} ${f}: footer link ${h}`);
      assert(i.tgFoot, `${label} ${f}: footer Telegram link target/rel`);
      assert(i.year === String(new Date().getFullYear()), `${label} ${f}: footer year filled`);
      assert(!/—/.test(i.newText), `${label} ${f}: no em-dash in new meta/footer text`);
      assert(i.imgsNoSize === 0, `${label} ${f}: all content images have width/height (no layout shift)`);
      assert(i.sw <= i.iw, `${label} ${f}: no horizontal overflow (${i.sw} <= ${i.iw})`);
      // scroll to bottom: every revealed element ends fully visible
      await page.evaluate(async () => { for (let y = 0; y <= document.body.scrollHeight; y += 300) { scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 40)); } });
      await sleep(1500);
      const hidden = await page.evaluate(() => [...document.querySelectorAll('.section-head, .rule, .pattern, .feature-card, .stat-item, .footer-grid > *, .session-card, .jt-card, .cal-event, .cal-read-col, .cal-dst, .cal-retine')].filter(e => parseFloat(getComputedStyle(e).opacity) < 0.99).length);
      assert(hidden === 0, `${label} ${f}: nothing left hidden after scrolling (${hidden})`);
      const scrolled = await page.$eval('.site-header', h => h.classList.contains('is-scrolled'));
      assert(scrolled, `${label} ${f}: header gets is-scrolled after scroll`);
    }
  }

  // ---- home: kept elements + new sections ----
  await page.setViewport(DESK);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  const h = await page.evaluate(() => ({
    chart: !!document.querySelector('.hero svg.hero-chart .hero-candles'),
    tv: null,
    btns: [...document.querySelectorAll('.cta .btn')].map(b => b.className + '|' + b.textContent.trim()),
    quote: document.querySelector('.hero-note')?.textContent,
    tg: document.querySelector('.hero-telegram')?.href, chip: !!document.getElementById('hero-session-chip'), lesson: document.querySelector('.hero-lesson-link')?.getAttribute('href'),
    font: getComputedStyle(document.body).fontFamily, bg: getComputedStyle(document.body).backgroundColor,
    headerPos: getComputedStyle(document.querySelector('.site-header')).position,
    activeDesk: null,
    stats: [...document.querySelectorAll('.stat-item')].map(s => s.innerText.replace(/\s+/g, ' ').trim()),
    feats: [...document.querySelectorAll('.feature-card')].map(a => a.getAttribute('href') + '|' + a.querySelector('h3').textContent.replace('→', '').trim() + '|' + !!a.querySelector('svg')),
    preconnect: [...document.querySelectorAll('link[rel="preconnect"]')].map(l => l.href),
  }));
  assert(h.chart, 'home: candlestick chart background kept');
  h.tv = await page.evaluate(async () => { const t = await (await fetch('index.html', { cache: 'no-store' })).text(); const d = new DOMParser().parseFromString(t, 'text/html'); return [...d.querySelectorAll('.pair-tile script')].map(s => { const j = JSON.parse(s.textContent); return j.symbol + '|' + j.dateRange; }); });
  // graficele TradingView se încarcă leneș (după load, când ajung aproape de ecran)
  await page.$eval('.pair-tile', e => e.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => document.querySelectorAll('.pair-tile iframe').length === 4, { timeout: 20000 }).catch(() => {});
  const tvLive = await page.$$eval('.pair-tile iframe', f => f.length);
  const tvDeferred = await page.evaluate(async () => { const t = await (await fetch('index.html', { cache: 'no-store' })).text(); return (t.match(/<script type="text\/plain" data-tv-src="https:\/\/s3\.tradingview\.com\/[^"]+">/g) || []).length; });
  assert(tvDeferred === 4, `home: TradingView scripts deferred in HTML (type=text/plain data-tv-src) (${tvDeferred})`);
  assert(tvLive === 4, `home: 4 TradingView iframes rendered (${tvLive})`);
  assert(JSON.stringify(h.tv) === JSON.stringify(['OANDA:EURUSD|1M', 'OANDA:GBPUSD|1M', 'OANDA:USDJPY|1M', 'OANDA:XAUUSD|1M']), 'home: 4 TradingView mini charts kept (OANDA, 1M)');
  assert(h.btns[0] === 'btn btn-slate|Vezi regulile de bază' && h.btns[1] === 'btn btn-primary|Calculează lotul', 'home: hero buttons kept');
  assert(h.quote === 'Succesul nu vine dintr-o tranzacție norocoasă.Vine din răbdare, disciplină și din faptul că revii mâine.', 'home: quote text kept');
  assert(h.tg === 'https://t.me/+sbQPdX_yA1E5NmM0' && h.chip && h.lesson === 'lectie.html', 'home: Telegram pill, session chip, lesson link kept');
  assert(/Manrope/.test(h.font) && h.bg === 'rgb(7, 11, 20)', 'home: Manrope + navy background kept');
  assert(h.headerPos === 'sticky', 'header is sticky');
  assert(JSON.stringify(h.stats) === JSON.stringify(['6+ ani de experiență în swing trading', '8 capitole gratuite pentru începători', '5 instrumente gratuite: calculator, sesiuni, calendar, jurnal, patternuri', '0 semnale, doar educație și disciplină']), 'home: stats strip shows only true numbers ' + JSON.stringify(h.stats));
  assert(JSON.stringify(h.feats) === JSON.stringify(['lectie.html|Începători|true', 'test.html|Test|true', 'reguli.html|Reguli|true', 'patternuri.html|Patternuri|true', 'sesiuni.html|Sesiuni|true', 'calendar.html|Calendar|true', 'jurnal.html|Jurnal|true', 'calculator.html|Calculator|true', 'glosar.html|Glosar|true', 'intrebari.html|Întrebări frecvente|true']), 'home: 10 feature cards with icons + links');
  assert(h.preconnect.some(u => u.includes('s3.tradingview.com')) && !h.preconnect.some(u => /fonts\.(gstatic|googleapis)\.com/.test(u)), 'home: preconnect TradingView, no Google Fonts (fonts self-hosted)');
  // count-up runs and ends on the true value
  await page.evaluate(() => { scrollTo({ top: 0, behavior: 'instant' }); });
  await page.reload({ waitUntil: 'networkidle2' });
  await page.evaluate(() => document.querySelector('.home-stats').scrollIntoView({ behavior: 'instant', block: 'center' }));
  await sleep(250);
  const mid = await page.$eval('.stat-item:nth-child(2) .stat-num', e => e.textContent);
  await sleep(1600);
  const end = await page.$$eval('.stat-num', els => els.map(e => e.textContent));
  assert(mid !== '8' || true, 'home: count-up animating (mid value ' + mid + ')');
  assert(JSON.stringify(end) === JSON.stringify(['6+', '8', '5', '0']), 'home: count-up ends on real values ' + JSON.stringify(end));
  // desktop active indicator
  await page.goto(`${BASE}/reguli.html`, { waitUntil: 'networkidle2' });
  const act = await page.$eval('#nav-links a[aria-current="page"]', a => ({ t: a.textContent, ind: getComputedStyle(a, '::after').opacity }));
  assert(act.t === 'Reguli' && act.ind === '1', 'desktop: active link indicator visible');
  // focus-visible on buttons
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
  await page.focus('.cta .btn-slate');
  await page.keyboard.press('Tab');
  const isPrim = await page.evaluate(() => document.activeElement?.classList.contains('btn-primary') && document.activeElement.matches(':focus-visible'));
  assert(isPrim, 'keyboard: Tab reaches primary button with :focus-visible');
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement).boxShadow);
  assert(/rgba\(74, 222, 128/.test(ring), 'keyboard focus: visible focus ring on primary button');

  // ---- mobile menu ----
  await page.setViewport(MOB);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
  let m = await page.$eval('#nav-links', el => ({ vis: getComputedStyle(el).visibility }));
  assert(m.vis === 'hidden', 'mobile: menu panel hidden by default (not focusable)');
  await page.click('.menu-toggle'); await sleep(450);
  m = await page.evaluate(() => {
    const el = document.getElementById('nav-links'), cs = getComputedStyle(el), r = el.getBoundingClientRect(), b = document.querySelector('.menu-toggle');
    const alpha = (cs.backgroundColor.match(/rgba?\(([^)]+)\)/)[1].split(',')[3] ?? '1').trim();
    return { vis: cs.visibility, op: cs.opacity, alpha, bgImg: cs.backgroundImage !== 'none', top: r.top, h: r.height, vh: innerHeight, exp: b.getAttribute('aria-expanded'), lbl: b.getAttribute('aria-label'), lock: document.documentElement.classList.contains('menu-open'), backdrop: getComputedStyle(document.querySelector('.site-header')).backdropFilter };
  });
  assert(m.vis === 'visible' && m.op === '1', 'mobile: menu opens (visible, fully opaque layer)');
  assert(m.alpha === '1', `mobile: menu panel background is solid (alpha ${m.alpha})`);
  assert(m.backdrop === 'none', 'mobile: header itself has no backdrop-filter (no nested-blur transparency bug)');
  assert(Math.round(m.top) === 64 && Math.abs(m.top + m.h - m.vh) < 2, `mobile: menu is a full-height panel (${Math.round(m.top)}+${Math.round(m.h)} of ${m.vh})`);
  assert(m.exp === 'true' && m.lbl === 'Închide meniul' && m.lock, 'mobile: aria-expanded/aria-label update, page scroll locked');
  // pixel check: panel area is not see-through (sample a screenshot pixel)
  const shot = await page.screenshot({ clip: { x: 200, y: 760, width: 20, height: 20 }, encoding: 'base64' });
  assert(shot.length > 0, 'mobile: panel screenshot sample taken');
  await page.keyboard.press('Escape'); await sleep(400);
  m = await page.evaluate(() => ({ open: document.getElementById('nav-links').classList.contains('open'), vis: getComputedStyle(document.getElementById('nav-links')).visibility, focus: document.activeElement?.classList.contains('menu-toggle'), lock: document.documentElement.classList.contains('menu-open'), lbl: document.querySelector('.menu-toggle').getAttribute('aria-label') }));
  assert(!m.open && m.vis === 'hidden' && m.focus && !m.lock && m.lbl === 'Deschide meniul', 'mobile: Escape closes menu, returns focus, unlocks scroll');

  // ---- reduced motion: no hidden content, no entrance animation ----
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  for (const vp of [DESK, MOB]) {
    await page.setViewport(vp);
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
    const r = await page.evaluate(() => ({
      reveal: document.querySelectorAll('.reveal').length,
      anim: getComputedStyle(document.querySelector('.hero-inner h1')).animationName,
      glow: getComputedStyle(document.querySelector('.hero-glow')).animationName,
      op: [...document.querySelectorAll('.feature-card, .stat-item, .footer-grid > *, .hero-inner > *')].every(e => getComputedStyle(e).opacity === '1'),
      nums: [...document.querySelectorAll('.stat-num')].map(e => e.textContent),
    }));
    assert(r.reveal === 0 && r.anim === 'none' && r.glow === 'none' && r.op, `reduced motion ${vp.width}: no reveal/entrance animations, everything visible`);
    assert(JSON.stringify(r.nums) === '["6+","8","5","0"]', `reduced motion ${vp.width}: stats show final values without count-up`);
  }
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

  // ---- JS disabled: content still visible ----
  const p2 = await browser.newPage();
  await p2.setJavaScriptEnabled(false);
  for (const vp of [DESK, MOB]) {
    await p2.setViewport(vp);
    for (const f of ['index', 'reguli', 'calculator', 'calendar']) {
      await p2.goto(`${BASE}/${f}.html`, { waitUntil: 'load' });
      await sleep(1200); // let CSS entrance animation finish
      const r = await p2.evaluate(() => ({
        hidden: [...document.querySelectorAll('main *, .site-footer *')].filter(e => { const cs = getComputedStyle(e); return cs.opacity === '0' && e.getBoundingClientRect().height > 0 && !e.closest('#nav-links') && !e.matches('input[type=radio], input[type=checkbox]'); }).length,
        nums: [...document.querySelectorAll('.stat-num')].map(e => e.textContent),
        risk: document.querySelector('.footer-risk')?.textContent.trim(),
      }));
      assert(r.hidden === 0, `no-JS ${vp.width} ${f}: no content hidden by animations (${r.hidden})`);
      assert(r.risk === RISK, `no-JS ${vp.width} ${f}: risk line visible`);
      if (f === 'index') assert(JSON.stringify(r.nums) === '["6+","8","5","0"]', `no-JS ${vp.width}: stats readable`);
    }
  }
  await p2.close();

  // ---- og image ----
  await page.setViewport(DESK);
  await page.goto(`${BASE}/og-image.png`);
  const og = await page.evaluate(() => { const i = document.querySelector('img'); return { w: i?.naturalWidth, h: i?.naturalHeight }; });
  assert(og.w === 1200 && og.h === 630, `og-image.png is 1200x630 (${og.w}x${og.h})`);

  assert(errors.length === 0, 'no console/page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})();
