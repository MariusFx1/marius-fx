// Test: calculatorul risk/reward (calculator.html) + glosarul (glosar.html) + linkuri noi; patternuri.html neatins
const puppeteer = require('puppeteer-core');
const fs = require('fs'), { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:8765';
const ROOT = '/workspace/forex-ms';
const LIVE = /github\.io/.test(BASE);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const assert = (c, m) => { if (!c) { fails++; console.error('FAIL:', m); } else console.log('ok  -', m); };
const DESK = { width: 1280, height: 900 };
const MOB = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const isThirdParty = t => /tradingview|google|gstatic|fonts\.|favicon/i.test(t);
const norm = s => s.replace(/\s+/g, ' ').trim();
const settle = async p => { let last = -1; for (let i = 0; i < 60; i++) { const y = await p.evaluate(() => scrollY); if (y === last) return; last = y; await sleep(60); } };
const roNum = t => Number(String(t).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
const CASES = JSON.parse(fs.readFileSync(__dirname + '/rr_cases.json', 'utf8'));   // calculate independent în Python (rr_cases.py)

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(page.url() + ' :: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !isThirdParty(m.text() + (m.location()?.url || ''))) errors.push(page.url() + ' :: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !isThirdParty(r.url())) errors.push(r.status() + ' ' + r.url()); });
  const set = (id, v) => page.$eval('#' + id, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, String(v));
  const read = () => page.evaluate(() => {
    const t = id => document.getElementById(id).textContent.trim();
    return { err: document.getElementById('rr-error').hidden ? '' : t('rr-error'), sl: t('rr-sl-pips'), tp: t('rr-tp-pips'), rr: t('rr-raport'), lot: t('rr-loturi'),
      risk: t('rr-risc-suma'), profit: t('rr-profit'), be: t('rr-be'), nota: t('rr-nota'), state: document.getElementById('rr-form').dataset.state,
      invalid: [...document.querySelectorAll('#rr-form [aria-invalid="true"]')].map(e => e.id), sell: document.getElementById('rr-visual').classList.contains('is-sell'),
      gTp: document.getElementById('rr-zone-tp').style.flexGrow, gSl: document.getElementById('rr-zone-sl').style.flexGrow,
      sw: document.documentElement.scrollWidth, iw: innerWidth };
  });
  const fill = async (c, commas) => {
    const f = x => commas ? String(x).replace('.', ',') : String(x);
    await page.select('#rr-pereche', c.pair);
    await page.click(`input[name="rr-dir"][value="${c.dir}"]`);
    await page.select('#rr-moneda', c.ccy);
    await set('rr-intrare', f(c.entry)); await set('rr-sl', f(c.sl)); await set('rr-tp', f(c.tp)); await set('rr-sold', c.bal); await set('rr-risc', f(c.risk));
    await sleep(30);
  };

  // ---------- calculator: tab-uri ----------
  for (const [label, vp] of [['desktop', DESK], ['mobile', MOB]]) {
    await page.setViewport(vp);
    await page.goto(`${BASE}/calculator.html`, { waitUntil: 'networkidle2' });
    let t = await page.evaluate(() => ({ tl: !document.querySelector('.calc-tabs').hidden, lot: !document.getElementById('panel-lot').hidden, rr: !document.getElementById('risc-recompensa').hidden,
      sel: document.getElementById('tab-lot').getAttribute('aria-selected'), role: document.getElementById('risc-recompensa').getAttribute('role'), h1: document.querySelector('h1').textContent,
      lotv: document.getElementById('loturi').textContent }));
    assert(t.tl && t.lot && !t.rr && t.sel === 'true' && t.role === 'tabpanel' && t.h1 === 'Calculator de lot Forex' && /\d/.test(t.lotv), `${label}: tabs shown, Lot tab active by default, lot calculator still works (${t.lotv})`);
    await page.click('#tab-rr'); await sleep(50);
    t = await page.evaluate(() => ({ lot: document.getElementById('panel-lot').hidden, rr: !document.getElementById('risc-recompensa').hidden, hash: location.hash, sel: document.getElementById('tab-rr').getAttribute('aria-selected') }));
    assert(t.lot && t.rr && t.hash === '#risc-recompensa' && t.sel === 'true', `${label}: click Risk/Reward shows R:R panel, hash #risc-recompensa`);
    await page.focus('#tab-rr'); await page.keyboard.press('ArrowLeft'); await sleep(50);
    t = await page.evaluate(() => ({ lot: !document.getElementById('panel-lot').hidden, f: document.activeElement.id }));
    assert(t.lot && t.f === 'tab-lot', `${label}: arrow keys switch tabs and move focus`);
    await page.goto(`${BASE}/calculator.html#risc-recompensa`, { waitUntil: 'networkidle2' });
    assert(await page.$eval('#risc-recompensa', e => !e.hidden), `${label}: deep link #risc-recompensa opens the R:R tab`);
    let r = await read();
    assert(r.state === 'ok' && r.sl === '25' && r.tp === '50' && r.rr === '1:2' && r.be === '33,3%', `${label}: default example EURUSD buy 25/50 pips → 1:2, 33,3%`);
    assert(r.sw <= r.iw, `${label}: calculator without horizontal overflow`);

    // ---------- cazuri numerice verificate în Python ----------
    for (const [i, C] of CASES.entries()) {
      await fill(C.input, i % 2 === 1);
      r = await read();
      const ok = r.state === 'ok' && roNum(r.sl) === C.sl_pips && roNum(r.tp) === C.tp_pips && roNum(r.lot) === C.lot &&
        Math.abs(roNum(r.risk) - C.risked) < 0.006 && Math.abs(roNum(r.profit) - C.profit) < 0.006 &&
        Math.abs(roNum(r.rr.split(':')[1]) - Number(C.rr.split(':')[1])) < 0.006 && r.be === C.be.replace('.', ',') &&
        r.risk.includes(C.input.ccy) && r.sell === (C.input.dir === 'sell');
      assert(ok, `${label}: ${C.case}${i % 2 ? ' (comma decimals)' : ''} → SL ${r.sl}, TP ${r.tp}, ${r.rr}, lot ${r.lot}, risk ${r.risk}, profit ${r.profit}, BE ${r.be} | python: ${C.sl_pips}/${C.tp_pips} ${C.rr} lot ${C.lot} ${C.risked}/${C.profit} ${C.be}`);
      if (C.case.startsWith('XAUUSD')) assert(/XAUUSD: 1 lot = 100 oz, 1 pip = 0,10/.test(r.nota), `${label}: gold pip convention shown in note`);
      if (C.case.startsWith('USDJPY')) assert(/JPY, 1 pip = 0,01/.test(r.nota), `${label}: JPY pip convention shown in note`);
      if (C.case.startsWith('EURJPY')) assert(/Ținta de risc este 120,00/.test(r.nota) && Number(r.gTp) > Number(r.gSl), `${label}: floored-lot note + visual zones proportional (TP ${r.gTp} > SL ${r.gSl})`);
    }

    // ---------- validare ----------
    const base = { pair: 'EURUSD', dir: 'buy', ccy: 'USD', entry: '1.1200', sl: '1.1175', tp: '1.1250', bal: '10000', risk: '1' };
    const V = [
      [{ sl: '1.1230' }, 'La Buy, stop loss-ul trebuie să fie sub prețul de intrare.', 'rr-sl'],
      [{ tp: '1.1150' }, 'La Buy, take profit-ul trebuie să fie deasupra prețului de intrare.', 'rr-tp'],
      [{ dir: 'sell', sl: '1.1175', tp: '1.1150' }, 'La Sell, stop loss-ul trebuie să fie deasupra prețului de intrare.', 'rr-sl'],
      [{ dir: 'sell', sl: '1.1230', tp: '1.1250' }, 'La Sell, take profit-ul trebuie să fie sub prețul de intrare.', 'rr-tp'],
      [{ sl: '1.1200' }, 'Stop loss-ul nu poate fi egal cu prețul de intrare.', 'rr-sl'],
      [{ entry: '' }, 'Completează toate câmpurile: intrarea, stop loss-ul, take profit-ul, soldul și riscul %.', 'rr-intrare'],
      [{ entry: 'abc' }, 'Prețul de intrare nu este un număr valid. Exemplu: 1,1200 sau 1.1200.', 'rr-intrare'],
      [{ sl: '1,1,1' }, 'Stop loss-ul nu este un preț valid. Scrie prețul, nu numărul de pips (exemplu: 1,1175).', 'rr-sl'],
      [{ bal: '0' }, 'Soldul contului trebuie să fie un număr mai mare decât 0.', 'rr-sold'],
      [{ risk: '0' }, 'Riscul % trebuie să fie între 0 și 100 (de exemplu 1 sau 0,5).', 'rr-risc'],
      [{ risk: '150' }, 'Riscul % trebuie să fie între 0 și 100 (de exemplu 1 sau 0,5).', 'rr-risc'],
    ];
    for (const [over, msg, field] of V) {
      const c = { ...base, ...over };
      await page.select('#rr-pereche', 'EURUSD'); await page.select('#rr-moneda', 'USD');
      await page.$eval(`input[name="rr-dir"][value="${c.dir}"]`, e => { e.checked = true; });
      await set('rr-intrare', c.entry); await set('rr-sl', c.sl); await set('rr-tp', c.tp); await set('rr-sold', c.bal); await set('rr-risc', c.risk);
      r = await read();
      assert(r.err === msg && r.state === 'error' && r.invalid.includes(field) && [r.sl, r.tp, r.rr, r.lot, r.risk, r.profit, r.be].every(x => x === '—'), `${label}: validation "${msg}" (${field})`);
    }
    // corectarea erorii o face să dispară
    await set('rr-intrare', '1,1200'); await set('rr-sl', '1,1175'); await set('rr-tp', '1,1250'); await set('rr-sold', '10.000'); await set('rr-risc', '1');
    await page.$eval('input[name="rr-dir"][value="buy"]', e => { e.checked = true; }); await set('rr-risc', '1');
    r = await read();
    assert(r.err === '' && r.invalid.length === 0 && r.lot === '0,40' && r.risk.startsWith('100,00'), `${label}: fixing the input clears the error (1,1200 / 10.000 parsed)`);
    // schimbarea direcției oglindește SL/TP
    await page.click('input[name="rr-dir"][value="sell"]'); await sleep(30);
    const mir = await page.evaluate(() => [document.getElementById('rr-sl').value, document.getElementById('rr-tp').value]);
    r = await read();
    assert(mir[0] === '1,1225' && mir[1] === '1,1150' && r.state === 'ok' && r.rr === '1:2', `${label}: Buy→Sell mirrors SL/TP around entry (${mir})`);
    await page.click('input[name="rr-dir"][value="buy"]'); await sleep(30);
    // perechea nouă: valori de pornire coerente
    await page.select('#rr-pereche', 'XAUUSD'); await sleep(30);
    const xv = await page.evaluate(() => ['rr-intrare', 'rr-sl', 'rr-tp'].map(id => document.getElementById(id).value));
    r = await read();
    assert(JSON.stringify(xv) === '["4150.00","4147.50","4155.00"]' && r.sl === '25' && r.tp === '50', `${label}: XAUUSD preset ${xv} → 25/50 pips`);
    // lot sub 0,01
    await page.select('#rr-pereche', 'EURUSD'); await set('rr-sold', '100'); await set('rr-risc', '1'); await set('rr-intrare', '1.1200'); await set('rr-sl', '1.1100'); await set('rr-tp', '1.1400');
    r = await read();
    assert(r.lot === '0,00' && /sub 0,01/.test(r.nota), `${label}: lot under 0,01 → 0,00 + explanation`);
    await set('rr-risc', '3'); r = await read();
    assert(/peste 2% risc/.test(r.nota), `${label}: warning above 2% risk`);
    assert((await read()).sw <= vp.width, `${label}: no overflow after interactions`);
  }
  // fără JS: ambele panouri vizibile, fără tab-uri
  const p2 = await browser.newPage(); await p2.setJavaScriptEnabled(false);
  await p2.goto(`${BASE}/calculator.html`, { waitUntil: 'load' });
  const nj = await p2.evaluate(() => ({ tl: getComputedStyle(document.querySelector('.calc-tabs')).display, a: getComputedStyle(document.getElementById('panel-lot')).display, b: getComputedStyle(document.getElementById('risc-recompensa')).display }));
  assert(nj.tl === 'none' && nj.a !== 'none' && nj.b !== 'none', 'no-JS: both calculators visible, tabs hidden');
  await p2.close(); await page.bringToFront();

  // ---------- glosar ----------
  for (const [label, vp] of [['desktop', DESK], ['mobile', MOB]]) {
    await page.setViewport(vp);
    await page.goto(`${BASE}/glosar.html`, { waitUntil: 'networkidle2' });
    const g = await page.evaluate(() => {
      const names = [...document.querySelectorAll('.gl-term dt')].map(d => d.textContent.trim());
      const coll = new Intl.Collator('ro', { sensitivity: 'base' });
      const sorted = [...names].sort(coll.compare);
      return { n: names.length, names, ordered: JSON.stringify(sorted) === JSON.stringify(names), az: document.querySelectorAll('.gl-az > *').length,
        azLinks: [...document.querySelectorAll('.gl-az a')].map(a => a.getAttribute('href')), groups: [...document.querySelectorAll('.gl-group')].map(s => '#' + s.id),
        count: document.getElementById('gl-count').textContent, tools: !document.getElementById('gl-tools').hidden, sw: document.documentElement.scrollWidth, iw: innerWidth,
        h1: document.querySelector('h1').textContent };
    });
    assert(g.n >= 40 && g.n <= 60 && g.ordered, `${label} glossary: ${g.n} terms in Romanian alphabetical order`);
    const need = ['Pip', 'Punct', 'Lot', 'Spread', 'Swap', 'Comision', 'Levier', 'Marjă', 'Margin call', 'Stop out', 'Equity', 'Sold', 'Drawdown', 'Stop loss', 'Take profit', 'Trailing stop', 'Break-even', 'R:R', 'Managementul riscului', 'Ordin market', 'Ordin limit', 'Ordin stop', 'Slippage', 'Gap', 'Bid și ask', 'Pereche majoră', 'Pereche minoră', 'Pereche exotică', 'Valută de bază', 'Long și short', 'Bullish', 'Bearish', 'Trend', 'Suport', 'Rezistență', 'Breakout', 'Retest', 'Lumânare', 'Timeframe', 'Volatilitate', 'Lichiditate', 'Sesiune', 'NFP', 'CPI', 'Bancă centrală', 'CFD', 'Broker', 'ECN', 'Cont demo', 'Backtest', 'Jurnal', 'Overtrading', 'FOMO', 'Revenge trading', 'Swing trading', 'Scalping', 'Day trading', 'ESMA', 'sold negativ'];
    const missing = need.filter(k => !g.names.some(n => n.includes(k)));
    assert(missing.length === 0, `${label} glossary: all requested terms present ${missing}`);
    assert(g.az === 26 && JSON.stringify(g.azLinks) === JSON.stringify(g.groups), `${label} glossary: A-Z bar (26 letters), links = letter sections (${g.azLinks.length})`);
    assert(g.tools && g.count === `${g.n} de termeni` && g.sw <= g.iw && g.h1 === 'Glosar Forex: termeni explicați simplu', `${label} glossary: search shown, count, H1, no overflow`);
    await page.click('.gl-az a[href="#litera-s"]'); await sleep(150); await settle(page);
    const { top, azB, h } = await page.evaluate(() => ({ top: document.querySelector('#litera-s').getBoundingClientRect().top, azB: document.querySelector('.gl-az').getBoundingClientRect().bottom, h: location.hash }));
    assert(h === '#litera-s' && top >= azB - 2 && top < azB + 90, `${label} glossary: A-Z "S" jumps to section, not hidden under sticky bar (top ${Math.round(top)}px, bar ends ${Math.round(azB)}px)`);
    await page.evaluate(() => scrollTo(0, 0));
    await page.type('#gl-q', 'marja'); await sleep(80);
    let s = await page.evaluate(() => ({ vis: [...document.querySelectorAll('.gl-term:not([hidden]) dt')].map(d => d.textContent), count: document.getElementById('gl-count').textContent,
      offLinks: [...document.querySelectorAll('.gl-az a.is-off')].length, groupsVis: [...document.querySelectorAll('.gl-group:not([hidden])')].length, empty: document.getElementById('gl-empty').hidden }));
    assert(s.vis.includes('Marjă') && s.vis.includes('Margin call') && s.vis.length < g.n && s.count === `${s.vis.length} termeni găsiți din ${g.n}` && s.offLinks > 0 && s.empty, `${label} glossary: search "marja" (no diacritics) → ${s.vis.length} terms, letters without hits disabled`);
    await page.click('#gl-q', { clickCount: 3 }); await page.type('#gl-q', 'stop loss'); await sleep(80);
    s = await page.evaluate(() => [...document.querySelectorAll('.gl-term:not([hidden]) dt')].map(d => d.textContent));
    assert(s.includes('Stop loss (SL)') && s.includes('Trailing stop'), `${label} glossary: multi-word search "stop loss" (${s.length})`);
    await page.click('#gl-q', { clickCount: 3 }); await page.type('#gl-q', 'zzqx'); await sleep(80);
    s = await page.evaluate(() => ({ empty: !document.getElementById('gl-empty').hidden, count: document.getElementById('gl-count').textContent, groups: document.querySelectorAll('.gl-group:not([hidden])').length, on: document.querySelectorAll('.gl-az a:not(.is-off)').length }));
    assert(s.empty && s.count === 'Niciun rezultat' && s.groups === 0 && s.on === 0, `${label} glossary: no-match state`);
    await page.focus('#gl-q'); await page.keyboard.press('Escape'); await sleep(80);
    s = await page.evaluate(() => ({ v: document.getElementById('gl-q').value, n: document.querySelectorAll('.gl-term:not([hidden])').length }));
    assert(s.v === '' && s.n === g.n, `${label} glossary: Escape clears search`);
  }
  await page.goto(`${BASE}/glosar.html?q=fomo`, { waitUntil: 'networkidle2' });
  assert(await page.evaluate(() => [...document.querySelectorAll('.gl-term:not([hidden]) dt')].map(d => d.textContent).join() === 'FOMO'), 'glossary: ?q=fomo pre-fills the search');
  // JSON-LD + linkuri din definiții
  const gl = await page.evaluate(() => {
    const ld = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
    const terms = [...document.querySelectorAll('.gl-term')].map(t => ({ id: t.id, n: t.querySelector('dt').innerText, d: t.querySelector('dd').innerText }));
    const hrefs = [...document.querySelectorAll('.gl-term dd a')].map(a => a.getAttribute('href'));
    return { ld, terms, hrefs };
  });
  const set_ = gl.ld['@graph'].find(x => x['@type'] === 'DefinedTermSet');
  const bad = set_ ? set_.hasDefinedTerm.filter((d, i) => d['@type'] !== 'DefinedTerm' || d.name !== norm(gl.terms[i].n) || d.description !== norm(gl.terms[i].d) || !d['@id'].endsWith('#' + gl.terms[i].id) || d.inDefinedTermSet['@id'] !== set_['@id']) : ['none'];
  assert(set_ && set_.hasDefinedTerm.length === gl.terms.length && bad.length === 0, `glossary JSON-LD: DefinedTermSet with ${set_ && set_.hasDefinedTerm.length} DefinedTerms matching visible text`);
  const brokenLinks = [];
  for (const h of new Set(gl.hrefs)) {
    const [file, anchor] = h.split('#');
    if (!fs.existsSync(`${ROOT}/${file}`)) { brokenLinks.push(h); continue; }
    if (anchor && !fs.readFileSync(`${ROOT}/${file}`, 'utf8').includes(`id="${anchor}"`)) brokenLinks.push(h);
  }
  assert(gl.hrefs.length >= 30 && brokenLinks.length === 0, `glossary: ${gl.hrefs.length} links in definitions, all files/anchors exist ${brokenLinks}`);
  for (const k of ['lectie.html#cap-3', 'calculator.html', 'calculator.html#risc-recompensa', 'sesiuni.html', 'calendar.html', 'patternuri.html', 'jurnal.html'])
    if (!gl.hrefs.includes(k)) assert(false, `glossary links to ${k}`);

  // ---------- linkuri + fișiere ----------
  for (const f of ['glosar.html', 'glosar.js', 'rr.js']) {
    let t = fs.readFileSync(`${ROOT}/${f}`, 'utf8');
    if (f === 'rr.js') t = t.replace(/'—'/g, '');
    assert(!/[—–]/.test(t) && !/[şţŞŢ]/.test(t), `${f}: no em/en dashes, comma-below diacritics`);
  }
  const calcHtml = fs.readFileSync(`${ROOT}/calculator.html`, 'utf8');
  const rrPanel = calcHtml.slice(calcHtml.indexOf('id="risc-recompensa"'), calcHtml.indexOf('</section>', calcHtml.indexOf('id="risc-recompensa"')));
  assert(!/[–]|—(?!<\/output>)/.test(rrPanel), 'calculator R:R panel text: no dashes (except empty-value placeholders)');
  const html = f => fs.readFileSync(`${ROOT}/${f}.html`, 'utf8');
  const foot = t => t.slice(t.indexOf('<footer class="site-footer">'));
  const noGl = ['index', 'lectie', 'test', 'reguli', 'sesiuni', 'calendar', 'jurnal', 'calculator', 'despre', 'broker', 'contact', 'intrebari', 'glosar'].filter(f => !/href="glosar\.html">Glosar</.test(foot(html(f)).split('aria-label="Instrumente"')[0]));
  assert(noGl.length === 0, `footer "Învață" links to Glosar on all pages except patternuri ${noGl}`);
  assert(/class="feature-card" href="glosar\.html"/.test(html('index')), 'home: Glosar card');
  assert(/lc-toc-gloss[\s\S]*href="glosar\.html"/.test(html('lectie')) && /lc-gloss-note[\s\S]*href="glosar\.html"/.test(html('lectie')), 'lectie: glossary links (table of contents + end of lesson)');
  assert(/faq-aside[\s\S]*href="glosar\.html"/.test(html('intrebari')), 'intrebari: glossary link in sidebar');
  assert(/<loc>https:\/\/mariusfx1\.github\.io\/marius-fx\/glosar\.html<\/loc>/.test(fs.readFileSync(`${ROOT}/sitemap.xml`, 'utf8')), 'sitemap: glosar.html');
  assert(html('index').includes('<meta name="google-site-verification" content="O7g1XoiifBLTrr8a1nMvz4BTCeQoflJg5ez10yfZFzg" />'), 'index: Google verification tag kept');
  if (!LIVE) {
    // conținutul nu se schimbă; sunt permise doar meniul/subsolul (Simulator) și versiunile CSS/JS
    const lines = execSync('git diff 955b134 -- patternuri.html', { cwd: ROOT }).toString().split('\n').filter(l => /^[-+][^-+]/.test(l));
    const okLine = l => /styles\.css\?v=\d+|script\.js\?v=\d+|<li><a href="simulator\.html">Simulator<\/a><\/li>|i18n:|rel="alternate" hreflang=|i18n\.js\?v=|i18n\/\w+\.js\?v=|fonts\.googleapis\.com|fonts\.gstatic\.com|fonts\/manrope-latin\.woff2/.test(l) || /MS Prime|MS <b>Prime<\/b>|Marius FX|Marius <b>FX<\/b>|og-image\.png|\.png\?v=1[56]|favicon\.ico\?v=1[56]|site\.webmanifest\?v=1[56]/.test(l);
    const imgs = (execSync('git status --porcelain -- images/', { cwd: ROOT }).toString() + execSync('git diff --stat 955b134 -- images/', { cwd: ROOT }).toString()).split('\n').filter(x => x.trim() && !/images\/flags\/|images\/masina-\d-\d+\.(webp|avif)|images\/jurnal-sablon-preview\.png|images\/CITESTE-MA\.txt|files? changed/.test(x)).join('\n');
    assert(lines.every(okLine) && imgs === '', 'patternuri.html content (and pattern images) unchanged: only nav/footer link + asset versions' + (lines.every(okLine) ? '' : ' ' + lines.filter(l => !okLine(l)).join(' | ')));
  }
  // meniul: 12 linkuri (cu Simulator), un rând de la 1121px
  await page.setViewport({ width: 1121, height: 800 });
  for (const f of ['glosar', 'calculator']) {
    await page.goto(`${BASE}/${f}.html`, { waitUntil: 'networkidle2' });
    const n = await page.evaluate(() => { const lis = [...document.querySelectorAll('#nav-links > li')]; return { n: lis.length, rows: new Set(lis.map(l => Math.round(l.getBoundingClientRect().top))).size }; });
    assert(n.n === 12 && n.rows === 1, `nav 1121 ${f}: 12 items on one row`);
  }
  assert(errors.length === 0, 'no console/page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})();
