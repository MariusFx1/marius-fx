// Teste pentru secțiunea Articole (articole.html + 3 articole), RO/EN/ES/PT. Rulează: LANGS=ro,en,es,pt node test-articles.js
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8765';
const ROOT = '/workspace/forex-ms';
const LANGS = (process.env.LANGS || 'ro,en,es,pt').split(',');
const SITE = 'https://mariusfx1.github.io/marius-fx/';
const ARTS = ['swing-trading-incepatori', 'marime-lot-forex', 'stop-loss-forex'];
const PAGES = ['articole', ...ARTS];
const WHOP = 'https://whop.com/mariusfx1-github-io/ms-prime-vip/';
const pre = l => (l === 'ro' ? '' : l + '/');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const words = h => h.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').split(/\s+/).filter(w => /\p{L}|\d/u.test(w)).length;

function staticChecks() {
  for (const l of LANGS) for (const p of PAGES) {
    const f = `${ROOT}/${pre(l)}${p}.html`;
    ok(fs.existsSync(f), `${l}/${p}: exists`); if (!fs.existsSync(f)) continue;
    const s = fs.readFileSync(f, 'utf8');
    const t = (s.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    const d = (s.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    ok(t.length >= 40 && t.length <= 72, `${l}/${p}: title length ${t.length} ${t}`);
    ok(d.length >= 120 && d.length <= 165, `${l}/${p}: description length ${d.length}`);
    ok((s.match(/<h1[\s>]/g) || []).length === 1, `${l}/${p}: exactly one h1`);
    const url = SITE + pre(l) + p + '.html';
    ok(s.includes(`<link rel="canonical" href="${url}">`) && s.includes(`<meta property="og:url" content="${url}">`), `${l}/${p}: canonical + og:url`);
    ok(new RegExp(`<html lang="${l}"`).test(s), `${l}/${p}: html lang`);
    const alts = [...s.matchAll(/hreflang="([\w-]+)" href="([^"]+)"/g)].map(m => m[1] + '=' + m[2]);
    ok(alts.length === 5 && alts.includes('x-default=' + SITE + p + '.html') && alts.includes(l + '=' + url), `${l}/${p}: hreflang ${alts.length}`);
    ok(/<head>\n<!-- Google tag \(gtag\.js\) -->\n<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-MVC55DC6H5">/.test(s) && (s.match(/G-MVC55DC6H5/g) || []).length === 2, `${l}/${p}: GA tag right after <head>, once`);
    ok(!/google-site-verification/.test(s), `${l}/${p}: no google-site-verification`);
    ok(/styles\.css\?v=61"/.test(s), `${l}/${p}: styles.css?v=61`);
    ok(/og:title" content="[^"]+"/.test(s) && /twitter:title" content="[^"]+"/.test(s), `${l}/${p}: og/twitter title`);
    const lds = [...s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    ok(lds.length === 1, `${l}/${p}: single JSON-LD block`);
    let j = null; try { j = JSON.parse(lds[0][1]); } catch (e) { /* */ }
    ok(j && j['@graph'], `${l}/${p}: JSON-LD parses`);
    if (j) {
      const g = j['@graph'];
      if (ARTS.includes(p)) {
        const a = g.find(x => x['@type'] === 'Article');
        ok(a && a.headline && a.datePublished && a.inLanguage === l && a.author && a.author.name === 'Marius' && a.url === url, `${l}/${p}: Article JSON-LD`);
        ok(a && a.headline === (s.match(/<h1>([^<]*)<\/h1>/) || [])[1], `${l}/${p}: headline = h1`);
        const bc = g.find(x => x['@type'] === 'BreadcrumbList');
        ok(bc && bc.itemListElement.length === 3, `${l}/${p}: breadcrumb 3 levels`);
      } else ok(g.some(x => x['@type'] === 'CollectionPage') && g.some(x => x['@type'] === 'ItemList' && x.itemListElement.length === 3), `${l}/${p}: CollectionPage + ItemList`);
    }
    ok(!/—/.test(s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '').match(/<main[\s\S]*<\/main>/)[0]), `${l}/${p}: no em-dash in main`);
    ok(!/profit garantat|guaranteed profit|ganancia garantizada|lucro garantido/i.test(s), `${l}/${p}: no guaranteed-profit claims`);
    // linkuri interne existente
    for (const m of s.matchAll(/<a [^>]*href="([^"#:]+\.html)(?:#([^"]*))?"/g)) ok(fs.existsSync(`${ROOT}/${pre(l)}${m[1]}`), `${l}/${p}: link target exists ${m[1]}`);
    ok(s.includes('articole.html'), `${l}/${p}: links to articole`);
    if (ARTS.includes(p)) {
      const main = s.match(/<main[\s\S]*<\/main>/)[0];
      for (const h of ['calculator.html', 'lectie.html', 'patternuri.html', 'glosar.html', 'reguli.html', 'vip.html']) ok(main.includes(`href="${h}`), `${l}/${p}: internal link ${h}`);
      ok(main.includes(`href="${WHOP}"`) && /class="vip-discord"/.test(main), `${l}/${p}: soft VIP CTA with Whop link`);
      ok(/art-disc/.test(main), `${l}/${p}: risk disclaimer box`);
      ok((main.match(/<h2[ >]/g) || []).length >= 5 && /<h3>/.test(main), `${l}/${p}: H2/H3 structure`);
      const body = main.match(/<div class="art-body">([\s\S]*?)<\/div>\s*<div class="art-vip">/)[1];
      const lead = words(main.match(/<p class="art-lead">([\s\S]*?)<\/p>/)[1]);
      const w = words(body) + lead;
      ok(w >= 900 && w <= 1300, `${l}/${p}: article words (lead + body) ${w}`);
      if (LANGS.length) console.log(`  words ${l}/${p}: ${w} (lead ${lead})`);
      ok(/art-ex/.test(main), `${l}/${p}: labeled didactic example`);
    } else {
      ok(ARTS.every(a => s.includes(`href="${a}.html"`)), `${l}/${p}: lists all 3 articles`);
    }
  }
  // subsol + home + sitemap
  for (const l of LANGS) for (const p of ['index', 'despre', 'lectie', 'vip', '404']) {
    const s = fs.readFileSync(`${ROOT}/${pre(l)}${p}.html`, 'utf8');
    const foot = s.slice(s.indexOf('<footer'));
    ok(new RegExp(`href="${p === '404' ? '/marius-fx/' + (l === 'ro' ? '' : l + '/') : ''}articole\\.html"`).test(foot), `${l}/${p}: footer link to articole`);
  }
  for (const l of LANGS) ok(fs.readFileSync(`${ROOT}/${pre(l)}index.html`, 'utf8').includes('class="feature-card" href="articole.html"'), `${l}/index: home card`);
  const sm = fs.readFileSync(`${ROOT}/sitemap.xml`, 'utf8');
  for (const l of LANGS) for (const p of PAGES) {
    const loc = SITE + pre(l) + p + '.html';
    const blk = (sm.match(new RegExp(`<url>\\s*<loc>${loc.replace(/[.]/g, '\\.')}</loc>[\\s\\S]*?</url>`)) || [''])[0];
    ok(blk && /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(blk) && (blk.match(/xhtml:link/g) || []).length === 5, `sitemap: ${l}/${p} with lastmod + 5 hreflang`);
  }
}

(async () => {
  staticChecks();
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errs = [];
  for (const l of LANGS) for (const p of PAGES) {
    const pg = await b.newPage();
    pg.on('pageerror', e => errs.push(`${l}/${p}: ${e.message}`));
    pg.on('requestfailed', r => { if (!/googletagmanager|google-analytics/.test(r.url())) errs.push(`${l}/${p}: failed ${r.url()}`); });
    for (const w of [390, 768, 1121, 1180, 1280, 1366, 1480]) {
      await pg.setViewport({ width: w, height: 900 });
      await pg.goto(`${BASE}/${pre(l)}${p}.html`, { waitUntil: 'networkidle2' });
      const m = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, nav: (n => n.scrollWidth - n.clientWidth)(document.querySelector('.nav')),
        wrapH: document.querySelector('.nav-links').getBoundingClientRect().height, toggle: getComputedStyle(document.querySelector('.menu-toggle')).display }));
      ok(m.sw <= m.iw, `${l}/${p} @${w}: no horizontal overflow (${m.sw} <= ${m.iw})`);
      if (w >= 1121) ok(m.nav <= 0 && m.wrapH < 60, `${l}/${p} @${w}: nav fits on one line (overflow ${m.nav}, h ${Math.round(m.wrapH)})`);
    }
    await pg.close();
  }
  ok(errs.length === 0, 'no page errors / failed requests ' + errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
