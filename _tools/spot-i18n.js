const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 900 });
  await p.goto('http://localhost:8765/en/calendar.html', { waitUntil: 'networkidle2' }); await new Promise(r => setTimeout(r, 1500));
  console.log((await p.evaluate(() => document.querySelector('#cal-list, .cal-list, main').innerText)).slice(0, 1500));
  await p.goto('http://localhost:8765/en/sesiuni.html', { waitUntil: 'networkidle2' }); await new Promise(r => setTimeout(r, 800));
  console.log('---', (await p.evaluate(() => document.querySelector('main').innerText)).slice(0, 700));
  await b.close();
})();
