/* Calculator risk/reward (calculator.html, tabul „Risk/Reward”).
   Folosește aceleași convenții ca și calculatorul de lot din script.js (încărcat înainte):
   PRET_IMPLICIT, pipUsdPeLot, conventiePip, parseNum, EURUSD_PRESUPUS, GBPUSD_PRESUPUS, JPY_CROSS. */
(function () {
  'use strict';
  const form = document.getElementById('rr-form');
  if (!form || typeof pipUsdPeLot !== 'function') return;
  const g = id => document.getElementById(id);

  // ---------- tab-uri Lot | Risk/Reward (fără JS, ambele panouri rămân vizibile) ----------
  const tablist = document.querySelector('.calc-tabs');
  const tabs = [g('tab-lot'), g('tab-rr')], panels = [g('panel-lot'), g('risc-recompensa')];
  panels.forEach((p, i) => { p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', tabs[i].id); p.tabIndex = -1; });
  function select(i, focus, push) {
    tabs.forEach((t, j) => { t.setAttribute('aria-selected', String(i === j)); t.tabIndex = i === j ? 0 : -1; panels[j].hidden = i !== j; });
    if (focus) tabs[i].focus();
    if (push) history.replaceState(null, '', i === 1 ? '#risc-recompensa' : location.pathname + location.search);
  }
  tablist.hidden = false;
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i, false, true));
    t.addEventListener('keydown', e => {
      const k = e.key;
      if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); select(1 - i, true, true); }
      else if (k === 'Home') { e.preventDefault(); select(0, true, true); }
      else if (k === 'End') { e.preventDefault(); select(1, true, true); }
    });
  });
  const fromHash = () => select(location.hash === '#risc-recompensa' ? 1 : 0, false, false);
  fromHash();
  window.addEventListener('hashchange', fromHash);

  // ---------- calcul ----------
  /** Prețuri: o singură virgulă sau un singur punct = separator zecimal (1,1200 = 1.1200). */
  function parsePret(raw) {
    let s = String(raw == null ? '' : raw).trim().replace(/\s/g, '');
    if (!s) return NaN;
    const c = (s.match(/,/g) || []).length, d = (s.match(/\./g) || []).length;
    if (c && d) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (c === 1) s = s.replace(',', '.');
    else if (c > 1 || d > 1) return NaN;
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  }
  const pipSize = p => p === 'XAUUSD' ? 0.1 : (p === 'XAGUSD' || p === 'USDJPY' || JPY_CROSS.has(p)) ? 0.01 : 0.0001;
  const decimale = p => p === 'XAUUSD' || p === 'XAGUSD' ? 2 : (p === 'USDJPY' || JPY_CROSS.has(p)) ? 3 : 5;
  const nr = (x, max, min = 0) => x.toLocaleString('ro-RO', { minimumFractionDigits: min, maximumFractionDigits: max });

  const out = {
    err: g('rr-error'), sl: g('rr-sl-pips'), tp: g('rr-tp-pips'), raport: g('rr-raport'), lot: g('rr-loturi'), risc: g('rr-risc-suma'),
    profit: g('rr-profit'), be: g('rr-be'), nota: g('rr-nota'), vis: g('rr-visual'), zTp: g('rr-zone-tp'), zSl: g('rr-zone-sl'),
    vTp: g('rr-v-tp'), vIn: g('rr-v-in'), vSl: g('rr-v-sl'), wrap: form.querySelector('.rr-out'),
  };
  const fields = ['rr-intrare', 'rr-sl', 'rr-tp', 'rr-sold', 'rr-risc'].map(g);

  function gol(msg, bad) {
    [out.sl, out.tp, out.raport, out.lot, out.risc, out.profit, out.be].forEach(o => { o.textContent = '—'; });
    out.wrap.classList.add('is-empty');
    fields.forEach(f => f.removeAttribute('aria-invalid'));
    (bad || []).forEach(id => g(id).setAttribute('aria-invalid', 'true'));
    out.err.textContent = msg; out.err.hidden = !msg;
    out.nota.textContent = '';
    form.dataset.state = msg ? 'error' : 'empty';
  }

  function calc() {
    const p = g('rr-pereche').value;
    const dir = form.querySelector('input[name="rr-dir"]:checked').value;
    const moneda = g('rr-moneda').value;
    const raw = id => g(id).value.trim();
    const intrare = parsePret(raw('rr-intrare')), sl = parsePret(raw('rr-sl')), tp = parsePret(raw('rr-tp'));
    const sold = parseNum(raw('rr-sold')), risc = parseNum(raw('rr-risc'));

    if (!raw('rr-intrare') || !raw('rr-sl') || !raw('rr-tp') || !raw('rr-sold') || !raw('rr-risc'))
      return gol('Completează toate câmpurile: intrarea, stop loss-ul, take profit-ul, soldul și riscul %.', fields.filter(f => !f.value.trim()).map(f => f.id));
    if (!(intrare > 0)) return gol('Prețul de intrare nu este un număr valid. Exemplu: 1,1200 sau 1.1200.', ['rr-intrare']);
    if (!(sl > 0)) return gol('Stop loss-ul nu este un preț valid. Scrie prețul, nu numărul de pips (exemplu: 1,1175).', ['rr-sl']);
    if (!(tp > 0)) return gol('Take profit-ul nu este un preț valid. Scrie prețul, nu numărul de pips (exemplu: 1,1250).', ['rr-tp']);
    if (!(sold > 0)) return gol('Soldul contului trebuie să fie un număr mai mare decât 0.', ['rr-sold']);
    if (!(risc > 0) || risc > 100) return gol('Riscul % trebuie să fie între 0 și 100 (de exemplu 1 sau 0,5).', ['rr-risc']);
    if (sl === intrare) return gol('Stop loss-ul nu poate fi egal cu prețul de intrare.', ['rr-sl']);
    if (tp === intrare) return gol('Take profit-ul nu poate fi egal cu prețul de intrare.', ['rr-tp']);
    if (dir === 'buy' && sl > intrare) return gol('La Buy, stop loss-ul trebuie să fie sub prețul de intrare.', ['rr-sl']);
    if (dir === 'sell' && sl < intrare) return gol('La Sell, stop loss-ul trebuie să fie deasupra prețului de intrare.', ['rr-sl']);
    if (dir === 'buy' && tp < intrare) return gol('La Buy, take profit-ul trebuie să fie deasupra prețului de intrare.', ['rr-tp']);
    if (dir === 'sell' && tp > intrare) return gol('La Sell, take profit-ul trebuie să fie sub prețul de intrare.', ['rr-tp']);

    const ps = pipSize(p);
    const slPips = Math.round(Math.abs(intrare - sl) / ps * 1e6) / 1e6;
    const tpPips = Math.round(Math.abs(tp - intrare) / ps * 1e6) / 1e6;
    const pipUsd = pipUsdPeLot(p, intrare);
    // USD → moneda contului: împărțim la EURUSD / GBPUSD (ca la calculatorul de lot)
    const eurusd = p === 'EURUSD' ? intrare : EURUSD_PRESUPUS, gbpusd = p === 'GBPUSD' ? intrare : GBPUSD_PRESUPUS;
    const pipCont = moneda === 'EUR' ? pipUsd / eurusd : moneda === 'GBP' ? pipUsd / gbpusd : pipUsd;
    const tinta = sold * risc / 100;
    const loturi = Math.floor(tinta / (slPips * pipCont) * 100 + 1e-9) / 100;
    const R = tpPips / slPips;
    const be = 1 / (1 + R);
    const bani = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: moneda, minimumFractionDigits: 2, maximumFractionDigits: 2 });

    out.err.hidden = true; out.err.textContent = '';
    fields.forEach(f => f.removeAttribute('aria-invalid'));
    out.wrap.classList.remove('is-empty');
    out.sl.textContent = nr(slPips, 1);
    out.tp.textContent = nr(tpPips, 1);
    out.raport.textContent = '1:' + nr(R, 2);
    out.lot.textContent = nr(loturi, 2, 2);
    out.risc.textContent = bani.format(loturi * slPips * pipCont);
    out.profit.textContent = bani.format(loturi * tpPips * pipCont);
    out.be.textContent = nr(be * 100, 1, 1) + '%';

    // bara vizuală: zonele au înălțimea proporțională cu distanța în pips
    out.vis.classList.toggle('is-sell', dir === 'sell');
    out.zTp.style.flexGrow = String(tpPips); out.zSl.style.flexGrow = String(slPips);
    const dec = decimale(p);
    out.vTp.textContent = nr(tp, dec, Math.min(dec, 2)); out.vIn.textContent = nr(intrare, dec, Math.min(dec, 2)); out.vSl.textContent = nr(sl, dec, Math.min(dec, 2));

    const note = [];
    if (loturi < 0.01) note.push('Lotul rezultat este sub 0,01, volumul minim obișnuit: cu acest stop loss, riscul ales este prea mic pentru sold. Mărește soldul sau alege un stop loss mai apropiat, nu riscul.');
    else if (Math.abs(loturi * slPips * pipCont - tinta) > 0.005) note.push(`Ținta de risc este ${bani.format(tinta)}; prin rotunjirea în jos a lotului riști puțin mai puțin.`);
    if (risc > 2) note.push('Atenție: peste 2% risc pe o tranzacție, o serie normală de pierderi îți poate afecta serios contul.');
    if (R < 1) note.push('Raport sub 1:1: câștigul vizat e mai mic decât riscul, deci ai nevoie de peste 50% tranzacții câștigătoare.');
    const ref = PRET_IMPLICIT[p];
    if (ref && (intrare > ref * 1.6 || intrare < ref / 1.6)) note.push('Verifică prețul de intrare: pare foarte diferit de cursul obișnuit al perechii.');
    note.push(`Valoare pip folosită: circa ${nr(pipCont, 2, 2)} ${moneda} per lot standard.${conventiePip(p)} Costurile (spread, comision, swap) nu sunt incluse. Este o estimare: confirmă valorile pe platforma brokerului.`);
    out.nota.textContent = note.join(' ');
    form.dataset.state = 'ok';
  }

  // la schimbarea perechii: valori de pornire coerente (intrare = curs orientativ, SL 25 pips, TP 50 pips)
  g('rr-pereche').addEventListener('change', () => {
    const p = g('rr-pereche').value, ps = pipSize(p), dec = decimale(p), ref = PRET_IMPLICIT[p];
    if (!ref) return calc();
    const sgn = form.querySelector('input[name="rr-dir"]:checked').value === 'buy' ? 1 : -1;
    const f = x => x.toFixed(dec === 3 ? 2 : dec === 5 ? 4 : 2);
    g('rr-intrare').value = f(ref); g('rr-sl').value = f(ref - sgn * 25 * ps); g('rr-tp').value = f(ref + sgn * 50 * ps);
    calc();
  });
  // la schimbarea direcției: oglindim SL și TP față de intrare (păstrăm distanțele), dacă erau corecte pentru direcția veche
  form.querySelectorAll('input[name="rr-dir"]').forEach(r => r.addEventListener('change', () => {
    const p = g('rr-pereche').value, dec = decimale(p);
    const e = parsePret(g('rr-intrare').value), sl = parsePret(g('rr-sl').value), tp = parsePret(g('rr-tp').value);
    const buy = r.value === 'buy';
    const fostCorect = buy ? (sl > e && tp < e) : (sl < e && tp > e);   // corect pentru direcția opusă
    if (e > 0 && sl > 0 && tp > 0 && fostCorect) {
      const zec = v => (String(g(v).value).split(/[.,]/)[1] || '').length;
      const n = Math.min(dec, Math.max(zec('rr-intrare'), zec('rr-sl'), zec('rr-tp')));
      const virgula = /,/.test(g('rr-intrare').value);
      const f = x => virgula ? x.toFixed(n).replace('.', ',') : x.toFixed(n);
      g('rr-sl').value = f(2 * e - sl); g('rr-tp').value = f(2 * e - tp);
    }
    calc();
  }));
  form.addEventListener('input', calc);
  form.addEventListener('change', e => { if (e.target.id !== 'rr-pereche') calc(); });
  form.addEventListener('submit', e => e.preventDefault());
  calc();
})();
