// make-icons.js: favicon / app icons în stilul vechi (ramă verde, litere mari verzi, wordmark gri) pentru brandul MS Prime
const puppeteer = require('puppeteer-core'); const fs = require('fs');
const font = 'data:font/woff2;base64,' + fs.readFileSync('/workspace/forex-ms/fonts/manrope-latin.woff2').toString('base64');
const html = (size, sub) => `<html><head><style>@font-face{font-family:M;src:url(${font}) format('woff2');font-weight:200 800}
html,body{margin:0;background:transparent}
.i{width:512px;height:512px;box-sizing:border-box;background:#070b14;border:${sub ? 10 : 34}px solid #22c55e;border-radius:${sub ? 84 : 110}px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:M}
.b{color:#4ade80;font-weight:700;font-size:${sub ? 200 : 260}px;line-height:1;letter-spacing:-.02em}
.s{color:#cbd5e1;font-weight:600;font-size:40px;letter-spacing:.06em;margin-top:28px}</style></head>
<body><div class="i"><div class="b">MS</div>${sub ? '<div class="s">MS PRIME</div>' : ''}</div></body></html>`;
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 512, height: 512 });
  for (const [sub, out] of [[true, '/tmp/icon-big.png'], [false, '/tmp/icon-small.png']]) {
    await p.setContent(html(512, sub)); await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 } });
  }
  await b.close();
})();
