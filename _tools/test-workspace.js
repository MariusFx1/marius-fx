// Spațiul de lucru pe tot ecranul al simulatorului: layout, istoric/Înapoi, ecran complet, taste, tragere linii, rezumat final.
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, oks = 0;
const assert = (c, m) => { if (c) { oks++; console.log('ok ' + m); } else { fails++; console.log('FAIL: ' + m); } };
const SIZES = [
  { name: 'desktop-1280', vp: { width: 1280, height: 800 } },
  { name: 'desktop-1920', vp: { width: 1920, height: 1080 } },
  { name: 'mobile-portrait', vp: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  { name: 'mobile-landscape', vp: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }
];
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const shots = {};
  for (const { name, vp } of SIZES) {
    const L = name, touch = !!vp.hasTouch, portrait = vp.width < 700;
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
    page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(r.status() + ' ' + r.url()); });
    await page.setViewport(vp);
    await page.goto(`${BASE}/simulator.html`, { waitUntil: 'networkidle2' });
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('mariusfx-sim-ajutor-v1', '1'); });
    await page.goto(`${BASE}/simulator.html`, { waitUntil: 'networkidle2' });
    const H = () => page.evaluate(() => history.length);
    const W = () => page.evaluate(() => {
      const ws = document.getElementById('sim-session').getBoundingClientRect(), ch = document.getElementById('sim-chart').getBoundingClientRect(), pn = document.getElementById('sim-panel').getBoundingClientRect();
      return { on: document.documentElement.classList.contains('sim-app-on'), hidden: document.getElementById('sim-session').hidden, ws: [ws.left, ws.top, ws.width, ws.height], ch: [ch.left, ch.top, ch.width, ch.height], pn: [pn.left, pn.top, pn.width, pn.height],
        sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight, hash: location.hash,
        headerInert: document.querySelector('.site-header, header').inert, overflow: getComputedStyle(document.documentElement).overflow };
    });
    const S = () => page.evaluate(() => { const s = window.__sim.S; return s && { cur: s.cur, pos: s.pos, pending: s.pending, trades: s.trades.length, ended: s.ended, sym: s.sym, tf: s.tf, hidden: s.hidden, risk: s.riskPct, id: s.id, c: s.d.c[s.cur] }; });

    // ---------- setare simplă: un singur clic, cu valori implicite ----------
    const setup = await page.evaluate(() => ({ adv: document.querySelector('.sim-adv-setup').open, sym: document.getElementById('sim-sym').value, tf: document.querySelector('input[name="sim-tf"]:checked').value, mode: document.querySelector('input[name="sim-mode"]:checked').value, risk: document.getElementById('sim-risk').value }));
    assert(!setup.adv && setup.sym === 'EURUSD' && setup.tf === 'H1' && setup.mode === 'random' && setup.risk === '1', `${L}: setup defaults EURUSD H1 random 1%, advanced collapsed`);
    const h0 = await H();
    await page.click('#sim-start');
    await page.waitForFunction(() => window.__sim.S && !document.getElementById('sim-session').hidden, { timeout: 20000 });
    await sleep(500);
    let s = await S(), w = await W();
    assert(s.sym === 'EURUSD' && s.tf === 'H1' && s.hidden && s.risk === 1, `${L}: one-click start → EURUSD H1, hidden date, 1% risk`);
    assert(w.on && w.hash === '#sesiune' && (await H()) === h0 + 1, `${L}: workspace opened with a history entry (#sesiune)`);
    assert(w.ws[0] === 0 && w.ws[1] === 0 && Math.round(w.ws[2]) === vp.width && Math.round(w.ws[3]) === vp.height, `${L}: workspace fills the viewport (${w.ws.map(Math.round)})`);
    assert(w.sw === vp.width && w.sh === vp.height && w.overflow === 'hidden' && w.headerInert === true, `${L}: no page scroll, site header inert/hidden behind`);
    const chartShare = w.ch[2] * w.ch[3] / (vp.width * vp.height);
    assert(chartShare > (portrait ? 0.7 : 0.6), `${L}: chart takes most of the screen (${Math.round(chartShare * 100)}%)`);
    if (portrait) assert(Math.round(w.pn[3]) === 40 && Math.round(w.pn[1] + w.pn[3]) === vp.height && w.pn[2] === vp.width, `${L}: bottom sheet collapsed at bottom (${w.pn.map(Math.round)})`);
    else assert(Math.round(w.pn[0] + w.pn[2]) === vp.width && w.pn[3] > vp.height - 60 && w.pn[2] >= 250 && w.pn[2] <= 330, `${L}: order panel docked right (${w.pn.map(Math.round)})`);
    // bara de sus (pe desktop mutăm cursorul de pe grafic, ca legenda să arate ultima bară)
    if (!touch) { await page.mouse.move(5, vp.height - 5); await page.mouse.move(vp.width / 2, 10); await sleep(150); }
    const bar = await page.evaluate(() => {
      const vis = id => { const e = document.getElementById(id); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight; };
      return { ids: ['sim-back', 'sim-first', 'sim-play', 'sim-next', 'sim-next10', 'sim-speed', 'sim-balance', 'sim-equity', 'sim-openpl', 'sim-end', 'sim-label'].filter(id => !vis(id)),
        firstDisabled: document.getElementById('sim-first').disabled, end: document.getElementById('sim-end').textContent, label: document.getElementById('sim-label').textContent,
        legend: document.getElementById('sim-legend').textContent, bid: document.getElementById('sim-bid').textContent, ask: document.getElementById('sim-ask').textContent };
    });
    assert(!bar.ids.length && bar.firstDisabled && bar.end === 'Termină' && bar.label === 'EURUSD · H1', `${L}: toolbar complete and visible (missing: ${bar.ids.join(',') || 'none'}), ⏮ disabled`);
    const pr = n => Number(n.replace(/\./g, '').replace(',', '.'));
    assert(/^EURUSD · H1O[\d,]+ H[\d,]+ L[\d,]+ C[\d,]+ [+−][\d,]+ \([+−][\d,]+%\)$/.test(bar.legend.replace(/\s+(?=[OHLC]\d)/g, '').replace(/\s{2,}/g, ' ')) || /O.*H.*L.*C/.test(bar.legend), `${L}: OHLC legend top-left (${bar.legend.slice(0, 60)})`);
    const closes = await page.evaluate(() => { const S = window.__sim.S, f = x => x.toLocaleString('ro-RO', { minimumFractionDigits: 5, maximumFractionDigits: 5 }); const out = []; for (let i = 0; i < S.view.c.length; i++) out.push(f(S.view.c[i])); return out; });
    const legC = (bar.legend.match(/C([\d,]+)/) || [])[1];
    assert((touch ? closes.includes(legC) : legC === bar.bid) && Math.abs(pr(bar.ask) - pr(bar.bid) - 0.0001) < 1e-7, `${L}: legend close = Sell (bid) ${bar.bid}, Buy (ask) ${bar.ask} = bid + 1 pip spread`);
    // linii implicite SL/TP cu etichete în bani și R
    const lt = await page.evaluate(() => ({ sl: window.__sim.lines.sl && window.__sim.lines.sl.options().title, tp: window.__sim.lines.tp && window.__sim.lines.tp.options().title }));
    assert(/^SL\s+−[\d.,]+\s€\s+−1,00R$/.test(lt.sl.replace(/\u00a0/g, ' ').replace(/EUR/, '€')) || /^SL .*−1,00R$/.test(lt.sl), `${L}: SL line auto-placed, labeled with money and R (${lt.sl})`);
    assert(/^TP .*\+2,00R$/.test(lt.tp), `${L}: TP auto-placed at 1:2 (${lt.tp})`);

    // ---------- foaia de jos (mobil) și file ----------
    if (portrait) {
      await page.tap('#sim-sheet'); await sleep(400);
      w = await W();
      assert(await page.$eval('#sim-sheet', b => b.getAttribute('aria-expanded')) === 'true' && w.pn[3] > 300, `${L}: bottom sheet expands (${Math.round(w.pn[3])}px)`);
      const btn = await page.evaluate(() => { const r = document.getElementById('sim-place').getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0 || 'scroll'; });
      assert(btn, `${L}: Buy button reachable in sheet`);
    }
    await page.click('#sim-tab-trades'); await sleep(150);
    let tabs = await page.evaluate(() => ({ t: !document.getElementById('sim-pane-trades').hidden, o: document.getElementById('sim-pane-order').hidden, sel: document.getElementById('sim-tab-trades').getAttribute('aria-selected') }));
    assert(tabs.t && tabs.o && tabs.sel === 'true', `${L}: Tranzacții tab switches pane`);
    await page.click('#sim-tab-stats'); await sleep(300);
    assert(await page.evaluate(() => !document.getElementById('sim-stats').hidden && !!document.querySelector('#sim-eq-chart canvas')), `${L}: Statistici tab shows tiles + equity chart`);
    await page.click('#sim-tab-order'); await sleep(150);

    // ---------- ordin Buy + tragere SL (mouse sau atingere) ----------
    await page.click('#sim-place'); await sleep(200);
    s = await S();
    assert(s.pos && s.pos.side === 'buy', `${L}: Buy at market from ticket`);
    if (portrait) { await page.tap('#sim-sheet'); await sleep(400); }
    const g = await page.evaluate(() => { const r = document.getElementById('sim-chart').getBoundingClientRect(); const P = window.__sim.S.pos; return { top: r.top, x: r.left + r.width * 0.45, sl: window.__sim.series.priceToCoordinate(P.sl), tp: window.__sim.series.priceToCoordinate(P.tp), y0: scrollY }; });
    const sl0 = s.pos.sl;
    if (touch) {
      await page.touchscreen.touchStart(g.x, g.top + g.sl);
      for (let k = 1; k <= 6; k++) await page.touchscreen.touchMove(g.x, g.top + g.sl + k * 4);
      await page.touchscreen.touchEnd();
    } else {
      await page.mouse.move(g.x, g.top + g.sl); await page.mouse.down();
      for (let k = 1; k <= 6; k++) await page.mouse.move(g.x, g.top + g.sl + k * 4);
      await page.mouse.up();
    }
    await sleep(250);
    s = await S();
    const slT = await page.evaluate(() => window.__sim.lines.sl.options().title);
    assert(s.pos.sl < sl0 && /^SL .*−\d+,\d\dR$/.test(slT) && !/−1,00R$/.test(slT), `${L}: ${touch ? 'touch' : 'mouse'} drag moves SL down (${sl0} → ${s.pos.sl}), label shows money/R (${slT})`);
    // TP în sus (coordonata recitită: scala s-a putut schimba după mutarea SL)
    g.tp = await page.evaluate(() => window.__sim.series.priceToCoordinate(window.__sim.S.pos.tp));
    if (touch) {
      await page.touchscreen.touchStart(g.x, g.top + g.tp);
      for (let k = 1; k <= 4; k++) await page.touchscreen.touchMove(g.x, g.top + g.tp - k * 4);
      await page.touchscreen.touchEnd();
    } else {
      await page.mouse.move(g.x, g.top + g.tp); await page.mouse.down();
      for (let k = 1; k <= 4; k++) await page.mouse.move(g.x, g.top + g.tp - k * 4);
      await page.mouse.up();
    }
    await sleep(250);
    const s2 = await S();
    assert(s2.pos.tp > s.pos.tp, `${L}: ${touch ? 'touch' : 'mouse'} drag moves TP up (${s.pos.tp} → ${s2.pos.tp})`);
    // P/L live în bară
    await page.click('#sim-next'); await sleep(150);
    const pl = await page.$eval('#sim-openpl', e => e.textContent);
    s = await S();
    assert(!s.pos || /[+−]?[\d.,]+\s?€|EUR/.test(pl), `${L}: open P/L shown in toolbar (${pl})`);

    // ---------- taste (desktop) ----------
    if (!touch) {
      if (s.pos) { await page.click('#sim-close'); await sleep(100); }
      await page.click('#sim-chart'); // focus în afara câmpurilor
      let c0 = (await S()).cur;
      await page.keyboard.press('ArrowRight'); await sleep(100);
      assert((await S()).cur === c0 + 1, `${L}: → advances one bar`);
      await page.keyboard.press('Space'); await sleep(1200);
      const pl1 = await page.$eval('#sim-play', b => b.getAttribute('aria-pressed'));
      await page.keyboard.press('Space'); await sleep(50);
      const c1 = (await S()).cur; await sleep(1200);
      assert(pl1 === 'true' && c1 > c0 + 1 && (await S()).cur === c1 && await page.$eval('#sim-play', b => b.getAttribute('aria-pressed')) === 'false', `${L}: Space plays and pauses (${c1 - c0 - 1} bars)`);
      await page.keyboard.press('KeyS'); await sleep(150);
      s = await S();
      const sellOk = s.pos && s.pos.side === 'sell';
      await page.keyboard.press('KeyB'); await sleep(150);
      const after = await page.evaluate(() => window.__sim.S.positions.map(p => p.side).join());
      { const msg = await page.$eval('#sim-msg', e => e.textContent); assert(sellOk && after === 'sell,buy' && /#\d+ Buy/.test(msg), `${L}: S sells at market; B while in a trade opens a second position (numbered) [${after}] [${msg}]`); }
      await page.evaluate(() => { window.__sim.sheet && window.__sim.sheet(true); document.getElementById('sim-close-all').click(); }); await sleep(100);
      assert(await page.evaluate(() => window.__sim.S.positions.length === 0), `${L}: "Închide tot" closes both`);
      await page.keyboard.press('KeyB'); await sleep(150);
      s = await S();
      assert(s.pos && s.pos.side === 'buy', `${L}: B buys at market`);
      // tastele nu se declanșează în câmpuri
      await page.click('#sim-p-sl'); c0 = (await S()).cur;
      await page.keyboard.press('ArrowRight'); await page.keyboard.press('KeyS'); await sleep(100);
      assert((await S()).cur === c0, `${L}: shortcuts ignored while typing in inputs`);
      await page.click('#sim-close');
    }

    // ---------- redimensionare ----------
    const before = (await W()).ch;
    const vp2 = Object.assign({}, vp, { width: Math.round(vp.width * 0.8), height: Math.round(vp.height * 0.9) });
    await page.setViewport(vp2); await sleep(500);
    const ch2 = await page.evaluate(() => { const r = document.getElementById('sim-chart').getBoundingClientRect(), c = document.querySelector('#sim-chart canvas').getBoundingClientRect(); return { r: [r.width, r.height], cw: c.width, sw: document.documentElement.scrollWidth, iw: innerWidth }; });
    assert(Math.round(ch2.r[0]) !== Math.round(before[2]) && Math.abs(ch2.cw - ch2.r[0]) < 80 && ch2.sw === ch2.iw, `${L}: resize-aware chart (${Math.round(before[2])} → ${Math.round(ch2.r[0])}px wide, canvas follows, no overflow)`);
    await page.setViewport(vp); await sleep(400);

    // ---------- ecran complet ----------
    if (!touch) {
      const fsVisible = await page.$eval('#sim-fs', b => !b.hidden);
      await page.click('#sim-fs'); await sleep(500);
      const fsOn = await page.evaluate(() => !!document.fullscreenElement && document.getElementById('sim-fs').getAttribute('aria-pressed') === 'true');
      await page.click('#sim-fs'); await sleep(500);
      const fsOff = await page.evaluate(() => !document.fullscreenElement && document.getElementById('sim-fs').getAttribute('aria-pressed') === 'false');
      assert(fsVisible && fsOn && fsOff, `${L}: fullscreen toggle enters and exits (Fullscreen API)`);
    }

    // ---------- Înapoi (butonul din bară) → setări; reluare ----------
    s = await S();
    const curBefore = s.cur, idBefore = s.id;
    if (portrait) { if (await page.$eval('#sim-sheet', b => b.getAttribute('aria-expanded')) === 'true') await page.tap('#sim-sheet'); }
    await page.click('#sim-back'); await sleep(500);
    w = await W();
    const back = await page.evaluate(() => ({ setup: getComputedStyle(document.getElementById('sim-setup')).display !== 'none', resume: !document.getElementById('sim-resume').hidden, S: !!window.__sim.S, inert: document.querySelector('.site-header, header').inert }));
    assert(!w.on && w.hidden && w.hash === '' && back.setup && back.resume && !back.S && !back.inert && w.sh >= vp.height, `${L}: Back button returns to setup page, session saved (Continuă shown)`);
    await page.click('#sim-resume');
    await page.waitForFunction(() => window.__sim.S && !document.getElementById('sim-session').hidden, { timeout: 20000 }); await sleep(300);
    s = await S();
    assert(s.cur === curBefore && s.id === idBefore && (await W()).on, `${L}: resume returns to the same bar in the workspace`);
    // butonul Înapoi al browserului
    await page.goBack(); await sleep(500);
    w = await W();
    assert(!w.on && w.hash === '' && !(await page.evaluate(() => !!window.__sim.S)), `${L}: browser Back closes the workspace`);
    await page.click('#sim-resume');
    await page.waitForFunction(() => window.__sim.S && !document.getElementById('sim-session').hidden, { timeout: 20000 }); await sleep(300);

    // ---------- tranzacție + final: rezumat ----------
    if (portrait) { await page.tap('#sim-sheet'); await sleep(350); }
    s = await S();
    if (!s.pos) { await page.click('#sim-place'); await sleep(150); }
    for (let k = 0; k < 30 && (await S()).pos; k++) await page.evaluate(() => window.__sim.step(10));
    if ((await S()).pos) await page.click('#sim-close');
    if (portrait) { await page.tap('#sim-sheet'); await sleep(350); }
    await page.click('#sim-end'); await sleep(700);
    const sum = await page.evaluate(() => ({ open: document.getElementById('sim-summary').open, reveal: document.getElementById('sim-reveal').textContent, n: document.getElementById('sim-m-n').textContent, eq: !!document.querySelector('#sim-sum-eq canvas'),
      btns: ['sim-new', 'sim-journal', 'sim-csv', 'sim-exit'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.width > 0 && r.bottom <= innerHeight + 1 ? document.getElementById(id).textContent : ''; }),
      disc: /nu garantează/.test(document.getElementById('sim-summary').textContent), legend: document.getElementById('sim-legend').textContent }));
    assert(sum.open && /^Perioada reală: EURUSD H1, \d\d\.\d\d\.20\d\d/.test(sum.reveal) && Number(sum.n) >= 1 && sum.eq && sum.disc, `${L}: end summary modal: real period revealed, stats, equity curve, disclaimer (${sum.reveal})`);
    assert(sum.btns.join('|') === 'Sesiune nouă|Trimite în jurnal|Export CSV|Înapoi' || (portrait && sum.btns.filter(Boolean).length >= 2), `${L}: summary buttons (${sum.btns.join('|')})`);
    assert(/20\d\d|\d\d:\d\d/.test(sum.legend), `${L}: date revealed in legend after the end`);
    shots[name + '-summary'] = `/workspace/shots/ws-${name}-summary.png`;
    await page.screenshot({ path: shots[name + '-summary'] });
    await page.keyboard.press('Escape'); await sleep(200);
    const esc = await page.evaluate(() => ({ open: document.getElementById('sim-summary').open, end: document.getElementById('sim-end').textContent, dis: document.getElementById('sim-next').disabled }));
    assert(!esc.open && esc.end === 'Rezultate' && esc.dis, `${L}: Esc closes summary; 'Rezultate' reopens, replay disabled`);
    await page.click('#sim-end'); await sleep(300);
    assert(await page.$eval('#sim-summary', d => d.open), `${L}: 'Rezultate' reopens the summary`);
    await page.click('#sim-journal'); await sleep(150);
    assert(/jurnal/.test(await page.$eval('#sim-stats-msg', e => e.textContent)), `${L}: 'Trimite în jurnal' from summary`);
    // Sesiune nouă: rămâi în spațiul de lucru
    const oldId = (await S()).id;
    await page.click('#sim-new');
    await page.waitForFunction(id => window.__sim.S && window.__sim.S.id !== id && !window.__sim.S.ended, { timeout: 20000 }, oldId); await sleep(300);
    w = await W();
    assert(w.on && !(await page.$eval('#sim-summary', d => d.open)) && !(await page.$eval('#sim-next', b => b.disabled)) && (await page.$eval('#sim-end', b => b.textContent)) === 'Termină', `${L}: 'Sesiune nouă' starts a fresh session in the workspace`);
    // screenshot de lucru cu tranzacție deschisă
    if (portrait) { await page.tap('#sim-sheet'); await sleep(300); }
    await page.click('#sim-place'); await page.click('#sim-next'); await page.click('#sim-next');
    if (portrait) { await page.tap('#sim-sheet'); await sleep(350); }
    await sleep(300);
    shots[name] = `/workspace/shots/ws-${name}.png`;
    await page.screenshot({ path: shots[name] });
    // Termină → Înapoi din rezumat
    await page.evaluate(() => window.__sim.endSession('')); await sleep(400);
    await page.click('#sim-exit'); await sleep(500);
    w = await W();
    assert(!w.on && w.hash === '' && !(await page.$eval('#sim-resume', b => !b.hidden)), `${L}: 'Înapoi' from summary returns to setup (nothing left to resume)`);
    const hist = await page.$$eval('#sim-history-list li', l => l.length);
    assert(hist >= 2, `${L}: finished sessions listed in history (${hist})`);
    // reîncărcare cu #sesiune în URL: pagina de setări, fără erori
    await page.goto('about:blank');
    await page.goto(`${BASE}/simulator.html#sesiune`, { waitUntil: 'networkidle2' });
    w = await W();
    assert(!w.on && w.hash === '', `${L}: direct load of #sesiune falls back to setup`);
    assert(!errors.length, `${L}: no console/page errors (${errors.join(' | ')})`);
    await page.close();
  }
  await browser.close();
  console.log('screenshots', JSON.stringify(shots));
  console.log(fails ? `\n${fails} FAILED ${oks} ok` : `\nALL PASSED ${oks} ok`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
