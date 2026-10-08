// ===== SETĂRI =====
const EMAIL_CONTACT = 'contact.mariusfx@gmail.com';               // adresa pentru formularul de contact

const anEl = document.getElementById('an');
if (anEl) anEl.textContent = new Date().getFullYear();

// ===== Meniu mobil =====
const menuBtn = document.querySelector('.menu-toggle');
const links = document.getElementById('nav-links');
function setMenu(open) {
  if (!menuBtn || !links) return;
  links.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Închide meniul' : 'Deschide meniul');
  document.documentElement.classList.toggle('menu-open', open);
}
if (menuBtn && links) {
  menuBtn.addEventListener('click', () => setMenu(!links.classList.contains('open')));
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && links.classList.contains('open')) { setMenu(false); menuBtn.focus(); }
  });
  const desktopMq = window.matchMedia('(min-width: 1081px)');
  const onMq = () => { if (desktopMq.matches) setMenu(false); };
  if (desktopMq.addEventListener) desktopMq.addEventListener('change', onMq); else if (desktopMq.addListener) desktopMq.addListener(onMq);
}

// ===== Antet: fundal mai opac după scroll =====
(function () {
  const header = document.querySelector('.site-header');
  if (!header) return;
  let ticking = false;
  const update = () => { header.classList.toggle('is-scrolled', window.scrollY > 8); ticking = false; };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();

// ===== Animații la scroll + numărătoare (respectă prefers-reduced-motion; fără JS totul rămâne vizibil) =====
(function () {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;

  const SEL = '.section-head, .rule, .pattern, .session-card, .sessions-status, .sessions-timeline, .sessions-edu, .feature-card, .stat-item, .broker-card, .about, .contact-grid > *, .jt-card, .jt-download > *, .footer-grid > *';
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add('is-revealed');
      io.unobserve(el);
      // după animație, scoatem clasele ca hover-ul cardurilor să-și păstreze tranzițiile proprii
      setTimeout(() => { el.classList.remove('reveal', 'is-revealed'); el.style.removeProperty('--reveal-delay'); }, 1300);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });

  document.querySelectorAll(SEL).forEach(el => {
    if (el.closest('.hero, .lc-article, .lc-hero')) return;
    if (el.getBoundingClientRect().top < vh * 0.92) return;   // deja în ecran: nu îl ascundem deloc
    const sibs = Array.prototype.indexOf.call(el.parentElement.children, el);
    el.style.setProperty('--reveal-delay', (sibs % 6) * 70 + 'ms');
    el.classList.add('reveal');
    io.observe(el);
  });

  // numărătoare pe statisticile de pe home (valoarea finală e deja în HTML)
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;
  const run = el => {
    const target = parseInt(el.dataset.count, 10);
    if (!target) return;
    const t0 = performance.now(), dur = 1300;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = '0';
    requestAnimationFrame(step);
  };
  const co = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { run(e.target); co.unobserve(e.target); }
  }), { threshold: 0.6 });
  counters.forEach(el => co.observe(el));
})();

// ===== Galerie foto: click pentru mărire =====
const lb = document.getElementById('lightbox');
if (lb && typeof lb.showModal === 'function') {
  const lbImg = lb.querySelector('img');
  document.querySelectorAll('[data-lightbox]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const img = a.querySelector('img');
    lbImg.src = a.href; lbImg.alt = img.alt;
    lb.showModal();
  }));
  lb.querySelector('.lightbox-close').addEventListener('click', () => lb.close());
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });   // click în afara imaginii
}

// ===== Calculator mărime poziție (estimare, fără promisiuni de profit) =====
const $ = id => document.getElementById(id);

