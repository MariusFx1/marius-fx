const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await p.goto('file:///workspace/forex-ms-tools/og-card.html', { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  console.log('fonts:', await p.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').length));
  await p.screenshot({ path: '/workspace/forex-ms/og-image.png', type: 'png' });
  await b.close();
})();
