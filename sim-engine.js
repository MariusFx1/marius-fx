/* ============================================================
   Marius FX: motorul simulatorului de backtesting (fără DOM)
   Folosit de sim.js în browser și testat separat în Node.
   Convenții (aceleași ca la calculatorul de lot):
   pip = 0,0001 (0,01 la perechile JPY, 0,10 la XAUUSD);
   1 lot standard: 10 USD/pip la perechile cu USD la final și la XAUUSD.
   Graficul afișează prețul BID. Buy intră la ASK (bid + spread) și iese la BID;
   Sell intră la BID și iese la ASK (bid + spread).
   ============================================================ */
(function (root) {
  'use strict';

  const INSTR = {
    EURUSD: { dec: 5, pip: 0.0001, spread: 1.0, nume: 'EUR/USD' },
    GBPUSD: { dec: 5, pip: 0.0001, spread: 1.5, nume: 'GBP/USD' },
    USDJPY: { dec: 3, pip: 0.01, spread: 1.2, nume: 'USD/JPY' },
    XAUUSD: { dec: 2, pip: 0.1, spread: 3.0, nume: 'XAU/USD (aur)' },
    AUDUSD: { dec: 5, pip: 0.0001, spread: 1.2, nume: 'AUD/USD' },
    GBPJPY: { dec: 3, pip: 0.01, spread: 2.5, nume: 'GBP/JPY' }
  };
  const TF_SEC = { H1: 3600, H4: 14400, D1: 86400 };

  /** Decodează un fișier JSON compact (vezi sim_build.py) în tablouri tipizate. */
  function decode(j) {
    const n = j.b.length / 5, m = Math.pow(10, j.dec);
    const t = new Float64Array(n), o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n);
    let pt = j.t0, pc = 0;
    for (let i = 0, k = 0; i < n; i++, k += 5) {
      pt += j.b[k] * 60;
      const O = i === 0 ? j.b[k + 1] : pc + j.b[k + 1];
      const C = O + j.b[k + 4];
      t[i] = pt; o[i] = O / m; h[i] = (O + j.b[k + 2]) / m; l[i] = (O - j.b[k + 3]) / m; c[i] = C / m;
      pc = C;
    }
    return { s: j.s, tf: j.tf, dec: j.dec, n, t, o, h, l, c };
  }

  /** Lipește două serii decodate (an anterior + an curent), fără dubluri. */
  function concat(a, b) {
    if (!a) return b; if (!b) return a;
    const last = a.t[a.n - 1];
    let s = 0; while (s < b.n && b.t[s] <= last) s++;
    const n = a.n + b.n - s, out = { s: a.s, tf: a.tf, dec: a.dec, n };
    for (const k of ['t', 'o', 'h', 'l', 'c']) { const x = new Float64Array(n); x.set(a[k], 0); x.set(b[k].subarray(s), a.n); out[k] = x; }
    return out;
  }

  const round = (x, d) => { const m = Math.pow(10, d); return Math.round(x * m) / m; };
  const pipOf = sym => INSTR[sym].pip;
  const spreadPrice = sym => INSTR[sym].spread * INSTR[sym].pip;

  /** Valoarea unui pip pentru 1 lot, în USD. Folosește funcția calculatorului (script.js) dacă e disponibilă.
      GBPJPY: 1000 / USDJPY la data tranzacției (cursul istoric, nu o valoare presupusă). */
  function pipUsd(sym, price, usdjpy) {
    if (sym === 'GBPJPY') return 1000 / usdjpy;
    if (typeof root.pipUsdPeLot === 'function') return root.pipUsdPeLot(sym, price);
    if (sym === 'USDJPY') return 1000 / price;
    return 10;
  }
  /** Valoarea pipului pe lot în moneda contului. rates = { EURUSD, GBPUSD, USDJPY } la data intrării. */
  function pipValueAcct(sym, price, ccy, rates) {
    const usd = pipUsd(sym, price, rates.USDJPY);
    if (ccy === 'EUR') return usd / rates.EURUSD;
    if (ccy === 'GBP') return usd / rates.GBPUSD;
    return usd;
  }
  /** Lot rotunjit în jos la 0,01 (aceeași regulă ca în calculator). */
  function lotFor(riskMoney, slPips, pipVal) {
    if (!(riskMoney > 0) || !(slPips > 0) || !(pipVal > 0)) return 0;
    return Math.floor(riskMoney / (slPips * pipVal) * 100 + 1e-9) / 100;
  }

  /** Verifică dacă SL și TP sunt de partea corectă. Întoarce null sau un mesaj în română. */
  function validateLevels(side, entry, sl, tp) {
    if (!(sl > 0)) return 'Stop loss-ul lipsește sau nu e un preț valid.';
    if (side === 'buy') {
      if (sl >= entry) return 'La Buy, stop loss-ul trebuie să fie sub prețul de intrare.';
      if (tp != null && tp <= entry) return 'La Buy, take profit-ul trebuie să fie deasupra prețului de intrare.';
    } else {
      if (sl <= entry) return 'La Sell, stop loss-ul trebuie să fie deasupra prețului de intrare.';
      if (tp != null && tp >= entry) return 'La Sell, take profit-ul trebuie să fie sub prețul de intrare.';
    }
    return null;
  }

  /** Deschide o poziție la piață la închiderea barei (bid). */
  function openMarket(o) {
    const sp = spreadPrice(o.sym);
    const entry = round(o.side === 'buy' ? o.bidClose + sp : o.bidClose, INSTR[o.sym].dec + 1);
    return makePosition(o, entry);
  }
  function makePosition(o, entry) {
    const pip = pipOf(o.sym);
    const slPips = Math.abs(entry - o.sl) / pip;
    return {
      sym: o.sym, side: o.side, entry, sl: o.sl, tp: o.tp == null ? null : o.tp, sl0: o.sl, tp0: o.tp == null ? null : o.tp,
      lot: o.lot, pipVal: o.pipVal, slPips0: slPips, riskMoney: round(slPips * o.pipVal * o.lot, 2),
      openTime: o.time, openIdx: o.idx, type: o.type || 'piață', be: false
    };
  }

  /** Ordin în așteptare: limit/stop, buy/sell, la prețul `price`. */
  function pendingTriggered(ord, bar) {
    const sp = spreadPrice(ord.sym);
    // Buy se execută la ASK, Sell la BID
    const lo = ord.side === 'buy' ? bar.l + sp : bar.l, hi = ord.side === 'buy' ? bar.h + sp : bar.h, op = ord.side === 'buy' ? bar.o + sp : bar.o;
    if (ord.side === 'buy' && ord.kind === 'limit' && lo <= ord.price) return Math.min(ord.price, op);
    if (ord.side === 'buy' && ord.kind === 'stop' && hi >= ord.price) return Math.max(ord.price, op);
    if (ord.side === 'sell' && ord.kind === 'limit' && hi >= ord.price) return Math.max(ord.price, op);
    if (ord.side === 'sell' && ord.kind === 'stop' && lo <= ord.price) return Math.min(ord.price, op);
    return null;
  }

  /** Verifică o bară nouă pentru o poziție deschisă.
      Reguli: dacă bara deschide dincolo de SL (gap), ieșirea e la open (alunecare);
      dacă în aceeași bară sunt atinse și SL și TP, se presupune SL primul (conservator);
      TP se execută la prețul TP. Întoarce null sau { price, reason, both }. */
  function checkExit(pos, bar, skipTp) {
    const sp = spreadPrice(pos.sym);
    const buy = pos.side === 'buy';
    // prețul la care se închide poziția: Buy la BID, Sell la ASK
    const o = buy ? bar.o : bar.o + sp, h = buy ? bar.h : bar.h + sp, l = buy ? bar.l : bar.l + sp;
    const slHit = buy ? l <= pos.sl : h >= pos.sl;
    const tpHit = pos.tp != null && !skipTp && (buy ? h >= pos.tp : l <= pos.tp);
    const slGap = buy ? o <= pos.sl : o >= pos.sl;
    if (slHit) return { price: slGap ? o : pos.sl, reason: pos.be && Math.abs(pos.sl - pos.entry) < 1e-9 ? 'BE' : 'SL', both: tpHit, gap: slGap };
    if (tpHit) return { price: pos.tp, reason: 'TP', both: false, gap: false };
    return null;
  }

  /** Profit/pierdere pentru o ieșire la `exitPrice`. */
  function result(pos, exitPrice) {
    const pip = pipOf(pos.sym);
    const pips = (pos.side === 'buy' ? exitPrice - pos.entry : pos.entry - exitPrice) / pip;
    const money = round(pips * pos.pipVal * pos.lot, 2);
    const r = pos.slPips0 > 0 ? pips / pos.slPips0 : 0;
    return { pips: round(pips, 1), money, r: round(r, 2) };
  }
  /** Prețul de ieșire curent (pentru P/L flotant) la închiderea `bidClose`. */
  const markPrice = (pos, bidClose) => pos.side === 'buy' ? bidClose : bidClose + spreadPrice(pos.sym);

  /** Statistici pentru o listă de tranzacții închise. */
  function stats(trades, startBalance) {
    const n = trades.length;
    const wins = trades.filter(t => t.money > 0), losses = trades.filter(t => t.money < 0);
    const gp = wins.reduce((s, t) => s + t.money, 0), gl = -losses.reduce((s, t) => s + t.money, 0);
    const totalR = trades.reduce((s, t) => s + t.r, 0);
    let bal = startBalance, peak = startBalance, maxDD = 0, maxDDPct = 0;
    const curve = [startBalance];
    for (const t of trades) {
      bal = round(bal + t.money, 2); curve.push(bal);
      if (bal > peak) peak = bal;
      const dd = peak - bal;
      if (dd > maxDD) maxDD = dd;
      if (peak > 0 && dd / peak > maxDDPct) maxDDPct = dd / peak;
    }
    const byMoney = [...trades].sort((a, b) => b.money - a.money);
    return {
      n, wins: wins.length, losses: losses.length, be: n - wins.length - losses.length,
      winRate: n ? wins.length / n : null,
      totalR: round(totalR, 2), avgR: n ? round(totalR / n, 2) : null,
      profitFactor: gl > 0 ? round(gp / gl, 2) : (gp > 0 ? Infinity : null),
      grossProfit: round(gp, 2), grossLoss: round(gl, 2),
      net: round(bal - startBalance, 2), balance: bal, returnPct: startBalance ? (bal - startBalance) / startBalance : 0,
      maxDD: round(maxDD, 2), maxDDPct,
      best: n ? byMoney[0] : null, worst: n ? byMoney[n - 1] : null,
      curve
    };
  }

  /** Mediana amplitudinii ultimelor `k` bare, în pips (pentru SL sugerat). */
  function medianRangePips(d, end, k, sym) {
    const a = [];
    for (let i = Math.max(0, end - k + 1); i <= end; i++) a.push(d.h[i] - d.l[i]);
    a.sort((x, y) => x - y);
    return a.length ? a[a.length >> 1] / pipOf(sym) : 0;
  }

  const api = { INSTR, TF_SEC, decode, concat, round, pipOf, spreadPrice, pipUsd, pipValueAcct, lotFor, validateLevels, openMarket, makePosition, pendingTriggered, checkExit, result, markPrice, stats, medianRangePips };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SimEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