const PRET_IMPLICIT = {
  EURUSD: 1.12, GBPUSD: 1.32, AUDUSD: 0.69, NZDUSD: 0.56,
  USDJPY: 158, USDCAD: 1.42, USDCHF: 0.83,
  EURGBP: 0.85, EURJPY: 177, EURCHF: 0.93, EURAUD: 1.62, EURCAD: 1.60, EURNZD: 2.00,
  GBPJPY: 209, GBPCHF: 1.10, GBPAUD: 1.90, GBPCAD: 1.89, GBPNZD: 2.36,
  AUDJPY: 110, AUDNZD: 1.24, AUDCAD: 0.99, AUDCHF: 0.58,
  NZDJPY: 89, NZDCAD: 0.80, NZDCHF: 0.47,
  CADJPY: 111, CADCHF: 0.58, CHFJPY: 190,
  XAUUSD: 4150, XAGUSD: 61
};
const USDJPY_PRESUPUS = 158;
const EURUSD_PRESUPUS = 1.12;
const GBPUSD_PRESUPUS = 1.32;
const AUDUSD_PRESUPUS = 0.69;
const NZDUSD_PRESUPUS = 0.56;
const USDCAD_PRESUPUS = 1.42;
const USDCHF_PRESUPUS = 0.83;
const QUOTE_USD = new Set(['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD']);
const USD_BASE = new Set(['USDCAD', 'USDCHF']);
const JPY_CROSS = new Set(['EURJPY', 'GBPJPY', 'AUDJPY', 'NZDJPY', 'CADJPY', 'CHFJPY']);
const QUOTE_GBP = new Set(['EURGBP']);
const QUOTE_CHF = new Set(['EURCHF', 'GBPCHF', 'AUDCHF', 'NZDCHF', 'CADCHF']);
const QUOTE_AUD = new Set(['EURAUD', 'GBPAUD']);
const QUOTE_CAD = new Set(['EURCAD', 'GBPCAD', 'AUDCAD', 'NZDCAD']);
const QUOTE_NZD = new Set(['EURNZD', 'GBPNZD', 'AUDNZD']);

/** Parsează numere cu punct SAU virgulă (utilizatori RO: 1,5 / 10.000). */
function parseNum(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/\s/g, '').replace(/^\+/, '');
  if (!s) return NaN;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    if (/^[\d.]+,\d{1,2}$/.test(s) || (/^[\d]+,\d{1,2}$/.test(s))) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasDot) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function curs(cod, pereche, pret, implicit) {
  return (pereche === cod && pret > 0) ? pret : implicit;
}

function pipUsdPeLot(pereche, pret) {
  const p = pret > 0 ? pret : PRET_IMPLICIT[pereche];
  if (QUOTE_USD.has(pereche)) return 10;
  // XAUUSD: 1 lot = 100 oz, pip = 0,10 → 10 USD / pip
  if (pereche === 'XAUUSD') return 10;
  // XAGUSD: 1 lot = 5000 oz, pip = 0,01 → 50 USD / pip
  if (pereche === 'XAGUSD') return 50;
  if (pereche === 'USDJPY') return 1000 / p;
  if (USD_BASE.has(pereche)) return 10 / p;
  if (JPY_CROSS.has(pereche)) return 1000 / curs('USDJPY', pereche, pret, USDJPY_PRESUPUS);
  if (QUOTE_GBP.has(pereche)) return 10 * curs('GBPUSD', pereche, pret, GBPUSD_PRESUPUS);
  if (QUOTE_CHF.has(pereche)) return 10 / curs('USDCHF', pereche, pret, USDCHF_PRESUPUS);
  if (QUOTE_AUD.has(pereche)) return 10 * curs('AUDUSD', pereche, pret, AUDUSD_PRESUPUS);
  if (QUOTE_CAD.has(pereche)) return 10 / curs('USDCAD', pereche, pret, USDCAD_PRESUPUS);
  if (QUOTE_NZD.has(pereche)) return 10 * curs('NZDUSD', pereche, pret, NZDUSD_PRESUPUS);
  return 10;
}

function conventiePip(pereche) {
  if (pereche === 'XAUUSD') return ' Convenție XAUUSD: 1 lot = 100 oz, 1 pip = 0,10 (10 USD/pip).';
  if (pereche === 'XAGUSD') return ' Convenție XAGUSD: 1 lot = 5000 oz, 1 pip = 0,01 (50 USD/pip).';
  if (pereche === 'USDJPY' || JPY_CROSS.has(pereche)) return ' Pentru perechile JPY, 1 pip = 0,01.';
  return '';
}

