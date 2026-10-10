// Test: calendar.html cu date proprii (data/calendar.json): rânduri, numărătoare, filtre + localStorage, stări goale / vechi / eroare
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8765';
const SITE = 'https://mariusfx1.github.io/marius-fx/';
const PAGES = ['index', 'lectie', 'reguli', 'patternuri', 'sesiuni', 'calendar', 'jurnal', 'calculator', 'despre', 'broker', 'contact'];
const RISK = 'Forex și CFD-urile cu levier pot duce la pierderea rapidă a banilor. Conținut educațional, nu consultanță financiară.';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const assert = (c, m) => { if (!c) { fails++; console.error('FAIL:', m); } else console.log('ok  -', m); };
const DESK = { width: 1280, height: 900 };
const MOB = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const WEEKDAY = /^(Luni|Marți|Miercuri|Joi|Vineri|Sâmbătă|Duminică), \d{1,2} [a-zăâîșț]+$/;

// ISO cu offset New York (-04:00 în octombrie), ca în feed
const ny = ms => new Date(ms - 4 * 3600e3).toISOString().slice(0, 19) + '-04:00';
const localAt = (dayOffset, h, m) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d.getTime(); };
function fixture(kind) {
  const now = Date.now(), M = 60e3, H = 3600e3;
  const ev = (t, title, country, impact, forecast = '', previous = '') => ({ title, country, date: ny(t), impact, forecast, previous });
  let events;
  if (kind === 'ended') events = [ev(now - 50 * H, 'Non-Farm Employment Change', 'USD', 'High', '100K', '90K'), ev(now - 30 * H, 'CPI m/m', 'USD', 'High', '0.3%', '0.2%'), ...Array.from({ length: 10 }, (_, i) => ev(now - (60 + i) * H, 'Trade Balance', 'EUR', 'Low'))];
  else events = [
    ev(now - 2 * H, 'Retail Sales m/m', 'USD', 'High', '0.4%', '0.1%'),
    ev(now - 2 * M, 'Unemployment Claims', 'USD', 'Medium', '200K', '197K'),
    ev(now + 4000, 'BOE Gov Bailey Speaks', 'GBP', 'Medium'),
    ev(now + 30 * M + 20e3, 'CPI m/m', 'USD', 'High', '0.3%', '0.4%'),
    ev(now + 30 * M + 20e3, 'Core CPI m/m', 'USD', 'High', '0.3%', '0.3%'),
    ev(now + 2 * H + 5 * M + 30e3, 'Main Refinancing Rate', 'EUR', 'High', '2.15%', '2.15%'),
    ev(now + 27 * H + 30e3, 'Non-Farm Employment Change', 'USD', 'High', '120K', '22K'),
    ev(localAt(1, 12, 0), 'Federal Funds Rate', 'USD', 'High', '3.75%', '4.00%'),
    ev(localAt(2, 3, 30), 'Cash Rate', 'AUD', 'High', '3.60%', '3.60%'),
    ev(localAt(2, 9, 0), 'Trade Balance', 'CNY', 'Medium', '90.2B', '102.3B'),
    ev(localAt(2, 10, 0), 'German Final Services PMI', 'EUR', 'Low', '52.9', '52.9'),
    ev(localAt(2, 11, 0), 'OPEC-JMMC Meetings', 'All', 'Medium'),
    ev(localAt(2, 12, 0), 'Leading Indicators', 'JPY', 'Low', '118.1%', '117.9%'),
    ev(new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' })).getTime() > 0 ? localAt(0, 0, 1) : 0, 'Bank Holiday', 'AUD', 'Holiday'),
  ];
  const updated = kind === 'stale' ? new Date(now - 4 * 86400e3) : new Date(now - 20 * M);
  return { source: 'ForexFactory', updated: updated.toISOString().replace(/\.\d+Z$/, 'Z'), events };
}

async function openWith(browser, vp, kind, opts = {}) {
  const p = await browser.newPage();
  await p.setViewport(vp);
  const errs = [], reqs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  if (kind) {
    await p.setRequestInterception(true);
    p.on('request', r => {
      if (/\/data\/calendar\.json/.test(r.url())) {
        reqs.push(r.url());
        if (kind === '404') return r.respond({ status: 404, contentType: 'text/plain', body: 'nope' });
        if (kind === 'garbage') return r.respond({ status: 200, contentType: 'text/html', body: '<!DOCTYPE html>Request Denied' });
        return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture(kind)) });
      }
      r.continue();
    });
  } else p.on('request', r => { if (/\/data\/calendar\.json/.test(r.url())) reqs.push(r.url()); });
  if (opts.clearStorage !== false) await p.evaluateOnNewDocument(() => { if (!sessionStorage.getItem('__kept')) { try { localStorage.removeItem('mfx-cal-filters-v1'); } catch (e) {} sessionStorage.setItem('__kept', '1'); } });
  await p.goto(`${BASE}/calendar.html`, { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => document.getElementById('cal-app').getAttribute('aria-busy') === 'false', { timeout: 15000 }).catch(() => {});
  return { p, errs, reqs };
}
const rows = p => p.$$eval('.cal-row', rs => rs.map(r => ({
  id: r.id, cls: r.className, time: r.querySelector('.cal-time')?.textContent, ccy: r.querySelector('.cal-ccy b')?.textContent,
  flag: !!r.querySelector('.cal-ccy img, .cal-ccy svg'), impact: r.querySelector('.cal-impact')?.textContent, cd: r.querySelector('.cal-cd')?.textContent,
  title: r.querySelector('.cal-row-title')?.textContent, ro: r.querySelector('.cal-row-ro')?.textContent,
  nums: [...r.querySelectorAll('.cal-row-nums div')].map(d => d.textContent), day: r.closest('.cal-day')?.querySelector('.cal-day-head')?.firstChild?.textContent,
})));

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });

  // ---------- 1. nav + subsol pe toate paginile ----------
  const page = await browser.newPage();
  for (const [label, vp] of [['desktop', DESK], ['mobile', MOB]]) {
    await page.setViewport(vp);
    for (const f of PAGES) {
      await page.goto(`${BASE}/${f}.html`, { waitUntil: 'domcontentloaded' });
      const i = await page.evaluate(() => {
        const nav = [...document.querySelectorAll('#nav-links a')], k = nav.findIndex(a => a.getAttribute('href') === 'calendar.html');
        const col = [...document.querySelectorAll('.site-footer h3, .site-footer h4, .site-footer .footer-title')].find(h => /Instrumente/i.test(h.textContent));
        return { k, label: nav[k]?.textContent.trim(), prev: nav[k - 1]?.getAttribute('href'), count: nav.length, colLinks: col ? [...col.parentElement.querySelectorAll('a')].map(a => a.textContent.trim()) : [] };
      });
      assert(i.label === 'Calendar' && i.prev === 'sesiuni.html' && i.count === 12, `${label} ${f}: nav "Calendar" after Sesiuni`);
      assert(JSON.stringify(i.colLinks) === '["Calculator","Simulator","Sesiuni","Calendar","Jurnal","Broker"]', `${label} ${f}: footer Instrumente has Calendar`);
      if (label === 'mobile') {
        await page.click('.menu-toggle'); await sleep(250);
        assert(await page.$eval('#nav-links a[href="calendar.html"]', a => { const r = a.getBoundingClientRect(); return a.closest('#nav-links').classList.contains('open') && r.height > 0 && r.bottom <= innerHeight; }), `mobile ${f}: Calendar in open mobile menu`);
      }
    }
  }
  await page.close();

  // ---------- 2. date reale (data/calendar.json din repo) ----------
  for (const [label, vp] of [['desktop', DESK], ['mobile', MOB]]) {
    const { p, errs, reqs } = await openWith(browser, vp, null);
    const info = await p.evaluate(() => ({
      ready: document.getElementById('cal-app').classList.contains('is-ready'), failed: document.getElementById('cal-app').classList.contains('is-failed'),
      fb: getComputedStyle(document.getElementById('cal-fallback')).display, meta: document.getElementById('cal-meta').textContent,
      sw: document.documentElement.scrollWidth, iw: innerWidth, tv: !!document.querySelector('iframe, script[src*="tradingview"]'),
      hero: document.querySelector('.cal-hero-title, .cal-hero-empty')?.textContent || '',
    }));
    const rs = await rows(p);
    assert(info.ready && !info.failed && info.fb === 'none', `${label} real data: calendar rendered, fallback hidden`);
    assert(/Ora ta:/.test(info.meta) && /Ultima actualizare: /.test(info.meta), `${label} real data: timezone + "Ultima actualizare" shown (${info.meta.replace(/\n/g, ' | ')})`);
    assert(reqs.length >= 1 && reqs.every(u => /calendar\.json\?t=\d+/.test(u)), `${label}: data fetched same-origin with cache-busting ?t=`);
    assert(!info.tv, `${label}: no TradingView widget/iframe anymore`);
    assert(info.hero.length > 0, `${label}: hero card filled ("${info.hero.slice(0, 60)}")`);
    assert(rs.every(r => r.ccy && r.flag && r.time && r.impact && r.title && r.cd), `${label} real data: every row has currency+flag, time, impact, title, countdown (${rs.length} rows)`);
    assert(info.sw <= info.iw, `${label} real data: no horizontal overflow (${info.sw} <= ${info.iw})`);
    assert(errs.length === 0, `${label} real data: no console errors ${errs.join(' | ')}`);
  }

  // ---------- 3. fixture: formate, grupuri, hero, tranziție ACUM, fără text tăiat ----------
  for (const [label, vp] of [['desktop', DESK], ['mobile', MOB]]) {
    const { p, errs } = await openWith(browser, vp, 'live');
    let rs = await rows(p);
    const by = t => rs.find(r => r.title === t);
    assert(!by('Retail Sales m/m'), `${label}: past events collapsed by default`);
    assert(/^peste \d{1,2}m \d\ds$/.test(by('CPI m/m')?.cd) && /^peste 30m|^peste 29m/.test(by('CPI m/m').cd), `${label}: <1h countdown "${by('CPI m/m')?.cd}"`);
    assert(/^peste 2h 0[45]m$/.test(by('Main Refinancing Rate')?.cd), `${label}: hours countdown "${by('Main Refinancing Rate')?.cd}"`);
    assert(/^peste 1z [23]h$/.test(by('Non-Farm Employment Change')?.cd), `${label}: days countdown "${by('Non-Farm Employment Change')?.cd}"`);
    const claims = by('Unemployment Claims');
    assert(claims?.cd === 'ACUM' && /st-now/.test(claims.cls), `${label}: released 2 min ago -> ACUM (pulsing class st-now)`);
    assert(by('CPI m/m')?.ro === 'Inflația (CPI) lunară · SUA' && by('Non-Farm Employment Change')?.ro === 'NFP: locuri de muncă SUA · SUA' && by('Federal Funds Rate')?.ro === 'Decizia de dobândă Fed · SUA' && by('Unemployment Claims')?.ro.startsWith('Cereri de șomaj') && by('Main Refinancing Rate')?.ro.startsWith('Decizia de dobândă BCE'), `${label}: Romanian subtitles mapped`);
    assert(JSON.stringify(by('CPI m/m')?.nums) === '["Prognoză0.3%","Anterior0.4%"]', `${label}: Prognoză / Anterior labels + values`);
    assert(by('CPI m/m')?.impact === 'Mare' && by('Unemployment Claims')?.impact === 'Mediu' && /is-high/.test(by('CPI m/m').cls) && /is-med/.test(claims.cls), `${label}: impact badges Mare (red) / Mediu (orange)`);
    const colors = await p.evaluate(() => ({ high: getComputedStyle(document.querySelector('.cal-row.is-high')).borderLeftColor, med: getComputedStyle(document.querySelector('.cal-row.is-med')).borderLeftColor }));
    assert(colors.high === 'rgb(239, 68, 68)' && colors.med === 'rgb(251, 146, 60)', `${label}: high red / medium orange accents ${JSON.stringify(colors)}`);
    assert(!rs.some(r => r.impact === 'Scăzut'), `${label}: low impact hidden by default`);
    assert(!rs.some(r => r.ccy === 'CNY'), `${label}: CNY off by default (majors only)`);
    const days = await p.$$eval('.cal-day-head', hs => hs.map(h => h.firstChild.textContent));
    assert(days[0] === 'Azi' && days[1] === 'Mâine' && WEEKDAY.test(days[2]), `${label}: groups Azi / Mâine / weekday+date (${days.slice(0, 3)})`);
    const hol = by('Bank Holiday');
    assert(hol && hol.time === 'Toată ziua' && hol.cd === 'bănci închise' && hol.impact === 'Zi liberă', `${label}: bank holiday row`);
    const next = rs.filter(r => /is-next/.test(r.cls)).map(r => r.title);
    assert(next.length === 1 && next[0] === 'BOE Gov Bailey Speaks', `${label}: next upcoming event highlighted (${next})`);
    const hero = await p.evaluate(() => ({ title: document.querySelector('.cal-hero-title')?.textContent, ccy: document.querySelector('.cal-hero .cal-ccy b')?.textContent, units: [...document.querySelectorAll('.cal-hero-unit span')].map(s => s.textContent), also: document.querySelector('.cal-hero-also')?.textContent, ro: document.querySelector('.cal-hero-ro')?.textContent, link: document.querySelector('.cal-hero-link')?.getAttribute('data-goto') }));
    assert(hero.title === 'CPI m/m' && hero.ccy === 'USD' && hero.ro === 'Inflația (CPI) lunară', `${label}: hero = next HIGH impact event with currency + RO title`);
    assert(JSON.stringify(hero.units) === '["ore","min","sec"]' && /Core CPI m\/m \(USD\)/.test(hero.also || ''), `${label}: hero big countdown units + "La aceeași oră"`);
    // fără trunchiere: niciun element din rânduri nu depășește lățimea, iar pe mobil ora, valuta, impactul și numărătoarea sunt pe același rând
    const fit = await p.evaluate(() => {
      const bad = [];
      document.querySelectorAll('.cal-row, .cal-row *, .cal-hero *').forEach(el => { if (el.classList.contains('cal-sr')) return; if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') bad.push(el.className); });
      const out = [...document.querySelectorAll('.cal-row')].filter(r => { const b = r.getBoundingClientRect(); return [...r.querySelectorAll('*')].some(c => { const x = c.getBoundingClientRect(); return x.width && (x.right > b.right + 1 || x.left < b.left - 1); }); }).length;
      const sameLine = [...document.querySelectorAll('.cal-row:not(.is-hol)')].filter(r => { const t = r.querySelector('.cal-time').getBoundingClientRect(), c = r.querySelector('.cal-cd').getBoundingClientRect(), i = r.querySelector('.cal-impact').getBoundingClientRect(), y = r.querySelector('.cal-ccy').getBoundingClientRect(); const mid = x => x.top + x.height / 2; return ![c, i, y].every(x => Math.abs(mid(x) - mid(t)) < 8); }).map(r => r.querySelector('.cal-row-title').textContent + ':' + r.querySelector('.cal-cd').textContent);
      const _unused = [...document.querySelectorAll('.cal-row:not(.is-hol)')].every(r => { const t = r.querySelector('.cal-time').getBoundingClientRect(), c = r.querySelector('.cal-cd').getBoundingClientRect(), i = r.querySelector('.cal-impact').getBoundingClientRect(), y = r.querySelector('.cal-ccy').getBoundingClientRect(); const mid = x => x.top + x.height / 2; return [c, i, y].every(x => Math.abs(mid(x) - mid(t)) < 8); });
      return { bad, out, sameLine, sw: document.documentElement.scrollWidth, iw: innerWidth };
    });
    assert(fit.bad.length === 0 && fit.out === 0, `${label}: no clipped/overflowing text in rows or hero (${fit.bad.slice(0, 3)} / ${fit.out})`);
    assert(fit.sameLine.length === 0, `${label}: time, currency, impact and countdown on one line in every row ${fit.sameLine}`);
    assert(fit.sw <= fit.iw, `${label}: no horizontal overflow`);
    // numărătoarea avansează + tranziția în ACUM (Bailey la +4s)
    const cd1 = await p.$eval('.cal-hero-cd', e => e.textContent);
    const r1 = (await rows(p)).find(r => r.title === 'CPI m/m').cd;
    await sleep(2200);
    const cd2 = await p.$eval('.cal-hero-cd', e => e.textContent);
    const r2 = (await rows(p)).find(r => r.title === 'CPI m/m').cd;
    assert(cd1 !== cd2 && r1 !== r2, `${label}: countdown ticks every second (${r1} -> ${r2})`);
    await sleep(2500);
    rs = await rows(p);
    const bailey = rs.find(r => r.title === 'BOE Gov Bailey Speaks');
    assert(bailey.cd === 'ACUM' && /st-now/.test(bailey.cls), `${label}: event switches to ACUM at release time`);
    // știrile trecute: buton, apoi „a trecut” estompat
    await p.click('#cal-past-toggle'); await sleep(200);
    rs = await rows(p);
    const past = rs.find(r => r.title === 'Retail Sales m/m');
    const op = await p.$eval('.cal-row.st-past', e => getComputedStyle(e).opacity);
    assert(past && past.cd === 'a trecut' && /st-past/.test(past.cls) && parseFloat(op) < 0.7, `${label}: past events shown dimmed with "a trecut" after toggle`);
    // butonul din hero derulează la rând
    await p.click('#cal-past-toggle'); await sleep(150);
    await p.click('.cal-hero-link'); await sleep(900);
    const inView = await p.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, hero.link);
    assert(inView, `${label}: "Vezi în listă" scrolls to the hero event`);
    assert(errs.length === 0, `${label} fixture: no console errors ${errs.join(' | ')}`);
    await p.close();
  }

  // ---------- 4. filtre + persistență ----------
  {
    const { p, errs } = await openWith(browser, MOB, 'live');
    await p.click('.cal-chip[data-ccy="USD"]'); await sleep(150);
    let rs = await rows(p);
    assert(rs.length > 0 && !rs.some(r => r.ccy === 'USD'), 'filter: USD chip off removes USD rows');
    assert(await p.$eval('.cal-chip[data-ccy="USD"]', b => b.getAttribute('aria-pressed')) === 'false', 'filter: chip aria-pressed=false');
    assert(await p.$eval('.cal-hero-title', e => e.textContent) === 'Main Refinancing Rate', 'filter: hero follows currency filter (next EUR high)');
    await p.click('[data-impact="high"]'); await sleep(150);
    rs = await rows(p);
    assert(rs.length > 0 && rs.every(r => r.impact === 'Mare'), 'filter: impact "Mare" shows only high');
    await p.click('[data-impact="all"]'); await sleep(150);
    rs = await rows(p);
    assert(rs.some(r => r.impact === 'Scăzut') && rs.some(r => r.title === 'Leading Indicators'), 'filter: impact "Toate" adds low impact');
    await p.click('.cal-chip[data-ccy="CNY"]'); await sleep(150);
    assert((await rows(p)).some(r => r.ccy === 'CNY'), 'filter: CNY can be added');
    await p.click('#cal-today'); await sleep(150);
    let days = await p.$$eval('.cal-day-head', hs => hs.map(h => h.firstChild.textContent));
    assert(JSON.stringify(days) === '["Azi"]', `filter: "Doar azi" shows only today (${days})`);
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('mfx-cal-filters-v1')));
    assert(saved && saved.impact === 'all' && saved.today === true && !saved.ccy.includes('USD') && saved.ccy.includes('CNY'), 'filter: saved to localStorage');
    await p.reload({ waitUntil: 'networkidle0' }); await sleep(400);
    const st = await p.evaluate(() => ({ usd: document.querySelector('.cal-chip[data-ccy="USD"]').getAttribute('aria-pressed'), cny: document.querySelector('.cal-chip[data-ccy="CNY"]').getAttribute('aria-pressed'), imp: document.querySelector('[data-impact][aria-pressed="true"]').dataset.impact, today: document.getElementById('cal-today').getAttribute('aria-pressed'), days: [...document.querySelectorAll('.cal-day-head')].map(h => h.firstChild.textContent) }));
    assert(st.usd === 'false' && st.cny === 'true' && st.imp === 'all' && st.today === 'true' && JSON.stringify(st.days) === '["Azi"]', 'filter: persisted after reload ' + JSON.stringify(st));
    for (const sel of ['.cal-chip-all', '#cal-today', '[data-impact="hm"]']) await p.$eval(sel, b => b.click()); // clic DOM: ora live poate muta layoutul await sleep(150);
    rs = await rows(p);
    assert(rs.some(r => r.ccy === 'USD') && rs.some(r => r.ccy === 'CNY') && rs.some(r => r.ccy === 'ALL'), '"Toate" chip selects every currency (incl. global ALL)');
    for (const c of ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY', 'ALL']) await p.$eval(`.cal-chip[data-ccy="${c}"]`, b => b.click());
    await sleep(150);
    assert(/Nicio valută selectată/.test(await p.$eval('#cal-list', e => e.textContent)) && (await rows(p)).length === 0, 'no currency selected: friendly message');
    await p.evaluate(() => localStorage.setItem('mfx-cal-filters-v1', '{"ccy":"bad","impact":42}'));
    await p.reload({ waitUntil: 'networkidle0' }); await sleep(400);
    assert((await rows(p)).length > 0, 'corrupt localStorage falls back to defaults');
    assert(errs.length === 0, 'filters: no console errors ' + errs.join(' | '));
    await p.close();
  }

  // ---------- 5. stări: săptămână încheiată, date vechi, eroare, răspuns invalid, fără JS ----------
  for (const [label, vp] of [['desktop', DESK], ['mobile', MOB]]) {
    let o = await openWith(browser, vp, 'ended');
    let s = await o.p.evaluate(() => ({ hero: document.querySelector('.cal-hero-empty')?.textContent || '', list: document.getElementById('cal-list').textContent, fb: getComputedStyle(document.getElementById('cal-fallback')).display, sw: document.documentElement.scrollWidth, iw: innerWidth }));
    assert(/Nu mai sunt știri importante săptămâna asta/.test(s.hero) && /Săptămâna s-a încheiat/.test(s.list) && /duminică/.test(s.list) && s.fb === 'none', `${label}: week-ended empty state (hero + list)`);
    assert(s.sw <= s.iw && o.errs.length === 0, `${label}: empty state no overflow / errors`);
    await o.p.close();

    o = await openWith(browser, vp, 'stale');
    s = await o.p.evaluate(() => ({ fb: getComputedStyle(document.getElementById('cal-fallback')).display, msg: document.getElementById('cal-fallback-msg').textContent, list: getComputedStyle(document.getElementById('cal-list')).display, hero: getComputedStyle(document.getElementById('cal-hero')).display, links: [...document.querySelectorAll('#cal-fallback a')].map(a => a.href) }));
    assert(s.fb === 'grid' && /nu au mai fost actualizate/.test(s.msg) && s.list === 'none' && s.hero === 'none', `${label}: stale data (4 days) -> fallback message, old list hidden`);
    assert(s.links.some(h => /forexfactory\.com\/calendar/.test(h)) && s.links.some(h => /tradingview\.com\/economic-calendar/.test(h)), `${label}: fallback links to ForexFactory + TradingView`);
    assert(o.errs.length === 0, `${label}: stale state no console errors`);
    await o.p.close();

    for (const k of ['404', 'garbage']) {
      o = await openWith(browser, vp, k);
      s = await o.p.evaluate(() => ({ fb: getComputedStyle(document.getElementById('cal-fallback')).display, msg: document.getElementById('cal-fallback-msg').textContent, sw: document.documentElement.scrollWidth, iw: innerWidth }));
      assert(s.fb === 'grid' && /nu s-a putut încărca/.test(s.msg) && s.sw <= s.iw, `${label}: data ${k} -> fallback shown`);
      assert(o.errs.filter(e => !/404|Failed to load resource/.test(e)).length === 0, `${label}: ${k} -> no JS errors from our code`);
      await o.p.close();
    }
  }
  {
    const pn = await browser.newPage(); await pn.setJavaScriptEnabled(false); await pn.setViewport(MOB);
    await pn.goto(`${BASE}/calendar.html`, { waitUntil: 'load' });
    const nj = await pn.evaluate(() => ({ fb: getComputedStyle(document.getElementById('cal-fallback')).display, hero: getComputedStyle(document.getElementById('cal-hero')).display, tb: getComputedStyle(document.querySelector('.cal-toolbar')).display }));
    assert(nj.fb === 'grid' && nj.hero === 'none' && nj.tb === 'none', 'no-JS: fallback with links, live UI hidden');
    await pn.close();
  }

  // ---------- 6. conținutul paginii ----------
  {
    const { p } = await openWith(browser, DESK, 'live');
    const c = await p.evaluate(() => ({
      text: document.querySelector('main').innerText, events: document.querySelectorAll('.cal-event').length, rules: document.querySelectorAll('#protectie .rule').length,
      retine: !!document.querySelector('#protectie .lc-retine'), links: ['sesiuni.html', 'lectie.html', 'calculator.html', 'jurnal.html'].filter(h => document.querySelector(`main a[href="${h}"]`)),
      canon: document.querySelector('link[rel="canonical"]')?.href, og: document.querySelector('meta[property="og:url"]')?.content, title: document.title,
      risk: document.querySelector('.footer-risk')?.textContent.trim(), current: document.querySelector('#nav-links a[aria-current="page"]')?.getAttribute('href'),
      js: [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean),
    }));
    assert(c.events === 8 && c.rules === 6 && c.retine && c.links.length === 4, 'guide (8 cards), 6 rules, Reține, 4 links kept');
    assert(!/limba engleză\. Din bara|marchează prognoza cu F/.test(c.text) && /Rezultatul \(cifra actuală\) nu apare aici/.test(c.text), 'old widget text replaced; no-actuals note present');
    assert(!/—/.test(c.text), 'no em-dash in calendar page text');
    assert(c.canon === SITE + 'calendar.html' && c.og === SITE + 'calendar.html' && c.risk === RISK && c.current === 'calendar.html', 'meta + risk line + aria-current');
    assert(c.js.includes('calendar.js?v=2') && c.js.includes('script.js?v=38'), 'calendar.js?v=2 + script.js?v=38 loaded');
    await p.close();
  }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})();
