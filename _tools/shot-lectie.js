// Screenshots rapide pentru lectie.html + index.html (desktop 1280 / mobil 390)
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8765';
const OUT = process.env.OUT || '/tmp/lcshots';
require('fs').mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto(BASE + '/lectie.html', { waitUntil: 'networkidle0' });
  await p.screenshot({ path: OUT + '/lectie-full-desktop.png', fullPage: true });
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await p.goto(BASE + '/lectie.html', { waitUntil: 'networkidle0' });
  await p.screenshot({ path: OUT + '/lectie-full-mobile.png', fullPage: true, captureBeyondViewport: true });
  await p.goto(BASE + '/index.html', { waitUntil: 'networkidle2' }); await sleep(2500);
  await p.screenshot({ path: OUT + '/index-mobile.png', fullPage: true });
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto(BASE + '/index.html', { waitUntil: 'networkidle2' }); await sleep(2500);
  await p.screenshot({ path: OUT + '/index-desktop.png', fullPage: true });
  console.log('errors', errs);
  await b.close();
})();
