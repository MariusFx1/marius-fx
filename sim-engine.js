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
  // traducere (în Node și pe paginile în română: textul original)
  const T = (root && root.T) || ((s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s));

  const INSTR = {
    EURUSD: { dec: 5, pip: 0.0001, spread: 1.0, nume: 'EUR/USD' },
    GBPUSD: { dec: 5, pip: 0.0001, spread: 1.5, nume: 'GBP/USD' },
    USDJPY: { dec: 3, pip: 0.01, spread: 1.2, nume: 'USD/JPY' },
    XAUUSD: { dec: 2, pip: 0.1, spread: 3.0, nume: T('XAU/USD (aur)') },
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
    if (!(sl > 0)) return T('Stop loss-ul lipsește sau nu e un preț valid.');
    if (side === 'buy') {
      if (sl >= entry) return T('La Buy, stop loss-ul trebuie să fie sub prețul de intrare.');
      if (tp != null && tp <= entry) return T('La Buy, take profit-ul trebuie să fie deasupra prețului de intrare.');
    } else {
      if (sl <= entry) return T('La Sell, stop loss-ul trebuie să fie deasupra prețului de intrare.');
      if (tp != null && tp >= entry) return T('La Sell, take profit-ul trebuie să fie sub prețul de intrare.');
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


  // ---------- timp: New York (ziua de tranzacționare) și România, cu regulile DST ----------
  const nthSunday = (y, m, n) => { const d = new Date(Date.UTC(y, m, 1)); const first = (7 - d.getUTCDay()) % 7 + 1; return first + (n - 1) * 7; };
  const lastSunday = (y, m) => { const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); const wd = new Date(Date.UTC(y, m, days)).getUTCDay(); return days - wd; };
  /** Decalajul New York față de UTC, în ore (-4 vara, -5 iarna). DST SUA: a doua duminică din martie 2:00 → prima duminică din noiembrie 2:00. */
  function nyOffset(t) {
    const y = new Date(t * 1000).getUTCFullYear();
    const a = Date.UTC(y, 2, nthSunday(y, 2, 2), 7) / 1000, b = Date.UTC(y, 10, nthSunday(y, 10, 1), 6) / 1000;
    return t >= a && t < b ? -4 : -5;
  }
  /** Decalajul României față de UTC (+3 vara, +2 iarna). DST UE: ultima duminică din martie 1:00 UTC → ultima duminică din octombrie 1:00 UTC. */
  function roOffset(t) {
    const y = new Date(t * 1000).getUTCFullYear();
    const a = Date.UTC(y, 2, lastSunday(y, 2), 1) / 1000, b = Date.UTC(y, 9, lastSunday(y, 9), 1) / 1000;
    return t >= a && t < b ? 3 : 2;
  }
  /** Data și ora în România: { y, m (1-12), d, wd (0 = duminică), h, key: 'AAAA-LL-ZZ' }. */
  function roParts(t) {
    const x = new Date((t + roOffset(t) * 3600) * 1000);
    const y = x.getUTCFullYear(), m = x.getUTCMonth() + 1, d = x.getUTCDate();
    return { y, m, d, wd: x.getUTCDay(), h: x.getUTCHours(), key: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
  }
  /** Ora pentru statistici: ora României pe site-ul în română, ora locală a vizitatorului în celelalte limbi. */
  const LOCAL_FMT = {};
  function userParts(t) {
    const L = typeof window !== 'undefined' && window.I18N;
    if (!L || L.lang === 'ro') return roParts(t);
    const f = LOCAL_FMT.f || (LOCAL_FMT.f = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short', hourCycle: 'h23' }));
    const p = {}; for (const x of f.formatToParts(new Date(t * 1000))) p[x.type] = x.value;
    const y = +p.year, m = +p.month, d = +p.day;
    return { y, m, d, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), h: +p.hour % 24, key: `${y}-${p.month}-${p.day}` };
  }
  /** Începutul barei H4/D1 care conține ora `t` (aceeași convenție ca sim_build.py: ziua începe la 17:00 New York).
      D1 primește ca timp miezul nopții UTC al zilei de tranzacționare; H4, ora UTC reală a începutului slotului. */
  function bucketStart(t, tf) {
    if (tf === 'H1') return t - (t % 3600 + 3600) % 3600;
    const sh = t + (nyOffset(t) + 7) * 3600;          // ora New York + 7h: 17:00 NY = 00:00
    const shDay = Math.floor(sh / 86400) * 86400;
    if (tf === 'D1') return shDay;
    const slot = Math.floor((sh - shDay) / 14400);
    return t - (sh - shDay - slot * 14400);
  }
  /** Construiește barele pentru intervalul `tf` din barele H1 [0..upTo] (fără nimic de după `upTo`: nu există lookahead).
      Ultima bară poate fi „în formare” (incompletă). Întoarce { time[], o[], h[], l[], c[], last[] (ultimul index H1) }. */
  function aggregate(d, upTo, tf) {
    const out = { time: [], o: [], h: [], l: [], c: [], last: [] };
    for (let i = 0; i <= upTo && i < d.n; i++) appendBar(out, d, i, tf);
    return out;
  }
  /** Adaugă bara H1 `i` la agregarea `out` (actualizează bara în formare sau începe una nouă). Întoarce true dacă a început o bară nouă. */
  function appendBar(out, d, i, tf) {
    const k = bucketStart(d.t[i], tf), n = out.time.length;
    if (n && out.time[n - 1] === k) {
      if (d.h[i] > out.h[n - 1]) out.h[n - 1] = d.h[i];
      if (d.l[i] < out.l[n - 1]) out.l[n - 1] = d.l[i];
      out.c[n - 1] = d.c[i]; out.last[n - 1] = i;
      return false;
    }
    out.time.push(k); out.o.push(d.o[i]); out.h.push(d.h[i]); out.l.push(d.l[i]); out.c.push(d.c[i]); out.last.push(i);
    return true;
  }
  /** Bara H1 `i` e ultima din bara sa de `tf`? (dacă nu știm încă bara următoare, răspunsul e false) */
  function isBucketEnd(d, i, tf) {
    if (tf === 'H1') return true;
    if (i + 1 >= d.n) return false;
    return bucketStart(d.t[i + 1], tf) !== bucketStart(d.t[i], tf);
  }

  // ---------- închidere parțială (R raportat la riscul inițial) ----------
  /** Închide `lot` loturi din poziție la `price`. Modifică poziția și întoarce partea închisă.
      R-ul fiecărei părți = pips × lot / (pips SL inițial × lot inițial), deci suma părților dă R-ul tranzacției. */
  function closePart(pos, price, lot, reason, t) {
    lot = Math.min(round(lot, 2), round(pos.lot, 2));
    const pip = pipOf(pos.sym), dir = pos.side === 'buy' ? 1 : -1;
    const pips = (price - pos.entry) * dir / pip;
    const money = round(pips * pos.pipVal * lot, 2);
    const lot0 = pos.lot0 || pos.lot;
    const r = pos.slPips0 > 0 ? pips * lot / (pos.slPips0 * lot0) : 0;
    if (!pos.lot0) pos.lot0 = pos.lot;
    if (!pos.closes) pos.closes = [];
    pos.closes.push({ t, price, lot, pips: round(pips, 1), money, r: round(r, 4), reason });
    pos.lot = round(pos.lot - lot, 2);
    pos.realized = round((pos.realized || 0) + money, 2);
    return { lot, pips, money, r };
  }
  /** Lotul pentru o închidere parțială de `frac` (0..1), rotunjit în jos la 0,01; null dacă nu se poate. */
  function partialLot(pos, frac) {
    const l = Math.floor(pos.lot * frac * 100 + 1e-9) / 100;
    return l >= 0.01 && l < pos.lot - 1e-9 ? l : null;
  }
  /** Rezultatul total al unei poziții închise complet (după una sau mai multe părți). */
  function summarize(pos) {
    const cl = pos.closes || [], lots = cl.reduce((s, c) => s + c.lot, 0) || 1;
    const money = round(cl.reduce((s, c) => s + c.money, 0), 2);
    const r = cl.reduce((s, c) => s + c.r, 0);
    return { money, r: round(r, 2), pips: round(cl.reduce((s, c) => s + c.pips * c.lot, 0) / lots, 1), exit: cl.reduce((s, c) => s + c.price * c.lot, 0) / lots, lot0: pos.lot0 || pos.lot, parts: cl.length };
  }

  // ---------- indicatori (doar din barele primite: fără lookahead) ----------
  const NaNs = n => new Array(n).fill(NaN);
  function sma(x, n) {
    const out = NaNs(x.length); let s = 0;
    for (let i = 0; i < x.length; i++) { s += x[i]; if (i >= n) s -= x[i - n]; if (i >= n - 1) out[i] = s / n; }
    return out;
  }
  /** EMA cu k = 2/(n+1), pornită de la SMA primelor n valori valide. */
  function ema(x, n) {
    const out = NaNs(x.length), k = 2 / (n + 1);
    let start = 0; while (start < x.length && !Number.isFinite(x[start])) start++;
    if (x.length - start < n) return out;
    let s = 0; for (let i = start; i < start + n; i++) s += x[i];
    let e = s / n; out[start + n - 1] = e;
    for (let i = start + n; i < x.length; i++) { e = x[i] * k + e * (1 - k); out[i] = e; }
    return out;
  }
  /** Benzi Bollinger: medie n, ± k abateri standard (populație). */
  function bollinger(x, n, k) {
    const mid = sma(x, n), up = NaNs(x.length), lo = NaNs(x.length);
    for (let i = n - 1; i < x.length; i++) {
      let v = 0; for (let j = i - n + 1; j <= i; j++) v += (x[j] - mid[i]) ** 2;
      const sd = Math.sqrt(v / n); up[i] = mid[i] + k * sd; lo[i] = mid[i] - k * sd;
    }
    return { mid, up, lo };
  }
  /** RSI Wilder. */
  function rsi(x, n) {
    const out = NaNs(x.length); if (x.length <= n) return out;
    let g = 0, l = 0;
    for (let i = 1; i <= n; i++) { const ch = x[i] - x[i - 1]; if (ch > 0) g += ch; else l -= ch; }
    g /= n; l /= n;
    const val = () => (l === 0 ? (g === 0 ? 50 : 100) : 100 - 100 / (1 + g / l));
    out[n] = val();
    for (let i = n + 1; i < x.length; i++) {
      const ch = x[i] - x[i - 1];
      g = (g * (n - 1) + Math.max(ch, 0)) / n; l = (l * (n - 1) + Math.max(-ch, 0)) / n;
      out[i] = val();
    }
    return out;
  }
  /** MACD (rapid, lent, semnal): linie = EMA rapidă - EMA lentă; semnal = EMA a liniei; histogramă = linie - semnal. */
  function macd(x, f, sl, sig) {
    const a = ema(x, f), b = ema(x, sl), line = x.map((_, i) => a[i] - b[i]);
    const signal = ema(line, sig), hist = line.map((v, i) => v - signal[i]);
    return { line, signal, hist };
  }
  /** ATR Wilder: primul ATR = media primelor n TR (TR[0] = H - L). */
  function atr(h, l, c, n) {
    const len = h.length, out = NaNs(len); if (len < n) return out;
    const tr = i => (i === 0 ? h[0] - l[0] : Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])));
    let s = 0; for (let i = 0; i < n; i++) s += tr(i);
    let a = s / n; out[n - 1] = a;
    for (let i = n; i < len; i++) { a = (a * (n - 1) + tr(i)) / n; out[i] = a; }
    return out;
  }

  // ---------- mod provocare (reguli de tip prop firm, educativ) ----------
  /** Configurare: { start, targetPct, dailyPct, totalPct }. Starea: { dayKey, dayStart, status: 'activ'|'trecut'|'picat', reason, peakDayLoss, maxTotalDD }. */
  function challengeInit(cfg) { return Object.assign({ dayKey: null, dayStart: cfg.start, status: 'activ', reason: '', maxDayLoss: 0, maxTotalDD: 0 }, cfg); }
  /** Evaluează o bară H1. ev = { dayKey, balanceStart (soldul la începutul barei), worst (equity în cel mai rău punct al barei), equity (la închidere) }.
      Ordinea: întâi limitele de pierdere (cu equity-ul cel mai rău din bară, conservator), apoi ținta de profit. */
  function challengeStep(ch, ev) {
    if (ch.status !== 'activ') return ch;
    if (ev.dayKey !== ch.dayKey) { ch.dayKey = ev.dayKey; ch.dayStart = ev.balanceStart; }
    const dailyLimit = ch.dayStart - ch.start * ch.dailyPct / 100, totalLimit = ch.start * (1 - ch.totalPct / 100);
    ch.maxDayLoss = Math.max(ch.maxDayLoss, ch.dayStart - ev.worst);
    ch.maxTotalDD = Math.max(ch.maxTotalDD, ch.start - ev.worst);
    if (ev.worst <= totalLimit + 1e-9) { ch.status = 'picat'; ch.reason = 'total'; }
    else if (ev.worst <= dailyLimit + 1e-9) { ch.status = 'picat'; ch.reason = 'zilnic'; }
    else if (ev.equity >= ch.start * (1 + ch.targetPct / 100) - 1e-9) { ch.status = 'trecut'; ch.reason = 'tinta'; }
    return ch;
  }
  /** Progres pentru bare: profit (0..1 din țintă), pierdere zilnică folosită (0..1), drawdown total folosit (0..1). */
  function challengeProgress(ch, equity) {
    const clamp = v => Math.max(0, Math.min(1, v));
    return {
      profit: clamp((equity - ch.start) / (ch.start * ch.targetPct / 100)),
      daily: clamp((ch.dayStart - equity) / (ch.start * ch.dailyPct / 100)),
      total: clamp((ch.start - equity) / (ch.start * ch.totalPct / 100)),
      target: ch.start * (1 + ch.targetPct / 100), dailyLimit: ch.dayStart - ch.start * ch.dailyPct / 100, totalLimit: ch.start * (1 - ch.totalPct / 100)
    };
  }

  // ---------- statistici detaliate ----------
  const R_BINS = [[-Infinity, -2, '≤ −2R'], [-2, -1, '−2R…−1R'], [-1, 0, '−1R…0R'], [0, 1, '0R…1R'], [1, 2, '1R…2R'], [2, 3, '2R…3R'], [3, Infinity, '> 3R']];
  const binOf = r => { for (let i = 0; i < R_BINS.length; i++) if (r <= R_BINS[i][1] + 1e-9 && (i === 0 || r > R_BINS[i][0] + 1e-9)) return i; return R_BINS.length - 1; };
  /** trades: [{ sym, side, entryT, exitT, r, money }]. Grupări după instrument, zi, oră de intrare (ora României), direcție. */
  function detailed(trades) {
    const grp = () => ({ n: 0, wins: 0, losses: 0, r: 0, money: 0 });
    const add = (g, t) => { g.n++; if (t.money > 0) g.wins++; else if (t.money < 0) g.losses++; g.r = round(g.r + t.r, 2); g.money = round(g.money + t.money, 2); };
    const bySym = {}, byWd = Array.from({ length: 7 }, grp), byHour = Array.from({ length: 24 }, grp), bySide = { buy: grp(), sell: grp() };
    const hist = R_BINS.map(b => ({ label: b[2], n: 0 }));
    let cw = 0, cl = 0, maxCW = 0, maxCL = 0, hold = 0, cumR = 0, peakR = 0, ddR = 0;
    const rCurve = [0];
    for (const t of trades) {
      add(bySym[t.sym] || (bySym[t.sym] = grp()), t);
      const p = userParts(t.entryT); add(byWd[p.wd], t); add(byHour[p.h], t); add(bySide[t.side], t);
      hist[binOf(t.r)].n++;
      if (t.money > 0) { cw++; cl = 0; } else if (t.money < 0) { cl++; cw = 0; } else { cw = 0; cl = 0; }
      maxCW = Math.max(maxCW, cw); maxCL = Math.max(maxCL, cl);
      hold += Math.max(0, t.exitT - t.entryT);
      cumR = round(cumR + t.r, 2); rCurve.push(cumR); peakR = Math.max(peakR, cumR); ddR = Math.max(ddR, round(peakR - cumR, 2));
    }
    const W = trades.filter(t => t.money > 0), L = trades.filter(t => t.money < 0), n = trades.length;
    const avg = (a, k) => (a.length ? a.reduce((s, t) => s + t[k], 0) / a.length : null);
    return {
      n, bySym, byWd, byHour, bySide, hist, rCurve, maxDDR: ddR,
      avgWin: avg(W, 'money'), avgLoss: avg(L, 'money'), avgWinR: avg(W, 'r'), avgLossR: avg(L, 'r'),
      expectancyR: n ? trades.reduce((s, t) => s + t.r, 0) / n : null, expectancy: n ? trades.reduce((s, t) => s + t.money, 0) / n : null,
      maxConsecWins: maxCW, maxConsecLosses: maxCL, avgHoldSec: n ? hold / n : null
    };
  }

  /** Mediana amplitudinii ultimelor `k` bare, în pips (pentru SL sugerat). */
  function medianRangePips(d, end, k, sym) {
    const a = [];
    for (let i = Math.max(0, end - k + 1); i <= end; i++) a.push(d.h[i] - d.l[i]);
    a.sort((x, y) => x - y);
    return a.length ? a[a.length >> 1] / pipOf(sym) : 0;
  }

  const api = { INSTR, TF_SEC, decode, concat, round, pipOf, spreadPrice, pipUsd, pipValueAcct, lotFor, validateLevels, openMarket, makePosition, pendingTriggered, checkExit, result, markPrice, stats, medianRangePips,
    nyOffset, roOffset, roParts, userParts, bucketStart, aggregate, appendBar, isBucketEnd, closePart, partialLot, summarize, sma, ema, bollinger, rsi, macd, atr, challengeInit, challengeStep, challengeProgress, detailed, R_BINS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SimEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
