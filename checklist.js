/* MS Prime: checklist înainte de tranzacție (scor live, doar educațional). */
(function () {
  'use strict';
  const form = document.getElementById('ck-form');
  if (!form) return;
  const I = window.I18N || {};
  const T = I.T || (s => s);
  const num = (x, d) => (I.num ? I.num(x, { maximumFractionDigits: d }) : String(Math.round(x * 10 ** d) / 10 ** d));
  const $ = id => document.getElementById(id);
  const cards = [...form.querySelectorAll('.ck-card')];
  const arc = $('ck-arc'), pctEl = $('ck-pct'), box = $('ck-score');
  const R = 84, C = 2 * Math.PI * R;
  arc.style.strokeDasharray = C; arc.style.strokeDashoffset = C;
  const val = id => { const s = ($(id).value || '').replace(',', '.').trim(); return s === '' ? NaN : parseFloat(s); };
  let shown = 0, raf = 0;

  function color(p) {   // roșu (0) → galben (60) → verde (100)
    const h = p < 60 ? (p / 60) * 45 : 45 + ((p - 60) / 40) * 97;
    return 'hsl(' + h.toFixed(0) + ' 85% 55%)';
  }
  function animate(to) {
    cancelAnimationFrame(raf);
    const from = shown, t0 = performance.now(), dur = 650;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      shown = from + (to - from) * e;
      pctEl.textContent = Math.round(shown);
      arc.style.strokeDashoffset = C * (1 - shown / 100);
      arc.style.stroke = color(shown);
      box.style.setProperty('--ck-c', color(shown));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function update() {
    let score = 0, done = 0;
    const flags = [];
    cards.forEach(card => {
      const w = +card.dataset.w, key = card.dataset.key;
      let f = null;
      if (key === 'risk') {
        const r = val('ck-risk'), st = $('ck-risk-st');
        st.className = 'ck-status';
        if (!isNaN(r)) {
          if (r <= 0) { f = 0; st.textContent = T('Introdu un risc mai mare decât 0%.'); st.classList.add('bad'); }
          else if (r > 3) { f = 0; st.textContent = T('Peste 3%: risc prea mare, scade lotul.'); st.classList.add('bad'); flags.push(T('Risc peste 3% din cont')); }
          else if (r > 2) { f = 0.7; st.textContent = T('Acceptabil, dar 1–2% e mai sănătos.'); st.classList.add('mid'); }
          else { f = 1; st.textContent = T('Risc sănătos, în regulă.'); st.classList.add('ok'); }
        } else st.textContent = '';
      } else if (key === 'rr') {
        const sl = val('ck-sl'), tp = val('ck-tp'), d = val('ck-rr'), st = $('ck-rr-st');
        let rr = NaN;
        if (sl > 0 && tp > 0) rr = tp / sl; else if (d > 0) rr = d;
        st.className = 'ck-status';
        if (!isNaN(rr)) {
          const txt = 'R:R 1:' + num(rr, 2);
          if (rr < 2) { f = 0; st.textContent = txt + ' · ' + T('sub 1:2, nu respectă regula.'); st.classList.add('bad'); flags.push(T('R:R sub 1:2')); }
          else { f = 1; st.textContent = txt + ' · ' + T('minim 2R, în regulă.'); st.classList.add('ok'); }
        } else st.textContent = '';
      } else {
        const c = card.querySelector('input:checked');
        if (c) f = parseFloat(c.dataset.v);
      }
      if (f !== null) { done++; score += w * f; }
      card.classList.toggle('is-done', f !== null);
      card.classList.toggle('is-ok', f !== null && f >= 0.7);
      card.classList.toggle('is-bad', f === 0);
      card.querySelector('[data-pts]').textContent = (f === null ? 0 : Math.round(w * f)) + '/' + w;
    });
    score = Math.round(score);
    const capped = flags.length > 0;
    let tier, v, sub;
    if (done === 0) { tier = 'none'; v = T('Completează checklist-ul'); sub = T('Alege câte o opțiune în fiecare secțiune.'); }
    else if (capped || score < 60) { tier = 'bad'; v = T('Nu intra'); sub = capped ? T('O regulă obligatorie nu este respectată. Corectează riscul sau R:R-ul înainte de orice intrare.') : T('Prea puține criterii îndeplinite. Așteaptă un setup mai clar.'); }
    else if (score < 85) { tier = 'mid'; v = T('Setup mediu: așteaptă mai multă confirmare'); sub = T('Lipsesc câteva elemente. Răbdarea face parte din plan.'); }
    else { tier = 'good'; v = T('Setup puternic: poți intra conform planului'); sub = T('Respectă SL-ul, lotul calculat și nu muta stop loss-ul.'); }
    if (done > 0 && done < cards.length) sub += ' ' + T('Secțiuni rămase: {n}.', { n: cards.length - done });
    box.dataset.tier = tier;
    $('ck-verdict').textContent = v;
    $('ck-verdict-sub').textContent = sub;
    $('ck-flags').innerHTML = '';
    flags.forEach(t => { const li = document.createElement('li'); li.textContent = t; $('ck-flags').appendChild(li); });
    $('ck-done').textContent = done;
    $('ck-bar').style.width = (done / cards.length * 100) + '%';
    animate(score);
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', e => e.preventDefault());
  $('ck-rr').addEventListener('input', () => { if ($('ck-rr').value) { $('ck-sl').value = ''; $('ck-tp').value = ''; } });
  ['ck-sl', 'ck-tp'].forEach(id => $(id).addEventListener('input', () => { if ($(id).value) $('ck-rr').value = ''; }));
  $('ck-reset').addEventListener('click', () => { form.reset(); update(); form.querySelector('input').focus({ preventScroll: true }); window.scrollTo({ top: form.getBoundingClientRect().top + scrollY - 90, behavior: 'smooth' }); });
  update();
})();
