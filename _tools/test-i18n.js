// Teste multilingve: rulează pentru fiecare limbă activă (LANGS=ro,en,...) la 1280 și 390.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8765';
const ROOT = '/workspace/forex-ms';
const LANGS = (process.env.LANGS || 'ro,en').split(',');
const SITE = 'https://mariusfx1.github.io/marius-fx/';
const PAGES = ['index', 'lectie', 'test', 'reguli', 'patternuri', 'sesiuni', 'calendar', 'calculator', 'jurnal', 'simulator', 'glosar', 'intrebari', 'despre', 'broker', 'contact'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const pre = l => (l === 'ro' ? '' : l + '/');
// „este” există și în ES/PT, iar „â” e literă normală în PT: detectorul se adaptează limbii verificate
const RO_LEAKS = {
  en: /[ăâîșțşţĂÂÎȘȚ]|\b(și|pentru|este|sunt|tranzacți\w+|capitolul|Înapoi|Șterge|Acasă)\b/,
  es: /[ăâîșțşţĂÂÎȘȚ]|(?<!\p{L})(pentru|sunt|tranzacți\p{L}*|capitolul|Înapoi|Șterge|Acasă|să|dacă|nu|cu|sau)(?!\p{L})/u,
  pt: /[ăîșțşţĂÎȘȚ]|(?<!\p{L})(pentru|sunt|tranzacți\p{L}*|capitolul|Înapoi|Șterge|Acasă|să|dacă|sau)(?!\p{L})/u,
};
const RO_LEAK = RO_LEAKS.en;

function staticChecks() {
  const href = {};
  for (const l of LANGS) for (const p of PAGES) {
    const s = fs.readFileSync(`${ROOT}/${pre(l)}${p}.html`, 'utf8');
    ok(new RegExp(`<html lang="${l}"`).test(s), `${l}/${p}: html lang`);
    const alts = {}; for (const m of s.matchAll(/<link rel="alternate" hreflang="([\w-]+)" href="([^"]+)"/g)) alts[m[1]] = m[2];
    href[`${l}/${p}`] = alts;
    ok(Object.keys(alts).sort().join() === [...LANGS, 'x-default'].sort().join(), `${l}/${p}: hreflang set ${Object.keys(alts)}`);
    const canon = (s.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    ok(canon && canon === alts[l], `${l}/${p}: canonical = self hreflang (${canon})`);
    ok(alts['x-default'] === alts.ro, `${l}/${p}: x-default = ro`);
    ok(/google-site-verification/.test(s) === (l === 'ro' && p === 'index'), `${l}/${p}: google verification only in RO index`);
    for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      let j; try { j = JSON.parse(m[1]); } catch (e) { ok(false, `${l}/${p}: JSON-LD parse`); continue; }
      const txt = JSON.stringify(j);
      ok(!txt.includes('"inLanguage"') || !new RegExp(`"inLanguage":"(?!${l})`).test(txt), `${l}/${p}: JSON-LD inLanguage=${l}`);
      if (l !== 'ro') ok(!(RO_LEAKS[l] || RO_LEAK).test(txt.replace(/Iași/g, '')), `${l}/${p}: JSON-LD without Romanian`);
    }
    const ogl = (s.match(/og:locale" content="([^"]+)"/) || [])[1];
    if (ogl) ok(ogl.startsWith(l === 'en' ? 'en' : l), `${l}/${p}: og:locale ${ogl}`);
  }
  // reciprocitate: fiecare pagină alternativă trimite înapoi la aceeași mulțime
  for (const p of PAGES) {
    const a0 = JSON.stringify(href[`${LANGS[0]}/${p}`]);
    for (const l of LANGS) ok(JSON.stringify(href[`${l}/${p}`]) === a0, `${p}: hreflang reciprocal (${l})`);
  }
  const sm = fs.readFileSync(`${ROOT}/sitemap.xml`, 'utf8');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  ok(locs.length === LANGS.length * PAGES.length, `sitemap: ${locs.length} urls`);
  ok(new Set(locs).size === locs.length, 'sitemap: unique');
  for (const loc of locs) {
    const rel = loc.slice(SITE.length) || 'index.html';
    const f = `${ROOT}/${rel.endsWith('/') ? rel + 'index.html' : rel}`;
    ok(fs.existsSync(f), `sitemap: file exists ${rel}`);
  }
  const blocks = sm.split('<url>').slice(1);
  ok(blocks.every(b => (b.match(/xhtml:link/g) || []).length === LANGS.length + 1), 'sitemap: every url has all alternates');
}

async function pageChecks(b, l, w) {
  const mob = w < 500;
  const page = await b.newPage();
  await page.setViewport({ width: w, height: mob ? 844 : 900, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/tradingview|Failed to load resource.*(s3\.tradingview|google)/i.test(m.text())) errs.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) errs.push(r.status() + ' ' + r.url()); });
  for (const p of PAGES) {
    errs.length = 0;
    await page.goto(`${BASE}/${pre(l)}${p}.html`, { waitUntil: 'networkidle2' }).catch(() => {});
    await sleep(p === 'calendar' || p === 'sesiuni' ? 1200 : 300);
    const r = await page.evaluate((mob) => {
      const de = document.documentElement;
      const sw = document.querySelector('.nav .lang-switch, header .lang-switch');
      const links = [...document.querySelectorAll('.nav-links > li, .nav-links > a')].filter(e => e.offsetParent);
      const tops = [...links, sw].filter(Boolean).filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2));
      return { overflow: de.scrollWidth - de.clientWidth, lang: de.lang, sw: !!sw, oneRow: mob || tops.length < 2 || Math.max(...tops) - Math.min(...tops) <= 8,
        text: document.body.innerText, title: document.title };
    }, mob);
    ok(errs.length === 0, `${l}/${p}@${w}: no console errors ${errs.slice(0, 3).join(' | ')}`);
    ok(r.overflow <= 0, `${l}/${p}@${w}: no horizontal overflow (${r.overflow})`);
    ok(r.lang === l, `${l}/${p}@${w}: lang`);
    ok(r.sw, `${l}/${p}@${w}: switcher present`);
    ok(r.oneRow, `${l}/${p}@${w}: nav + switcher on one row`);
    if (l !== 'ro') {
      const lines = r.text.split('\n').map(s => s.replace(/Română|Iași/g, '')).filter(s => (RO_LEAKS[l] || RO_LEAK).test(s));
      ok(lines.length === 0, `${l}/${p}@${w}: no Romanian at runtime: ${lines.slice(0, 3).join(' | ')}`);
      ok(!(RO_LEAKS[l] || RO_LEAK).test(r.title), `${l}/${p}: title translated`);
    }
  }
  // selectorul: deschide (în meniul mobil pe 390), link-urile duc la aceeași pagină
  await page.goto(`${BASE}/${pre(l)}lectie.html`, { waitUntil: 'networkidle2' });
  if (mob) { await page.click('.menu-toggle'); await sleep(300); }
  await page.evaluate(() => document.querySelector('.lang-btn').click()); await sleep(150);
  const sw = await page.evaluate(() => ({ open: !document.getElementById('lang-menu').hidden,
    links: [...document.querySelectorAll('#lang-menu a')].map(a => [a.hreflang, new URL(a.href).pathname]),
    vis: (() => { const r = document.querySelector('#lang-menu').getBoundingClientRect(); return r.width > 0 && r.right <= innerWidth + 1 && r.left >= -1; })() }));
  ok(sw.open && sw.vis, `${l}@${w}: switcher opens, menu in viewport`);
  ok(sw.links.length === LANGS.length && sw.links.every(([h, path]) => path.endsWith((h === 'ro' ? '/' : `/${h}/`) + 'lectie.html')), `${l}@${w}: switcher links to same page ${JSON.stringify(sw.links)}`);
  await page.close();
}

