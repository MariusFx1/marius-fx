const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const [w, h, mob] of [[1280, 900, false], [390, 844, true]]) {
    const p = await b.newPage(); const errs=[]; p.on('console',m=>m.type()==='error'&&errs.push(m.text())); p.on('pageerror',e=>errs.push(e.message));
    await p.setViewport({ width: w, height: h, isMobile: mob, hasTouch: mob, deviceScaleFactor: 1 });
    await p.goto('https://mariusfx1.github.io/marius-fx/simulator.html', { waitUntil: 'networkidle0' });
    await p.evaluate(() => localStorage.clear());
    await p.reload({ waitUntil: 'networkidle0' });
    if (await p.$('#sim-help[open]')) await p.keyboard.press('Escape');
    const ck = async s => { await p.$eval(s, e => e.scrollIntoView({ block: 'center' })); await p.click(s); };
    await ck('#sim-start');
    await p.waitForFunction(() => !document.getElementById('sim-session').hidden);
    await new Promise(r => setTimeout(r, 800));
    await ck('#sim-place');
    await ck('#sim-next'); await ck('#sim-next');
    await p.$eval('#sim-chart', e => e.scrollIntoView({ block: 'start' }));
    await new Promise(r => setTimeout(r, 500));
    await p.screenshot({ path: `/workspace/shots/live-sim-${w}-session.png`, fullPage: !mob ? false : false });
    for (let i = 0; i < 6; i++) {
      if (await p.$eval('#sim-pos', e => e.hidden)) { await ck(i % 2 ? 'input[name=sim-side][value=sell]' : 'input[name=sim-side][value=buy]'); await ck('#sim-place'); }
      for (let k = 0; k < 4 && !(await p.$eval('#sim-pos', e => e.hidden)); k++) await ck('#sim-next10');
      if (!(await p.$eval('#sim-pos', e => e.hidden))) await ck('#sim-close');
    }
    await ck('#sim-end');
    await p.waitForFunction(() => !document.getElementById('sim-stats').hidden);
    await new Promise(r => setTimeout(r, 600));
    await p.$eval('#sim-stats', e => e.scrollIntoView({ block: 'start' }));
    await p.screenshot({ path: `/workspace/shots/live-sim-${w}-stats.png`, fullPage: mob });
    console.log(w, 'errors', JSON.stringify(errs), await p.evaluate(()=>document.documentElement.scrollWidth), await p.$eval('#sim-s-n', e => e.textContent));
  }
  await b.close();
})();
