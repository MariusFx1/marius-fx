// ===== Calendar economic (calendar.html) =====
// Datele vin din data/calendar.json, actualizat automat de GitHub Actions din feed-ul ForexFactory.
// Orele din feed au offset ISO (ora New York), așa că new Date() le convertește corect în ora vizitatorului, inclusiv la schimbarea orei.
(function () {
  'use strict';
  const app = document.getElementById('cal-app');
  if (!app) return;

  const DATA_URL = 'data/calendar.json';
  const STALE_MS = 72 * 3600e3;      // peste 3 zile fără actualizare: afișăm mesajul de rezervă
  const NOW_WINDOW_MS = 5 * 60e3;    // „ACUM” încă 5 minute după publicare
  const REFRESH_MS = 30 * 60e3;      // reîncărcăm datele la 30 de minute cât timp pagina e deschisă
  const STORE_KEY = 'mfx-cal-filters-v1';

  const CCY = [
    ['USD', 'us', 'SUA', 'America/New_York'], ['EUR', 'eu', 'zona euro', 'Europe/Berlin'], ['GBP', 'gb', 'Marea Britanie', 'Europe/London'],
    ['JPY', 'jp', 'Japonia', 'Asia/Tokyo'], ['CHF', 'ch', 'Elveția', 'Europe/Zurich'], ['CAD', 'ca', 'Canada', 'America/Toronto'],
    ['AUD', 'au', 'Australia', 'Australia/Sydney'], ['NZD', 'nz', 'Noua Zeelandă', 'Pacific/Auckland'], ['CNY', 'cn', 'China', 'Asia/Shanghai'],
    ['ALL', '', 'global', 'UTC'],
  ];
  const CCY_INFO = Object.fromEntries(CCY.map(([c, f, n, tz]) => [c, { flag: f, name: n, tz }]));
  const DEFAULT_CCY = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'ALL'];
  const IMPACT = { High: ['high', 'Mare', 'Impact mare'], Medium: ['med', 'Mediu', 'Impact mediu'], Low: ['low', 'Scăzut', 'Impact scăzut'], Holiday: ['hol', 'Zi liberă', 'Zi liberă bancară'] };

  // ---------- titluri explicate în română ----------
  const PERIOD = { 'm/m': ['lunar', 'lunară', 'lunare'], 'y/y': ['anual', 'anuală', 'anuale'], 'q/q': ['trimestrial', 'trimestrială', 'trimestriale'],
    '3m/y': ['anual, medie pe 3 luni', 'anuală, medie pe 3 luni', 'anuale, medie pe 3 luni'], 'q/y': ['anual', 'anuală', 'anuale'] };
  const G = { m: 0, f: 1, p: 2 };
  const QUAL = [[/^Flash /, 'estimare rapidă'], [/^Prelim /, 'date preliminare'], [/^Final /, 'date finale'], [/^Revised /, 'date revizuite'], [/^Advance /, 'prima estimare']];
  const PREFIX = { German: 'Germania', French: 'Franța', Italian: 'Italia', Spanish: 'Spania' };
  const SECTOR = { Manufacturing: 'industrie', Services: 'servicii', Construction: 'construcții', Composite: 'compozit (industrie + servicii)', 'Non-Manufacturing': 'servicii' };
  const BANK = { EUR: 'BCE', GBP: 'BoE', JPY: 'BoJ', CHF: 'SNB', CAD: 'BoC', AUD: 'RBA', NZD: 'RBNZ', USD: 'Fed', CNY: 'PBoC' };
  const MAP = [
    [/^Non-Farm Employment Change$/, 'NFP: locuri de muncă SUA'],
    [/^ADP Non-Farm Employment Change$/, 'ADP: locuri de muncă în sectorul privat'],
    [/^ADP Weekly Employment Change$/, 'ADP: locuri de muncă, estimare săptămânală'],
    [/^Core CPI$/, 'Inflația de bază (CPI)', 'f'],
    [/^CPI$/, 'Inflația (CPI)', 'f'],
    [/^(Trimmed Mean|Median|Common) CPI$/, 'Inflația de bază (CPI)', 'f'],
    [/^Core PCE Price Index$/, 'Inflația PCE de bază (măsura urmărită de Fed)', 'f'],
    [/^PCE Price Index$/, 'Inflația PCE', 'f'],
    [/^Core PPI$/, 'Prețurile de producție de bază (PPI)', 'p'],
    [/^PPI$/, 'Prețurile de producție (PPI)', 'p'],
    [/^Federal Funds Rate$/, 'Decizia de dobândă Fed'],
    [/^FOMC Statement$/, 'Comunicatul Fed după decizia de dobândă'],
    [/^FOMC Press Conference$/, 'Conferința de presă Fed'],
    [/^FOMC Meeting Minutes$/, 'Minutele ședinței Fed (FOMC)'],
    [/^FOMC Economic Projections$/, 'Proiecțiile economice ale Fed'],
    [/^Main Refinancing Rate$/, 'Decizia de dobândă BCE'],
    [/^ECB Press Conference$/, 'Conferința de presă BCE'],
    [/^ECB Monetary Policy Meeting Accounts$/, 'Minutele ședinței BCE'],
    [/^Official Bank Rate$/, 'Decizia de dobândă BoE'],
    [/^MPC Official Bank Rate Votes$/, 'Cum au votat membrii BoE pentru dobândă'],
    [/^BOE Monetary Policy Report$/, 'Raportul de politică monetară BoE'],
    [/^BOJ Policy Rate$/, 'Decizia de dobândă BoJ'],
    [/^BOJ Press Conference$/, 'Conferința de presă BoJ'],
    [/^BOJ Outlook Report$/, 'Raportul de perspective BoJ'],
    [/^SNB Policy Rate$/, 'Decizia de dobândă SNB'],
    [/^SNB Press Conference$/, 'Conferința de presă SNB'],
    [/^Overnight Rate$/, 'Decizia de dobândă BoC'],
    [/^BOC Rate Statement$/, 'Comunicatul BoC după decizia de dobândă'],
    [/^BOC Press Conference$/, 'Conferința de presă BoC'],
    [/^Cash Rate$/, 'Decizia de dobândă RBA'],
    [/^RBA Rate Statement$/, 'Comunicatul RBA după decizia de dobândă'],
    [/^RBA Press Conference$/, 'Conferința de presă RBA'],
    [/^Official Cash Rate$/, 'Decizia de dobândă RBNZ'],
    [/^RBNZ Rate Statement$/, 'Comunicatul RBNZ după decizia de dobândă'],
    [/^RBNZ Press Conference$/, 'Conferința de presă RBNZ'],
    [/^Monetary Policy Statement$/, c => 'Comunicatul de politică monetară ' + (BANK[c] || '')],
    [/^Fed Chair .+ Speaks$/, 'Discurs: președintele Fed'],
    [/^FOMC Member .+ Speaks$/, 'Discurs: membru Fed (FOMC)'],
    [/^ECB President .+ Speaks$/, 'Discurs: președintele BCE'],
    [/^BOE Gov .+ Speaks$/, 'Discurs: guvernatorul BoE'],
    [/^MPC Member .+ Speaks$/, 'Discurs: membru BoE (MPC)'],
    [/^BOJ Gov .+ Speaks$/, 'Discurs: guvernatorul BoJ'],
    [/^SNB Chairman .+ Speaks$/, 'Discurs: președintele SNB'],
    [/^BOC Gov .+ Speaks$/, 'Discurs: guvernatorul BoC'],
    [/^RBA Gov .+ Speaks$/, 'Discurs: guvernatorul RBA'],
    [/^RBNZ Gov .+ Speaks$/, 'Discurs: guvernatorul RBNZ'],
    [/^Buba President .+ Speaks$/, 'Discurs: președintele Bundesbank'],
    [/^Gov Board Member .+ Speaks$/, c => 'Discurs: membru al conducerii ' + (BANK[c] || 'băncii centrale')],
    [/^President Trump Speaks$/, 'Discurs: președintele SUA'],
    [/^Unemployment Claims$/, 'Cereri de șomaj (săptămânal)'],
    [/^Unemployment Rate$/, 'Rata șomajului', 'f'],
    [/^Employment Change$/, 'Locuri de muncă noi'],
    [/^Claimant Count Change$/, 'Cereri de ajutor de șomaj'],
    [/^Average Hourly Earnings$/, 'Salariul mediu pe oră', 'm'],
    [/^Average Earnings Index$/, 'Câștigurile salariale', 'p'],
    [/^Wage Price Index$/, 'Indicele salariilor', 'm'],
    [/^Employment Cost Index$/, 'Costul forței de muncă', 'm'],
    [/^JOLTS Job Openings$/, 'Locuri de muncă disponibile (JOLTS)'],
    [/^Retail Sales$/, 'Vânzările cu amănuntul', 'p'],
    [/^Core Retail Sales$/, 'Vânzările cu amănuntul fără auto', 'p'],
    [/^GDP$/, 'Creșterea economiei (PIB)', 'f'],
    [/^Trade Balance$/, 'Balanța comercială', 'f'],
    [/^Current Account$/, 'Contul curent', 'm'],
    [/^Industrial Production$/, 'Producția industrială', 'f'],
    [/^Factory Orders$/, 'Comenzile din fabrici', 'p'],
    [/^Core Durable Goods Orders$/, 'Comenzi de bunuri durabile, fără transport', 'p'],
    [/^Durable Goods Orders$/, 'Comenzi de bunuri durabile', 'p'],
    [/^UoM Consumer Sentiment$/, 'Încrederea consumatorilor (Univ. Michigan)', 'f'],
    [/^UoM Inflation Expectations$/, 'Inflația așteptată de consumatori (Univ. Michigan)', 'f'],
    [/^CB Consumer Confidence$/, 'Încrederea consumatorilor (Conference Board)', 'f'],
    [/^Consumer Confidence$/, 'Încrederea consumatorilor', 'f'],
    [/^ZEW Economic Sentiment$/, 'Sentimentul economic ZEW', 'm'],
    [/^Ifo Business Climate$/, 'Climatul de afaceri Ifo', 'm'],
    [/^Sentix Investor Confidence$/, 'Încrederea investitorilor (Sentix)', 'f'],
    [/^Empire State Manufacturing Index$/, 'Industria din statul New York (Empire State)'],
    [/^Philly Fed Manufacturing Index$/, 'Industria din regiunea Philadelphia (Philly Fed)'],
    [/^Existing Home Sales$/, 'Vânzări de case existente', 'p'],
    [/^New Home Sales$/, 'Vânzări de case noi', 'p'],
    [/^Pending Home Sales$/, 'Contracte de vânzare de case', 'p'],
    [/^Building Permits$/, 'Autorizații de construcție', 'p'],
    [/^Housing Starts$/, 'Construcții de locuințe începute', 'p'],
    [/^Crude Oil Inventories$/, 'Stocurile de petrol din SUA', 'p'],
    [/^Natural Gas Storage$/, 'Stocurile de gaze naturale din SUA', 'p'],
    [/^Tankan .+$/, 'Sondajul Tankan al BoJ', 'm'],
    [/^Bank Holiday$/, 'Zi liberă bancară: lichiditate mai mică'],
    [/^OPEC.*Meetings$/, 'Ședințe OPEC (petrol)'],
    [/^\d+-y Bond Auction$/, 'Licitație de obligațiuni de stat'],
  ];

  function roTitle(title, ccy) {
    let t = title, country = '', qual = '', period = '';
    for (const [p, name] of Object.entries(PREFIX)) if (t.startsWith(p + ' ')) { country = name; t = t.slice(p.length + 1); }
    for (const [re, q] of QUAL) if (re.test(t)) { qual = q; t = t.replace(re, ''); }
    if (/ Flash Estimate( |$)/.test(t)) { qual = 'estimare rapidă'; t = t.replace(' Flash Estimate', ''); }
    const pm = t.match(/ (m\/m|y\/y|q\/q|3m\/y|q\/y)$/);
    if (pm) { period = pm[1]; t = t.slice(0, -pm[0].length); }
    let base = null, gender = 'm', note = '';
    const pmi = t.match(/^(ISM |Caixin |Ivey |Chicago )?(?:(Manufacturing|Services|Construction|Composite|Non-Manufacturing) )?PMI$/);
    if (pmi) {
      const who = (pmi[1] || '').trim();
      base = 'Indicele PMI' + (pmi[2] ? ' ' + SECTOR[pmi[2]] : '') + (who ? ' (' + who + ')' : '');
      note = ': peste 50 înseamnă creștere';
    } else {
      for (const [re, txt, g] of MAP) if (re.test(t)) { base = typeof txt === 'function' ? txt(ccy) : txt; gender = g || 'm'; break; }
    }
    if (!base) return '';
    let out = base;
    if (period && PERIOD[period]) out += ' ' + PERIOD[period][G[gender]];
    if (qual) out += ', ' + qual;
    if (country) out += ' (' + country + ')';
    return out + note;
  }

  // ---------- utilitare ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const fmtTime = new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit' });
  const fmtDay = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
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
    if (d >= 1) return 'peste ' + d + 'z ' + h + 'h';
    if (h >= 1) return 'peste ' + h + 'h ' + pad(m) + 'm';
    return 'peste ' + m + 'm ' + pad(sec) + 's';
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
    if (f) return '<img class="' + cls + '" src="images/flags/' + f + '.svg" width="20" height="15" alt="" loading="lazy" decoding="async">';
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

  chips.innerHTML = CCY.map(([c]) => '<button type="button" class="cal-chip" data-ccy="' + c + '" aria-pressed="false">' + flagImg(c, 'cal-flag') + '<span>' + (c === 'ALL' ? 'Global' : c) + '</span></button>').join('') +
    '<button type="button" class="cal-chip cal-chip-all" data-ccy="*">Toate</button>';

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
    fallbackMsg.innerHTML = msg || '<strong>Calendarul nu s-a putut încărca.</strong> Poate fi o problemă de conexiune: reîncarcă pagina peste câteva momente. Între timp, găsești aceleași știri, în ora ta, pe calendarele de mai jos.';
  }

  // ---------- randare ----------
  function rowHtml(e, st, isNext) {
    const nums = [];
    if (e.forecast) nums.push('<div><dt>Prognoză</dt><dd>' + esc(e.forecast) + '</dd></div>');
    if (e.previous) nums.push('<div><dt>Anterior</dt><dd>' + esc(e.previous) + '</dd></div>');
    const sub = [e.ro, ccyName(e.ccy)].filter(Boolean);
    const cls = ['cal-row', 'is-' + (IMPACT[e.impact] || IMPACT.Low)[0], 'st-' + st];
    if (isNext) cls.push('is-next');
    const timeTxt = e.holiday ? 'Toată ziua' : fmtTime.format(e.d);
    const cd = e.holiday ? '<span class="cal-cd cal-cd-hol">bănci închise</span>' : '<span class="cal-cd" data-t="' + e.t + '">' + cdText(e, Date.now()) + '</span>';
    return '<article class="' + cls.join(' ') + '" id="' + e.id + '">' +
      '<div class="cal-row-top">' +
        '<time class="cal-time" datetime="' + esc(e.d.toISOString()) + '">' + timeTxt + '</time>' +
        ccyBadge(e.ccy) + impactBadge(e.impact) +
        cd +
      '</div>' +
      '<div class="cal-row-main">' + (isNext ? '<span class="cal-next-tag">Urmează</span>' : '') + '<h4 class="cal-row-title" lang="en">' + esc(e.title) + '</h4>' +
        '<p class="cal-row-ro">' + esc(sub.join(' · ')) + '</p></div>' +
      (nums.length ? '<dl class="cal-row-nums">' + nums.join('') + '</dl>' : '<div class="cal-row-nums is-empty"></div>') +
    '</article>';
  }
  function cdText(e, now) {
    const diff = e.t - now;
    if (diff > 0) return countdown(diff);
    if (diff > -NOW_WINDOW_MS) return 'ACUM';
    return 'a trecut';
  }

  function heroHtml(now, todayKey) {
    const up = events.filter(e => !e.holiday && state.ccy.has(e.ccy) && statusOf(e, now, todayKey) !== 'past');
    let pick = up.filter(e => e.impact === 'High'), level = 'High';
    if (!pick.length) { pick = up.filter(e => e.impact === 'Medium'); level = 'Medium'; }
    if (!pick.length) {
      return '<p class="cal-hero-kicker"><span class="cal-hero-dot"></span>Următoarea știre importantă</p>' +
        '<div class="cal-hero-empty"><h3>Nu mai sunt știri importante săptămâna asta' + (state.ccy.size < CCY.length ? ' pentru valutele alese' : '') + '.</h3>' +
        '<p>Calendarul săptămânii viitoare apare automat duminică. Până atunci, verifică din nou pozițiile pe care le ții peste weekend.</p></div>';
    }
    const e = pick[0], same = pick.filter(x => x !== e && x.t === e.t), st = statusOf(e, now, todayKey);
    const nums = [];
    if (e.forecast) nums.push('<span><em>Prognoză</em> ' + esc(e.forecast) + '</span>');
    if (e.previous) nums.push('<span><em>Anterior</em> ' + esc(e.previous) + '</span>');
    const dayLbl = e.key === todayKey ? 'Azi' : e.key === addDays(todayKey, 1) ? 'Mâine' : dayName(e.key);
    const inList = visible(e, todayKey);
    return '<p class="cal-hero-kicker"><span class="cal-hero-dot"></span>' + (level === 'High' ? 'Următoarea știre importantă' : 'Următoarea știre (impact mediu)') + '</p>' +
      '<div class="cal-hero-body' + (st === 'now' ? ' is-now' : '') + '">' +
        '<div class="cal-hero-info">' +
          '<div class="cal-hero-tags">' + ccyBadge(e.ccy, true) + '<span class="cal-hero-country">' + esc(ccyName(e.ccy)) + '</span>' + impactBadge(e.impact) + '</div>' +
          '<h3 class="cal-hero-title" lang="en">' + esc(e.title) + '</h3>' +
          (e.ro ? '<p class="cal-hero-ro">' + esc(e.ro) + '</p>' : '') +
          '<p class="cal-hero-when"><b>' + dayLbl + (dayLbl === 'Azi' || dayLbl === 'Mâine' ? ', ' + esc(fmtDay.format(e.d)) : '') + '</b> la <b>' + fmtTime.format(e.d) + '</b> (ora ta)</p>' +
          (nums.length ? '<p class="cal-hero-nums">' + nums.join('') + '</p>' : '') +
          (same.length ? '<p class="cal-hero-also">La aceeași oră: ' + same.map(x => '<span lang="en">' + esc(x.title) + '</span> (' + x.ccy + ')').join(', ') + '</p>' : '') +
        '</div>' +
        '<div class="cal-hero-cd" id="cal-hero-cd" role="timer" data-t="' + e.t + '">' + heroCd(e.t - now) + '</div>' +
      '</div>' +
      (inList ? '<a class="cal-hero-link" href="#' + e.id + '" data-goto="' + e.id + '">Vezi în listă <span aria-hidden="true">↓</span></a>' : '');
  }
  function heroCd(ms) {
    if (ms <= 0) return '<div class="cal-hero-now"><span>ACUM</span><small>știrea tocmai a apărut</small></div>';
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    const box = (v, l) => '<div class="cal-hero-unit"><b>' + v + '</b><span>' + l + '</span></div>';
    return '<span class="cal-sr">' + countdown(ms) + '</span><div class="cal-hero-units" aria-hidden="true">' +
      (d ? box(d, d === 1 ? 'zi' : 'zile') : '') + box(pad(h), h === 1 ? 'oră' : 'ore') + box(pad(m), 'min') + (d ? '' : box(pad(sec), 'sec')) + '</div>';
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
      (state.showPast ? 'Ascunde știrile trecute' : 'Arată știrile trecute din săptămâna asta (' + pastCount + ')') + '</button>';
    const groups = new Map();
    for (const e of shown) { if (!groups.has(e.key)) groups.set(e.key, []); groups.get(e.key).push(e); }
    const keys = events.map(e => e.key).sort(), firstDay = keys[0] || todayKey, lastDay = keys[keys.length - 1] || todayKey;
    // „Azi” rămâne vizibil (cu un mesaj) cât timp suntem în săptămâna din date și mai urmează ceva
    if (!groups.has(todayKey) && todayKey >= firstDay && todayKey <= lastDay && state.ccy.size && upcoming.length) groups.set(todayKey, []);
    const ordered = [...groups.entries()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    for (const [k, items] of ordered) {
      items.sort((a, b) => (b.holiday - a.holiday) || a.t - b.t);
      const label = k === todayKey ? 'Azi' : k === tomorrow ? 'Mâine' : dayName(k);
      const sub = (k === todayKey || k === tomorrow) ? '<span>' + esc(dayName(k)) + '</span>' : '';
      html += '<section class="cal-day' + (k === todayKey ? ' is-today' : '') + (k < todayKey ? ' is-past' : '') + '" aria-label="' + esc(label + (sub ? ', ' + dayName(k) : '')) + '">' +
        '<h3 class="cal-day-head">' + label + sub + '</h3>';
      html += items.length ? items.map(e => rowHtml(e, st.get(e), firstNext && e.t === firstNext.t && !e.holiday)).join('')
        : '<p class="cal-day-empty">Nu mai urmează știri azi pentru filtrele alese.</p>';
      html += '</section>';
    }
    if (!state.ccy.size) html += '<p class="cal-empty"><b>Nicio valută selectată.</b> Alege cel puțin o valută de mai sus.</p>';
    else if (!upcoming.length) {
      const weekEnded = events.every(e => statusOf(e, now, todayKey) === 'past');
      html += '<div class="cal-empty"><b>' + (weekEnded ? 'Săptămâna s-a încheiat.' : state.today ? 'Nu mai sunt știri azi pentru filtrele alese.' : 'Nu mai urmează știri săptămâna asta pentru filtrele alese.') + '</b>' +
        '<p>' + (weekEnded ? 'Calendarul săptămânii viitoare apare automat duminică.' : 'Poți alege mai multe valute sau „Toate” la impact.') + '</p></div>';
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
          return showFallback('<strong>Datele calendarului nu au mai fost actualizate' + (updated ? ' din ' + esc(cap(fmtDay.format(updated))) : '') + '.</strong> Ca să nu vezi ore vechi, le-am ascuns. Până se rezolvă, verifică știrile direct pe unul dintre calendarele de mai jos.');
        }
        events = prepare(doc.events); updated = up;
        app.classList.remove('is-failed');
        app.classList.add('is-ready'); app.setAttribute('aria-busy', 'false');
        meta.innerHTML = '<span><span class="dot"></span>Ora ta: <b>' + esc(tzLabel()) + '</b></span><span>Ultima actualizare: <b>' + esc(cap(fmtDay.format(up)) + ', ' + fmtTime.format(up)) + '</b></span>';
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