function calculeaza() {
  const perecheEl = $('pereche');
  const monedaEl = $('moneda');
  const soldEl = $('sold');
  const riscEl = $('risc');
  const stopEl = $('stop');
  const pretEl = $('pret');
  const sumaEl = $('suma-risc');
  const loturiEl = $('loturi');
  const notaEl = $('pip-nota');
  if (!perecheEl || !sumaEl || !loturiEl) return;

  const pereche = perecheEl.value;
  const moneda = monedaEl.value;
  const soldRaw = (soldEl.value || '').trim();
  const riscRaw = (riscEl.value || '').trim();
  const stopRaw = (stopEl.value || '').trim();
  const pretRaw = (pretEl.value || '').trim();

  const sold = Math.max(0, parseNum(soldRaw) || 0);
  const risc = Math.min(100, Math.max(0, parseNum(riscRaw) || 0));
  const stop = Math.max(0, parseNum(stopRaw) || 0);
  const pret = parseNum(pretRaw);

  const emptyRequired = !soldRaw || !riscRaw || !stopRaw;
  if (emptyRequired) {
    sumaEl.textContent = '—';
    loturiEl.textContent = '—';
    notaEl.textContent = 'Completează soldul, riscul % și stop loss-ul în pips.';
    return;
  }

  const pipUsd = pipUsdPeLot(pereche, pret);
  const eurusd = (pereche === 'EURUSD' && pret > 0) ? pret : EURUSD_PRESUPUS;
  const gbpusd = (pereche === 'GBPUSD' && pret > 0) ? pret : GBPUSD_PRESUPUS;
  let pipCont = pipUsd;
  let cursNota = '';
  // USD → monedă cont: împărțim la cursul XXXUSD (nu înmulțim)
  if (moneda === 'EUR') {
    pipCont = pipUsd / eurusd;
    cursNota = ` Conversie EUR cu EURUSD ≈ ${eurusd.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}.`;
  } else if (moneda === 'GBP') {
    pipCont = pipUsd / gbpusd;
    cursNota = ` Conversie GBP cu GBPUSD ≈ ${gbpusd.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}.`;
  }

  const sumaTinta = sold * (risc / 100);
  const loturiExact = (stop > 0 && pipCont > 0) ? sumaTinta / (stop * pipCont) : NaN;
  // Rotunjire ÎN JOS la 0,01 lot — riscul efectiv nu depășește ținta
  const loturi = Number.isFinite(loturiExact) ? Math.floor(loturiExact * 100 + 1e-9) / 100 : NaN;
  const riscEfectiv = Number.isFinite(loturi) ? loturi * stop * pipCont : NaN;

  const fmt = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: moneda, maximumFractionDigits: 2 });
  sumaEl.textContent = fmt.format(sumaTinta);
  loturiEl.textContent = Number.isFinite(loturi) ? loturi.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

  const pipTxt = pipCont.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let efectivNota = '';
  if (Number.isFinite(riscEfectiv) && Number.isFinite(loturi) && Math.abs(riscEfectiv - sumaTinta) > 0.005) {
    efectivNota = ` Risc efectiv la ${loturi.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} loturi: ${fmt.format(riscEfectiv)}.`;
  }
  notaEl.textContent =
    `Valoare pip folosită: circa ${pipTxt} ${moneda} per lot standard, per pip.` +
    conventiePip(pereche) + cursNota + efectivNota +
    ' Este o estimare — confirmă valoarea pipului pe platforma brokerului. Nu indică profitul posibil.';
}

