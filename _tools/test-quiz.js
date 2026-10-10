// Test: test.html (quiz) + intrebari.html (FAQ) + linkuri noi (meniu, subsol, home, lecție, contact) + meniul pe un rând
const puppeteer = require('puppeteer-core');
const fs = require('fs'), vm = require('vm');
const BASE = process.env.BASE || 'http://localhost:8765';
const ROOT = '/workspace/forex-ms';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const assert = (c, m) => { if (!c) { fails++; console.error('FAIL:', m); } else console.log('ok  -', m); };
const DESK = { width: 1280, height: 900 };
const MOB = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const isThirdParty = t => /tradingview|google|gstatic|fonts\.|favicon/i.test(t);
const norm = s => s.replace(/\s+/g, ' ').trim();
// așteaptă să se oprească derularea lină spre întrebarea următoare
const settle = async p => { let last = -1; for (let i = 0; i < 40; i++) { const y = await p.evaluate(() => scrollY); if (y === last) return; last = y; await sleep(50); } };

// datele testului direct din quiz.js (aceeași sursă ca pagina)
const src = fs.readFileSync(`${ROOT}/quiz.js`, 'utf8');
const QUESTIONS = vm.runInNewContext('(' + src.match(/const QUESTIONS = (\[[\s\S]*?\n  \]);/)[1] + ')');
const CORRECT = new Map(QUESTIONS.map(q => [q.q, q.a[0]]));
const BY_Q = new Map(QUESTIONS.map(q => [q.q, q]));

