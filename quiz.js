/* Testul pentru începători (test.html): 15 întrebări din cele 8 capitole ale cursului.
   O întrebare pe ecran, feedback imediat, scor final, ordine și variante amestecate la fiecare încercare.
   Cel mai bun scor se salvează doar în browser (localStorage). */
(function () {
  'use strict';
  const root = document.getElementById('quiz');
  if (!root) return;

  const CH = {
    1: 'Forex, brokerul și platforma',
    2: 'Graficul: lumânări și timeframe-uri',
    3: 'Pip, lot și costuri',
    4: 'Levier și marjă',
    5: 'Ordine, stop loss și take profit',
    6: 'Managementul riscului',
    7: 'Psihologie, disciplină și greșeli',
    8: 'Primii pași concreți',
  };
  // a[0] este mereu răspunsul corect în date; la afișare variantele se amestecă.
  const QUESTIONS = [
    { ch: 1, q: 'Pe EURUSD vezi bid 1,1000 și ask 1,1001. Ce reprezintă diferența de 1 pip dintre ele?',
      a: ['Spread-ul, un cost pe care îl plătești la fiecare tranzacție', 'Comisionul fix pe care brokerul îl ia la retragere', 'Swap-ul pentru ținerea poziției peste noapte', 'Marja blocată ca garanție'],
      ex: 'Cumperi la ask și vinzi la bid. Diferența dintre ele este spread-ul, principalul cost al unei tranzacții. De aceea orice poziție pornește puțin pe minus.' },
    { ch: 2, q: 'Ce arată o singură lumânare de pe graficul H4?',
      a: ['Deschiderea, închiderea, maximul și minimul prețului într-un interval de 4 ore', 'Prețul mediu din ultimele 4 zile', 'Câte tranzacții s-au făcut în ultimele 4 minute', 'Direcția pe care o va avea prețul în următoarele 4 ore'],
      ex: 'Fiecare lumânare arată deschiderea, închiderea, maximul și minimul dintr-un interval. Pe H4, intervalul este de 4 ore. Lumânarea arată trecutul, nu ce urmează.' },
    { ch: 3, q: 'Cumperi EURUSD la 1,1000 și închizi la 1,1035. Câți pips ai câștigat?',
      a: ['35 de pips', '3,5 pips', '350 de pips', '0,35 pips'],
      ex: 'La EURUSD, 1 pip = 0,0001. Diferența este 1,1035 − 1,1000 = 0,0035, adică 0,0035 ÷ 0,0001 = 35 de pips.' },
    { ch: 3, q: 'Cât valorează aproximativ un pip pe EURUSD pentru o poziție de 0,10 loturi?',
      a: ['1 USD', '0,10 USD', '10 USD', '100 USD'],
      ex: '0,10 loturi înseamnă 10.000 de unități. Valoarea pipului = 0,0001 × 10.000 = 1 USD. Pentru 1 lot ar fi 10 USD, iar pentru 0,01 loturi, 0,10 USD.' },
    { ch: 3, q: 'Ce este swap-ul?',
      a: ['Costul (uneori un mic câștig) pentru ținerea poziției peste noapte, în funcție de dobânzile celor două valute', 'Diferența dintre prețul de cumpărare și cel de vânzare', 'Taxa pe care o plătești când deschizi contul', 'Ordinul care îți închide automat poziția pe pierdere'],
      ex: 'Swap-ul se aplică pozițiilor ținute peste noapte și depinde de dobânzile celor două valute. La majoritatea brokerilor, miercurea se aplică triplu, pentru weekend. Pentru swing trading contează.' },
    { ch: 4, q: 'Ai un cont cu levier 1:30 și deschizi o poziție în valoare de 10.000 €. Ce marjă îți blochează brokerul?',
      a: ['Aproximativ 333,33 €', '300 €', '3.000 €', '10.000 €'],
      ex: 'Marja necesară = valoarea poziției ÷ levier = 10.000 ÷ 30 ≈ 333,33 €. Atenție: profitul și pierderea se calculează la toată valoarea poziției, nu la marjă.' },
    { ch: 4, q: 'Care este levierul maxim pentru un client retail pe EURUSD, la un broker reglementat în UE?',
      a: ['1:30', '1:2', '1:20', '1:500'],
      ex: 'ESMA limitează levierul pentru clienții retail din UE la 1:30 pe perechile formate doar din USD, EUR, JPY, GBP, CAD și CHF. Tot în UE ai și protecție la sold negativ.' },
    { ch: 5, q: 'Vrei să cumperi EURUSD doar dacă prețul coboară la un nivel mai bun, sub prețul curent. Ce ordin folosești?',
      a: ['Buy limit', 'Buy stop', 'Sell limit', 'Market'],
      ex: 'Ordinele limit așteaptă un preț mai bun: buy limit sub prețul curent, sell limit deasupra. Ordinele stop așteaptă confirmarea: buy stop deasupra prețului curent.' },
    { ch: 5, q: 'Ai o poziție de buy, iar prețul se apropie de stop loss. Ce spune lecția?',
      a: ['Nu muți niciodată stop loss-ul mai departe; îl poți muta doar ca să reduci riscul, dacă asta scrie în plan', 'Muți stop loss-ul mai jos, ca să-i dai pieței mai mult spațiu', 'Scoți stop loss-ul, pentru că prețul își revine de obicei', 'Adaugi încă o poziție, ca să obții un preț mediu mai bun'],
      ex: 'Stop loss-ul se pune acolo unde ideea devine greșită (la buy, sub ultimul minim relevant) și nu se mută niciodată mai departe. Fără SL, o singură știre îți poate șterge luni de muncă.' },
    { ch: 5, q: 'Riști 25 de pips ca să câștigi 50 (R:R 1:2). Ce procent minim de tranzacții câștigate îți trebuie ca să fii pe zero, înainte de costuri?',
      a: ['Aproximativ 33,3%', '20%', '50%', '66,7%'],
      ex: 'Rata de echilibru = 1 ÷ (1 + 2) = 33,3%. Cu R:R 1:1 ai avea nevoie de peste 50%. Este un calcul, nu o promisiune de profit.' },
    { ch: 6, q: 'Ai un cont de 1.500 € și respecți regula de 1%. Cât poți pierde cel mult dacă se atinge stop loss-ul?',
      a: ['15 €', '1,50 €', '150 €', '1 € pe pip, indiferent de stop loss'],
      ex: '1% din 1.500 € = 15 €. Pare puțin și exact asta e ideea: poți greși de multe ori fără să ieși din joc. La început, chiar și 0,5% este o alegere foarte bună.' },
    { ch: 6, q: 'Cont de 2.000 €, risc 1%, stop loss de 40 de pips pe EURUSD, la cursul 1,10 (1 pip pe 1 lot ≈ 9,09 €). Ce lot alegi?',
      a: ['0,05 loturi', '0,06 loturi', '0,02 loturi', '0,50 loturi'],
      ex: 'Suma riscată = 20 €. Lot = 20 ÷ (40 × 9,09) ≈ 0,055, iar rotunjit în jos dă 0,05 loturi (risc ≈ 18,18 €). Cu 0,06 loturi ai risca ≈ 21,82 €, peste 1%. Rotunjești mereu în jos.' },
    { ch: 6, q: 'Contul tău scade cu 50%. Ce câștig îți trebuie, din ce ți-a rămas, ca să revii de unde ai pornit?',
      a: ['+100%', '+50%', '+75%', '+200%'],
      ex: 'Din 1.000 € pierzi 50% și rămâi cu 500 €. Ca să revii la 1.000 € îți trebuie +500 €, adică +100% din cât ți-a rămas. De aceea pierderile mari sunt greu de recuperat.' },
    { ch: 7, q: 'Ai pierdut două tranzacții la rând și simți că vrei să „recuperezi” imediat, cu un lot mai mare. Ce faci?',
      a: ['Închizi platforma până a doua zi: asta e trading din răzbunare', 'Dublezi lotul, ca să recuperezi mai repede', 'Intri pe primul semnal, fără să mai verifici planul', 'Schimbi strategia, pentru că evident nu funcționează'],
      ex: 'Tradingul din răzbunare duce de obicei la loturi mai mari și pierderi mai mari. Antidotul din lecție: după 2 pierderi la rând, închizi platforma până a doua zi.' },
    { ch: 8, q: 'Care este primul pas recomandat înainte să tranzacționezi cu bani reali?',
      a: ['Cel puțin 6 până la 8 săptămâni pe cont demo, cu același risc, același plan și jurnal complet', 'Un depozit mare, ca să ai spațiu pentru pierderi', 'Copierea semnalelor unui trader cu rezultate bune', 'Levier cât mai mare, ca să crești contul rapid'],
      ex: 'Mai întâi demo, cel puțin 6 până la 8 săptămâni și 30 până la 50 de tranzacții, ca pe bani reali. Treci pe real doar dacă ai fost disciplinat, cu sume mici și 0,01 loturi.' },
  ];
  // traducere (identitate în română): întrebări, variante, explicații, capitole
  QUESTIONS.forEach(x => { x.q = T(x.q); x.a = x.a.map(s => T(s)); x.ex = T(x.ex); });
  Object.keys(CH).forEach(k => { CH[k] = T(CH[k]); });
  const TOTAL = QUESTIONS.length;
  const KEY = 'mfx-quiz-best';
  const LETTERS = ['A', 'B', 'C', 'D'];
  const $ = id => document.getElementById(id);
  const el = {
    start: $('quiz-start'), startBtn: $('quiz-start-btn'), best: $('quiz-best'),
    q: $('quiz-q'), count: $('quiz-count'), ch: $('quiz-ch'), bar: $('quiz-bar'), fill: $('quiz-bar-fill'),
    question: $('quiz-question'), options: $('quiz-options'), feedback: $('quiz-feedback'), next: $('quiz-next'),
    result: $('quiz-result'), resultTitle: $('quiz-result-title'), score: $('quiz-score'), pct: $('quiz-pct'), ring: $('quiz-ring'),
    band: $('quiz-band'), bestResult: $('quiz-best-result'), missed: $('quiz-missed'), retry: $('quiz-retry'),
  };

  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const chLink = ch => `lectie.html#cap-${ch}`;
  const chLabel = ch => T('Capitolul {n}: {t}', { n: ch, t: CH[ch] });
  const pctOf = s => Math.round(s / TOTAL * 100);
  const readBest = () => { try { const b = JSON.parse(localStorage.getItem(KEY) || 'null'); return b && Number.isInteger(b.score) && b.score >= 0 && b.score <= TOTAL ? b : null; } catch (e) { return null; } };
  const saveBest = s => { try { localStorage.setItem(KEY, JSON.stringify({ score: s, total: TOTAL, date: new Date().toISOString().slice(0, 10) })); } catch (e) { /* stocare indisponibilă */ } };
  const bestText = b => `${b.score}/${TOTAL} (${pctOf(b.score)}%)`;

  let order = [], opts = [], idx = 0, answers = [], answered = false;

  function showBestOnStart() {
    const b = readBest();
    if (b) { el.best.innerHTML = T('Cel mai bun scor al tău: <b>{x}</b>', { x: bestText(b) }); el.best.hidden = false; }
  }

  function start() {
    order = shuffle(QUESTIONS.map((_, i) => i));
    opts = order.map(qi => shuffle([0, 1, 2, 3]));
    idx = 0; answers = [];
    el.start.hidden = true; el.result.hidden = true; el.q.hidden = false;
    render();
  }

  function setProgress(done) {
    el.fill.style.width = (done / TOTAL * 100) + '%';
    el.bar.setAttribute('aria-valuenow', String(done));
    el.bar.setAttribute('aria-valuetext', T('{a} din {b} întrebări răspunse', { a: done, b: TOTAL }));
  }

  function render() {
    const Q = QUESTIONS[order[idx]];
    answered = false;
    el.count.textContent = T('Întrebarea {a} din {b}', { a: idx + 1, b: TOTAL });
    el.ch.textContent = T('Capitolul {n}', { n: Q.ch });
    setProgress(idx);
    el.question.textContent = Q.q;
    el.options.innerHTML = '';
    opts[idx].forEach((ai, k) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'quiz-opt'; b.dataset.k = String(k);
      b.innerHTML = `<span class="quiz-letter" aria-hidden="true">${LETTERS[k]}</span><span class="quiz-opt-text"></span><span class="quiz-mark" aria-hidden="true"></span><span class="sr-only quiz-sr"></span>`;
      b.querySelector('.quiz-opt-text').textContent = Q.a[ai];
      b.setAttribute('aria-label', `${LETTERS[k]}. ${Q.a[ai]}`);
      b.addEventListener('click', () => choose(k));
      li.appendChild(b); el.options.appendChild(li);
    });
    el.feedback.hidden = true; el.feedback.className = 'quiz-feedback'; el.feedback.innerHTML = '';
    el.next.hidden = true;
    el.next.textContent = idx === TOTAL - 1 ? T('Vezi rezultatul') : T('Următoarea întrebare');
    el.question.focus({ preventScroll: true });
    if (idx > 0) el.q.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function choose(k) {
    if (answered) return;
    answered = true;
    const qi = order[idx], Q = QUESTIONS[qi];
    const chosenA = opts[idx][k], ok = chosenA === 0;
    answers.push({ qi, chosen: chosenA, ok });
    [...el.options.querySelectorAll('.quiz-opt')].forEach((b, j) => {
      const a = opts[idx][j];
      b.disabled = true;
      b.setAttribute('aria-disabled', 'true');
      if (a === 0) { b.classList.add('is-correct'); b.querySelector('.quiz-sr').textContent = ' (' + T('răspunsul corect') + ')'; b.setAttribute('aria-label', b.getAttribute('aria-label') + ', ' + T('răspunsul corect')); }
      if (j === k) { b.classList.add('is-chosen'); if (!ok) { b.classList.add('is-wrong'); b.setAttribute('aria-label', b.getAttribute('aria-label') + ', ' + T('răspunsul tău')); } }
    });
    el.feedback.className = 'quiz-feedback ' + (ok ? 'is-ok' : 'is-bad');
    el.feedback.innerHTML = `<p class="quiz-verdict">${ok ? T('Corect!') : T('Greșit.')}</p><p class="quiz-ex"></p><a class="quiz-ch-link" href="${chLink(Q.ch)}">${T('Recitește:')} ${chLabel(Q.ch)} <span aria-hidden="true">→</span></a>`;
    if (!ok) el.feedback.querySelector('.quiz-verdict').textContent = T('Greșit. Răspunsul corect: {x}.', { x: Q.a[0] });
    el.feedback.querySelector('.quiz-ex').textContent = Q.ex;
    el.feedback.hidden = false;
    setProgress(idx + 1);
    el.next.hidden = false;
    el.next.focus({ preventScroll: true });
    // feedback-ul trebuie să se vadă pe telefon
    const r = el.next.getBoundingClientRect();
    if (r.bottom > innerHeight) el.next.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }

  function next() {
    if (!answered) return;
    if (idx < TOTAL - 1) { idx++; render(); } else finish();
  }

  function finish() {
    const score = answers.filter(a => a.ok).length, pct = pctOf(score);
    const prev = readBest();
    const record = !prev || score > prev.score;
    if (record) saveBest(score);
    el.q.hidden = true; el.result.hidden = false;
    el.score.textContent = `${score}/${TOTAL}`;
    el.pct.textContent = `${pct}%`;
    el.ring.style.setProperty('--p', String(pct));
    el.result.dataset.band = pct < 60 ? 'low' : pct <= 85 ? 'mid' : 'high';
    el.resultTitle.textContent = T('Ai răspuns corect la {a} din {b} întrebări', { a: score, b: TOTAL });
    el.band.textContent = pct < 60
      ? T('Recitește capitolele de mai jos și reia testul. Nu te grăbi: calculele din capitolele 3, 4, 5 și 6 sunt baza a tot ce urmează.')
      : pct <= 85
        ? T('Bază bună. Recitește capitolele unde ai greșit, apoi refă testul până treci de 85%.')
        : T('Foarte bine! Ai înțeles bazele. Următorul pas: exersezi pe un cont demo, cu risc de 1% și jurnal complet.');
    const best = readBest();
    el.bestResult.innerHTML = record && prev
      ? T('Scor nou record! Cel mai bun scor al tău: <b>{x}</b> (înainte: {y})', { x: bestText(best), y: bestText(prev) })
      : T('Cel mai bun scor al tău: <b>{x}</b>', { x: bestText(best || { score }) });
    const missed = answers.filter(a => !a.ok);
    if (missed.length) {
      el.missed.innerHTML = `<h3>${T('Întrebările greșite ({n})', { n: missed.length })}</h3><ol class="quiz-missed-list"></ol>`;
      const ol = el.missed.querySelector('ol');
      missed.forEach(a => {
        const Q = QUESTIONS[a.qi];
        const li = document.createElement('li');
        li.innerHTML = '<p class="quiz-m-q"></p><p class="quiz-m-a"><span>' + T('Răspunsul corect:') + '</span> <b></b></p>' +
          `<a class="quiz-ch-link" href="${chLink(Q.ch)}">${T('Recitește:')} ${chLabel(Q.ch)} <span aria-hidden="true">→</span></a>`;
        li.querySelector('.quiz-m-q').textContent = Q.q;
        li.querySelector('b').textContent = Q.a[0];
        ol.appendChild(li);
      });
    } else {
      el.missed.innerHTML = '<p class="quiz-perfect">' + T('Niciun răspuns greșit. Felicitări! Acum aplică totul pe demo, cu aceleași reguli ca pe real.') + '</p>';
    }
    el.resultTitle.focus({ preventScroll: true });
    el.result.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  // tastatură: A-D sau 1-4 aleg varianta, cât timp întrebarea nu are răspuns
  document.addEventListener('keydown', e => {
    if (el.q.hidden || answered || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    const k = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
    if (k >= 0 && e.key.length === 1) { e.preventDefault(); choose(k); }
  });

  el.startBtn.addEventListener('click', start);
  el.next.addEventListener('click', next);
  el.retry.addEventListener('click', start);
  el.startBtn.hidden = false;
  showBestOnStart();
})();