if ($('calc-form')) {
  $('pereche').addEventListener('change', () => {
    const p = PRET_IMPLICIT[$('pereche').value];
    if (p != null) $('pret').value = String(p);
    calculeaza();
  });
  ['sold', 'risc', 'stop', 'pret'].forEach(id => {
    const el = $(id);
    el.addEventListener('input', calculeaza);
    el.addEventListener('change', calculeaza);
  });
  $('moneda').addEventListener('input', calculeaza);
  $('moneda').addEventListener('change', calculeaza);
  $('calc-form').addEventListener('submit', e => e.preventDefault());
  calculeaza();
}

// ===== Formular contact -> mailto (fără server) =====
const contactForm = $('contact-form');
if (contactForm) contactForm.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const subject = encodeURIComponent('Marius FX — mesaj de la ' + f.nume.value.trim());
  const body = encodeURIComponent(
    'Nume: ' + f.nume.value.trim() + '\n' +
    'E-mail: ' + f.email.value.trim() + '\n\n' +
    'Mesaj:\n' + f.mesaj.value.trim()
  );
  window.location.href = `mailto:${EMAIL_CONTACT}?subject=${subject}&body=${body}`;
});

// ===== Sesiuni forex (live, ora vizitatorului + DST pe fusuri reale) =====
(function () {
  const SESSIONS = [
    { id: 'sydney', name: 'Sydney', tz: 'Australia/Sydney', openH: 7, closeH: 16, pairs: 'AUD, NZD' },
    { id: 'tokyo', name: 'Tokyo', tz: 'Asia/Tokyo', openH: 9, closeH: 18, pairs: 'JPY, Asia' },
    { id: 'london', name: 'Londra', tz: 'Europe/London', openH: 8, closeH: 17, pairs: 'EUR, GBP' },
    { id: 'newyork', name: 'New York', tz: 'America/New_York', openH: 8, closeH: 17, pairs: 'USD, aur' }
  ];
  const NY_TZ = 'America/New_York';
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  function partsInZone(date, timeZone) {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    });
    const map = {};
    for (const p of dtf.formatToParts(date)) {
      if (p.type !== 'literal') map[p.type] = p.value;
    }
    return {
      weekday: map.weekday,
      year: +map.year,
      month: +map.month,
      day: +map.day,
      hour: +map.hour % 24,
      minute: +map.minute,
      second: +map.second
    };
  }

  // UTC Date for a civil time in a given IANA zone (handles DST)
  function zonedTimeToUtc(timeZone, y, m, d, h, min, s) {
    s = s || 0;
    let utc = Date.UTC(y, m - 1, d, h, min, s);
    for (let i = 0; i < 4; i++) {
      const p = partsInZone(new Date(utc), timeZone);
      const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
      const want = Date.UTC(y, m - 1, d, h, min, s);
      const delta = want - asUtc;
      if (delta === 0) break;
      utc += delta;
    }
    return new Date(utc);
  }

  function addDays(y, m, d, delta) {
    const t = new Date(Date.UTC(y, m - 1, d + delta));
    return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
  }

  function isWeekendClosed(now) {
    const ny = partsInZone(now, NY_TZ);
    const mins = ny.hour * 60 + ny.minute + ny.second / 60;
    const close = 17 * 60;
    if (ny.weekday === 'Sat') return true;
    if (ny.weekday === 'Fri' && mins >= close) return true;
    if (ny.weekday === 'Sun' && mins < close) return true;
    return false;
  }

  function nextSundayNyOpen(now) {
    const ny = partsInZone(now, NY_TZ);
    let add = (7 - WD[ny.weekday]) % 7;
    if (ny.weekday === 'Sun') {
      const mins = ny.hour * 60 + ny.minute;
      if (mins < 17 * 60) add = 0;
      else add = 7;
    } else if (ny.weekday === 'Fri') {
      const mins = ny.hour * 60 + ny.minute;
      if (mins >= 17 * 60) add = 2; // Sunday
    } else if (ny.weekday === 'Sat') {
      add = 1;
    }
    const d = addDays(ny.year, ny.month, ny.day, add);
    return zonedTimeToUtc(NY_TZ, d.year, d.month, d.day, 17, 0, 0);
  }

  function sessionOpenCloseToday(now, session) {
    const p = partsInZone(now, session.tz);
    const open = zonedTimeToUtc(session.tz, p.year, p.month, p.day, session.openH, 0, 0);
    const close = zonedTimeToUtc(session.tz, p.year, p.month, p.day, session.closeH, 0, 0);
    return { open, close, parts: p };
  }

  function effectiveSessionOpen(open, close) {
    // If session starts during NY weekend close, it becomes active at market reopen (if still within window)
    if (!isWeekendClosed(open)) return open;
    const reopen = nextSundayNyOpen(open);
    if (reopen >= close) return null; // entirely inside weekend
    return reopen;
  }

  function nextSessionBoundary(now, session) {
    const p0 = partsInZone(now, session.tz);
    for (let i = 0; i < 10; i++) {
      const d = addDays(p0.year, p0.month, p0.day, i);
      const open = zonedTimeToUtc(session.tz, d.year, d.month, d.day, session.openH, 0, 0);
      const close = zonedTimeToUtc(session.tz, d.year, d.month, d.day, session.closeH, 0, 0);
      const effOpen = effectiveSessionOpen(open, close);
      if (!effOpen) continue;
      if (now < effOpen) return { at: effOpen, kind: 'open' };
      if (now >= effOpen && now < close && !isWeekendClosed(now)) {
        return { at: close, kind: 'close' };
      }
    }
    return { at: nextSundayNyOpen(now), kind: 'open' };
  }

  function isSessionOpenNow(now, session) {
    if (isWeekendClosed(now)) return false;
    const { open, close } = sessionOpenCloseToday(now, session);
    const effOpen = effectiveSessionOpen(open, close);
    if (!effOpen) return false;
    return now >= effOpen && now < close;
  }

  function formatDuration(ms) {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h >= 24) {
      const d = Math.floor(h / 24);
      const rh = h % 24;
      return d + 'z ' + rh + 'h ' + m + 'm';
    }
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return s > 0 ? (m + 'm ' + s + 's') : (m + 'm');
    return s + 's';
  }

  function formatLocalTime(date, opts) {
    return new Intl.DateTimeFormat('ro-RO', opts).format(date);
  }

  function visitorDayBounds(now) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end, ms: end - start };
  }

  // Session bars overlapping visitor's local calendar day (handles DST day length).
  // Bars show the nominal local schedule; open-state / weekend gating is separate.
  function sessionBarsForVisitorDay(now, session) {
    const { start, end, ms } = visitorDayBounds(now);
    const dayMs = ms || 86400000;
    const bars = [];
    // Check session days that might overlap visitor day (±1 day around now in session tz)
    const p = partsInZone(now, session.tz);
    for (let i = -1; i <= 1; i++) {
      const d = addDays(p.year, p.month, p.day, i);
      const open = zonedTimeToUtc(session.tz, d.year, d.month, d.day, session.openH, 0, 0);
      const close = zonedTimeToUtc(session.tz, d.year, d.month, d.day, session.closeH, 0, 0);
      const segStart = Math.max(open.getTime(), start.getTime());
      const segEnd = Math.min(close.getTime(), end.getTime());
      if (segEnd > segStart) {
        bars.push({
          left: ((segStart - start.getTime()) / dayMs) * 100,
          width: ((segEnd - segStart) / dayMs) * 100,
          startMs: segStart,
          endMs: segEnd
        });
      }
    }
    return bars;
  }

  function openSessions(now) {
    return SESSIONS.filter(s => isSessionOpenNow(now, s));
  }

  function overlapLabels(open) {
    const ids = new Set(open.map(s => s.id));
    const labels = [];
    if (ids.has('london') && ids.has('newyork')) {
      labels.push({ text: 'Suprapunere Londra–New York: volatilitate mare', hot: true });
    }
    if (ids.has('tokyo') && ids.has('london')) {
      labels.push({ text: 'Suprapunere Tokyo–Londra', hot: false });
    }
    if (ids.has('sydney') && ids.has('tokyo')) {
      labels.push({ text: 'Suprapunere Sydney–Tokyo', hot: false });
    }
    return labels;
  }

  // Expose for home badge + tests
  window.MariusSessions = {
    SESSIONS,
    isWeekendClosed,
    isSessionOpenNow,
    openSessions,
    nextSundayNyOpen,
    nextSessionBoundary,
    partsInZone,
    formatDuration,
    zonedTimeToUtc
  };

  function renderHomeChip(now) {
    const chip = document.getElementById('hero-session-chip');
    if (!chip) return;
    const weekend = isWeekendClosed(now);
    const open = openSessions(now);
    chip.classList.toggle('is-weekend', weekend);
    chip.classList.toggle('is-closed', !weekend && open.length === 0);
    const text = chip.querySelector('.chip-text');
    if (weekend) {
      text.textContent = 'Piața: weekend închis';
    } else if (open.length === 0) {
      text.textContent = 'Nicio sesiune deschisă acum';
    } else if (open.length === 1) {
      text.textContent = 'Sesiunea acum: ' + open[0].name;
    } else {
      text.textContent = 'Sesiuni acum: ' + open.map(s => s.name).join(' · ');
    }
  }

  const root = document.getElementById('sessions-live');
  if (!root && !document.getElementById('hero-session-chip')) {
    // nothing to do on this page
    return;
  }

  // Build static card shells + timeline lanes once
  if (root) {
    const cards = document.getElementById('session-cards');
    const lanes = document.getElementById('tl-lanes');
    const hours = document.getElementById('tl-hours');
    const legend = document.getElementById('tl-legend');
    hours.innerHTML = '';
    for (let h = 0; h < 24; h += 2) {
      const s = document.createElement('span');
      s.textContent = String(h).padStart(2, '0');
      hours.appendChild(s);
    }
    legend.innerHTML = SESSIONS.map(s =>
      '<span><i style="background:var(--sess-' + (s.id === 'newyork' ? 'ny' : s.id === 'london' ? 'london' : s.id) + ')"></i>' + s.name + '</span>'
    ).join('');
    // fix london css var name
    legend.innerHTML = [
      '<span><i style="background:var(--sess-sydney)"></i>Sydney</span>',
      '<span><i style="background:var(--sess-tokyo)"></i>Tokyo</span>',
      '<span><i style="background:var(--sess-london)"></i>Londra</span>',
      '<span><i style="background:var(--sess-ny)"></i>New York</span>'
    ].join('');

    lanes.innerHTML = '';
    cards.innerHTML = '';
    SESSIONS.forEach(s => {
      const lane = document.createElement('div');
      lane.className = 'tl-lane';
      lane.dataset.id = s.id;
      lane.innerHTML = '<span class="tl-lane-label">' + s.name + '</span>';
      lanes.appendChild(lane);

      const card = document.createElement('article');
      card.className = 'session-card';
      card.dataset.id = s.id;
      card.innerHTML =
        '<div class="session-card-top"><h3>' + s.name + '</h3><span class="session-pill" data-pill>…</span></div>' +
        '<p class="session-hours" data-hours></p>' +
        '<p class="session-local-clock">Ora locală acolo: <b data-local-clock>—</b></p>' +
        '<p class="session-countdown" data-countdown>—</p>';
      cards.appendChild(card);
    });
  }

  function tick(forcedNow) {
    const now = forcedNow || new Date();
    renderHomeChip(now);
    if (!root) return;

    const weekend = isWeekendClosed(now);
    const open = openSessions(now);

    const clock = document.getElementById('visitor-clock');
    const dateEl = document.getElementById('visitor-date');
    const badge = document.getElementById('open-badge');
    const badgeText = document.getElementById('open-badge-text');
    const weekendBanner = document.getElementById('weekend-banner');
    const weekendCd = document.getElementById('weekend-countdown');
    const overlap = document.getElementById('overlap-banner');
    const timeline = document.getElementById('sessions-timeline');
    const nowLine = document.getElementById('tl-now');

    clock.textContent = formatLocalTime(now, { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    clock.dateTime = now.toISOString();
    dateEl.textContent = formatLocalTime(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    badge.classList.toggle('is-weekend', weekend);
    badge.classList.toggle('is-closed', !weekend && open.length === 0);
    if (weekend) {
      badgeText.textContent = 'Piața e închisă (weekend)';
    } else if (open.length === 0) {
      badgeText.textContent = 'Nicio sesiune deschisă acum';
    } else {
      badgeText.textContent = 'Deschis acum: ' + open.map(s => s.name).join(' · ');
    }

    weekendBanner.hidden = !weekend;
    if (weekend) {
      const reopen = nextSundayNyOpen(now);
      const localReopen = formatLocalTime(reopen, { weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      weekendCd.textContent = 'Se redeschide duminică 17:00 New York — la tine: ' + localReopen +
        ' (în ' + formatDuration(reopen - now) + ').';
    }

    const labels = weekend ? [] : overlapLabels(open);
    if (labels.length) {
      overlap.hidden = false;
      overlap.innerHTML = labels.map(l => '<span class="' + (l.hot ? 'hot' : '') + '">' + l.text + '</span>').join('');
    } else {
      overlap.hidden = true;
      overlap.innerHTML = '';
    }

    timeline.classList.toggle('is-weekend', weekend);

    // Now line position (use real local day length — 23/25h on DST days)
    const { start, ms: dayMs } = visitorDayBounds(now);
    const pct = ((now - start) / (dayMs || 86400000)) * 100;
    nowLine.style.left = Math.min(100, Math.max(0, pct)) + '%';

    SESSIONS.forEach(s => {
      const lane = root.querySelector('.tl-lane[data-id="' + s.id + '"]');
      const card = root.querySelector('.session-card[data-id="' + s.id + '"]');
      const isOpen = isSessionOpenNow(now, s);
      // bars
      lane.querySelectorAll('.tl-bar').forEach(b => b.remove());
      sessionBarsForVisitorDay(now, s).forEach(bar => {
        const el = document.createElement('div');
        const barLit = isOpen && now.getTime() >= bar.startMs && now.getTime() < bar.endMs;
        el.className = 'tl-bar ' + s.id + (barLit ? ' is-open' : '');
        el.style.left = bar.left + '%';
        el.style.width = bar.width + '%';
        lane.appendChild(el);
      });

      card.classList.toggle('is-open', isOpen && !weekend);
      const pill = card.querySelector('[data-pill]');
      const hoursEl = card.querySelector('[data-hours]');
      const localClock = card.querySelector('[data-local-clock]');
      const cd = card.querySelector('[data-countdown]');

      pill.textContent = weekend ? 'Weekend' : (isOpen ? 'Deschis' : 'Închis');
      const { open: o, close: c } = sessionOpenCloseToday(now, s);
      const openLocal = formatLocalTime(o, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      const closeLocal = formatLocalTime(c, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      hoursEl.innerHTML = 'Local acolo: <strong>' +
        String(s.openH).padStart(2, '0') + ':00–' + String(s.closeH).padStart(2, '0') + ':00</strong><br>' +
        'La tine: <strong>' + openLocal + '–' + closeLocal + '</strong>';

      const lp = partsInZone(now, s.tz);
      localClock.textContent =
        String(lp.hour).padStart(2, '0') + ':' +
        String(lp.minute).padStart(2, '0') + ':' +
        String(lp.second).padStart(2, '0');

      if (weekend) {
        const target = nextSessionBoundary(now, s);
        cd.textContent = 'se deschide în ' + formatDuration(target.at - now);
      } else if (isOpen) {
        const bound = nextSessionBoundary(now, s);
        cd.textContent = 'se închide în ' + formatDuration(bound.at - now);
      } else {
        const bound = nextSessionBoundary(now, s);
        cd.textContent = 'se deschide în ' + formatDuration(bound.at - now);
      }
    });
  }

  // Allow tests to force a time
  window.MariusSessions.tick = tick;

  tick();
  setInterval(() => tick(), 1000);
})();