(async () => {
  // ---------- date ----------
  const lect = fs.readFileSync(`${ROOT}/lectie.html`, 'utf8');
  assert(QUESTIONS.length === 15, `15 questions (${QUESTIONS.length})`);
  assert(QUESTIONS.every(q => q.a.length === 4 && new Set(q.a).size === 4 && q.ex.length > 40 && q.ch >= 1 && q.ch <= 8), 'each question: 4 distinct options, explanation, chapter 1-8');
  assert(new Set(QUESTIONS.map(q => q.ch)).size === 8, 'questions cover all 8 chapters');
  assert([1, 2, 3, 4, 5, 6, 7, 8].every(n => lect.includes(`id="cap-${n}"`)), 'lesson has all chapter anchors #cap-1..8');
  for (const f of ['quiz.js', 'test.html', 'intrebari.html']) assert(!/[—–]/.test(fs.readFileSync(`${ROOT}/${f}`, 'utf8')), `${f}: no em/en dashes`);
  for (const f of ['quiz.js', 'test.html', 'intrebari.html']) assert(!/[şţŞŢ]/.test(fs.readFileSync(`${ROOT}/${f}`, 'utf8')), `${f}: Romanian comma-below diacritics only`);
  // răspunsurile numerice (verificate și în Python)
  const num = q => BY_Q.get([...BY_Q.keys()].find(k => k.includes(q))).a[0];
  assert(num('1,1035') === '35 de pips' && Math.round((1.1035 - 1.1) / 0.0001) === 35, 'numeric: 35 pips');
  assert(num('0,10 loturi') === '1 USD' && Math.abs(0.0001 * 10000 - 1) < 1e-9, 'numeric: pip value 0.10 lot = 1 USD');
  assert(num('levier 1:30') === 'Aproximativ 333,33 €' && (10000 / 30).toFixed(2) === '333.33', 'numeric: margin 333,33 €');
  assert(num('R:R 1:2') === 'Aproximativ 33,3%' && (100 / 3).toFixed(1) === '33.3', 'numeric: break-even 33,3%');
  assert(num('1.500 €') === '15 €' && 1500 * 0.01 === 15, 'numeric: 1% of 1.500 € = 15 €');
  const lot = 20 / (40 * (10 / 1.1));
  assert(num('2.000 €') === '0,05 loturi' && Math.floor(lot * 100) / 100 === 0.05 && 0.06 * 40 * (10 / 1.1) > 20, `numeric: lot 0,05 (raw ${lot.toFixed(4)})`);
  assert(num('scade cu 50%') === '+100%' && 1 / (1 - 0.5) - 1 === 1, 'numeric: -50% needs +100%');

  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(page.url() + ' :: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !isThirdParty(m.text() + (m.location()?.url || ''))) errors.push(page.url() + ' :: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !isThirdParty(r.url())) errors.push(r.status() + ' ' + r.url()); });

  // ---------- randare + overflow ----------
  for (const [label, vp] of [['desktop', DESK], ['mobile', MOB]]) {
    await page.setViewport(vp);
    for (const f of ['test', 'intrebari']) {
      await page.goto(`${BASE}/${f}.html`, { waitUntil: 'networkidle2' });
      const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, h1: document.querySelectorAll('h1').length,
        cur: document.querySelector('#nav-links a[aria-current="page"]')?.getAttribute('href') || null, css: document.querySelector('link[href*="styles.css"]').getAttribute('href') }));
      assert(r.sw <= r.iw && r.h1 === 1, `${label} ${f}: no overflow (${r.sw}/${r.iw}), one H1`);
      if (f === 'test') assert(r.cur === 'test.html', `${label} test: nav marks Test as current`);
    }
  }

  // ---------- meniul: un singur rând de la 1121px, Test după Începători ----------
  for (const w of [1121, 1280, 1440]) {
    await page.setViewport({ width: w, height: 800 });
    for (const f of ['index', 'test', 'lectie', 'contact']) {
      await page.goto(`${BASE}/${f}.html`, { waitUntil: 'networkidle2' });
      const n = await page.evaluate(() => {
        const ul = document.getElementById('nav-links'), lis = [...ul.children], logo = document.querySelector('.nav .logo').getBoundingClientRect();
        return { rows: new Set(lis.map(l => Math.round(l.getBoundingClientRect().top))).size, gap: ul.getBoundingClientRect().left - logo.right,
          right: ul.getBoundingClientRect().right, navRight: document.querySelector('.nav').getBoundingClientRect().right,
          labels: lis.map(l => l.textContent.trim()), toggle: getComputedStyle(document.querySelector('.menu-toggle')).display };
      });
      assert(n.rows === 1 && n.gap >= 24 && n.right <= n.navRight + 1 && n.toggle === 'none', `nav ${w} ${f}: one row, ${Math.round(n.gap)}px clear of logo`);
      if (w === 1280 && f === 'index') assert(JSON.stringify(n.labels) === JSON.stringify(['Începători', 'Test', 'Reguli', 'Patternuri', 'Sesiuni', 'Calendar', 'Jurnal', 'Calculator', 'Simulator', 'Despre', 'Broker', 'Contact']), 'nav order: Test right after Începători ' + n.labels.join(','));
    }
  }
  await page.setViewport({ width: 1120, height: 800 });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
  assert(await page.$eval('.menu-toggle', b => getComputedStyle(b).display !== 'none'), 'nav 1120: hamburger shown');
  await page.setViewport(MOB);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
  await page.click('.menu-toggle'); await sleep(500);
  const mm = await page.evaluate(() => { const ul = document.getElementById('nav-links'); const a = ul.querySelector('a[href="test.html"]'); const r = a.getBoundingClientRect();
    const last = [...ul.querySelectorAll('a')].pop(); ul.scrollTop = 1e5; const lr = last.getBoundingClientRect();
    return { n: ul.querySelectorAll('a').length, vis: r.height > 0 && getComputedStyle(a).visibility === 'visible', lastIn: lr.bottom <= innerHeight + 1 }; });
  assert(mm.n === 12 && mm.vis && mm.lastIn, `mobile menu: 12 links incl. Test, last reachable (${mm.n})`);

  // ---------- linkuri noi ----------
  for (const f of ['index', 'lectie', 'reguli', 'patternuri', 'sesiuni', 'calendar', 'jurnal', 'calculator', 'despre', 'broker', 'contact', 'test', 'intrebari', 'glosar']) {
    const t = fs.readFileSync(`${ROOT}/${f}.html`, 'utf8');
    const foot = t.slice(t.indexOf('<footer class="site-footer">'));
    const nav = t.slice(t.indexOf('<ul class="nav-links"'), t.indexOf('</ul>', t.indexOf('<ul class="nav-links"')));
    if (!(/href="test\.html"/.test(nav) && /href="test\.html">Test</.test(foot) && /href="intrebari\.html">Întrebări frecvente</.test(foot))) assert(false, `${f}: Test in nav + footer, Întrebări in footer`);
  }
  assert(true, 'all pages: Test in nav + footer, Întrebări frecvente in footer');
  const idx = fs.readFileSync(`${ROOT}/index.html`, 'utf8');
  assert(/class="feature-card" href="test\.html"/.test(idx) && /class="feature-card" href="intrebari\.html"/.test(idx), 'home: feature cards for Test + Întrebări');
  assert(/<aside class="lc-quiz-cta"[\s\S]*Verifică-ți cunoștințele[\s\S]*href="test\.html"/.test(lect), 'lectie: CTA "Verifică-ți cunoștințele" → test.html');
  assert(/href="intrebari\.html"/.test(fs.readFileSync(`${ROOT}/contact.html`, 'utf8').split('<main')[1].split('</main>')[0]), 'contact: link to Întrebări frecvente in page content');
  const sm = fs.readFileSync(`${ROOT}/sitemap.xml`, 'utf8');
  assert(sm.includes('/marius-fx/test.html</loc>') && sm.includes('/marius-fx/intrebari.html</loc>'), 'sitemap: test.html + intrebari.html');

  // ---------- fluxul testului ----------
  for (const [label, vp] of [['mobile', MOB], ['desktop', DESK]]) {
    await page.setViewport(vp);
    await page.goto(`${BASE}/test.html`, { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.removeItem('mfx-quiz-best'));
    await page.reload({ waitUntil: 'networkidle2' });
    let s = await page.evaluate(() => ({ best: document.getElementById('quiz-best').hidden, btn: !document.getElementById('quiz-start-btn').hidden, q: document.getElementById('quiz-q').hidden }));
    assert(s.best && s.btn && s.q, `${label}: start screen, no best score yet, start button visible`);

    // o încercare: răspunde corect la primele `nCorrect` întrebări; întoarce ordinea întrebărilor/variantelor
    const run = async (nCorrect, useKeys = false) => {
      const seq = [];
      for (let i = 0; i < 15; i++) {
        const st = await page.evaluate(() => ({ q: document.getElementById('quiz-question').textContent, opts: [...document.querySelectorAll('#quiz-options .quiz-opt-text')].map(o => o.textContent),
          count: document.getElementById('quiz-count').textContent, now: document.getElementById('quiz-bar').getAttribute('aria-valuenow'), focus: document.activeElement?.id }));
        seq.push(st);
        if (st.count !== `Întrebarea ${i + 1} din 15` || st.now !== String(i)) assert(false, `${label}: counter/progress before answer ${i + 1} (${st.count}, ${st.now})`);
        const ci = st.opts.indexOf(CORRECT.get(st.q));
        if (ci < 0) { assert(false, `${label}: correct option present for "${st.q}"`); return seq; }
        const pick = i < nCorrect ? ci : (ci + 1) % 4;
        if (useKeys) await page.keyboard.press('ABCD'[pick].toLowerCase()); else await page.click(`#quiz-options li:nth-child(${pick + 1}) .quiz-opt`);
        await sleep(60);
        const fb = await page.evaluate(() => ({ hidden: document.getElementById('quiz-feedback').hidden, cls: document.getElementById('quiz-feedback').className,
          verdict: document.querySelector('.quiz-verdict')?.textContent, link: document.querySelector('#quiz-feedback .quiz-ch-link')?.getAttribute('href'),
          ex: document.querySelector('.quiz-ex')?.textContent, disabled: [...document.querySelectorAll('.quiz-opt')].every(b => b.disabled),
          correctMarked: [...document.querySelectorAll('.quiz-opt')].findIndex(b => b.classList.contains('is-correct')), wrongMarked: [...document.querySelectorAll('.quiz-opt')].findIndex(b => b.classList.contains('is-wrong')),
          now: document.getElementById('quiz-bar').getAttribute('aria-valuenow'), focus: document.activeElement?.id, next: !document.getElementById('quiz-next').hidden }));
        const Q = BY_Q.get(st.q);
        const good = i < nCorrect;
        const okFb = !fb.hidden && fb.disabled && fb.next && fb.focus === 'quiz-next' && fb.now === String(i + 1) && fb.correctMarked === ci && fb.link === `lectie.html#cap-${Q.ch}` && fb.ex === Q.ex &&
          (good ? fb.verdict === 'Corect!' && /is-ok/.test(fb.cls) && fb.wrongMarked === -1 : fb.verdict.startsWith('Greșit. Răspunsul corect: ' + Q.a[0]) && /is-bad/.test(fb.cls) && fb.wrongMarked === pick);
        if (!okFb) assert(false, `${label}: feedback after answer ${i + 1} ${JSON.stringify(fb)}`);
        if (useKeys) await page.keyboard.press('Enter'); else await page.click('#quiz-next');
        await sleep(60); await settle(page);
      }
      return seq;
    };
    const result = () => page.evaluate(() => ({ shown: !document.getElementById('quiz-result').hidden, qHidden: document.getElementById('quiz-q').hidden,
      score: document.getElementById('quiz-score').textContent, pct: document.getElementById('quiz-pct').textContent, band: document.getElementById('quiz-result').dataset.band,
      bandText: document.getElementById('quiz-band').textContent, best: document.getElementById('quiz-best-result').textContent, title: document.getElementById('quiz-result-title').textContent,
      missed: [...document.querySelectorAll('.quiz-missed-list li')].map(li => ({ q: li.querySelector('.quiz-m-q').textContent, a: li.querySelector('b').textContent, href: li.querySelector('a').getAttribute('href') })),
      perfect: !!document.querySelector('.quiz-perfect'), focus: document.activeElement?.id, store: localStorage.getItem('mfx-quiz-best') }));

    await page.click('#quiz-start-btn'); await sleep(80);
    assert(await page.evaluate(() => document.activeElement?.id === 'quiz-question'), `${label}: focus moves to the question`);
    const seq1 = await run(9);
    let r = await result();
    assert(r.shown && r.qHidden && r.score === '9/15' && r.pct === '60%' && r.band === 'mid' && /^Bază bună/.test(r.bandText) && r.title === 'Ai răspuns corect la 9 din 15 întrebări', `${label}: 9/15 → 60%, middle band (${r.score} ${r.pct} ${r.band})`);
    assert(r.missed.length === 6 && r.missed.every(m => CORRECT.get(m.q) === m.a && m.href === `lectie.html#cap-${BY_Q.get(m.q).ch}`), `${label}: missed list (6) with correct answers + chapter links`);
    assert(JSON.parse(r.store).score === 9 && /9\/15 \(60%\)/.test(r.best) && r.focus === 'quiz-result-title', `${label}: best score saved (9) and shown; focus on result`);

    await page.click('#quiz-retry'); await sleep(80);
    const seq2 = await run(0);
    r = await result();
    assert(r.score === '0/15' && r.pct === '0%' && r.band === 'low' && /^Recitește capitolele/.test(r.bandText) && r.missed.length === 15, `${label}: retake 0/15 → low band, 15 missed`);
    assert(JSON.parse(r.store).score === 9 && /9\/15/.test(r.best) && !/record/.test(r.best), `${label}: lower score keeps best 9/15`);
    const o1 = seq1.map(x => x.q).join('|'), o2 = seq2.map(x => x.q).join('|');
    assert(o1 !== o2 && new Set(seq2.map(x => x.q)).size === 15, `${label}: retake shuffles question order (15 unique)`);
    const optsChanged = seq2.filter(x => { const y = seq1.find(z => z.q === x.q); return y.opts.join('|') !== x.opts.join('|'); }).length;
    assert(optsChanged >= 3 && seq2.every(x => { const y = seq1.find(z => z.q === x.q); return [...y.opts].sort().join('|') === [...x.opts].sort().join('|'); }), `${label}: options reshuffled (${optsChanged}/15 changed), same set`);

    await page.click('#quiz-retry'); await sleep(80);
    await run(15, label === 'desktop');       // pe desktop: doar tastatura (A-D + Enter)
    r = await result();
    assert(r.score === '15/15' && r.pct === '100%' && r.band === 'high' && /^Foarte bine/.test(r.bandText) && r.perfect && /record/.test(r.best) && JSON.parse(r.store).score === 15, `${label}: 15/15 → high band, new record saved${label === 'desktop' ? ' (keyboard only)' : ''}`);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    assert(sw, `${label}: result screen without horizontal overflow`);
    await page.reload({ waitUntil: 'networkidle2' });
    s = await page.evaluate(() => ({ hidden: document.getElementById('quiz-best').hidden, t: document.getElementById('quiz-best').textContent }));
    assert(!s.hidden && s.t === 'Cel mai bun scor al tău: 15/15 (100%)', `${label}: best score shown on start after reload ("${s.t}")`);
    // 13/15 = 87% → bandă de sus; 8/15 = 53% → jos
    await page.click('#quiz-start-btn'); await sleep(60); await run(13); r = await result();
    assert(r.pct === '87%' && r.band === 'high' && JSON.parse(r.store).score === 15, `${label}: 13/15 → 87% high band, best stays 15`);
    await page.click('#quiz-retry'); await sleep(60); await run(8); r = await result();
    assert(r.pct === '53%' && r.band === 'low', `${label}: 8/15 → 53% low band`);
  }
  // fără JS: mesaj noscript, butonul de start ascuns
  const p2 = await browser.newPage(); await p2.setJavaScriptEnabled(false);
  await p2.goto(`${BASE}/test.html`, { waitUntil: 'load' });
  const nj = await p2.evaluate(() => ({ ns: !!document.querySelector('.quiz-noscript'), btn: document.getElementById('quiz-start-btn').hidden, topics: document.querySelectorAll('.quiz-topics a').length }));
  assert(nj.ns && nj.btn && nj.topics === 8, 'no-JS: noscript note, no dead start button, 8 chapter links');
  await p2.close();

  // ---------- FAQ ----------
  for (const [label, vp] of [['desktop', DESK], ['mobile', MOB]]) {
    await page.setViewport(vp);
    await page.goto(`${BASE}/intrebari.html`, { waitUntil: 'networkidle2' });
    const f0 = await page.evaluate(() => ({ n: document.querySelectorAll('details.faq-item').length, open: document.querySelectorAll('details.faq-item[open]').length }));
    assert(f0.n >= 12 && f0.n <= 15 && f0.open === 0, `${label} FAQ: ${f0.n} questions, all closed`);
    await page.click('#taxe summary'); await sleep(150);
    let o = await page.evaluate(() => ({ open: document.getElementById('taxe').open, h: document.querySelector('#taxe .faq-a').getBoundingClientRect().height, sw: document.documentElement.scrollWidth, iw: innerWidth }));
    assert(o.open && o.h > 40 && o.sw <= o.iw, `${label} FAQ: click opens answer (${Math.round(o.h)}px), no overflow`);
    await page.click('#taxe summary'); await sleep(100);
    assert(!(await page.$eval('#taxe', d => d.open)), `${label} FAQ: click again closes`);
    await page.focus('#bani summary'); await page.keyboard.press('Enter'); await sleep(100);
    const k1 = await page.$eval('#bani', d => d.open);
    await page.keyboard.press('Space'); await sleep(100);
    const k2 = await page.$eval('#bani', d => d.open);
    assert(k1 && !k2, `${label} FAQ: keyboard Enter/Space toggles`);
  }
  // JSON-LD FAQPage = textul vizibil
  await page.goto(`${BASE}/intrebari.html`, { waitUntil: 'networkidle2' });
  const fq = await page.evaluate(() => {
    document.querySelectorAll('details.faq-item').forEach(d => d.open = true);
    const ld = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
    return { ld, vis: [...document.querySelectorAll('details.faq-item')].map(d => ({ q: d.querySelector('.faq-q').innerText, a: d.querySelector('.faq-a').innerText })),
      text: document.querySelector('main').innerText, links: [...document.querySelectorAll('main a')].map(a => a.getAttribute('href')) };
  });
  const faqNode = fq.ld['@graph'].find(g => g['@type'] === 'FAQPage');
  assert(faqNode && faqNode.url === 'https://mariusfx1.github.io/marius-fx/intrebari.html' && faqNode.mainEntity.length === fq.vis.length, `FAQ JSON-LD: FAQPage with ${faqNode && faqNode.mainEntity.length} questions`);
  const mism = faqNode.mainEntity.filter((e, i) => e['@type'] !== 'Question' || e.acceptedAnswer['@type'] !== 'Answer' || e.name !== norm(fq.vis[i].q) || e.acceptedAnswer.text !== norm(fq.vis[i].a));
  assert(mism.length === 0, `FAQ JSON-LD matches visible text exactly ${mism.map(m => m.name).join(' | ')}`);
  const T = fq.text;
  for (const [k, re] of [['demo first', /cont demo/], ['no promise', /Nu îți pot promite/], ['no signals', /nu dau semnale/], ['commission disclosure', /pot primi un comision/],
    ['regulation check', /reglementată/], ['ASF/ESMA', /ASF[\s\S]*ESMA|ESMA[\s\S]*ASF/], ['Declarația unică', /Declarația unică/], ['accountant', /contabil/], ['telegram', /t\.me\/FreeMariusFx/], ['email', /contact\.mariusfx@gmail\.com/]])
    assert(re.test(T), `FAQ content: ${k}`);
  for (const h of ['broker.html', 'https://t.me/FreeMariusFx', 'mailto:contact.mariusfx@gmail.com', 'lectie.html', 'test.html', 'contact.html']) if (!fq.links.includes(h)) assert(false, `FAQ links to ${h}`);
  assert(!/(garant|sigur vei câștiga|profit garantat)/i.test(T.replace(/Nu există o garanție/, '')), 'FAQ: no guarantees / promises');

  assert(errors.length === 0, 'no console/page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})();
