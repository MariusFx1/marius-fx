const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  for (const [w,n] of [[1280,'desktop'],[390,'mobile']]) {
    await p.setViewport({ width: w, height: 900 });
    await p.goto('http://localhost:8765/vip.html', { waitUntil: 'networkidle2' });
    await p.evaluate(async () => { document.querySelectorAll('.vp-faq')[0].open = true; for (let y=0;y<document.body.scrollHeight;y+=300){scrollTo(0,y);await new Promise(r=>setTimeout(r,120));} scrollTo(0,0); });
    await new Promise(r=>setTimeout(r,800));
    console.log(n, await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
    await p.screenshot({ path: `/workspace/forex-ms/screenshots/vip-page-${n}.png`, fullPage: true });
  }
  await b.close();
})();
