// Test: tranzacții „În desfășurare” fără R (date vechi cu R salvat), statistici, editare open->TP, export xlsx.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { execSync } = require('child_process');
const URL = process.env.URL || 'http://localhost:8765/jurnal.html';
const DL = '/tmp/jt-dl2';
const SHOTS = '/workspace/forex-ms/screenshots';
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  -', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SEED = [
  { id: 'open-gbpjpy', data: '2026-10-02', pereche: 'GBPJPY', directie: 'Buy', sesiune: 'Londra', intrare: 190, sl: 189.5, tp: 192, rezultat: '', r: 4, plan: 'Da', creat: '2026-10-02T08:00:00.000Z' },
  { id: 'tp-eurusd', data: '2026-09-30', pereche: 'EURUSD', directie: 'Buy', sesiune: 'Londra', intrare: 1.085, sl: 1.083, tp: 1.089, rezultat: 'TP', r: 2, plan: 'Da', creat: '2026-09-30T08:00:00.000Z' },
  { id: 'sl-gbpusd', data: '2026-10-01', pereche: 'GBPUSD', directie: 'Sell', sesiune: 'New York', intrare: 1.27, sl: 1.272, tp: 1.266, rezultat: 'SL', r: -1, plan: 'Nu', creat: '2026-10-01T08:00:00.000Z' }
];
function readXlsx(file) {
  const py = `import zipfile,re,json,sys
z=zipfile.ZipFile(sys.argv[1]); out={}
for n in ['xl/worksheets/sheet1.xml','xl/worksheets/sheet2.xml']:
  x=z.read(n).decode(); rows={}
  for rr in re.finditer(r'<row r="(\\d+)"[^>]*>(.*?)</row>',x):
    cells={}
    for c in re.finditer(r'<c r="([A-Z]+)\\d+"([^>]*?)(?:/>|>(.*?)</c>)',rr.group(2)):
      body=c.group(3) or ''; m=re.search(r'<t[^>]*>(.*?)</t>',body) or re.search(r'<v>(.*?)</v>',body)
      cells[c.group(1)]=m.group(1) if m else None
    rows[rr.group(1)]=cells
  out[n.split('/')[-1]]=rows
print(json.dumps(out))`;
  fs.writeFileSync('/tmp/readxlsx.py', py);
  return JSON.parse(execSync(`python3 /tmp/readxlsx.py "${file}"`).toString());
}
async function exportXlsx(page) {
  fs.readdirSync(DL).forEach(f => fs.unlinkSync(DL + '/' + f));
  await page.click('#jt-export-xlsx');
  for (let i = 0; i < 50; i++) { const f = fs.readdirSync(DL).filter(f => f.endsWith('.xlsx')); if (f.length) return DL + '/' + f[0]; await sleep(100); }
  throw new Error('no xlsx downloaded');
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(seed => localStorage.setItem('mariusfx-jurnal-v1', JSON.stringify(seed)), SEED);
  await page.reload({ waitUntil: 'networkidle0' });

  const stats = () => page.$$eval('[data-stat]', els => Object.fromEntries(els.map(e => [e.dataset.stat, e.hidden ? '(hidden)' : e.textContent])));
  let s = await stats(); console.log(s);
  assert(s.total === '3', 'total 3');
  assert(s.castigate === '1' && s.pierdute === '1', 'câștigate 1 / pierdute 1 (open excluded)');
  assert(s.rata === '50%', 'win rate 50% from closed only');
  assert(s.totalR === '+1R' && s.rMediu === '+0,5R', 'total R +1R, R mediu +0,5R');
  assert(s.deschise === '1 în desfășurare', 'open count shown in stats: ' + s.deschise);
  assert((await page.$eval('#jt-count', e => e.textContent)) === '3 tranzacții · 1 în desfășurare', 'list count line');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mariusfx-jurnal-v1')).find(t => t.id === 'open-gbpjpy'));
  assert(stored && stored.r === 4 && stored.rezultat === '', 'stored R of old open entry untouched in localStorage');

  const card = id => page.$eval(`.jt-item[data-id="${id}"]`, li => ({ res: li.querySelector('.jt-res').textContent, r: li.querySelector('.jt-rval').textContent, meta: li.querySelector('.jt-meta')?.textContent || '' }));
  let c = await card('open-gbpjpy'); console.log(c);
  assert(c.res === 'În desfășurare' && c.r === '', 'open card shows no R result');
  assert(/R:R 1:4/.test(c.meta), 'open card still shows planned R:R 1:4');
  assert((await card('tp-eurusd')).r === '+2R' && (await card('sl-gbpusd')).r === '−1R', 'closed cards show +2R / −1R');

  await page.$eval('#jt-stats', e => e.scrollIntoView({ block: 'center' }));
  await sleep(300);
  const statsEl = await page.$('#jt-stats');
  await statsEl.screenshot({ path: `${SHOTS}/jurnal-stats-open-trade.png` });
  await page.screenshot({ path: `${SHOTS}/jurnal-open-trade-desktop.png` });

  // xlsx export with open trade
  let x = readXlsx(await exportXlsx(page));
  const j = x['sheet1.xml'], sum = x['sheet2.xml'];
  const rowOf = pair => Object.values(j).find(r => r.C === pair);
  assert(rowOf('GBPJPY').N === 'În desfășurare' && (rowOf('GBPJPY').O == null), 'xlsx: open trade has empty R (O=' + rowOf('GBPJPY').O + ')');
  assert(rowOf('GBPJPY').M === '4', 'xlsx: open trade keeps planned R:R 4');
  assert(rowOf('EURUSD').O === '2' && rowOf('GBPUSD').O === '-1', 'xlsx: closed R values 2 / -1');
  const kv = Object.fromEntries(Object.values(sum).filter(r => r.A && r.B != null).map(r => [r.A, r.B]));
  console.log(kv);
  assert(kv['Total tranzacții'] === '3' && kv['În desfășurare (fără rezultat în R)'] === '1', 'xlsx summary: total 3, 1 open');
  assert(kv['Câștigate'] === '1' && kv['Pierdute'] === '1' && kv['Rata de câștig'] === '50%', 'xlsx summary: 1/1, 50%');
  assert(kv['Total R'] === '1' && kv['R mediu'] === '0.5', 'xlsx summary: total R 1, R mediu 0.5');

  // edit open -> form has no R, field disabled
  await page.click('.jt-item[data-id="open-gbpjpy"] [data-act="edit"]');
  await sleep(400);
  let f = await page.$eval('#jt-r', e => ({ v: e.value, d: e.disabled, ph: e.placeholder }));
  assert(f.v === '' && f.d, 'editing open trade: R empty and disabled (' + JSON.stringify(f) + ')');
  await page.select('#jt-rezultat', 'TP');
  f = await page.$eval('#jt-r', e => ({ v: e.value, d: e.disabled }));
  assert(f.v === '4' && !f.d, 'open -> TP auto-fills R = planned R:R 4');
  await page.click('#jt-submit'); await sleep(200);
  s = await stats(); console.log(s);
  assert(s.castigate === '2' && s.pierdute === '1' && s.rata === '66,7%' && s.totalR === '+5R' && s.rMediu === '+1,67R', 'after open->TP: 2/1, 66,7%, +5R, +1,67R');
  assert(s.deschise === '(hidden)', 'open count hidden when no open trades');
  c = await card('open-gbpjpy');
  assert(c.res === 'TP' && c.r === '+4R', 'card now TP +4R');

  // edit back: TP -> SL / BE / Manual compute normally
  for (const [rez, exp] of [['SL', '-1'], ['BE', '0'], ['Manual', '']]) {
    await page.click('.jt-item[data-id="open-gbpjpy"] [data-act="edit"]'); await sleep(300);
    await page.select('#jt-rezultat', rez);
    const v = await page.$eval('#jt-r', e => e.value);
    assert(v === exp, `edit -> ${rez}: R = "${exp}" (got "${v}")`);
    await page.click('#jt-cancel'); await sleep(100);
  }
  // open-old -> SL path on a fresh seeded open entry
  await page.evaluate(seed => localStorage.setItem('mariusfx-jurnal-v1', JSON.stringify(seed)), SEED);
  await page.reload({ waitUntil: 'networkidle0' });
  for (const [rez, exp] of [['SL', '-1'], ['BE', '0'], ['Manual', '']]) {
    await page.click('.jt-item[data-id="open-gbpjpy"] [data-act="edit"]'); await sleep(300);
    await page.select('#jt-rezultat', rez);
    const v = await page.$eval('#jt-r', e => e.value);
    assert(v === exp, `open -> ${rez}: R = "${exp}" (got "${v}")`);
    await page.click('#jt-cancel'); await sleep(100);
  }

  // new open trade: R never auto-filled, saved without R
  await page.select('#jt-pereche', 'EURJPY');
  await page.click('input[name="directie"][value="Buy"] + span');
  await page.type('#jt-intrare', '160'); await page.type('#jt-sl', '159,5'); await page.type('#jt-tp', '161,5');
  f = await page.$eval('#jt-r', e => ({ v: e.value, d: e.disabled }));
  assert(f.v === '' && f.d, 'new open trade: R not auto-filled (R:R 1:3), field disabled');
  await page.select('#jt-rezultat', 'TP');
  assert((await page.$eval('#jt-r', e => e.value)) === '3', 'switch to TP fills 3');
  await page.select('#jt-rezultat', '');
  assert((await page.$eval('#jt-r', e => e.value)) === '', 'switch back to open clears R');
  await page.click('#jt-submit'); await sleep(200);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mariusfx-jurnal-v1')).find(t => t.pereche === 'EURJPY'));
  assert(saved && saved.rezultat === '' && saved.r === null, 'new open trade saved with r=null');
  s = await stats();
  assert(s.deschise === '2 în desfășurare' && s.rata === '50%' && s.totalR === '+1R', 'two open trades excluded: ' + JSON.stringify(s));
  const stillOld = await page.evaluate(() => JSON.parse(localStorage.getItem('mariusfx-jurnal-v1')).find(t => t.id === 'open-gbpjpy'));
  assert(stillOld.r === 4, 'old open entry R still preserved after saving another trade');

  // version + console
  const v = await page.evaluate(() => [...document.querySelectorAll('script[src*="jurnal.js"], link[href*="styles.css"]')].map(e => e.getAttribute('src') || e.getAttribute('href')));
  console.log('assets:', v);
  assert(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