async function toolChecks(b, l) {
  const page = await b.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  // calculator de lot + R:R
  await page.goto(`${BASE}/${pre(l)}calculator.html`, { waitUntil: 'networkidle2' });
  const calc = await page.evaluate(async () => {
    const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
    set('sold', '1000'); set('risc', '1'); set('stop', '25'); set('pret', '1.10');
    const m = document.getElementById('moneda'); if (m) { m.value = 'EUR'; m.dispatchEvent(new Event('input', { bubbles: true })); }
    await new Promise(r => setTimeout(r, 100));
    const out = { lot: document.getElementById('loturi').textContent, sum: document.getElementById('suma-risc').textContent };
    set('rr-intrare', '1.1000'); set('rr-sl', '1.0975'); set('rr-tp', '1.1050'); set('rr-sold', '10000'); set('rr-risc', '1');
    await new Promise(r => setTimeout(r, 100));
    out.rr = [...document.querySelectorAll('#rr-form output')].map(o => o.textContent.trim());
    return out;
  });
  await page.close();
  // quiz
  const q = await b.newPage(); await q.setViewport({ width: 1280, height: 900 }); q.on('pageerror', e => errs.push(e.message));
  await q.goto(`${BASE}/${pre(l)}test.html`, { waitUntil: 'networkidle2' });
  await q.evaluate(() => { localStorage.clear(); document.getElementById('quiz-start-btn').click(); });
  for (let i = 0; i < 15; i++) {
    await sleep(60);
    await q.evaluate(() => document.querySelector('#quiz-options .quiz-opt').click()); await sleep(60);
    await q.evaluate(() => document.getElementById('quiz-next').click());
  }
  await sleep(200);
  const qr = await q.evaluate(() => ({ score: document.getElementById('quiz-score').textContent, res: !document.getElementById('quiz-result').hidden, text: document.getElementById('quiz-result').innerText }));
  ok(qr.res && /\d+/.test(qr.score), `${l}: quiz completes (${qr.score})`);
  if (l !== 'ro') ok(!(RO_LEAKS[l] || RO_LEAK).test(qr.text), `${l}: quiz result translated`);
  await q.close();
  // jurnal
  const j = await b.newPage(); await j.setViewport({ width: 1280, height: 900 }); j.on('pageerror', e => errs.push(e.message));
  await j.goto(`${BASE}/${pre(l)}jurnal.html`, { waitUntil: 'networkidle2' });
  await j.evaluate(() => localStorage.removeItem('mariusfx-jurnal-v1')); await j.reload({ waitUntil: 'networkidle2' });
  await j.select('#jt-pereche', 'EURUSD');
  await j.evaluate(() => document.querySelector('input[name="directie"][value="buy"]')?.click() || document.querySelector('input[name="directie"]').click());
  await j.evaluate(() => { for (const [id, v] of [['jt-intrare', '1.1000'], ['jt-sl', '1.0975'], ['jt-tp', '1.1050'], ['jt-r', '2']]) { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); } });
  await j.evaluate(() => document.getElementById('jt-submit').click()); await sleep(200);
  const jr = await j.evaluate(() => ({ n: JSON.parse(localStorage.getItem('mariusfx-jurnal-v1') || '[]').length, text: document.querySelector('.jt-item')?.innerText || '', stats: document.querySelector('[data-stat="totalR"]').textContent }));
  ok(jr.n === 1, `${l}: journal add saved to shared key (${jr.n})`);
  if (l !== 'ro') ok(!(RO_LEAKS[l] || RO_LEAK).test(jr.text), `${l}: journal row translated: ${jr.text.slice(0, 80)}`);
  await j.close();
  // simulator: start, trade, statistici
  const s = await b.newPage(); await s.setViewport({ width: 1280, height: 900 }); s.on('pageerror', e => errs.push(e.message));
  await s.goto(`${BASE}/${pre(l)}simulator.html`, { waitUntil: 'networkidle2' });
  await s.evaluate(() => { Object.keys(localStorage).filter(k => /sim/i.test(k)).forEach(k => localStorage.removeItem(k)); }); await s.reload({ waitUntil: 'networkidle2' });
  await s.evaluate(() => { const h = document.getElementById('sim-help'); if (h && h.open) h.close(); document.getElementById('sim-start').click(); });
  await s.waitForFunction(() => window.__sim && window.__sim.S && window.__sim.S.view, { timeout: 20000 }).catch(() => {});
  await sleep(500);
  await s.evaluate(() => { const h = document.getElementById('sim-help'); if (h && h.open) h.close(); document.getElementById('sim-place').click(); });
  for (let k = 0; k < 400; k++) { const n = await s.evaluate(() => window.__sim.S.trades.length); if (n) break; await s.evaluate(() => document.getElementById('sim-next10').click()); }
  const st = await s.evaluate(() => ({ trades: window.__sim.S.trades.length, ws: document.body.innerText }));
  ok(st.trades >= 1, `${l}: simulator trade closed (${st.trades})`);
  await s.evaluate(() => document.getElementById('sim-end').click()); await sleep(600);
  const se = await s.evaluate(() => ({ n: document.getElementById('sim-m-n').textContent, text: document.body.innerText }));
  ok(se.n === '1' || +se.n >= 1, `${l}: simulator summary shows trades (${se.n})`);
  if (l !== 'ro') {
    const lines = (st.ws + '\n' + se.text).split('\n').filter(x => (RO_LEAKS[l] || RO_LEAK).test(x.replace(/Română/g, '')));
    ok(lines.length === 0, `${l}: simulator UI has no Romanian: ${lines.slice(0, 4).join(' | ')}`);
  }
  await s.close();
  ok(errs.length === 0, `${l}: tools no page errors ${errs.slice(0, 3).join(' | ')}`);
  return calc;
}

