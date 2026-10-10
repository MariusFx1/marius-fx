// Capturi: test (întrebare cu feedback, scor final) pe mobil, FAQ mobil + desktop, CTA lecție, carduri home
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8765';
const OUT = '/workspace/forex-ms/screenshots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DESK = { width: 1280, height: 900 };
const MOB = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const only = process.argv[2] || 'all';
  // test: mobil
  await p.setViewport(MOB);
  await p.goto(`${BASE}/test.html`, { waitUntil: 'networkidle2' });
  await p.evaluate(() => localStorage.removeItem('mfx-quiz-best'));
  await p.reload({ waitUntil: 'networkidle2' }); await sleep(300);
  await p.screenshot({ path: OUT + 'quiz-start-mobile.png' });
  await p.click('#quiz-start-btn'); await sleep(300);
  await p.click('#quiz-options li:nth-child(2) .quiz-opt'); await sleep(700);
  await p.evaluate(() => document.getElementById('quiz-q').scrollIntoView({ block: 'start' })); await p.evaluate(() => scrollBy(0, -80)); await sleep(300);
  await p.screenshot({ path: OUT + 'quiz-feedback-mobile.png' });
  await p.$eval('#quiz-q', e => e.scrollIntoView());
  await p.screenshot({ path: OUT + 'quiz-feedback-mobile-full.png', fullPage: false });
  for (let i = 1; i < 15; i++) { await p.click('#quiz-next'); await sleep(120); await p.click(`#quiz-options li:nth-child(${(i % 4) + 1}) .quiz-opt`); await sleep(80); }
  await p.click('#quiz-next'); await sleep(900);
  await p.evaluate(() => { document.getElementById('quiz-result').scrollIntoView({ block: 'start' }); scrollBy(0, -80); }); await sleep(300);
  await p.screenshot({ path: OUT + 'quiz-result-mobile.png' });
  // desktop test
  await p.setViewport(DESK);
  await p.goto(`${BASE}/test.html`, { waitUntil: 'networkidle2' }); await sleep(300);
  await p.screenshot({ path: OUT + 'quiz-start-desktop.png' });
  await p.click('#quiz-start-btn'); await sleep(200); await p.click('#quiz-options li:nth-child(1) .quiz-opt'); await sleep(600);
  await p.screenshot({ path: OUT + 'quiz-feedback-desktop.png' });
  // FAQ
  for (const [n, vp] of [['desktop', DESK], ['mobile', MOB]]) {
    await p.setViewport(vp);
    await p.goto(`${BASE}/intrebari.html`, { waitUntil: 'networkidle2' }); await sleep(300);
    await p.$eval('#taxe', d => d.open = true); await p.$eval('#bani', d => d.open = true); await sleep(300);
    await p.screenshot({ path: OUT + `faq-${n}.png` });
    await p.screenshot({ path: OUT + `faq-${n}-full.png`, fullPage: true });
  }
  // lectie CTA + home cards
  for (const [n, vp] of [['desktop', DESK], ['mobile', MOB]]) {
    await p.setViewport(vp);
    await p.goto(`${BASE}/lectie.html`, { waitUntil: 'networkidle2' });
    await p.$eval('.lc-quiz-cta', e => { e.scrollIntoView({ block: 'center', behavior: 'instant' }); }); await sleep(800);
    await p.screenshot({ path: OUT + `lectie-quiz-cta-${n}.png` });
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
    await p.evaluate(async () => { for (let y = 0; y <= document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } });
    await sleep(1400);
    const el = await p.$('.home-features');
    await el.screenshot({ path: OUT + `home-features-${n}.png` });
  }
  await p.setViewport({ width: 1081, height: 700 });
  await p.goto(`${BASE}/test.html`, { waitUntil: 'networkidle2' });
  await p.screenshot({ path: OUT + 'nav-1081.png', clip: { x: 0, y: 0, width: 1081, height: 70 } });
  await b.close();
})();
