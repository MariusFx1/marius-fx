/* MS Prime: statistici detaliate, istoric pe sesiuni, comparare strategii (fără dependențe; folosește SimEngine). */
(function () {
  'use strict';
  const E = window.SimEngine;
  if (!E) return;
  const NF = {};
  const nf = (v, min, max) => { const k = min + '|' + (max == null ? min : max); return (NF[k] || (NF[k] = I18N.NF({ minimumFractionDigits: min, maximumFractionDigits: max == null ? min : max }))).format(v); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '');
  const fR = v => (v == null ? '—' : sgn(v) + nf(Math.abs(v), 2) + 'R');
  const pc = (v, d = 0) => (v == null ? '—' : nf(v * 100, d) + '%');
  const SYM = { EUR: '€', USD: '$', GBP: '£' };
  const fM = (v, ccy) => (v == null ? '—' : sgn(v) + nf(Math.abs(v), 2) + ' ' + (SYM[ccy] || ccy || ''));
  const cls = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
  const WD = I18N.weekdays();
  const NOSETUP = T('(fără setup)'), NOSTRAT = T('Fără strategie');
  function hold(sec) {
    if (sec == null) return '—';
    const h = sec / 3600;
    return h < 1 ? T('< 1 oră') : h < 48 ? T('{n} ore', { n: nf(h, 0, 1) }) : T('{n} zile', { n: nf(h / 24, 0, 1) });
  }
  /** Profit factor în R (comparabil între conturi și monede diferite). */
  function pfR(trades) {
    let w = 0, l = 0;
    for (const t of trades) { if (t.r > 0) w += t.r; else if (t.r < 0) l -= t.r; }
    return l > 0 ? w / l : (w > 0 ? Infinity : null);
  }
  const fPF = v => (v == null ? '—' : v === Infinity ? '∞' : nf(v, 2));
  /** Rezumat (în R) pentru o listă de tranzacții. */
  function summary(trades) {
    const d = E.detailed(trades), n = trades.length, w = trades.filter(t => t.money > 0).length;
    return { n, wins: w, winRate: n ? w / n : null, totalR: E.round(trades.reduce((s, t) => s + t.r, 0), 2), expR: d.expectancyR, pf: pfR(trades), ddR: d.maxDDR,
      maxCL: d.maxConsecLosses, maxCW: d.maxConsecWins, hold: d.avgHoldSec, avgWinR: d.avgWinR, avgLossR: d.avgLossR, d };
  }
  function groupTable(title, rows, opts) {
    rows = rows.filter(r => r.g.n > 0);
    if (!rows.length) return '';
    const money = opts && opts.money;
    return `<div class="st-block"><h4>${esc(title)}</h4><div class="st-tw"><table class="st-table"><thead><tr><th scope="col">${esc(opts.col)}</th><th scope="col">${T('Tranz.')}</th><th scope="col">${T('Câștig')}</th><th scope="col">Total R</th><th scope="col">${T('R mediu')}</th>${money ? '<th scope="col">P/L</th>' : ''}</tr></thead><tbody>` +
      rows.map(r => `<tr><th scope="row">${esc(r.k)}</th><td>${r.g.n}</td><td>${pc(r.g.wins / r.g.n)}</td><td class="${cls(r.g.r)}">${fR(r.g.r)}</td><td class="${cls(r.g.r)}">${fR(r.g.r / r.g.n)}</td>${money ? `<td class="${cls(r.g.money)}">${fM(r.g.money, money)}</td>` : ''}</tr>`).join('') +
      '</tbody></table></div></div>';
  }
  function bySetup(trades) {
    const m = {};
    for (const t of trades) {
      const k = t.setup || NOSETUP, g = m[k] || (m[k] = { n: 0, wins: 0, losses: 0, r: 0, money: 0 });
      g.n++; if (t.money > 0) g.wins++; else if (t.money < 0) g.losses++; g.r = E.round(g.r + t.r, 2); g.money = E.round(g.money + t.money, 2);
    }
    return Object.keys(m).sort((a, b) => m[b].n - m[a].n).map(k => ({ k, g: m[k] }));
  }
  /** Curba R cumulată, ca SVG (fără bibliotecă, ca să meargă și pe pagina de setări). */
  function curveSVG(pts, label) {
    if (pts.length < 2) return '';
    const W = 600, H = 140, P = 6;
    const lo = Math.min(0, ...pts), hi = Math.max(0, ...pts), span = hi - lo || 1;
    const x = i => P + i * (W - 2 * P) / (pts.length - 1), y = v => P + (hi - v) * (H - 2 * P) / span;
    const line = pts.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('');
    const last = pts[pts.length - 1];
    return `<figure class="st-curve"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}"><line x1="0" x2="${W}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="st-zero"/><path d="${line}" class="st-line ${last >= 0 ? 'up' : 'down'}" vector-effect="non-scaling-stroke"/></svg><figcaption>${esc(label)}: ${T('{r} după {n} tranzacții', { r: fR(last), n: pts.length - 1 })}</figcaption></figure>`;
  }
  function histHTML(hist) {
    const mx = Math.max(1, ...hist.map(h => h.n));
    return T('<div class="st-block"><h4>Distribuția rezultatelor (R)</h4><ul class="st-hist">') + hist.map((h, i) => `<li><span>${esc(h.label)}</span><i class="${i < 3 ? 'neg' : 'pos'}" style="width:${(h.n / mx * 100).toFixed(1)}%"></i><b>${h.n}</b></li>`).join('') + '</ul></div>';
  }
  /** HTML complet pentru statistici detaliate. opts: { ccy (pentru sume), bal0 (pentru drawdown %), curve: bool }. */
  function detailHTML(trades, opts) {
    opts = opts || {};
    if (!trades.length) return T('<p class="sim-empty">Statisticile detaliate apar după prima tranzacție închisă.</p>');
    const s = summary(trades), d = s.d, money = opts.ccy || null;
    let ddPct = null;
    if (opts.bal0) ddPct = E.stats(trades, opts.bal0).maxDDPct;
    const k = (lab, val, c, sub) => `<div class="st-k"><span>${esc(lab)}</span><strong class="${c || ''}">${val}</strong>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const few = trades.length < 30 ? `<p class="st-few">${trades.length === 1 ? T('Doar 1 tranzacție: concluziile devin credibile abia după 30-50 de tranzacții cu aceleași reguli.') : T('Doar {n} tranzacții: concluziile devin credibile abia după 30-50 de tranzacții cu aceleași reguli.', { n: trades.length })}</p>` : '';
    const wd = [1, 2, 3, 4, 5, 6, 0].map(i => ({ k: WD[i], g: d.byWd[i] }));
    const hr = d.byHour.map((g, h) => ({ k: String(h).padStart(2, '0') + ':00', g }));
    const side = [{ k: 'Long (Buy)', g: d.bySide.buy }, { k: 'Short (Sell)', g: d.bySide.sell }];
    const sym = Object.keys(d.bySym).sort().map(x => ({ k: x, g: d.bySym[x] }));
    const setups = bySetup(trades);
    return few + '<div class="st-keys">' +
      k(T('Expectanță'), fR(s.expR), cls(s.expR), money ? fM(d.expectancy, money) + T(' / tranzacție') : T('pe tranzacție')) +
      k(T('Câștig mediu'), fR(s.avgWinR), 'pos', money && d.avgWin != null ? fM(d.avgWin, money) : '') +
      k(T('Pierdere medie'), fR(s.avgLossR), 'neg', money && d.avgLoss != null ? fM(d.avgLoss, money) : '') +
      k(T('Profit factor (R)'), fPF(s.pf), '') +
      k(T('Serii maxime'), `${s.maxCW} / ${s.maxCL}`, '', T('câștiguri / pierderi la rând')) +
      k(T('Drawdown maxim'), ddPct != null ? pc(ddPct, 2) : fR(-s.ddR), ddPct ? 'neg' : '', ddPct != null ? fR(-s.ddR) + T(' din vârf') : T('din vârful curbei R')) +
      k(T('Durată medie'), hold(s.hold), '', T('de la intrare la ieșire')) +
      '</div>' +
      (opts.curve !== false ? curveSVG(d.rCurve, T('Curba R cumulată')) : '') +
      histHTML(d.hist) +
      '<div class="st-grid">' +
      (setups.length > 1 || (setups[0] && setups[0].k !== NOSETUP) ? groupTable(T('Pe setup'), setups, { col: 'Setup', money }) : '') +
      groupTable('Long / short', side, { col: T('Direcție'), money }) +
      groupTable(T('Pe instrument'), sym, { col: 'Instrument', money }) +
      groupTable(T('Pe zi (intrare, ora României)'), wd, { col: T('Zi'), money }) +
      groupTable(T('Pe oră de intrare (ora României)'), hr, { col: T('Ora'), money }) +
      '</div>';
  }

  // ---------- istoric pe toate sesiunile salvate ----------
  const stratOf = s => (s.strategy && s.strategy.name) || NOSTRAT;
  /** Toate tranzacțiile din sesiunile salvate, cu numele strategiei și al sesiunii. */
  function allTrades(list) {
    const out = [];
    for (const s of list) for (const t of s.trades || []) out.push(Object.assign({ sym: s.sym }, t, { strategy: stratOf(s), sid: s.id, stf: s.tf, ccy: s.ccy }));
    return out.sort((a, b) => (a.exitT - b.exitT) || 0);
  }
  /** Tabel de comparare: câte o coloană pe strategie (side by side). */
  function compareHTML(list) {
    const names = [...new Set(list.map(stratOf))];
    if (!names.length) return '';
    const cols = names.map(nm => {
      const ss = list.filter(s => stratOf(s) === nm), tr = allTrades(ss);
      return { nm, sess: ss.length, s: summary(tr), ch: ss.filter(s => s.challenge).map(s => s.challenge.status) };
    });
    const best = Math.max(...cols.filter(c => c.s.n >= 1).map(c => c.s.expR == null ? -Infinity : c.s.expR));
    const row = (lab, f, c) => `<tr><th scope="row">${esc(lab)}</th>${cols.map(x => `<td class="${c ? c(x) : ''}">${f(x)}</td>`).join('')}</tr>`;
    return `<div class="st-tw"><table class="st-table st-compare"><thead><tr><th scope="col">${T('Indicator')}</th>${cols.map(c => `<th scope="col">${esc(c.nm)}${c.s.n && c.s.expR === best && cols.length > 1 ? ' <span class="st-best" title="' + T('Cea mai mare expectanță') + '">★</span>' : ''}</th>`).join('')}</tr></thead><tbody>` +
      row(T('Sesiuni'), c => c.sess) +
      row(T('Tranzacții'), c => c.s.n + (c.s.n && c.s.n < 30 ? T(' <small>(puține)</small>') : '')) +
      row(T('Rata de câștig'), c => pc(c.s.winRate)) +
      row(T('Expectanță'), c => fR(c.s.expR), c => cls(c.s.expR)) +
      row(T('Total R'), c => fR(c.s.totalR), c => cls(c.s.totalR)) +
      row(T('Profit factor (R)'), c => fPF(c.s.pf)) +
      row(T('Câștig / pierdere medie'), c => fR(c.s.avgWinR) + ' / ' + fR(c.s.avgLossR)) +
      row(T('Drawdown maxim (R)'), c => (c.s.n ? fR(-c.s.ddR) : '—')) +
      row(T('Pierderi la rând (max)'), c => (c.s.n ? c.s.maxCL : '—')) +
      row(T('Durată medie'), c => hold(c.s.hold)) +
      row(T('Provocări trecute'), c => (c.ch.length ? T('{a} din {b}', { a: c.ch.filter(x => x === 'trecut').length, b: c.ch.length }) : '—')) +
      '</tbody></table></div>';
  }
  function csvAll(trades) {
    const n = (x, d) => (x == null ? '' : Number(x).toFixed(d).replace('.', I18N.csvDec));
    const dt = t => { const p = E.userParts(t); return `${p.key} ${String(p.h).padStart(2, '0')}:00`; };
    const head = [T('Strategie'), 'Setup', T('Notă'), 'Instrument', T('Interval'), T('Direcție'), T('Intrare (ora României)'), T('Preț intrare'), T('Ieșire (ora României)'), T('Preț ieșire'), 'Lot', 'Pips', 'R', 'Profit', T('Moneda')];
    const rows = trades.map(t => { const dec = (E.INSTR[t.sym] || { dec: 5 }).dec + 1; return [t.strategy, t.setup || '', t.note || '', t.sym, t.stf, t.side === 'buy' ? 'Buy' : 'Sell', dt(t.entryT), n(t.entry, dec), dt(t.exitT), n(t.exit, dec), n(t.lot, 2), n(t.pips, 1), n(t.r, 2), n(t.money, 2), t.ccy]; });
    return [head, ...rows].map(r => r.map(v => { const s = String(v); return (s.includes(I18N.csvSep) || /["\n]/.test(s)) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(I18N.csvSep)).join('\r\n');
  }
  /** Secțiunea „Statistici pe toate sesiunile” de pe pagina de setări. */
  function renderHistoryStats(list) {
    const box = document.getElementById('sim-hstats');
    if (!box) return;
    const withT = list.filter(s => (s.trades || []).length);
    box.hidden = !withT.length;
    if (!withT.length) return;
    const fS = document.getElementById('sim-hf-strat'), fI = document.getElementById('sim-hf-sym'), fT = document.getElementById('sim-hf-setup');
    const keep = (sel, opts, all) => { const v = sel.value; sel.innerHTML = `<option value="">${all}</option>` + opts.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join(''); sel.value = opts.includes(v) ? v : ''; };
    keep(fS, [...new Set(withT.map(stratOf))].sort(), T('Toate strategiile'));
    keep(fI, [...new Set(withT.map(s => s.sym))].sort(), T('Toate instrumentele'));
    const tr0 = allTrades(withT);
    keep(fT, [...new Set(tr0.map(t => t.setup || NOSETUP))].sort(), T('Toate setup-urile'));
    const tr = tr0.filter(t => (!fS.value || t.strategy === fS.value) && (!fI.value || t.sym === fI.value) && (!fT.value || (t.setup || NOSETUP) === fT.value));
    const s = summary(tr);
    document.getElementById('sim-h-tiles').innerHTML = [
      [T('Tranzacții'), String(s.n), ''], [T('Rata de câștig'), pc(s.winRate), ''], [T('Total R'), fR(s.totalR), cls(s.totalR)], [T('Expectanță'), fR(s.expR), cls(s.expR)], [T('Profit factor (R)'), fPF(s.pf), '']
    ].map(([a, b, c]) => `<div class="sim-tile"><span>${a}</span><strong class="${c}">${b}</strong></div>`).join('');
    document.getElementById('sim-h-compare').innerHTML = compareHTML(withT.filter(x => !fI.value || x.sym === fI.value));
    document.getElementById('sim-h-detail').innerHTML = detailHTML(tr, {});
    box._trades = tr;
  }
  function wireHistory(getList) {
    const box = document.getElementById('sim-hstats');
    if (!box) return;
    ['sim-hf-strat', 'sim-hf-sym', 'sim-hf-setup'].forEach(id => document.getElementById(id).addEventListener('change', () => renderHistoryStats(getList())));
    document.getElementById('sim-h-csv').addEventListener('click', () => {
      const tr = box._trades || [];
      const blob = new Blob(['\ufeff' + csvAll(tr) + '\r\n'], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'simulator-istoric-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      document.getElementById('sim-h-msg').textContent = T('Fișierul CSV a fost descărcat ({length} tranzacții).', { length: tr.length });
    });
  }
  window.SimStats = { detailHTML, compareHTML, renderHistoryStats, wireHistory, allTrades, summary, csvAll, pfR, NOSTRAT, NOSETUP };
})();