(async () => {
  staticChecks();
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const calcs = {};
  for (const l of LANGS) {
    for (const w of [1280, 390]) await pageChecks(b, l, w);
    calcs[l] = await toolChecks(b, l);
  }
  // rezultatele calculatorului identice (după normalizarea separatorilor locali)
  const normNum = (s, l) => { s = s.replace(/\s/g, ''); return l === 'en' ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(/,/g, '.'); };
  const ref = calcs[LANGS[0]];
  console.log('calc', JSON.stringify(calcs));
  for (const l of LANGS) {
    const c = calcs[l];
    ok(normNum(c.lot, l) === normNum(ref.lot, LANGS[0]) && normNum(c.lot, l).startsWith('0.04'), `${l}: lot identical (${c.lot})`);
    ok(normNum(c.sum, l).replace(/[^\d.]/g, '') === normNum(ref.sum, LANGS[0]).replace(/[^\d.]/g, ''), `${l}: risk sum identical (${c.sum})`);
    ok(c.rr.map(x => normNum(x, l).replace(/[^\d.:+−-]/g, '')).join('|') === ref.rr.map(x => normNum(x, LANGS[0]).replace(/[^\d.:+−-]/g, '')).join('|'), `${l}: R:R outputs identical ${c.rr.join(' / ')}`);
    if (l === 'en') ok(/^\d+(\.\d+)?/.test(c.lot), 'en: decimal point');
  }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
