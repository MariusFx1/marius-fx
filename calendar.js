// ===== Calendar economic (calendar.html) =====
// Datele vin din data/calendar.json, actualizat automat de GitHub Actions din feed-ul ForexFactory.
// Orele din feed au offset ISO (ora New York), așa că new Date() le convertește corect în ora vizitatorului, inclusiv la schimbarea orei.
(function () {
  'use strict';
  const app = document.getElementById('cal-app');
  if (!app) return;

  const DATA_URL = I18N.root + 'data/calendar.json';
  const STALE_MS = 72 * 3600e3;      // peste 3 zile fără actualizare: afișăm mesajul de rezervă
  const NOW_WINDOW_MS = 5 * 60e3;    // „ACUM” încă 5 minute după publicare
  const REFRESH_MS = 30 * 60e3;      // reîncărcăm datele la 30 de minute cât timp pagina e deschisă
  const STORE_KEY = 'mfx-cal-filters-v1';

  const CCY = [
    ['USD', 'us', T('SUA'), 'America/New_York'], ['EUR', 'eu', T('zona euro'), 'Europe/Berlin'], ['GBP', 'gb', T('Marea Britanie'), 'Europe/London'],
    ['JPY', 'jp', T('Japonia'), 'Asia/Tokyo'], ['CHF', 'ch', T('Elveția'), 'Europe/Zurich'], ['CAD', 'ca', T('Canada'), 'America/Toronto'],
    ['AUD', 'au', T('Australia'), 'Australia/Sydney'], ['NZD', 'nz', T('Noua Zeelandă'), 'Pacific/Auckland'], ['CNY', 'cn', T('China'), 'Asia/Shanghai'],
    ['ALL', '', T('global'), 'UTC'],
  ];
  const CCY_INFO = Object.fromEntries(CCY.map(([c, f, n, tz]) => [c, { flag: f, name: n, tz }]));
  const DEFAULT_CCY = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'ALL'];
  const IMPACT = { High: ['high', T('Mare'), T('Impact mare')], Medium: ['med', T('Mediu'), T('Impact mediu')], Low: ['low', T('Scăzut'), T('Impact scăzut')], Holiday: ['hol', T('Zi liberă'), T('Zi liberă bancară')] };

  // ---------- titluri explicate în română ----------
  const PERIOD = { 'm/m': ['lunar', 'lunară', 'lunare'], 'y/y': ['anual', 'anuală', 'anuale'], 'q/q': ['trimestrial', 'trimestrială', 'trimestriale'],
    '3m/y': ['anual, medie pe 3 luni', 'anuală, medie pe 3 luni', 'anuale, medie pe 3 luni'], 'q/y': ['anual', 'anuală', 'anuale'] };
  const G = { m: 0, f: 1, p: 2 };
  const QUAL = [[/^Flash /, T('estimare rapidă')], [/^Prelim /, T('date preliminare')], [/^Final /, T('date finale')], [/^Revised /, T('date revizuite')], [/^Advance /, T('prima estimare')]];
  const PREFIX = { German: T('Germania'), French: T('Franța'), Italian: T('Italia'), Spanish: T('Spania') };
  const SECTOR = { Manufacturing: T('industrie'), Services: T('servicii'), Construction: T('construcții'), Composite: T('compozit (industrie + servicii)'), 'Non-Manufacturing': T('servicii') };
  const BANK = { EUR: T('BCE'), GBP: 'BoE', JPY: 'BoJ', CHF: 'SNB', CAD: 'BoC', AUD: 'RBA', NZD: 'RBNZ', USD: 'Fed', CNY: 'PBoC' };
  const MAP = [
    [/^Non-Farm Employment Change$/, T('NFP: locuri de muncă SUA')],
    [/^ADP Non-Farm Employment Change$/, T('ADP: locuri de muncă în sectorul privat')],
    [/^ADP Weekly Employment Change$/, T('ADP: locuri de muncă, estimare săptămânală')],
    [/^Core CPI$/, T('Inflația de bază (CPI)'), 'f'],
    [/^CPI$/, T('Inflația (CPI)'), 'f'],
    [/^(Trimmed Mean|Median|Common) CPI$/, T('Inflația de bază (CPI)'), 'f'],
    [/^Core PCE Price Index$/, T('Inflația PCE de bază (măsura urmărită de Fed)'), 'f'],
    [/^PCE Price Index$/, T('Inflația PCE'), 'f'],
    [/^Core PPI$/, T('Prețurile de producție de bază (PPI)'), 'p'],
    [/^PPI$/, T('Prețurile de producție (PPI)'), 'p'],
    [/^Federal Funds Rate$/, T('Decizia de dobândă Fed')],
    [/^FOMC Statement$/, T('Comunicatul Fed după decizia de dobândă')],
    [/^FOMC Press Conference$/, T('Conferința de presă Fed')],
    [/^FOMC Meeting Minutes$/, T('Minutele ședinței Fed (FOMC)')],
    [/^FOMC Economic Projections$/, T('Proiecțiile economice ale Fed')],
    [/^Main Refinancing Rate$/, T('Decizia de dobândă BCE')],
    [/^ECB Press Conference$/, T('Conferința de presă BCE')],
    [/^ECB Monetary Policy Meeting Accounts$/, T('Minutele ședinței BCE')],
    [/^Official Bank Rate$/, T('Decizia de dobândă BoE')],
    [/^MPC Official Bank Rate Votes$/, T('Cum au votat membrii BoE pentru dobândă')],
    [/^BOE Monetary Policy Report$/, T('Raportul de politică monetară BoE')],
    [/^BOJ Policy Rate$/, T('Decizia de dobândă BoJ')],
    [/^BOJ Press Conference$/, T('Conferința de presă BoJ')],
    [/^BOJ Outlook Report$/, T('Raportul de perspective BoJ')],
    [/^SNB Policy Rate$/, T('Decizia de dobândă SNB')],
    [/^SNB Press Conference$/, T('Conferința de presă SNB')],
    [/^Overnight Rate$/, T('Decizia de dobândă BoC')],
    [/^BOC Rate Statement$/, T('Comunicatul BoC după decizia de dobândă')],
    [/^BOC Press Conference$/, T('Conferința de presă BoC')],
    [/^Cash Rate$/, T('Decizia de dobândă RBA')],
    [/^RBA Rate Statement$/, T('Comunicatul RBA după decizia de dobândă')],
    [/^RBA Press Conference$/, T('Conferința de presă RBA')],
    [/^Official Cash Rate$/, T('Decizia de dobândă RBNZ')],
    [/^RBNZ Rate Statement$/, T('Comunicatul RBNZ după decizia de dobândă')],
    [/^RBNZ Press Conference$/, T('Conferința de presă RBNZ')],
    [/^Monetary Policy Statement$/, c => T('Comunicatul de politică monetară {b}', { b: BANK[c] || '' }).trim()],
    [/^Fed Chair .+ Speaks$/, T('Discurs: președintele Fed')],
    [/^FOMC Member .+ Speaks$/, T('Discurs: membru Fed (FOMC)')],
    [/^ECB President .+ Speaks$/, T('Discurs: președintele BCE')],
    [/^BOE Gov .+ Speaks$/, T('Discurs: guvernatorul BoE')],
    [/^MPC Member .+ Speaks$/, T('Discurs: membru BoE (MPC)')],
    [/^BOJ Gov .+ Speaks$/, T('Discurs: guvernatorul BoJ')],
    [/^SNB Chairman .+ Speaks$/, T('Discurs: președintele SNB')],
    [/^BOC Gov .+ Speaks$/, T('Discurs: guvernatorul BoC')],
    [/^RBA Gov .+ Speaks$/, T('Discurs: guvernatorul RBA')],
    [/^RBNZ Gov .+ Speaks$/, T('Discurs: guvernatorul RBNZ')],
    [/^Buba President .+ Speaks$/, T('Discurs: președintele Bundesbank')],
    [/^Gov Board Member .+ Speaks$/, c => T('Discurs: membru al conducerii {b}', { b: BANK[c] || T('băncii centrale') })],
    [/^President Trump Speaks$/, T('Discurs: președintele SUA')],
    [/^Unemployment Claims$/, T('Cereri de șomaj (săptămânal)')],
    [/^Unemployment Rate$/, T('Rata șomajului'), 'f'],
    [/^Employment Change$/, T('Locuri de muncă noi')],
    [/^Claimant Count Change$/, T('Cereri de ajutor de șomaj')],
    [/^Average Hourly Earnings$/, T('Salariul mediu pe oră'), 'm'],
    [/^Average Earnings Index$/, T('Câștigurile salariale'), 'p'],
    [/^Wage Price Index$/, T('Indicele salariilor'), 'm'],
    [/^Employment Cost Index$/, T('Costul forței de muncă'), 'm'],
    [/^JOLTS Job Openings$/, T('Locuri de muncă disponibile (JOLTS)')],
    [/^Retail Sales$/, T('Vânzările cu amănuntul'), 'p'],
    [/^Core Retail Sales$/, T('Vânzările cu amănuntul fără auto'), 'p'],
    [/^GDP$/, T('Creșterea economiei (PIB)'), 'f'],
    [/^Trade Balance$/, T('Balanța comercială'), 'f'],
    [/^Current Account$/, T('Contul curent'), 'm'],
    [/^Industrial Production$/, T('Producția industrială'), 'f'],
    [/^Factory Orders$/, T('Comenzile din fabrici'), 'p'],
    [/^Core Durable Goods Orders$/, T('Comenzi de bunuri durabile, fără transport'), 'p'],
    [/^Durable Goods Orders$/, T('Comenzi de bunuri durabile'), 'p'],
    [/^UoM Consumer Sentiment$/, T('Încrederea consumatorilor (Univ. Michigan)'), 'f'],
    [/^UoM Inflation Expectations$/, T('Inflația așteptată de consumatori (Univ. Michigan)'), 'f'],
    [/^CB Consumer Confidence$/, T('Încrederea consumatorilor (Conference Board)'), 'f'],
    [/^Consumer Confidence$/, T('Încrederea consumatorilor'), 'f'],
    [/^ZEW Economic Sentiment$/, T('Sentimentul economic ZEW'), 'm'],
    [/^Ifo Business Climate$/, T('Climatul de afaceri Ifo'), 'm'],
    [/^Sentix Investor Confidence$/, T('Încrederea investitorilor (Sentix)'), 'f'],
    [/^Empire State Manufacturing Index$/, T('Industria din statul New York (Empire State)')],
    [/^Philly Fed Manufacturing Index$/, T('Industria din regiunea Philadelphia (Philly Fed)')],
    [/^Existing Home Sales$/, T('Vânzări de case existente'), 'p'],
    [/^New Home Sales$/, T('Vânzări de case noi'), 'p'],
    [/^Pending Home Sales$/, T('Contracte de vânzare de case'), 'p'],
    [/^Building Permits$/, T('Autorizații de construcție'), 'p'],
    [/^Housing Starts$/, T('Construcții de locuințe începute'), 'p'],
    [/^Crude Oil Inventories$/, T('Stocurile de petrol din SUA'), 'p'],
    [/^Natural Gas Storage$/, T('Stocurile de gaze naturale din SUA'), 'p'],
    [/^Tankan .+$/, T('Sondajul Tankan al BoJ'), 'm'],
    [/^Bank Holiday$/, T('Zi liberă bancară: lichiditate mai mică')],
    [/^OPEC.*Meetings$/, T('Ședințe OPEC (petrol)')],
    [/^\d+-y Bond Auction$/, T('Licitație de obligațiuni de stat')],
  ];

  function roTitle(title, ccy) {
    let t = title, country = '', qual = '', period = '';
    for (const [p, name] of Object.entries(PREFIX)) if (t.startsWith(p + ' ')) { country = name; t = t.slice(p.length + 1); }
    for (const [re, q] of QUAL) if (re.test(t)) { qual = q; t = t.replace(re, ''); }
    if (/ Flash Estimate( |$)/.test(t)) { qual = T('estimare rapidă'); t = t.replace(' Flash Estimate', ''); }
    const pm = t.match(/ (m\/m|y\/y|q\/q|3m\/y|q\/y)$/);
    if (pm) { period = pm[1]; t = t.slice(0, -pm[0].length); }
    let base = null, gender = 'm', note = '';
    const pmi = t.match(/^(ISM |Caixin |Ivey |Chicago )?(?:(Manufacturing|Services|Construction|Composite|Non-Manufacturing) )?PMI$/);
    if (pmi) {
      const who = (pmi[1] || '').trim();
      base = (pmi[2] ? T('Indicele PMI {s}', { s: SECTOR[pmi[2]] }) : T('Indicele PMI')) + (who ? ' (' + who + ')' : '');
      note = T(': peste 50 înseamnă creștere');
    } else {
      for (const [re, txt, g] of MAP) if (re.test(t)) { base = typeof txt === 'function' ? txt(ccy) : txt; gender = g || 'm'; break; }
    }
    if (!base) return '';
    let out = base;
    if (period && PERIOD[period]) out += I18N.lang === 'ro' ? ' ' + PERIOD[period][G[gender]] : ' (' + T(PERIOD[period][0]) + ')';
    if (qual) out += ', ' + qual;
    if (country) out += ' (' + country + ')';
    return out + note;
  }

  // ---------- utilitare ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const fmtTime = new Intl.DateTimeFormat(I18N.locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const fmtDay = new Intl.DateTimeFormat(I18N.locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const localKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const tzKeyFmt = {};
  const zoneKey = (d, tz) => {
    try { tzKeyFmt[tz] = tzKeyFmt[tz] || new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }); return tzKeyFmt[tz].format(d); }
    catch (e) { return localKey(d); }
  };
  const keyToDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const dayName = k => cap(fmtDay.format(keyToDate(k)));
  const addDays = (k, n) => { const d = keyToDate(k); d.setDate(d.getDate() + n); return localKey(d); };

  function countdown(ms) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    if (d >= 1) return T('peste {x}', { x: d + T('z') + ' ' + h + 'h' });
    if (h >= 1) return T('peste {x}', { x: h + 'h ' + pad(m) + 'm' });
    return T('peste {x}', { x: m + 'm ' + pad(sec) + 's' });
  }
  function tzLabel() {
    let zone = '';
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* fără nume de fus */ }
    const off = -new Date().getTimezoneOffset(), sign = off >= 0 ? '+' : '-', a = Math.abs(off);
    const utc = 'UTC' + sign + Math.floor(a / 60) + (a % 60 ? ':' + pad(a % 60) : '');
    return zone ? zone.replace(/_/g, ' ') + ', ' + utc : utc;
  }
  const flagImg = (ccy, cls) => {
    const f = (CCY_INFO[ccy] || {}).flag;
    if (f) return '<img class="' + cls + '" src="' + I18N.root + 'images/flags/' + f + '.svg" width="20" height="15" alt="" loading="lazy" decoding="async">';
    return '<svg class="' + cls + ' cal-globe" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/></svg>';
  };
  const ccyBadge = (ccy, big) => '<span class="cal-ccy' + (big ? ' cal-ccy-lg' : '') + '" title="' + esc(ccyName(ccy)) + '">' + flagImg(ccy, 'cal-flag') + '<b>' + esc(ccy) + '</b></span>';
  const ccyName = c => (CCY_INFO[c] ? CCY_INFO[c].name : c);
  const impactBadge = imp => { const i = IMPACT[imp] || IMPACT.Low; return '<span class="cal-impact cal-impact-' + i[0] + '" title="' + i[2] + '">' + i[1] + '</span>'; };

  // ---------- filtre (salvate în localStorage) ----------
  const state = { ccy: new Set(DEFAULT_CCY), impact: 'hm', today: false, showPast: false };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && Array.isArray(saved.ccy)) state.ccy = new Set(saved.ccy.filter(c => CCY_INFO[c]));
    if (saved && ['high', 'hm', 'all'].includes(saved.impact)) state.impact = saved.impact;
    if (saved && typeof saved.today === 'boolean') state.today = saved.today;
  } catch (e) { /* localStorage indisponibil sau date corupte: rămân valorile implicite */ }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify({ ccy: [...state.ccy], impact: state.impact, today: state.today })); } catch (e) { /* ignorat */ } };

  // ---------- elemente ----------
  const $ = id => document.getElementById(id);
  const hero = $('cal-hero'), list = $('cal-list'), chips = $('cal-ccy-chips'), seg = $('cal-impact-seg'), todayBtn = $('cal-today'),
    meta = $('cal-meta'), fallbackMsg = $('cal-fallback-msg');

  chips.innerHTML = CCY.map(([c]) => '<button type="button" class="cal-chip" data-ccy="' + c + '" aria-pressed="false">' + flagImg(c, 'cal-flag') + '<span>' + (c === 'ALL' ? T('Global') : c) + '</span></button>').join('') +
    '<button type="button" class="cal-chip cal-chip-all" data-ccy="*">' + T('Toate') + '</button>';

  function syncControls() {
    chips.querySelectorAll('[data-ccy]').forEach(b => { if (b.dataset.ccy !== '*') b.setAttribute('aria-pressed', state.ccy.has(b.dataset.ccy)); });
    seg.querySelectorAll('[data-impact]').forEach(b => b.setAttribute('aria-pressed', b.dataset.impact === state.impact));
    todayBtn.setAttribute('aria-pressed', state.today);
  }
  chips.addEventListener('click', e => {
    const b = e.target.closest('[data-ccy]'); if (!b) return;
    const c = b.dataset.ccy;
    if (c === '*') state.ccy = new Set(CCY.map(x => x[0]));
    else if (state.ccy.has(c)) state.ccy.delete(c); else state.ccy.add(c);
    save(); syncControls(); render();
  });
  seg.addEventListener('click', e => { const b = e.target.closest('[data-impact]'); if (!b) return; state.impact = b.dataset.impact; save(); syncControls(); render(); });
  todayBtn.addEventListener('click', () => { state.today = !state.today; save(); syncControls(); render(); });
  list.addEventListener('click', e => { if (e.target.closest('#cal-past-toggle')) { state.showPast = !state.showPast; render(); } });
  hero.addEventListener('click', e => {
    const a = e.target.closest('[data-goto]'); if (!a) return;
    e.preventDefault();
    const row = $(a.dataset.goto); if (!row) return;
    row.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    row.classList.remove('is-flash'); void row.offsetWidth; row.classList.add('is-flash');
  });

  // ---------- date ----------
  let events = [], updated = null, lastSig = '', lastToday = '';

  function prepare(raw) {
    return raw.map((e, i) => {
      const d = new Date(e.date);
      const ccy = CCY_INFO[e.country] ? e.country : 'ALL';
      const holiday = e.impact === 'Holiday';
      return { id: 'ev-' + i, title: e.title, ccy, t: d.getTime(), d, holiday, impact: IMPACT[e.impact] ? e.impact : 'Low',
        key: holiday ? zoneKey(d, CCY_INFO[ccy].tz) : localKey(d), forecast: e.forecast || '', previous: e.previous || '', ro: roTitle(e.title, ccy) };
    }).filter(e => !isNaN(e.t)).sort((a, b) => a.t - b.t || (a.holiday ? -1 : 0));
  }

  const statusOf = (e, now, todayKey) => {
    if (e.holiday) return e.key < todayKey ? 'past' : 'hol';
    const diff = e.t - now;
    return diff > 0 ? 'future' : diff > -NOW_WINDOW_MS ? 'now' : 'past';
  };
  const impactOk = e => state.impact === 'all' || (state.impact === 'hm' ? e.impact !== 'Low' : e.impact === 'High');
  const visible = (e, todayKey) => state.ccy.has(e.ccy) && impactOk(e) && (!state.today || e.key === todayKey);

  function showFallback(msg) {
    app.classList.add('is-failed'); app.setAttribute('aria-busy', 'false');
    fallbackMsg.innerHTML = msg || T('<strong>Calendarul nu s-a putut încărca.</strong> Poate fi o problemă de conexiune: reîncarcă pagina peste câteva momente. Între timp, găsești aceleași știri, în ora ta, pe calendarele de mai jos.');
  }

  // ---------- randare ----------
  function rowHtml(e, st, isNext) {
    const nums = [];
    if (e.forecast) nums.push('<div><dt>' + T('Prognoză') + '</dt><dd>' + esc(e.forecast) + '</dd></div>');
    if (e.previous) nums.push('<div><dt>' + T('Anterior') + '</dt><dd>' + esc(e.previous) + '</dd></div>');
    const sub = [e.ro, ccyName(e.ccy)].filter(Boolean);
    const cls = ['cal-row', 'is-' + (IMPACT[e.impact] || IMPACT.Low)[0], 'st-' + st];
    if (isNext) cls.push('is-next');
    const timeTxt = e.holiday ? T('Toată ziua') : fmtTime.format(e.d);
    const cd = e.holiday ? '<span class="cal-cd cal-cd-hol">' + T('bănci închise') + '</span>' : '<span class="cal-cd" data-t="' + e.t + '">' + cdText(e, Date.now()) + '</span>';
    return '<article class="' + cls.join(' ') + '" id="' + e.id + '">' +
      '<div class="cal-row-top">' +
        '<time class="cal-time" datetime="' + esc(e.d.toISOString()) + '">' + timeTxt + '</time>' +
        ccyBadge(e.ccy) + impactBadge(e.impact) +
        cd +
      '</div>' +
      '<div class="cal-row-main">' + (isNext ? '<span class="cal-next-tag">' + T('Urmează') + '</span>' : '') + '<h4 class="cal-row-title" lang="en">' + esc(e.title) + '</h4>' +
        '<p class="cal-row-ro">' + esc(sub.join(' · ')) + '</p></div>' +
      (nums.length ? '<dl class="cal-row-nums">' + nums.join('') + '</dl>' : '<div class="cal-row-nums is-empty"></div>') +
    '</article>';
  }
  function cdText(e, now) {
    const diff = e.t - now;
    if (diff > 0) return countdown(diff);
    if (diff > -NOW_WINDOW_MS) return T('ACUM');
    return T('a trecut');
  }

  function heroHtml(now, todayKey) {
    const up = events.filter(e => !e.holiday && state.ccy.has(e.ccy) && statusOf(e, now, todayKey) !== 'past');
    let pick = up.filter(e => e.impact === 'High'), level = 'High';
    if (!pick.length) { pick = up.filter(e => e.impact === 'Medium'); level = 'Medium'; }
    if (!pick.length) {
      return '<p class="cal-hero-kicker"><span class="cal-hero-dot"></span>' + T('Următoarea știre importantă') + '</p>' +
        '<div class="cal-hero-empty"><h3>' + (state.ccy.size < CCY.length ? T('Nu mai sunt știri importante săptămâna asta pentru valutele alese.') : T('Nu mai sunt știri importante săptămâna asta.')) + '</h3>' +
        '<p>' + T('Calendarul săptămânii viitoare apare automat duminică. Până atunci, verifică din nou pozițiile pe care le ții peste weekend.') + '</p></div>';
    }
    const e = pick[0], same = pick.filter(x => x !== e && x.t === e.t), st = statusOf(e, now, todayKey);
    const nums = [];
    if (e.forecast) nums.push('<span><em>' + T('Prognoză') + '</em> ' + esc(e.forecast) + '</span>');
    if (e.previous) nums.push('<span><em>' + T('Anterior') + '</em> ' + esc(e.previous) + '</span>');
    const rel = e.key === todayKey || e.key === addDays(todayKey, 1);
    const dayLbl = e.key === todayKey ? T('Azi') : e.key === addDays(todayKey, 1) ? T('Mâine') : dayName(e.key);
    const inList = visible(e, todayKey);
    return '<p class="cal-hero-kicker"><span class="cal-hero-dot"></span>' + (level === 'High' ? T('Următoarea știre importantă') : T('Următoarea știre (impact mediu)')) + '</p>' +
      '<div class="cal-hero-body' + (st === 'now' ? ' is-now' : '') + '">' +
        '<div class="cal-hero-info">' +
          '<div class="cal-hero-tags">' + ccyBadge(e.ccy, true) + '<span class="cal-hero-country">' + esc(ccyName(e.ccy)) + '</span>' + impactBadge(e.impact) + '</div>' +
          '<h3 class="cal-hero-title" lang="en">' + esc(e.title) + '</h3>' +
          (e.ro ? '<p class="cal-hero-ro">' + esc(e.ro) + '</p>' : '') +
          '<p class="cal-hero-when">' + T('<b>{d}</b> la <b>{t}</b> (ora ta)', { d: dayLbl + (rel ? ', ' + esc(fmtDay.format(e.d)) : ''), t: fmtTime.format(e.d) }) + '</p>' +
          (nums.length ? '<p class="cal-hero-nums">' + nums.join('') + '</p>' : '') +
          (same.length ? '<p class="cal-hero-also">' + T('La aceeași oră:') + ' ' + same.map(x => '<span lang="en">' + esc(x.title) + '</span> (' + x.ccy + ')').join(', ') + '</p>' : '') +
        '</div>' +
        '<div class="cal-hero-cd" id="cal-hero-cd" role="timer" data-t="' + e.t + '">' + heroCd(e.t - now) + '</div>' +
      '</div>' +
      (inList ? '<a class="cal-hero-link" href="#' + e.id + '" data-goto="' + e.id + '">' + T('Vezi în listă') + ' <span aria-hidden="true">↓</span></a>' : '');
  }
  function heroCd(ms) {
    if (ms <= 0) return '<div class="cal-hero-now"><span>' + T('ACUM') + '</span><small>' + T('știrea tocmai a apărut') + '</small></div>';
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    const box = (v, l) => '<div class="cal-hero-unit"><b>' + v + '</b><span>' + l + '</span></div>';
    return '<span class="cal-sr">' + countdown(ms) + '</span><div class="cal-hero-units" aria-hidden="true">' +
      (d ? box(d, d === 1 ? T('zi') : T('zile')) : '') + box(pad(h), h === 1 ? T('oră') : T('ore')) + box(pad(m), 'min') + (d ? '' : box(pad(sec), 'sec')) + '</div>';
  }

  function render() {
    if (!events.length && !updated) return;
    const now = Date.now(), todayKey = localKey(new Date(now)), tomorrow = addDays(todayKey, 1);
    lastToday = todayKey;
    const vis = events.filter(e => visible(e, todayKey));
    const st = new Map(vis.map(e => [e, statusOf(e, now, todayKey)]));
    const upcoming = vis.filter(e => st.get(e) !== 'past');
    const firstNext = upcoming.find(e => !e.holiday && st.get(e) === 'future');
    const pastCount = vis.length - upcoming.length;
    const shown = state.showPast ? vis : upcoming;

    hero.innerHTML = heroHtml(now, todayKey);

    let html = '';
    if (pastCount) html += '<button type="button" class="cal-past-toggle" id="cal-past-toggle" aria-expanded="' + state.showPast + '">' +
      (state.showPast ? T('Ascunde știrile trecute') : T('Arată știrile trecute din săptămâna asta ({n})', { n: pastCount })) + '</button>';
    const groups = new Map();
    for (const e of shown) { if (!groups.has(e.key)) groups.set(e.key, []); groups.get(e.key).push(e); }
    const keys = events.map(e => e.key).sort(), firstDay = keys[0] || todayKey, lastDay = keys[keys.length - 1] || todayKey;
    // „Azi” rămâne vizibil (cu un mesaj) cât timp suntem în săptămâna din date și mai urmează ceva
    if (!groups.has(todayKey) && todayKey >= firstDay && todayKey <= lastDay && state.ccy.size && upcoming.length) groups.set(todayKey, []);
    const ordered = [...groups.entries()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    for (const [k, items] of ordered) {
      items.sort((a, b) => (b.holiday - a.holiday) || a.t - b.t);
      const label = k === todayKey ? T('Azi') : k === tomorrow ? T('Mâine') : dayName(k);
      const sub = (k === todayKey || k === tomorrow) ? '<span>' + esc(dayName(k)) + '</span>' : '';
      html += '<section class="cal-day' + (k === todayKey ? ' is-today' : '') + (k < todayKey ? ' is-past' : '') + '" aria-label="' + esc(label + (sub ? ', ' + dayName(k) : '')) + '">' +
        '<h3 class="cal-day-head">' + label + sub + '</h3>';
      html += items.length ? items.map(e => rowHtml(e, st.get(e), firstNext && e.t === firstNext.t && !e.holiday)).join('')
        : '<p class="cal-day-empty">' + T('Nu mai urmează știri azi pentru filtrele alese.') + '</p>';
      html += '</section>';
    }
    if (!state.ccy.size) html += '<p class="cal-empty">' + T('<b>Nicio valută selectată.</b> Alege cel puțin o valută de mai sus.') + '</p>';
    else if (!upcoming.length) {
      const weekEnded = events.every(e => statusOf(e, now, todayKey) === 'past');
      html += '<div class="cal-empty"><b>' + (weekEnded ? T('Săptămâna s-a încheiat.') : state.today ? T('Nu mai sunt știri azi pentru filtrele alese.') : T('Nu mai urmează știri săptămâna asta pentru filtrele alese.')) + '</b>' +
        '<p>' + (weekEnded ? T('Calendarul săptămânii viitoare apare automat duminică.') : T('Poți alege mai multe valute sau „Toate” la impact.')) + '</p></div>';
    }
    list.innerHTML = html;
    lastSig = sigOf(now, todayKey);
  }
  const sigOf = (now, todayKey) => events.map(e => statusOf(e, now, todayKey)[0]).join('');

  function tick() {
    if (!events.length) return;
    const now = Date.now(), todayKey = localKey(new Date(now));
    if (todayKey !== lastToday || sigOf(now, todayKey) !== lastSig) { render(); return; }
    list.querySelectorAll('.cal-cd[data-t]').forEach(el => { const txt = cdText({ t: +el.dataset.t }, now); if (el.textContent !== txt) el.textContent = txt; });
    const hc = $('cal-hero-cd');
    if (hc) hc.innerHTML = heroCd(+hc.dataset.t - now);
  }

  function load() {
    const ctrl = 'AbortController' in window ? new AbortController() : null;
    const to = setTimeout(() => ctrl && ctrl.abort(), 12000);
    return fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(doc => {
        clearTimeout(to);
        if (!doc || !Array.isArray(doc.events)) throw new Error('format invalid');
        const up = new Date(doc.updated);
        if (isNaN(up) || Date.now() - up.getTime() > STALE_MS) {
          events = []; updated = isNaN(up) ? null : up;
          return showFallback('<strong>' + (updated ? T('Datele calendarului nu au mai fost actualizate din {d}.', { d: esc(cap(fmtDay.format(updated))) }) : T('Datele calendarului nu au mai fost actualizate.')) + '</strong> ' + T('Ca să nu vezi ore vechi, le-am ascuns. Până se rezolvă, verifică știrile direct pe unul dintre calendarele de mai jos.'));
        }
        events = prepare(doc.events); updated = up;
        app.classList.remove('is-failed');
        app.classList.add('is-ready'); app.setAttribute('aria-busy', 'false');
        meta.innerHTML = '<span><span class="dot"></span>' + T('Ora ta:') + ' <b>' + esc(tzLabel()) + '</b></span><span>' + T('Ultima actualizare:') + ' <b>' + esc(cap(fmtDay.format(up)) + ', ' + fmtTime.format(up)) + '</b></span>';
        render();
      })
      .catch(err => { clearTimeout(to); if (!events.length) showFallback(); console.warn('Calendar: datele nu s-au putut încărca', err && err.message); });
  }

  syncControls();
  load().then(() => {
    // derulează lista la următoarea știre dacă vizitatorul a deschis știrile trecute anterior sau vine cu #urmatoarea
    if (location.hash === '#urmatoarea') { const n = list.querySelector('.is-next'); if (n) n.scrollIntoView({ block: 'center' }); }
  });
  setInterval(tick, 1000);
  setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
})();
