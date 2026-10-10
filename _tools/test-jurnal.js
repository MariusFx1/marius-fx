const puppeteer = require('puppeteer-core');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:8765/jurnal.html';
const DL = '/tmp/jt-dl';
const SHOTS = '/workspace/forex-ms/screenshots';
const log = (...a) => console.log(...a);
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else log('ok  -', m); };

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const requests = [];
  page.on('request', r => requests.push(r.method() + ' ' + r.url()));
  let dialogAnswer = true;
  const dialogs = [];
  page.on('dialog', async d => { dialogs.push(d.message()); dialogAnswer ? await d.accept() : await d.dismiss(); });
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });

  assert(await page.$eval('#jt-empty', e => !e.hidden), 'empty state visible on fresh load');
  assert((await page.$$('.jt-item')).length === 0, 'no pre-filled trades');
  assert((await page.$$('.slot, .journal')).length === 0, 'old screenshot cards removed');
  await page.screenshot({ path: `${SHOTS}/jurnal-mobile-empty.png`, fullPage: false });

  // validation
  await page.click('#jt-submit');
  assert(await page.$eval('#jt-form-error', e => !e.hidden && /perechea/.test(e.textContent)), 'validation error when pair/direction missing');

  async function addTrade(t) {
    await page.$eval('#jt-data', (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, t.data);
    if (t.alta) { await page.select('#jt-pereche', '__alta'); await page.type('#jt-pereche-alta', t.alta); }
    else await page.select('#jt-pereche', t.pereche);
    await page.click(`input[name="directie"][value="${t.dir}"] + span`);
    if (t.ses) await page.select('#jt-sesiune', t.ses);
    for (const [id, v] of [['#jt-intrare', t.in], ['#jt-sl', t.sl], ['#jt-tp', t.tp]]) if (v) { await page.click(id, { clickCount: 3 }); await page.type(id, v); }
    if (t.rez) await page.select('#jt-rezultat', t.rez);
    if (t.r != null) { await page.click('#jt-r', { clickCount: 3 }); await page.type('#jt-r', t.r); }
    if (t.plan) await page.click(`input[name="plan"][value="${t.plan}"] + span`);
    if (t.setup || t.emotii || t.lectie || t.lot) {
      const open = await page.$eval('#jt-more', e => e.open);
      if (!open) await page.click('#jt-more summary');
      if (t.setup) await page.type('#jt-setup', t.setup);
      if (t.lot) await page.type('#jt-lot', t.lot);
      if (t.risc) await page.type('#jt-risc', t.risc);
      if (t.emotii) await page.type('#jt-emotii', t.emotii);
      if (t.lectie) await page.type('#jt-lectie', t.lectie);
    }
    const rBefore = await page.$eval('#jt-r', e => e.value);
    await page.click('#jt-submit');
    await new Promise(r => setTimeout(r, 150));
    return rBefore;
  }
  const r1 = await addTrade({ data: '2026-09-28', pereche: 'EURUSD', dir: 'Buy', ses: 'Londra', in: '1.08500', sl: '1.08300', tp: '1.08900', rez: 'TP', plan: 'Da',
    setup: 'Retest suport H4 — confirmare pin bar', lot: '0,10', risc: '1', emotii: 'calm, răbdare', lectie: 'Așteaptă închiderea lumânării; țintă clară, fără grabă (ș ț ă î â)' });
  assert(r1 === '2', 'auto R for TP = planned R:R (2), got ' + r1);
  const r2 = await addTrade({ data: '2026-09-29', pereche: 'GBPJPY', dir: 'Sell', ses: 'Tokyo', in: '191,500', sl: '192,000', tp: '190,250', rez: 'SL', plan: 'Nu', emotii: 'FOMO' });
  assert(r2 === '-1', 'auto R for SL = -1, got ' + r2);
  const r3 = await addTrade({ data: '2026-09-30', pereche: 'XAUUSD', dir: 'Buy', ses: 'New York', in: '2350.5', sl: '2345.5', tp: '2365.5', rez: 'BE', plan: 'Da' });
  assert(r3 === '0', 'auto R for BE = 0, got ' + r3);
  await addTrade({ data: '2026-10-01', alta: 'eurpln', dir: 'Sell', ses: 'Londra', rez: 'Manual', r: '0,6' });

  const stats = async () => page.$$eval('[data-stat]', els => Object.fromEntries(els.map(e => [e.dataset.stat, e.textContent])));
  let s = await stats();
  log(s);
  assert(s.total === '4' && s.castigate === '2' && s.pierdute === '1', 'counts 4/2/1');
  assert(s.rata === '50%', 'win rate 50%');
  assert(s.totalR === '+1,6R' && s.rMediu === '+0,4R', 'total R +1,6R, avg +0,4R');
  assert(s.plan === '66,7%', 'plan respected 66,7%');
  const pairs = await page.$$eval('.jt-pair', els => els.map(e => e.textContent));
  assert(JSON.stringify(pairs) === JSON.stringify(['EURPLN', 'XAUUSD', 'GBPJPY', 'EURUSD']), 'list sorted newest first, custom pair uppercased: ' + pairs);

  // edit GBPJPY → Manual, -0,5R, plan Da
  await page.click('.jt-item[data-id] :is(.jt-act)[data-act="edit"]').catch(() => {});
  const ids = await page.$$eval('.jt-item', els => els.map(e => [e.dataset.id, e.querySelector('.jt-pair').textContent]));
  const gbp = ids.find(x => x[1] === 'GBPJPY')[0];
  await page.evaluate(() => document.getElementById('jt-cancel').click());
  await page.click(`.jt-item[data-id="${gbp}"] [data-act="edit"]`);
  await new Promise(r => setTimeout(r, 400));
  assert(await page.$eval('#jt-pereche', e => e.value) === 'GBPJPY' && await page.$eval('#jt-intrare', e => e.value) === '191.500', 'edit form prefilled');
  await page.screenshot({ path: `${SHOTS}/jurnal-mobile-editing.png` });
  await page.select('#jt-rezultat', 'Manual');
  await page.type('#jt-r', '-0,5');
  await page.click('input[name="plan"][value="Da"] + span');
  await page.click('#jt-submit');
  await new Promise(r => setTimeout(r, 150));
  s = await stats(); log(s);
  assert(s.total === '4' && s.totalR === '+2,1R' && s.plan === '100%', 'after edit: total R +2,1R, plan 100%');

  // delete: dismiss first, then accept
  const xau = ids.find(x => x[1] === 'XAUUSD')[0];
  dialogAnswer = false;
  await page.click(`.jt-item[data-id="${xau}"] [data-act="delete"]`);
  assert((await page.$$('.jt-item')).length === 4, 'cancelled delete keeps trade');
  dialogAnswer = true;
  await page.click(`.jt-item[data-id="${xau}"] [data-act="delete"]`);
  assert((await page.$$('.jt-item')).length === 3, 'confirmed delete removes trade');
  assert(dialogs.some(d => /Ștergi tranzacția din 30\.09\.2026 \(XAUUSD\)/.test(d)), 'delete asks for confirmation');

  // reload persists
  await page.reload({ waitUntil: 'networkidle0' });
  s = await stats(); log(s);
  assert((await page.$$('.jt-item')).length === 3 && s.total === '3', 'reload keeps 3 trades');
  assert(s.castigate === '2' && s.pierdute === '1' && s.rata === '66,7%' && s.totalR === '+2,1R' && s.rMediu === '+0,7R', 'stats after delete+reload correct');

  // list screenshot (mobile cards)
  await page.evaluate(() => document.querySelector('.jt-list-head').scrollIntoView()); await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: `${SHOTS}/jurnal-mobile-list.png` });
  // screenshots with data
  await page.evaluate(() => window.scrollTo(0, 0)); await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: `${SHOTS}/jurnal-mobile.png`, fullPage: false });
  await page.evaluate(() => document.querySelector('.jt-preview').scrollIntoView()); await new Promise(r => setTimeout(r, 800));
  assert(await page.$eval('.jt-preview img', i => i.complete && i.naturalWidth === 1600), 'template preview image loads');
  await page.click('.jt-preview');
  await new Promise(r => setTimeout(r, 400));
  assert(await page.$eval('#lightbox', d => d.open && d.querySelector('img').src.includes('jurnal-sablon-preview')), 'preview opens in lightbox');
  await page.screenshot({ path: `${SHOTS}/jurnal-mobile-lightbox.png` });
  await page.click('.lightbox-close');
  assert(await page.$eval('#lightbox', d => !d.open), 'lightbox closes');
  const dl = await page.$$eval('.jt-download-cta a', as => as.map(a => [a.textContent, a.getAttribute('href'), a.getAttribute('download')]));
  log(dl);
  assert(dl.length === 2 && dl.every(x => x[2]), 'two download links with download attribute');
  await page.evaluate(() => window.scrollTo(0, 0)); await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: `${SHOTS}/jurnal-mobile-full.png`, fullPage: true });

  // export xlsx + json
  await page.click('#jt-export-xlsx');
  await page.click('#jt-export-json');
  await new Promise(r => setTimeout(r, 1500));
  const files = fs.readdirSync(DL);
  log('downloads:', files);
  assert(files.some(f => /^jurnal-marius-fx-\d{4}-\d{2}-\d{2}\.xlsx$/.test(f)), 'xlsx exported');
  const backup = files.find(f => /backup.*\.json$/.test(f));
  assert(backup, 'json backup exported');

  // clear all
  await page.click('#jt-clear');
  assert((await page.$$('.jt-item')).length === 0 && await page.$eval('#jt-empty', e => !e.hidden), 'Șterge tot empties journal');
  assert(dialogs.some(d => /TOATE cele 3/.test(d)), 'Șterge tot asked for confirmation');

  // import restores
  const input = await page.$('#jt-import');
  await input.uploadFile(`${DL}/${backup}`);
  await new Promise(r => setTimeout(r, 500));
  s = await stats(); log(s, await page.$eval('#jt-status', e => e.textContent));
  assert((await page.$$('.jt-item')).length === 3 && s.totalR === '+2,1R', 'import restores 3 trades');
  const lesson = await page.$$eval('.jt-notes-text p', ps => ps.map(p => p.textContent).join(' | '));
  assert(/Așteaptă închiderea lumânării; țintă clară/.test(lesson), 'diacritics preserved through backup');
  await input.uploadFile(`${DL}/${backup}`);
  await new Promise(r => setTimeout(r, 500));
  assert((await page.$$('.jt-item')).length === 3, 're-import does not duplicate');
  await page.reload({ waitUntil: 'networkidle0' });
  assert((await page.$$('.jt-item')).length === 3, 'imported data persists after reload');

  // desktop
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(() => window.scrollTo(0, 0)); await new Promise(r => setTimeout(r, 300));
  assert(await page.$eval('#jt-cancel', e => getComputedStyle(e).display === 'none') && await page.$eval('#jt-pereche-alta-wrap', e => getComputedStyle(e).display === 'none'), 'hidden elements really hidden');
  await page.screenshot({ path: `${SHOTS}/jurnal-desktop.png` });
  await page.evaluate(() => document.querySelector('.jt-preview').scrollIntoView()); await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: `${SHOTS}/jurnal-desktop-templates.png` });
  await page.evaluate(() => window.scrollTo(0, 0)); await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: `${SHOTS}/jurnal-desktop-full.png`, fullPage: true });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert(!overflow, 'no horizontal overflow desktop');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'networkidle0' });
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'no horizontal overflow at 390px');

  const posts = requests.filter(r => !r.startsWith('GET'));
  assert(posts.length === 0, 'no non-GET requests (nothing sent anywhere)');
  const external = [...new Set(requests.map(r => new (require('url').URL)(r.split(' ')[1]).host))];
  log('hosts contacted:', external);
  assert(errors.length === 0, 'no JS errors ' + JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
