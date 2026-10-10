// Faza 3: strategie (reguli, checklist, setup-uri), setup + notă pe tranzacție, statistici detaliate (sesiune + istoric),
// compararea strategiilor, modul provocare (bare live, trecut / picat, rezumat), ghidul „Cum faci un backtest corect”.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, oks = 0;
const assert = (c, m) => { if (c) { oks++; console.log('ok ' + m); } else { fails++; console.log('FAIL: ' + m); } };
const SIZES0 = [
  { name: 'desktop-1280', vp: { width: 1280, height: 800 } },
  { name: 'mobile-portrait', vp: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  { name: 'mobile-landscape', vp: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }
];
const SIZES = process.env.ONLY ? SIZES0.filter(x => x.name === process.env.ONLY) : SIZES0;
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const { name: L, vp } of SIZES) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror ' + e.stack));
    page.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
    page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(r.status() + ' ' + r.url()); });
    page.on('dialog', d => d.accept());
    await page.setViewport(vp);
    await page.goto(`${BASE}/simulator.html`, { waitUntil: 'networkidle2' });
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('mariusfx-sim-ajutor-v1', '1'); });
    const act = sel => page.evaluate(s => { window.__sim.sheet && window.__sim.sheet(true); const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); e.click(); }, sel);
    const overflow = () => page.evaluate(w => document.documentElement.scrollWidth > innerWidth + 1 || innerWidth !== w, vp.width);
    const S = fn => page.evaluate(fn);
    const setup = async (o) => {
      await page.goto(`${BASE}/simulator.html`, { waitUntil: 'networkidle2' });
      await page.evaluate(o => {
        const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
        document.querySelectorAll('.sim-adv-setup').forEach(d => { d.open = true; });
        set('sim-sym', o.sym || 'EURUSD');
        document.querySelector('input[name="sim-mode"][value="date"]').click(); document.getElementById('sim-date').value = o.date;
        set('sim-risk', o.risk || '1');
        set('sim-st-name', o.name || ''); set('sim-st-setups', o.setups || ''); set('sim-st-rules', o.rules || ''); set('sim-st-check', o.check || '');
        document.getElementById('sim-ch-on').checked = !!o.ch;
        if (o.ch) { set('sim-ch-target', o.ch[0]); set('sim-ch-daily', o.ch[1]); set('sim-ch-total', o.ch[2]); }
      }, o);
    };
    const start = async () => {
      const cov = await page.evaluate(() => { const b = document.getElementById('sim-start'); b.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e === b || b.contains(e) ? '' : (e ? e.tagName + '.' + e.className : 'none'); });
      if (cov) assert(false, `${L}: start button covered by ${cov}`);
      await page.click('#sim-start');
      try { await page.waitForFunction(() => window.__sim.S && !document.getElementById('sim-session').hidden, { timeout: 20000 }); }
      catch (e) { throw new Error('start failed: ' + await page.evaluate(() => document.getElementById('sim-setup-err').textContent + ' | btn=' + document.getElementById('sim-start').textContent + ' | hash=' + location.hash + ' | ws=' + document.getElementById('sim-session').hidden)); }
      await sleep(250);
    };
    const place = async (side, tag, note) => {
      await page.evaluate((side, tag, note) => {
        window.__sim.sheet(true); window.__sim.selectTab('order');
        document.querySelector(`input[name="sim-side"][value="${side}"]`).click();
        const t = document.getElementById('sim-setup-tag'), n = document.getElementById('sim-note');
        t.value = tag || ''; n.value = note || '';
        document.getElementById('sim-place').click();
      }, side, tag, note);
      await sleep(120);
    };
    const back = async () => { await page.evaluate(() => document.getElementById('sim-sum-close') && document.getElementById('sim-summary').open && document.getElementById('sim-sum-close').click()); await page.click('#sim-back'); await page.waitForFunction(() => document.getElementById('sim-session').hidden); await sleep(200); };

    // ---------- 0. pagina de setări: ghid, strategie, provocare ----------
    const pg = await S(() => ({
      guide: !!document.querySelector('#sim-guide h2') && document.querySelectorAll('#sim-guide li').length >= 5, link: !!document.querySelector('.sim-setup a[href="#sim-guide"]'),
      txt: document.getElementById('sim-guide').textContent, strat: !!document.getElementById('sim-strat-setup'), ch: !!document.getElementById('sim-ch-setup'),
      chDef: [document.getElementById('sim-ch-target').value, document.getElementById('sim-ch-daily').value, document.getElementById('sim-ch-total').value].join('/'), chOn: document.getElementById('sim-ch-on').checked }));
    assert(pg.guide && pg.link && /30-50/.test(pg.txt) && /lookahead/i.test(pg.txt) && /jurnal/.test(pg.txt), `${L}: guide "Cum faci un backtest corect" (rules, 30-50 trades, no lookahead, journal) linked from setup`);
    assert(pg.strat && pg.ch && pg.chDef === '8/5/10' && !pg.chOn, `${L}: strategy + challenge sections, challenge off by default (8/5/10)`);
    assert(!/—/.test(pg.txt), `${L}: guide has no em-dash`);
    await page.click('a[href="#sim-guide"]'); await sleep(400);
    assert(await S(() => { const r = document.getElementById('sim-guide-title').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }), `${L}: guide link scrolls to the guide`);
    // validarea provocării
    await setup({ date: '2024-03-05', ch: ['8', '12', '10'] });
    await page.click('#sim-start'); await sleep(300);
    let err = await S(() => !document.getElementById('sim-setup-err').hidden && document.getElementById('sim-setup-err').textContent);
    assert(/zilnică maximă nu poate fi mai mare/.test(err || ''), `${L}: challenge validation (daily > total refused): ${err}`);
    await setup({ date: '2024-03-05', ch: ['0', '5', '10'] });
    await page.click('#sim-start'); await sleep(300);
    err = await S(() => document.getElementById('sim-setup-err').textContent);
    assert(/Ținta de profit/.test(err), `${L}: challenge validation (target 0 refused)`);

    // ---------- 1. sesiune cu strategie, setup și notă ----------
    await setup({ date: '2024-03-05', name: 'Pullback', setups: 'Pullback, Breakout, Pullback', rules: 'Intru doar în trend.\nSL sub swing.', check: 'Trend pe H4\n\nR:R minim 1:2' });
    await start();
    let w = await S(() => ({ box: !document.getElementById('sim-strat-box').hidden, name: document.getElementById('sim-strat-name').textContent, rules: document.getElementById('sim-strat-rules').textContent,
      items: [...document.querySelectorAll('#sim-checklist li')].map(l => l.textContent.trim()), cnt: document.getElementById('sim-check-count').textContent,
      list: [...document.querySelectorAll('#sim-setup-list option')].map(o => o.value), strat: window.__sim.S.strategy, chBox: document.getElementById('sim-ch').hidden }));
    assert(w.box && w.name === 'Pullback' && /trend/.test(w.rules) && JSON.stringify(w.items) === '["Trend pe H4","R:R minim 1:2"]' && w.cnt === 'checklist 0/2', `${L}: strategy box with rules + checklist 0/2 ${JSON.stringify(w.items)}`);
    assert(JSON.stringify(w.list) === '["Pullback","Breakout"]' && w.strat.setups.length === 2, `${L}: setup suggestions (deduplicated) ${w.list}`);
    assert(w.chBox, `${L}: no challenge bars without challenge mode`);
    await page.evaluate(() => { window.__sim.sheet(true); document.getElementById('sim-strat-box').open = true; document.querySelectorAll('#sim-checklist input').forEach(c => c.click()); });
    w = await S(() => [document.getElementById('sim-check-count').textContent, document.getElementById('sim-check-count').classList.contains('is-done')]);
    assert(w[0] === 'checklist 2/2' && w[1], `${L}: ticking the checklist -> 2/2`);
    await place('buy', 'Pullback', 'Retragere la EMA');
    w = await S(() => { const P = window.__sim.S.positions[0]; return { setup: P && P.setup, note: P && P.note, noteField: document.getElementById('sim-note').value, cnt: document.getElementById('sim-check-count').textContent, tag: document.getElementById('sim-setup-tag').value }; });
    assert(w.setup === 'Pullback' && w.note === 'Retragere la EMA', `${L}: position tagged with setup + note`);
    assert(w.noteField === '' && w.cnt === 'checklist 0/2' && w.tag === 'Pullback', `${L}: after entry the note + checklist reset, setup stays`);
    await page.evaluate(() => window.__sim.step(3)); await act('#sim-close'); await sleep(100);
    await place('sell', 'Breakout', 'Spargere de range <b>');
    await page.evaluate(() => window.__sim.step(2)); await act('#sim-close'); await sleep(100);
    await place('buy', '', '');
    await page.evaluate(() => window.__sim.step(1)); await act('#sim-close'); await sleep(100);
    // o ordine limit: setup-ul și nota trec la poziția executată
    w = await S(() => window.__sim.S.trades.map(t => [t.setup, t.note]));
    assert(JSON.stringify(w) === JSON.stringify([['Pullback', 'Retragere la EMA'], ['Breakout', 'Spargere de range <b>'], ['', '']]), `${L}: trades keep setup + note ${JSON.stringify(w)}`);
    w = await S(() => ({ tags: [...document.querySelectorAll('#sim-trades .sim-tag')].map(e => e.textContent), notes: [...document.querySelectorAll('#sim-trades .sim-note')].map(e => e.textContent), inj: !!document.querySelector('#sim-trades b') }));
    assert(w.tags.join() === 'Pullback,Breakout' && w.notes[1] === 'Spargere de range <b>' && !w.inj, `${L}: trade list shows setup + note (escaped)`);

    // ---------- 2. statistici detaliate în sesiune ----------
    await page.evaluate(() => { window.__sim.sheet(true); window.__sim.selectTab('stats'); });
    await sleep(200);
    w = await S(() => {
      const S = window.__sim.S, E = window.SimEngine, d = E.detailed(S.trades), el = document.getElementById('sim-detail');
      const keys = Object.fromEntries([...el.querySelectorAll('.st-k')].map(k => [k.querySelector('span').textContent, k.querySelector('strong').textContent]));
      const tbl = t => { const b = [...el.querySelectorAll('.st-block')].find(x => x.querySelector('h4').textContent === t); return b ? [...b.querySelectorAll('tbody tr')].map(r => [...r.children].map(c => c.textContent)) : null; };
      const hours = [...new Set(S.trades.map(t => E.roParts(t.entryT).h))].sort((a, b) => a - b).map(h => String(h).padStart(2, '0') + ':00');
      const fmt = v => (v > 0 ? '+' : v < 0 ? '−' : '') + new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v)) + 'R';
      const st = E.stats(S.trades, S.bal0);
      return { keys, exp: fmt(d.expectancyR), setup: tbl('Pe setup'), side: tbl('Long / short'), hours: (tbl('Pe oră de intrare (ora României)') || []).map(r => r[0]), wantH: hours,
        wd: (tbl('Pe zi (intrare, ora României)') || []).map(r => r[0]), wantWd: [...new Set(S.trades.map(t => ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'][E.roParts(t.entryT).wd]))],
        sym: tbl('Pe instrument'), hist: [...el.querySelectorAll('.st-hist b')].reduce((s, b) => s + +b.textContent, 0), curve: !!el.querySelector('.st-curve path'), few: !!el.querySelector('.st-few'),
        dd: keys['Drawdown maxim'], wantDD: new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(st.maxDDPct * 100) + '%',
        streak: keys['Serii maxime'], wantStreak: d.maxConsecWins + ' / ' + d.maxConsecLosses, hold: keys['Durată medie'], n: S.trades.length };
    });
    assert(w.keys['Expectanță'] === w.exp, `${L}: expectancy shown = engine (${w.keys['Expectanță']} vs ${w.exp})`);
    assert(w.dd === w.wantDD && w.streak === w.wantStreak && /ore|oră|zile/.test(w.hold), `${L}: max DD %, streaks, avg holding time (${w.dd}, ${w.streak}, ${w.hold})`);
    assert(w.setup && w.setup.map(r => r[0]).sort().join() === '(fără setup),Breakout,Pullback' && w.setup.every(r => r[1] === '1'), `${L}: per-setup table ${JSON.stringify(w.setup && w.setup.map(r => r[0]))}`);
    assert(w.side && w.side.length >= 1 && w.sym && w.sym[0][0] === 'EURUSD' && w.sym[0][1] === '3', `${L}: long/short + per instrument tables`);
    assert(JSON.stringify(w.hours) === JSON.stringify(w.wantH) && w.wd.slice().sort().join() === w.wantWd.sort().join(), `${L}: per-hour + per-weekday in Romanian time ${w.hours} ${w.wd}`);
    assert(w.hist === w.n && w.curve && w.few, `${L}: R histogram sums to ${w.n}, R curve, "few trades" warning`);
    assert(!(await overflow()), `${L}: no overflow with stats tab`);
    // CSV de sesiune: coloane noi
    w = await S(() => { const tr = window.__sim.S.trades.map(t => Object.assign({ strategy: 'Pullback', stf: 'H1', ccy: 'EUR', sym: 'EURUSD' }, t)); return window.SimStats.csvAll(tr).split('\r\n'); });
    assert(w.length === 4 && w[0].startsWith('Strategie;Setup;Notă;Instrument') && w[1].startsWith('Pullback;Pullback;Retragere la EMA;EURUSD;H1;Buy'), `${L}: CSV with strategy/setup/note columns`);
    await page.evaluate(() => window.__sim.endSession()); await sleep(400);
    w = await S(() => ({ ch: document.getElementById('sim-sum-ch').hidden, saved: JSON.parse(localStorage.getItem('mariusfx-sim-sesiuni-v1'))[0] }));
    assert(w.ch && w.saved.strategy.name === 'Pullback' && w.saved.trades.length === 3 && !w.saved.challenge, `${L}: saved session keeps strategy, summary without challenge block`);
    await back();

    // ---------- 3. provocare picată ----------
    await setup({ date: '2024-05-14', name: 'Breakout H4', ch: ['8', '5', '10'] });
    await start();
    w = await S(() => ({ box: !document.getElementById('sim-ch').hidden, bars: document.querySelectorAll('#sim-ch [role="progressbar"]').length, txt: document.getElementById('sim-ch').textContent, ch: window.__sim.S.challenge }));
    assert(w.box && w.bars === 3 && /0,0% \/ 8%/.test(w.txt) && w.ch.status === 'activ' && w.ch.start === 10000, `${L}: live challenge bars (profit/daily/total) ${w.txt}`);
    const vis = await S(() => { const r = document.getElementById('sim-ch').getBoundingClientRect(); return r.height > 0 && r.bottom <= innerHeight + 1; });
    assert(vis, `${L}: challenge bars visible when the panel is open`);
    await place('buy');
    // poziție uriașă: prima bară îi duce equity-ul sub limită
    await page.evaluate(() => { window.__sim.S.positions[0].lot = 400; });
    await page.evaluate(() => window.__sim.step(1)); await sleep(400);
    w = await S(() => { const S = window.__sim.S; return { ended: S.ended, ch: S.challenge, reason: S.trades.map(t => t.reason), sum: document.getElementById('sim-summary').open, box: document.getElementById('sim-sum-ch'),
      boxTxt: document.getElementById('sim-sum-ch').textContent, tone: document.getElementById('sim-sum-ch').dataset.tone, rs: document.getElementById('sim-sum-reason').textContent }; });
    assert(w.ended && w.ch.status === 'picat' && ['total', 'zilnic'].includes(w.ch.reason) && w.reason.join() === 'Provocare', `${L}: challenge FAILS automatically (${w.ch.reason}), position closed`);
    const stale = await S(() => ({ list: document.querySelectorAll('#sim-pos-list li').length, cnt: document.getElementById('sim-pos-count').textContent, pl: document.getElementById('sim-openpl').textContent, eq: document.getElementById('sim-equity').textContent, bal: document.getElementById('sim-balance').textContent }));
    assert(stale.list === 0 && stale.cnt === '0' && stale.pl === '—' && stale.eq === stale.bal, `${L}: after auto-end the panel/toolbar show no open position ${JSON.stringify(stale)}`);
    assert(w.sum && w.tone === 'bad' && /Provocare picată/.test(w.boxTxt) && /riscului prea mare/.test(w.boxTxt) && /Provocare picată/.test(w.rs), `${L}: fail result screen + educational note`);
    w = await S(() => JSON.parse(localStorage.getItem('mariusfx-sim-sesiuni-v1'))[0].challenge);
    assert(w && w.status === 'picat', `${L}: failed challenge saved in history`);
    await back();

    // ---------- 4. provocare trecută ----------
    await setup({ date: '2024-05-14', name: 'Breakout H4', ch: ['1', '5', '10'] });
    await start();
    // alege direcția și TP-ul pe care următoarea bară H1 îl atinge (doar în test)
    const side = await S(() => { const S = window.__sim.S, i = S.cur + 1, E = window.SimEngine, sp = E.spreadPrice(S.sym); return S.d.h[i] > S.d.c[S.cur] + sp + 0.0003 ? 'buy' : 'sell'; });
    await place(side);
    await page.evaluate(() => {
      const S = window.__sim.S, P = S.positions[0], i = S.cur + 1, E = window.SimEngine, sp = E.spreadPrice(S.sym);
      if (P.side === 'buy') { P.tp = E.round(Math.max(P.entry + 0.0001, S.d.h[i] - 0.00005), 6); P.sl = E.round(P.entry - 0.05, 6); }
      else { P.tp = E.round(Math.min(P.entry - 0.0001, S.d.l[i] + sp + 0.00005), 6); P.sl = E.round(P.entry + 0.05, 6); }
      P.lot = 200;
    });
    await page.evaluate(() => window.__sim.step(1)); await sleep(400);
    w = await S(() => { const S = window.__sim.S; return { ended: S.ended, ch: S.challenge, tr: S.trades.map(t => t.reason), bal: S.balance, tone: document.getElementById('sim-sum-ch').dataset.tone, txt: document.getElementById('sim-sum-ch').textContent }; });
    assert(w.ended && w.ch.status === 'trecut' && w.tr.join() === 'TP' && w.bal >= 10100 && w.tone === 'good' && /Provocare trecută/.test(w.txt), `${L}: challenge PASSES at the profit target (${w.ch.status}, balance ${w.bal})`);
    if (L === 'desktop-1280' && process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/challenge-result.png' });
    await back();

    // ---------- 5. reluare cu provocare ----------
    await setup({ date: '2024-06-11', name: 'Pullback', ch: ['8', '5', '10'] });
    await start();
    await page.evaluate(() => window.__sim.step(3));
    await page.click('#sim-back'); await page.waitForFunction(() => document.getElementById('sim-session').hidden); await sleep(200);
    await page.click('#sim-resume');
    await page.waitForFunction(() => window.__sim.S && !document.getElementById('sim-session').hidden, { timeout: 20000 }); await sleep(250);
    w = await S(() => ({ ch: window.__sim.S.challenge, box: !document.getElementById('sim-ch').hidden, st: window.__sim.S.strategy }));
    assert(w.ch && w.ch.status === 'activ' && w.ch.targetPct === 8 && w.box && w.st && w.st.name === 'Pullback', `${L}: resume keeps challenge + strategy`);
    await page.evaluate(() => window.__sim.endSession()); await sleep(300);
    await back();

    // ---------- 6. istoric: statistici pe toate sesiunile + comparare ----------
    await page.evaluate(() => document.getElementById('sim-hstats').scrollIntoView());
    w = await S(() => {
      const cmp = document.querySelector('#sim-h-compare table');
      const head = cmp ? [...cmp.querySelectorAll('thead th')].map(t => t.textContent.trim()) : [];
      const row = lab => { const r = [...cmp.querySelectorAll('tbody tr')].find(r => r.querySelector('th').textContent === lab); return r ? [...r.querySelectorAll('td')].map(c => c.textContent) : null; };
      return { vis: !document.getElementById('sim-hstats').hidden, head, sess: row('Sesiuni'), n: row('Tranzacții'), ch: row('Provocări trecute'),
        tiles: [...document.querySelectorAll('#sim-h-tiles .sim-tile strong')].map(e => e.textContent), opts: [...document.querySelectorAll('#sim-hf-strat option')].map(o => o.textContent),
        badges: [...document.querySelectorAll('#sim-history-list .sim-badge')].map(b => b.textContent), detail: !!document.querySelector('#sim-h-detail .st-keys') };
    });
    assert(w.vis && w.head.slice(1).map(h => h.replace(' ★', '')).sort().join() === 'Breakout H4,Pullback', `${L}: comparison table, one column per strategy ${w.head}`);
    const iP = w.head.findIndex(h => h.startsWith('Pullback')) - 1, iB = w.head.findIndex(h => h.startsWith('Breakout')) - 1;
    assert(w.sess[iP] === '1' && w.sess[iB] === '2' && /^3/.test(w.n[iP]) && /^2/.test(w.n[iB]) && w.ch[iB] === '1 din 2' && w.ch[iP] === '—', `${L}: comparison counts (sessions ${w.sess}, trades ${w.n}, challenges ${w.ch})`);
    assert(w.tiles[0] === '5' && w.opts.join() === 'Toate strategiile,Breakout H4,Pullback' && w.detail, `${L}: all-session tiles + filters + detail`);
    assert(w.badges.includes('Provocare trecută') && w.badges.includes('Provocare picată') && w.badges.includes('Pullback'), `${L}: history list badges`);
    await page.select('#sim-hf-strat', 'Pullback'); await sleep(150);
    w = await S(() => ({ n: document.querySelector('#sim-h-tiles .sim-tile strong').textContent, setups: [...document.querySelectorAll('#sim-hf-setup option')].map(o => o.textContent) }));
    assert(w.n === '3' && w.setups.includes('Breakout') && w.setups.includes('(fără setup)'), `${L}: filter by strategy -> 3 trades`);
    await page.select('#sim-hf-setup', 'Pullback'); await sleep(150);
    assert(await S(() => document.querySelector('#sim-h-tiles .sim-tile strong').textContent) === '1', `${L}: filter by setup -> 1 trade`);
    await page.select('#sim-hf-setup', ''); await page.select('#sim-hf-strat', '');
    // export CSV istoric
    const dl = `/tmp/simdl-${L}`; fs.rmSync(dl, { recursive: true, force: true }); fs.mkdirSync(dl);
    const cdp = await page.target().createCDPSession(); await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
    await page.evaluate(() => document.getElementById('sim-h-csv').click());
    let f = null; for (let k = 0; k < 30 && !f; k++) { await sleep(150); f = fs.readdirSync(dl).find(x => x.endsWith('.csv')); }
    const lines = f ? fs.readFileSync(`${dl}/${f}`, 'utf8').replace(/^\ufeff/, '').trim().split(/\r\n/) : [];
    assert(f && /^simulator-istoric-\d{4}-\d\d-\d\d\.csv$/.test(f) && lines.length === 6 && /tranzacții/.test(await S(() => document.getElementById('sim-h-msg').textContent)), `${L}: history CSV export (${f}, ${lines.length - 1} trades)`);
    if (process.env.SHOTS && L === 'desktop-1280') {
      await page.evaluate(() => document.getElementById('sim-h-compare').scrollIntoView({ block: 'start' })); await page.evaluate(() => scrollBy(0, -70)); await sleep(300);
      await page.screenshot({ path: process.env.SHOTS + '/strategy-comparison.png' });
    }
    assert(!(await overflow()), `${L}: setup page with history stats: no horizontal overflow`);
    // numele strategiei salvate completează câmpurile
    await page.evaluate(() => { document.getElementById('sim-strat-setup').open = true; const n = document.getElementById('sim-st-name'); n.value = 'Pullback'; n.dispatchEvent(new Event('change', { bubbles: true })); });
    w = await S(() => [document.getElementById('sim-st-rules').value, document.getElementById('sim-st-check').value, [...document.querySelectorAll('#sim-st-names option')].map(o => o.value).sort().join()]);
    assert(/trend/.test(w[0]) && w[1] === 'Trend pe H4\nR:R minim 1:2' && w[2] === 'Breakout H4,Pullback', `${L}: saved strategy refills rules/checklist, names suggested ${JSON.stringify(w)}`);
    // ștergerea istoricului ascunde statisticile
    await page.click('#sim-clear'); await sleep(200);
    assert(await S(() => document.getElementById('sim-hstats').hidden && document.getElementById('sim-history').hidden), `${L}: clearing history hides stats`);
    assert(errors.length === 0, `${L}: no console/page errors ${errors.slice(0, 3).join(' | ')}`);
    await page.close();
  }
  await browser.close();
  console.log(fails ? `${fails} FAILED, ${oks} ok` : `ALL PASSED ${oks} ok`);
  process.exit(fails ? 1 : 0);
})();
