// Test: SEO on-site (titluri, descrieri, OG/Twitter, canonical, H1, JSON-LD, alt, linkuri interne, sitemap, robots, 404)
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8765';            // site-ul (rădăcina /marius-fx/ pe live)
const PREFIXED = process.env.PREFIXED || 'http://localhost:8766/marius-fx'; // la fel ca pe GitHub Pages, pentru 404
const LIVE = /github\.io/.test(BASE);
const SITE = 'https://mariusfx1.github.io/marius-fx/';
const PAGES = ['index', 'lectie', 'test', 'reguli', 'patternuri', 'sesiuni', 'calendar', 'jurnal', 'calculator', 'despre', 'broker', 'contact', 'intrebari', 'glosar', 'simulator'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const assert = (c, m) => { if (!c) { fails++; console.error('FAIL:', m); } else console.log('ok  -', m); };
const urlOf = p => p === 'index' ? SITE : SITE + p + '.html';

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(page.url() + ' ' + e.message));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });

  // ---------- meta pe fiecare pagină (HTML brut, așa cum îl vede Google) ----------
  const metas = {};
  for (const p of PAGES) {
    const m = await page.evaluate(async f => {
      const t = await (await fetch(f + '.html', { cache: 'no-store' })).text();
      const d = new DOMParser().parseFromString(t, 'text/html');
      const c = s => d.querySelector(s)?.getAttribute('content') ?? null;
      return {
        lang: d.documentElement.getAttribute('lang'), title: d.title, desc: c('meta[name="description"]'),
        ogt: c('meta[property="og:title"]'), ogd: c('meta[property="og:description"]'), twt: c('meta[name="twitter:title"]'), twd: c('meta[name="twitter:description"]'),
        canon: d.querySelector('link[rel="canonical"]')?.getAttribute('href'), ogurl: c('meta[property="og:url"]'), robots: c('meta[name="robots"]'),
        h1: [...d.querySelectorAll('h1')].map(h => h.textContent.replace(/\s+/g, ' ').trim()),
        ld: [...d.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent),
        imgs: [...d.querySelectorAll('img')].map(i => ({ src: i.getAttribute('src'), alt: i.getAttribute('alt'), w: i.getAttribute('width'), h: i.getAttribute('height') })),
        links: [...d.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
        emdash: /—/.test([d.title, c('meta[name="description"]')].join(' ')),
        gsc: /google-site-verification/.test(t),
        gscExact: t.indexOf('<meta name="google-site-verification" content="O7g1XoiifBLTrr8a1nMvz4BTCeQoflJg5ez10yfZFzg" />') > -1 && t.indexOf('<meta name="google-site-verification" content="O7g1XoiifBLTrr8a1nMvz4BTCeQoflJg5ez10yfZFzg" />') < t.indexOf('</head>') && d.head.querySelectorAll('meta[name="google-site-verification"]').length === 1,
      };
    }, p);
    metas[p] = m;
    assert(m.lang === 'ro', `${p}: html lang="ro"`);
    assert(m.title.length >= 40 && m.title.length <= 70, `${p}: title length ${m.title.length} "${m.title}"`);
    assert(m.desc && m.desc.length >= 120 && m.desc.length <= 165, `${p}: description length ${m.desc && m.desc.length}`);
    assert(m.ogt === m.title && m.twt === m.title && m.ogd === m.desc && m.twd === m.desc, `${p}: og/twitter title+description match`);
    assert(m.canon === urlOf(p) && m.ogurl === urlOf(p), `${p}: canonical + og:url absolute (${m.canon})`);
    assert(!m.robots || !/noindex/.test(m.robots), `${p}: indexable (no noindex)`);
    assert(m.h1.length === 1, `${p}: exactly one H1 (${m.h1})`);
    assert(!m.emdash, `${p}: no em-dash in title/description`);
    let ld = null; try { ld = m.ld.length === 1 ? JSON.parse(m.ld[0]) : null; } catch (e) { /* invalid */ }
    const types = ld ? ld['@graph'].map(g => g['@type']) : [];
    assert(ld && ld['@context'] === 'https://schema.org' && types.includes('WebSite') && types.includes('Organization') && (types.includes('WebPage') || (p === 'intrebari' && types.includes('FAQPage'))), `${p}: JSON-LD valid (${types})`);
    const org = ld && ld['@graph'].find(g => g['@type'] === 'Organization');
    assert(org && org.name === 'MS Prime' && org.sameAs.includes('https://t.me/FreeMariusFx') && /icon-512\.png$/.test(org.logo.url), `${p}: Organization name/logo/sameAs Telegram`);
    if (p !== 'index') {
      const bc = ld && ld['@graph'].find(g => g['@type'] === 'BreadcrumbList');
      assert(bc && bc.itemListElement.length === 2 && bc.itemListElement[0].item === SITE && bc.itemListElement[1].item === urlOf(p), `${p}: BreadcrumbList Acasă > ${bc && bc.itemListElement[1].name}`);
    }
    if (p === 'lectie') {
      const c = ld['@graph'].find(g => g['@type'] === 'Course');
      assert(c && c.inLanguage === 'ro' && c.isAccessibleForFree === true && c.provider['@id'] === SITE + '#org' && c.offers.price === 0 && c.syllabusSections.length === 8, 'lectie: Course schema (free, ro, provider, 8 chapters)');
    }
    assert(p === 'intrebari' ? types.includes('FAQPage') : !types.includes('FAQPage'), `${p}: FAQPage only on intrebari`);
    const badImg = m.imgs.filter(i => !/images\/(flags\/|logo-bull)/.test(i.src || '')).filter(i => !i.src || !i.alt || i.alt.trim().length < 10 || !i.w || !i.h);
    assert(badImg.length === 0, `${p}: all ${m.imgs.length} static images have src, descriptive alt and width/height ${JSON.stringify(badImg)}`);
    assert(p === 'index' ? m.gsc : !m.gsc, `${p}: Search Console verification tag only on home`);
    if (p === 'index') assert(m.gscExact, 'index: exact Google verification tag present once inside <head>');
  }
  const uniq = k => new Set(PAGES.map(p => metas[p][k])).size === PAGES.length;
  assert(uniq('title') && uniq('desc') && uniq('h1') , 'titles, descriptions and H1s are unique across pages');

  // ---------- crawl din home doar prin <a href> din HTML brut ----------
  const seen = new Set(['index']), queue = ['index'];
  while (queue.length) {
    const p = queue.shift();
    for (const h of metas[p].links) {
      const mm = h.match(/^(?:\.\/)?([a-z0-9-]+)\.html(?:[#?].*)?$/);
      if (mm && PAGES.includes(mm[1]) && !seen.has(mm[1])) { seen.add(mm[1]); queue.push(mm[1]); }
    }
  }
  assert(seen.size === PAGES.length, `every page reachable from home via plain links (${seen.size}/${PAGES.length})`);
  const calStatic = await page.evaluate(async () => { const d = new DOMParser().parseFromString(await (await fetch('calendar.html')).text(), 'text/html'); return d.querySelector('main').textContent.replace(/\s+/g, ' ').length; });
  assert(calStatic > 3000, `calendar.html has crawlable static text without JS (${calStatic} chars)`);

  // ---------- sitemap + robots ----------
  const sm = await page.evaluate(async () => { const r = await fetch('sitemap.xml', { cache: 'no-store' }); return { status: r.status, type: r.headers.get('content-type'), text: await r.text() }; });
  const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x => x[1]);
  const mods = [...sm.text.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(x => x[1]);
  assert(sm.status === 200 && /xml/.test(sm.type || ''), `sitemap.xml 200 + XML content-type (${sm.type})`);
  assert(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9" xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml">/.test(sm.text), 'sitemap.xml header + namespace');
  assert(JSON.stringify(locs.slice(0, PAGES.length)) === JSON.stringify(PAGES.map(urlOf)), `sitemap lists all ${PAGES.length} canonical RO URLs first (then translated ones, ${locs.length} total)`);
  assert(mods.length === locs.length && mods.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= new Date().toISOString().slice(0, 10)), 'sitemap lastmod present (YYYY-MM-DD, not in the future)');
  const parsed = await page.evaluate(t => !new DOMParser().parseFromString(t, 'application/xml').querySelector('parsererror'), sm.text);
  assert(parsed, 'sitemap.xml is well-formed XML');
  const rb = await page.evaluate(async () => { const r = await fetch('robots.txt', { cache: 'no-store' }); return { status: r.status, text: await r.text() }; });
  assert(rb.status === 200 && /^User-agent: \*$/m.test(rb.text) && /^Allow: \/$/m.test(rb.text) && /^Sitemap: https:\/\/mariusfx1\.github\.io\/marius-fx\/sitemap\.xml$/m.test(rb.text) && !/Disallow: \/\s*$/m.test(rb.text), 'robots.txt allows all + points to sitemap');

  // ---------- 404 ----------
  const nfBase = LIVE ? BASE : PREFIXED;
  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]) {
    const p4 = await browser.newPage(); await p4.setViewport(vp);
    const e4 = []; p4.on('pageerror', e => e4.push(e.message)); p4.on('requestfailed', r => { if (!/tradingview|google/.test(r.url())) e4.push('failed ' + r.url()); });
    p4.on('response', r => { if (r.status() >= 400 && !/\/(nu-exista|404)/.test(r.url()) && !/tradingview|google/.test(r.url())) e4.push(r.status() + ' ' + r.url()); });
    const target = LIVE ? `${nfBase}/nu-exista/pagina-adanca/x.html` : `${nfBase}/404.html`;
    const resp = await p4.goto(target, { waitUntil: 'networkidle2' });
    const r = await p4.evaluate(() => ({
      h1: document.querySelector('h1')?.textContent, robots: document.querySelector('meta[name="robots"]')?.content, canon: !!document.querySelector('link[rel="canonical"]'),
      font: getComputedStyle(document.querySelector('h1')).fontFamily, bg: getComputedStyle(document.body).backgroundColor,
      rel: [...document.querySelectorAll('[href],[src]')].map(e => e.getAttribute('href') ?? e.getAttribute('src')).filter(u => !/^(https?:|mailto:|tel:|#|\/marius-fx\/|data:)/.test(u)),
      links: [...document.querySelectorAll('main a')].map(a => a.getAttribute('href')), sw: document.documentElement.scrollWidth, iw: innerWidth,
      nav: document.querySelectorAll('#nav-links a').length, risk: document.querySelector('.footer-risk')?.textContent.trim(),
    }));
    if (LIVE) assert(resp.status() === 404, `404: missing deep URL returns HTTP 404 (${resp.status()})`);
    assert(r.h1 === 'Pagina nu a fost găsită' && r.robots === 'noindex' && !r.canon, `404 ${vp.width}: h1, noindex, no canonical`);
    assert(/Manrope/.test(r.font) && r.bg !== 'rgba(0, 0, 0, 0)' && r.nav === 12 && /Forex și CFD-urile/.test(r.risk || ''), `404 ${vp.width}: site style loaded, nav + footer risk line`);
    assert(r.rel.length === 0, `404 ${vp.width}: all links/resources absolute (/marius-fx/...) ${r.rel.slice(0, 3)}`);
    assert(['/marius-fx/', '/marius-fx/lectie.html', '/marius-fx/calculator.html', '/marius-fx/sesiuni.html', '/marius-fx/calendar.html'].every(h => r.links.includes(h)), `404 ${vp.width}: links back to home + key pages`);
    assert(r.sw <= r.iw && e4.length === 0, `404 ${vp.width}: no overflow, no broken resources ${e4.join(' | ')}`);
    await p4.close();
  }

  // ---------- randare: lightbox fără <img src=""> + o singură eroare de consolă zero ----------
  for (const f of ['despre', 'jurnal']) {
    await page.goto(`${BASE}/${f}.html`, { waitUntil: 'networkidle2' });
    const emptySrc = await page.$$eval('img', im => im.filter(i => i.getAttribute('src') === '').length);
    assert(emptySrc === 0, `${f}: no <img src=""> in DOM`);
  }
  assert(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})();
