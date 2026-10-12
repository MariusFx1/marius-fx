const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  for (const [w,n] of [[1280,'desktop'],[390,'mobile']]) {
    await p.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
    await p.goto('http://localhost:8765/index.html', { waitUntil: 'networkidle2' });
    await p.evaluate(async () => { document.querySelector('.vip-discord').scrollIntoView(); await new Promise(r=>setTimeout(r,800)); });
    await p.waitForFunction(() => document.querySelector('.vip-banner img').complete);
    const box = await p.evaluate(() => { const a=document.querySelector('.vip-discord').getBoundingClientRect(), c=document.querySelector('.vip-discord-disc').getBoundingClientRect(); return {y:a.top+scrollY-30,b:c.bottom+scrollY+30, of: document.documentElement.scrollWidth>innerWidth, src: document.querySelector('.vip-banner img').currentSrc}; });
    console.log(n, JSON.stringify(box));
    await p.screenshot({ path: `/workspace/forex-ms/screenshots/vip-banner-${n}.png`, clip: { x:0, y:box.y, width:w, height:box.b-box.y }, captureBeyondViewport: true });
  }
  await b.close();
})();
