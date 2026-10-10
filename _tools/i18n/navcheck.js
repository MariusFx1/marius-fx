const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const url = process.argv[2] || 'http://localhost:8765/index.html';
  for (const w of [1440, 1280, 1121, 1120, 390]) {
    await p.setViewport({ width: w, height: 800 });
    await p.goto(url, { waitUntil: 'networkidle2' });
    const r = await p.evaluate(() => {
      const nav = document.querySelector('.nav'), ul = document.querySelector('.nav-links'), sw = document.querySelector('.lang-switch');
      const lis = [...ul.querySelectorAll('li')].map(li => li.getBoundingClientRect().top);
      const nb = nav.getBoundingClientRect(), sb = sw.getBoundingClientRect();
      return { navH: Math.round(nb.height), rows: new Set(lis.map(Math.round)).size, swTop: Math.round(sb.top), swRight: Math.round(sb.right), navRight: Math.round(nb.right), sw: getComputedStyle(ul).position, docW: document.documentElement.scrollWidth };
    });
    console.log(w, JSON.stringify(r));
    if (process.argv[3]) await p.screenshot({ path: `/workspace/shots/i18n/nav-${process.argv[3]}-${w}.png`, clip: { x: 0, y: 0, width: w, height: 80 } });
  }
  await b.close();
})();
