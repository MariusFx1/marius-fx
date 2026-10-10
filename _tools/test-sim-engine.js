// Teste unitare pentru motorul simulatorului (Node, fără browser), cu bare sintetice.
const E = require('/workspace/forex-ms/sim-engine.js');
const fs = require('fs'), zlib = require('zlib'), path = require('path');
let ok = 0, fail = 0;
const assert = (c, m) => { if (c) { ok++; console.log('ok  - ' + m); } else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const bar = (o, h, l, c) => ({ o, h, l, c });

// 1. Buy EURUSD: intrare la ASK = 1.10000 + 1 pip spread
let p = E.openMarket({ sym: 'EURUSD', side: 'buy', bidClose: 1.10000, sl: 1.09810, tp: 1.10410, lot: 0.5, pipVal: 10, time: 0, idx: 0 });
assert(near(p.entry, 1.10010) && near(p.slPips0, 20, 1e-6) && p.riskMoney === 100, `buy: entry at ask 1.10010, SL 20 pips, risk 100 (${p.entry}, ${p.slPips0}, ${p.riskMoney})`);
assert(E.checkExit(p, bar(1.1000, 1.1030, 1.0990, 1.1020)) === null, 'buy: bar inside SL/TP → no exit');
let x = E.checkExit(p, bar(1.1020, 1.1045, 1.1010, 1.1040));
let r = E.result(p, x.price);
assert(x.reason === 'TP' && near(x.price, 1.10410) && r.pips === 40 && r.r === 2 && r.money === 200, `buy: TP hit on high → +40 pips, +2R, +200 (${JSON.stringify(r)})`);
x = E.checkExit(p, bar(1.1000, 1.1045, 1.0980, 1.1000)); r = E.result(p, x.price);
assert(x.reason === 'SL' && x.both === true && r.r === -1 && r.money === -100, 'buy: SL and TP in same bar → SL first (conservative), -1R');
x = E.checkExit(p, bar(1.0970, 1.0990, 1.0960, 1.0980)); r = E.result(p, x.price);
assert(x.reason === 'SL' && x.gap && near(x.price, 1.0970) && r.pips === -31 && r.r === -1.55, `buy: gap below SL → exit at open 1.0970, -31 pips, -1.55R (${JSON.stringify(r)})`);
assert(E.checkExit(p, bar(1.1000, 1.1040, 1.09811, 1.1)) === null, 'buy: TP not reached at 1.1040 bid, SL not at 1.09811');

// 2. Sell EURUSD: intrare la BID, ieșire la ASK (bid + spread)
p = E.openMarket({ sym: 'EURUSD', side: 'sell', bidClose: 1.10000, sl: 1.10200, tp: 1.09600, lot: 1, pipVal: 10, time: 0, idx: 0 });
assert(near(p.entry, 1.1) && near(p.slPips0, 20, 1e-6), 'sell: entry at bid 1.10000, SL 20 pips');
assert(E.checkExit(p, bar(1.1, 1.10189, 1.0962, 1.1)) === null, 'sell: ask high 1.10199 < SL, ask low 1.09630 > TP → no exit');
x = E.checkExit(p, bar(1.1, 1.10190, 1.0990, 1.1)); r = E.result(p, x.price);
assert(x.reason === 'SL' && r.r === -1 && r.money === -200, 'sell: ask touches SL (bid high 1.10190 + spread) → -1R');
x = E.checkExit(p, bar(1.0990, 1.1000, 1.09590, 1.096)); r = E.result(p, x.price);
assert(x.reason === 'TP' && r.pips === 40 && r.r === 2 && r.money === 400, 'sell: ask low reaches TP → +40 pips, +2R');

// 3. Break-even
p = E.openMarket({ sym: 'EURUSD', side: 'buy', bidClose: 1.1, sl: 1.098, tp: 1.106, lot: 1, pipVal: 10, time: 0, idx: 0 });
p.sl = p.entry; p.be = true;
x = E.checkExit(p, bar(1.1005, 1.1008, 1.1000, 1.1002)); r = E.result(p, x.price);
assert(x.reason === 'BE' && r.money === 0 && r.r === 0, 'break-even: SL moved to entry → exit BE, 0R, 0 money');

// 4. Ordine în așteptare
const ord = (side, kind, price) => ({ sym: 'EURUSD', side, kind, price });
assert(near(E.pendingTriggered(ord('buy', 'limit', 1.0990), bar(1.1, 1.1, 1.0989, 1.0995)), 1.0990), 'buy limit fills when ASK low (bid 1.0989 + 1 pip) reaches 1.0990');
assert(E.pendingTriggered(ord('buy', 'limit', 1.0990), bar(1.1, 1.1, 1.09895, 1.0995)) === null, 'buy limit not filled when ASK low stays above');
assert(near(E.pendingTriggered(ord('buy', 'stop', 1.1050), bar(1.1060, 1.1070, 1.1055, 1.106)), 1.1061), 'buy stop gapped through → fill at open ask 1.1061 (slippage)');
assert(near(E.pendingTriggered(ord('sell', 'limit', 1.1050), bar(1.1, 1.1050, 1.0990, 1.1)), 1.1050), 'sell limit fills at bid high 1.1050');
assert(near(E.pendingTriggered(ord('sell', 'stop', 1.0950), bar(1.0940, 1.0960, 1.0930, 1.094)), 1.0940), 'sell stop gapped through → fill at open 1.0940');
p = E.makePosition({ sym: 'EURUSD', side: 'buy', sl: 1.0970, tp: 1.1050, lot: 1, pipVal: 10, time: 0, idx: 0, type: 'limit' }, 1.0990);
x = E.checkExit(p, bar(1.1, 1.1060, 1.0960, 1.1), true);
assert(x && x.reason === 'SL', 'fill bar: only SL checked (TP skipped, conservative)');

// 5. Valoare pip + lot (aceeași regulă ca în calculator)
const pv = E.pipValueAcct('EURUSD', 1.1, 'EUR', { EURUSD: 1.1, GBPUSD: 1.3, USDJPY: 110 });
assert(near(pv, 10 / 1.1) && E.lotFor(100, 20, pv) === 0.55, `EUR account: pip 9.0909 EUR, risk 100 / SL 20 → 0.55 lot (${E.lotFor(100, 20, pv)})`);
assert(near(E.pipValueAcct('USDJPY', 125, 'USD', { USDJPY: 125 }), 8), 'USDJPY at 125: pip = 1000/125 = 8 USD');
assert(near(E.pipValueAcct('GBPJPY', 140, 'USD', { USDJPY: 110 }), 1000 / 110), 'GBPJPY: pip uses historical USDJPY (110) → 9.09 USD');
assert(near(E.pipValueAcct('XAUUSD', 1800, 'GBP', { GBPUSD: 1.25 }), 8), 'XAUUSD in GBP: 10 USD / 1.25 = 8 GBP per pip');
assert(E.lotFor(100, 300, 10) === 0.03 && E.lotFor(5, 300, 10) === 0, 'lot floored to 0.01; below 0.01 → 0');
p = E.openMarket({ sym: 'XAUUSD', side: 'buy', bidClose: 1800.00, sl: 1790.00, tp: 1830.00, lot: 0.1, pipVal: 10, time: 0, idx: 0 });
assert(near(p.entry, 1800.30) && near(p.slPips0, 103, 1e-6) && p.riskMoney === 103, `XAUUSD buy: spread 0.30, entry 1800.30, SL 103 pips, risk 103 USD (${p.entry}, ${p.slPips0})`);
x = E.checkExit(p, bar(1801, 1830.2, 1795, 1829)); r = E.result(p, x.price);
assert(x.reason === 'TP' && r.pips === 297 && r.r === 2.88 && r.money === 297, `XAUUSD TP: +297 pips, +2.88R, +297 USD (${JSON.stringify(r)})`);
p = E.openMarket({ sym: 'USDJPY', side: 'sell', bidClose: 150.000, sl: 150.500, tp: 149.000, lot: 0.2, pipVal: 1000 / 150, time: 0, idx: 0 });
x = E.checkExit(p, bar(149.9, 150.0, 148.987, 149.2)); r = E.result(p, x.price);
assert(x.reason === 'TP' && r.pips === 100 && r.r === 2 && r.money === 133.33, `USDJPY sell: ask low 148.999 hits TP 149.000 → +100 pips, 2R, 133.33 (${JSON.stringify(r)})`);

// 6. Validare
assert(E.validateLevels('buy', 1.1, 1.101, 1.105) === 'La Buy, stop loss-ul trebuie să fie sub prețul de intrare.', 'validate: buy SL above entry');
assert(E.validateLevels('sell', 1.1, 1.102, 1.105) === 'La Sell, take profit-ul trebuie să fie sub prețul de intrare.', 'validate: sell TP above entry');
assert(E.validateLevels('buy', 1.1, 1.098, null) === null && E.validateLevels('sell', 1.1, 1.102, 1.096) === null, 'validate: correct levels pass (TP optional)');

// 7. Statistici
const T = [100, -50, 200, -100, -100, 0].map((m, i) => ({ money: m, r: [1, -0.5, 2, -1, -1, 0][i] }));
const s = E.stats(T, 10000);
assert(s.n === 6 && s.wins === 2 && s.losses === 3 && s.be === 1 && near(s.winRate, 1 / 3), 'stats: 6 trades, 2 wins, 3 losses, 1 BE, win rate 33.3%');
assert(s.totalR === 0.5 && s.avgR === 0.08 && s.profitFactor === 1.2, `stats: total R 0.5, avg R 0.08, profit factor 300/250 = 1.2 (${s.totalR}, ${s.avgR}, ${s.profitFactor})`);
assert(s.maxDD === 200 && near(s.maxDDPct, 200 / 10250) && s.net === 50 && s.balance === 10050, `stats: max drawdown 200 (1.95% from peak 10250), net +50 (${s.maxDD})`);
assert(JSON.stringify(s.curve) === JSON.stringify([10000, 10100, 10050, 10250, 10150, 10050, 10050]) && s.best.money === 200 && s.worst.money === -100, 'stats: equity curve + best/worst');
assert(E.stats([{ money: 50, r: 1 }], 1000).profitFactor === Infinity && E.stats([], 1000).winRate === null, 'stats: PF ∞ with no losses; empty session');

// 8. Date reale: decodare + verificare față de M1 brut (o bară H1 și o bară D1)
const d = E.decode(JSON.parse(fs.readFileSync('/workspace/forex-ms/data/sim/EURUSD-H1-2024.json')));
const i = Array.from(d.t).indexOf(Date.UTC(2024, 6, 10, 13) / 1000);   // 10 iul 2024, 13:00 UTC
assert(i > 0 && d.n > 6000, `EURUSD H1 2024 decoded: ${d.n} bars, bar 2024-07-10 13:00 UTC found`);
const { execSync } = require('child_process');
// ceas HistData = Europe/Athens - 7h → 13:00 UTC (vara: Athens 16:00) = 09:00 în fișier
const rows = execSync(`unzip -p /workspace/forex-ms-tools/simdata/hd/eurusd-2024.zip '*.csv' | grep '^20240710 09'`).toString().trim().split('\n').map(l => l.split(';').slice(1, 5).map(Number));
const ref = [rows[0][0], Math.max(...rows.map(r => r[1])), Math.min(...rows.map(r => r[2])), rows[rows.length - 1][3]].map(v => Math.round(v * 1e5) / 1e5);
assert(JSON.stringify([d.o[i], d.h[i], d.l[i], d.c[i]]) === JSON.stringify(ref), `H1 bar matches raw M1 aggregate ${JSON.stringify(ref)}`);
const d1 = E.decode(JSON.parse(fs.readFileSync('/workspace/forex-ms/data/sim/EURUSD-D1.json')));
const wd = new Set(Array.from(d1.t).map(t => new Date(t * 1000).getUTCDay()));
assert(!wd.has(0) && !wd.has(6) && d1.n > 1800, `D1: only Mon-Fri trading days (${d1.n} bars)`);
let okOhlc = true; for (let k = 0; k < d.n; k++) if (!(d.l[k] <= Math.min(d.o[k], d.c[k]) && Math.max(d.o[k], d.c[k]) <= d.h[k])) okOhlc = false;
assert(okOhlc, 'decoded bars are OHLC-consistent');
const both = E.concat(d, E.decode(JSON.parse(fs.readFileSync('/workspace/forex-ms/data/sim/EURUSD-H1-2025.json'))));
let mono = true; for (let k = 1; k < both.n; k++) if (both.t[k] <= both.t[k - 1]) mono = false;
assert(mono && both.n > 12000, 'concat 2024+2025: strictly increasing times');
const idx = JSON.parse(fs.readFileSync('/workspace/forex-ms/data/sim/index.json'));
assert(JSON.stringify(idx.instruments.EURUSD.incomplete) === JSON.stringify([[Date.UTC(2023, 1, 1) / 1000, Date.UTC(2023, 7, 1) / 1000]]), 'index.json: EURUSD incomplete source window = Feb-Jul 2023 only');

// ================= funcții noi: timp, agregare fără lookahead, parțiale, indicatori, provocare, statistici =================
// timp (DST)
assert(E.nyOffset(Date.UTC(2024, 2, 10, 6, 59) / 1000) === -5 && E.nyOffset(Date.UTC(2024, 2, 10, 7) / 1000) === -4 && E.nyOffset(Date.UTC(2024, 10, 3, 5, 59) / 1000) === -4 && E.nyOffset(Date.UTC(2024, 10, 3, 6) / 1000) === -5, 'nyOffset: US DST switches (10 Mar / 3 Nov 2024)');
let rp = E.roParts(Date.UTC(2024, 2, 31, 0, 30) / 1000), rp2 = E.roParts(Date.UTC(2024, 2, 31, 1, 30) / 1000);
assert(rp.h === 2 && rp2.h === 4 && E.roParts(Date.UTC(2024, 6, 10, 7) / 1000).h === 10 && E.roParts(Date.UTC(2024, 6, 10, 7) / 1000).wd === 3 && E.roParts(Date.UTC(2024, 0, 15, 7) / 1000).h === 9, 'roParts: Romanian time incl. EU DST (31 Mar 2024), weekday');
assert(E.roParts(Date.UTC(2024, 9, 27, 0, 30) / 1000).h === 3 && E.roParts(Date.UTC(2024, 9, 27, 1, 30) / 1000).h === 3, 'roParts: autumn switch (27 Oct 2024)');
// agregare H1 → H4/D1 identică cu fișierele publicate (toate instrumentele, 2024-2025)
for (const sym of ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'AUDUSD', 'GBPJPY']) {
  const h = E.concat(E.decode(JSON.parse(fs.readFileSync(`/workspace/forex-ms/data/sim/${sym}-H1-2024.json`))), E.decode(JSON.parse(fs.readFileSync(`/workspace/forex-ms/data/sim/${sym}-H1-2025.json`))));
  let bad = 0, cnt = 0;
  for (const tf of ['H4', 'D1']) {
    const f = E.decode(JSON.parse(fs.readFileSync(`/workspace/forex-ms/data/sim/${sym}-${tf}.json`))), m = new Map(); for (let i = 0; i < f.n; i++) m.set(f.t[i], i);
    const a = E.aggregate(h, h.n - 1, tf);
    for (let k = 1; k < a.time.length - 1; k++) { const i = m.get(a.time[k]); if (i == null) { bad++; continue; } cnt++; if (![['o', 'o'], ['h', 'h'], ['l', 'l'], ['c', 'c']].every(([x, y]) => Math.abs(a[x][k] - f[y][i]) < 1e-9)) bad++; }
  }
  assert(bad === 0 && cnt > 3500, `${sym}: H1→H4/D1 aggregation equals published H4/D1 bars (${cnt} bars)`);
}
// fără lookahead: bara în formare folosește doar H1 până la ora curentă, iar modificarea viitorului nu schimbă nimic
{
  const h = E.decode(JSON.parse(fs.readFileSync('/workspace/forex-ms/data/sim/EURUSD-H1-2024.json')));
  let k = 3000; while (E.isBucketEnd(h, k, 'D1')) k++;   // un index la mijlocul unei zile de tranzacționare
  const a = E.aggregate(h, k, 'D1'), last = a.time.length - 1;
  let i0 = k; while (i0 > 0 && E.bucketStart(h.t[i0 - 1], 'D1') === a.time[last]) i0--;
  let hi = -Infinity, lo = Infinity; for (let i = i0; i <= k; i++) { hi = Math.max(hi, h.h[i]); lo = Math.min(lo, h.l[i]); }
  assert(a.o[last] === h.o[i0] && a.h[last] === hi && a.l[last] === lo && a.c[last] === h.c[k] && a.last[last] === k, 'forming D1 candle = only H1 bars up to now (open of first hour, max/min so far, close of current hour)');
  const fut = { n: h.n, t: h.t, o: Float64Array.from(h.o), h: Float64Array.from(h.h), l: Float64Array.from(h.l), c: Float64Array.from(h.c) };
  for (let i = k + 1; i < h.n; i++) { fut.h[i] = 99; fut.l[i] = 0.01; fut.c[i] = 50; fut.o[i] = 50; }
  const b = E.aggregate(fut, k, 'D1'), b4 = E.aggregate(fut, k, 'H4'), a4 = E.aggregate(h, k, 'H4');
  assert(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a4) === JSON.stringify(b4), 'changing future H1 bars does not change aggregated view (no lookahead)');
  const inc = { time: [], o: [], h: [], l: [], c: [], last: [] }; for (let i = 0; i <= k; i++) E.appendBar(inc, h, i, 'H4');
  assert(JSON.stringify(inc) === JSON.stringify(a4), 'incremental appendBar equals full aggregate');
  assert(E.isBucketEnd(h, h.n - 1, 'D1') === false && E.isBucketEnd(h, 5, 'H1') === true, 'isBucketEnd: unknown next bar → not complete; H1 always complete');
}
// închidere parțială: R raportat la riscul inițial
{
  let P = E.openMarket({ sym: 'EURUSD', side: 'buy', bidClose: 1.10000, sl: 1.09810, tp: 1.10410, lot: 1, pipVal: 10, time: 0, idx: 0 });   // intrare 1.10010, SL 20 pips, risc 200
  let a = E.closePart(P, 1.10210, 0.5, 'Parțial', 1);
  assert(a.money === 100 && near(a.r, 0.5) && P.lot === 0.5 && P.lot0 === 1, `partial 50% at +20 pips: +100, +0.5R, 0.5 lot left (${JSON.stringify(a)})`);
  E.closePart(P, 1.09810, P.lot, 'SL', 2);
  let sm = E.summarize(P);
  assert(sm.money === 0 && sm.r === 0 && sm.parts === 2 && sm.lot0 === 1 && near(sm.exit, 1.1001) && sm.pips === 0, `half at +1R, rest at SL → 0 money, 0R total (${JSON.stringify(sm)})`);
  P = E.openMarket({ sym: 'EURUSD', side: 'sell', bidClose: 1.10000, sl: 1.10220, tp: 1.09600, lot: 1, pipVal: 10, time: 0, idx: 0 });   // sell la 1.10000, SL 22 pips → risc 220
  const l25 = E.partialLot(P, 0.25);
  E.closePart(P, 1.09780 + 0.0001, l25, 'Parțial', 1);   // închidere la ask: +21 pips
  E.closePart(P, 1.09600 + 0.0001, P.lot, 'TP', 2);       // +39 pips
  sm = E.summarize(P);
  const expR = (21 * 0.25 + 39 * 0.75) / 22, expM = Math.round(21 * 10 * 0.25 * 100) / 100 + Math.round(39 * 10 * 0.75 * 100) / 100;
  assert(l25 === 0.25 && near(sm.r, Math.round(expR * 100) / 100) && near(sm.money, expM, 0.011), `sell: 25% at +21 pips, rest at TP +39 → ${sm.r}R (expected ${expR.toFixed(4)}), ${sm.money}`);
  assert(E.partialLot({ lot: 0.03 }, 0.5) === 0.01 && E.partialLot({ lot: 0.01 }, 0.5) === null && E.partialLot({ lot: 0.02 }, 0.75) === 0.01 && E.partialLot({ lot: 1 }, 1) === null, 'partialLot: floors to 0.01, refuses empty or full');
  // poziții multiple independente + statistici pe tranzacții (o tranzacție = o poziție, cu toate părțile)
  const A = E.openMarket({ sym: 'EURUSD', side: 'buy', bidClose: 1.1, sl: 1.099, tp: null, lot: 0.4, pipVal: 10, time: 0, idx: 0 });
  const B = E.openMarket({ sym: 'EURUSD', side: 'sell', bidClose: 1.1, sl: 1.101, tp: null, lot: 0.4, pipVal: 10, time: 0, idx: 0 });
  const bb = { o: 1.1, h: 1.1012, l: 1.0995, c: 1.1005 };
  const xa = E.checkExit(A, bb), xb = E.checkExit(B, bb);
  assert(xa === null && xb && xb.reason === 'SL', 'two positions: same bar hits only the Sell SL, Buy stays open');
  E.closePart(A, 1.1, 0.2, 'Parțial', 1); E.closePart(A, 1.1011, 0.2, 'Manual', 2); E.closePart(B, xb.price, B.lot, 'SL', 1);
  const tr = [E.summarize(B), E.summarize(A)].map(x => ({ money: x.money, r: x.r }));
  const st = E.stats(tr, 10000);
  assert(st.n === 2 && st.wins === 1 && st.losses === 1 && near(st.totalR, tr[0].r + tr[1].r), `stats count 2 trades (partials inside one trade): ${JSON.stringify(tr)}`);
}
// indicatori: valori de referință
{
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const s3 = E.sma(x, 3), e3 = E.ema(x, 3);
  assert(Number.isNaN(s3[1]) && s3[2] === 2 && s3[9] === 9 && e3[2] === 2 && e3[3] === 3 && e3[9] === 9 && Number.isNaN(e3[1]), 'SMA/EMA on 1..10 (seeded EMA, k=2/(n+1))');
  // RSI(14) exemplul clasic Wilder (StockCharts afișează 70,53 / 66,32 cu medii rotunjite la 2 zecimale; calculul exact: câștig mediu 3,34/14, pierdere medie 1,40/14 → 70,46, apoi 66,25)
  const w = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00];
  const R = E.rsi(w, 14);
  assert(Math.abs(R[14] - (100 - 100 / (1 + 3.34 / 1.40))) < 1e-6 && Math.abs(R[15] - (100 - 100 / (1 + (3.34 / 14 * 13 / 14) / ((1.40 / 14 * 13 + 0.28) / 14)))) < 1e-6 && Number.isNaN(R[13]), `RSI(14) matches exact Wilder reference 70.46 / 66.25 (${R[14].toFixed(2)} / ${R[15].toFixed(2)})`);
  const y = Array.from({ length: 20 }, (_, i) => i + 1), bbd = E.bollinger(y, 20, 2);
  assert(near(bbd.mid[19], 10.5) && near(bbd.up[19], 10.5 + 2 * Math.sqrt(399 / 12), 1e-9) && near(bbd.lo[19], 10.5 - 2 * Math.sqrt(399 / 12), 1e-9), 'Bollinger(20,2) on 1..20: 10.5 ± 2·5.766');
  // implementări naive independente pentru MACD și ATR pe date reale
  const h = E.decode(JSON.parse(fs.readFileSync('/workspace/forex-ms/data/sim/EURUSD-H1-2024.json')));
  const c = Array.from(h.c.subarray(0, 400)), H = Array.from(h.h.subarray(0, 400)), L = Array.from(h.l.subarray(0, 400));
  const naiveEma = (a, n) => { const out = []; let e = null; for (let i = 0; i < a.length; i++) { if (!Number.isFinite(a[i])) { out.push(NaN); continue; } if (e == null) { const win = a.slice(i, i + n); if (win.length < n || win.some(v => !Number.isFinite(v))) { out.push(NaN); continue; } } out.push(NaN); } return out; };
  void naiveEma;
  const refEma = (a, n) => { const out = new Array(a.length).fill(NaN); let st0 = a.findIndex(Number.isFinite); let e = a.slice(st0, st0 + n).reduce((s, v) => s + v, 0) / n; out[st0 + n - 1] = e; for (let i = st0 + n; i < a.length; i++) { e = (a[i] - e) * (2 / (n + 1)) + e; out[i] = e; } return out; };
  const m = E.macd(c, 12, 26, 9), l1 = refEma(c, 12).map((v, i) => v - refEma(c, 26)[i]), sg = refEma(l1, 9);
  let mx = 0; for (let i = 0; i < 400; i++) if (Number.isFinite(sg[i])) mx = Math.max(mx, Math.abs(m.line[i] - l1[i]), Math.abs(m.signal[i] - sg[i]), Math.abs(m.hist[i] - (l1[i] - sg[i])));
  assert(mx < 1e-12 && Number.isNaN(m.signal[32]) && Number.isFinite(m.signal[33]), 'MACD(12,26,9) equals reference EMA calc; signal starts at bar 34');
  const tr = i => (i === 0 ? H[0] - L[0] : Math.max(H[i] - L[i], Math.abs(H[i] - c[i - 1]), Math.abs(L[i] - c[i - 1])));
  let a14 = 0; for (let i = 0; i < 14; i++) a14 += tr(i); a14 /= 14; for (let i = 14; i <= 100; i++) a14 = (a14 * 13 + tr(i)) / 14;
  assert(near(E.atr(H, L, c, 14)[100], a14, 1e-12), 'ATR(14) Wilder equals reference');
  // fără lookahead: valoarea la indexul i nu depinde de barele de după i
  const k = 250, pre = E.rsi(c.slice(0, k + 1), 14)[k] === E.rsi(c, 14)[k] && E.ema(c.slice(0, k + 1), 20)[k] === E.ema(c, 20)[k] && E.macd(c.slice(0, k + 1), 12, 26, 9).hist[k] === m.hist[k] && E.bollinger(c.slice(0, k + 1), 20, 2).up[k] === E.bollinger(c, 20, 2).up[k] && E.atr(H.slice(0, k + 1), L.slice(0, k + 1), c.slice(0, k + 1), 14)[k] === E.atr(H, L, c, 14)[k];
  assert(pre, 'indicators are causal: value at bar i identical when computed only from bars ≤ i');
}
// mod provocare
{
  const mk = () => E.challengeInit({ start: 10000, targetPct: 8, dailyPct: 5, totalPct: 10 });
  let ch = mk();
  E.challengeStep(ch, { dayKey: 'd1', balanceStart: 10000, worst: 9600, equity: 9700 });
  assert(ch.status === 'activ' && ch.dayStart === 10000, 'challenge: -4% intraday stays active');
  E.challengeStep(ch, { dayKey: 'd1', balanceStart: 9700, worst: 9499, equity: 9600 });
  assert(ch.status === 'picat' && ch.reason === 'zilnic', 'challenge: equity below day start - 5% → failed (daily)');
  ch = mk();
  E.challengeStep(ch, { dayKey: 'd1', balanceStart: 10000, worst: 9600, equity: 9600 });
  E.challengeStep(ch, { dayKey: 'd2', balanceStart: 9600, worst: 9150, equity: 9200 });
  assert(ch.status === 'activ' && ch.dayStart === 9600, 'challenge: daily limit resets at new day from day-start balance');
  E.challengeStep(ch, { dayKey: 'd2', balanceStart: 9200, worst: 9000, equity: 9100 });
  assert(ch.status === 'picat' && ch.reason === 'total', 'challenge: equity at start - 10% → failed (total drawdown)');
  ch = mk(); E.challengeStep(ch, { dayKey: 'd1', balanceStart: 10000, worst: 10500, equity: 10800 });
  assert(ch.status === 'trecut' && ch.reason === 'tinta', 'challenge: equity reaches +8% → passed');
  ch = mk(); E.challengeStep(ch, { dayKey: 'd1', balanceStart: 10000, worst: 9450, equity: 10800 });
  assert(ch.status === 'picat', 'challenge: loss limit checked before target in the same bar (conservative)');
  const before = JSON.stringify(ch); E.challengeStep(ch, { dayKey: 'd9', balanceStart: 20000, worst: 30000, equity: 30000 });
  assert(JSON.stringify(ch) === before, 'challenge: finished state is final');
  ch = mk(); E.challengeStep(ch, { dayKey: 'd1', balanceStart: 10000, worst: 9900, equity: 10200 });
  const pg = E.challengeProgress(ch, 10200);
  assert(near(pg.profit, 0.25) && pg.daily === 0 && pg.total === 0 && pg.target === 10800 && pg.dailyLimit === 9500 && pg.totalLimit === 9000, `challenge progress: 25% of target (${JSON.stringify(pg)})`);
}
// statistici detaliate
{
  const T = (r, money, side, sym, entryT, h) => ({ r, money, side, sym, entryT, exitT: entryT + h * 3600 });
  const t0 = Date.UTC(2024, 6, 10, 7) / 1000;   // miercuri 10:00 ora României
  const tr = [T(2, 200, 'buy', 'EURUSD', t0, 5), T(1, 100, 'buy', 'EURUSD', t0 + 86400, 3), T(-1, -100, 'sell', 'GBPUSD', t0 + 2 * 86400, 2), T(-1, -100, 'sell', 'EURUSD', t0 + 5 * 86400, 1), T(-0.5, -50, 'buy', 'EURUSD', t0 + 6 * 86400, 1), T(3.5, 350, 'sell', 'GBPUSD', t0 + 7 * 86400, 12)];
  const D = E.detailed(tr);
  assert(D.n === 6 && D.maxConsecWins === 2 && D.maxConsecLosses === 3, 'detailed: max consecutive wins 2 / losses 3');
  assert(near(D.expectancyR, 4 / 6) && near(D.avgWin, 650 / 3) && near(D.avgLoss, -250 / 3) && near(D.avgWinR, 6.5 / 3) && near(D.avgLossR, -2.5 / 3), 'detailed: expectancy and average win/loss (money and R)');
  assert(D.bySym.EURUSD.n === 4 && D.bySym.GBPUSD.r === 2.5 && D.bySide.buy.n === 3 && D.bySide.sell.money === 150, 'detailed: per instrument and long/short');
  assert(D.byWd[3].n === 2 && D.byWd[4].n === 1 && D.byHour[10].n === 6, 'detailed: per weekday and entry hour (Romanian time)');
  assert(JSON.stringify(D.hist.map(b => b.n)) === JSON.stringify([0, 2, 1, 1, 1, 0, 1]) && D.hist[1].label === '−2R…−1R', `detailed: R histogram bins ${JSON.stringify(D.hist.map(b => b.n))}`);
  assert(near(D.avgHoldSec, 24 * 3600 / 6) && D.maxDDR === 2.5 && D.rCurve.length === 7, 'detailed: average holding time, R drawdown, R curve');
  assert(E.detailed([]).expectancyR === null && E.detailed([]).n === 0, 'detailed: empty input');
}

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED', ok, 'ok');
process.exit(fail ? 1 : 0);
