const puppeteer = require('puppeteer-core');
const sizes = [[1280, 800, false], [1920, 1080, false], [390, 844, true], [844, 390, true]];
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const [w, h, mob] of sizes) {
    const p = await b.newPage(); const errs = [];
    p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
    await p.setViewport({ width: w, height: h, isMobile: mob, hasTouch: mob });
    await p.goto('http://localhost:8765/simulator.html', { waitUntil: 'networkidle0' });
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem('mariusfx-sim-ajutor-v1', '1'); });
    await p.reload({ waitUntil: 'networkidle0' });
    await p.screenshot({ path: `/tmp/ws-${w}x${h}-setup.png` });
    await p.click('#sim-start');
    await p.waitForFunction(() => window.__sim.S && !document.getElementById('sim-session').hidden, { timeout: 20000 });
    await new Promise(r => setTimeout(r, 600));
    if (mob && w < 700) { await p.click('#sim-sheet'); await new Promise(r => setTimeout(r, 400)); }
    await p.click('#sim-place'); await p.click('#sim-next'); await p.click('#sim-next');
    if (mob && w < 700) { await p.click('#sim-sheet'); await new Promise(r => setTimeout(r, 400)); }
    await new Promise(r => setTimeout(r, 400));
    await p.screenshot({ path: `/tmp/ws-${w}x${h}-trade.png` });
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, ih: innerHeight, chart: document.getElementById('sim-chart').getBoundingClientRect().toJSON(), bar: document.querySelector('.ws-bar').getBoundingClientRect().height, hash: location.hash }));
    console.log(w, h, JSON.stringify(m), 'errors', errs);
    await p.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
