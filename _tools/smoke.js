const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(p.url() + ' ' + e.message));
  p.on('requestfailed', r => errs.push('failed ' + r.url()));
  p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
  for (const f of ['index', 'reguli', 'patternuri', 'sesiuni', 'calendar', 'calculator', 'despre', 'broker', 'contact', 'jurnal', 'lectie', 'test', 'intrebari', 'glosar']) {
    await p.goto(`http://localhost:8765/${f}.html`, { waitUntil: 'networkidle2' });
  }
  await p.goto('http://localhost:8765/despre.html', { waitUntil: 'networkidle2' });
  await p.click('.gallery-item'); await new Promise(r => setTimeout(r, 300));
  console.log('despre lightbox open:', await p.$eval('#lightbox', d => d.open));
  console.log('errors:', errs.filter(e => !/tradingview|google/.test(e)));
  await b.close();
})();
