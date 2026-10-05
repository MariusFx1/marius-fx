// ===== SETĂRI =====
const EMAIL_CONTACT = 'contact.mariusfx@gmail.com';               // adresa pentru formularul de contact
const GALERIE_EXTENSII = ['jpg', 'jpeg', 'png', 'webp'];  // extensii căutate în images/etapa-N.*

const anEl = document.getElementById('an');
if (anEl) anEl.textContent = new Date().getFullYear();

// ===== Meniu mobil =====
const menuBtn = document.querySelector('.menu-toggle');
const links = document.getElementById('nav-links');
menuBtn.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', open);
});
links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  links.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false');
}));

// ===== Jurnalul contului: încarcă automat images/etapa-N.(jpg|png|…) dacă există =====
document.querySelectorAll('.slot').forEach(slot => {
  const n = slot.dataset.etapa;
  const box = slot.querySelector('.slot-img');
  if (!box || box.classList.contains('has-img') || box.querySelector('img')) return; // deja completat în HTML
  const tryExt = i => {
    if (i >= GALERIE_EXTENSII.length) return;          // nu există imagine — rămâne caseta goală
    const img = new Image();
    img.alt = 'Captură reală a contului — etapa ' + n;
    img.onload = () => {
      box.replaceChildren(img); box.classList.add('has-img');
      const a = document.createElement('a'); a.href = img.src; a.target = '_blank'; a.rel = 'noopener';
      a.setAttribute('aria-label', 'Deschide captura etapei ' + n + ' la dimensiune completă');
      box.parentNode.insertBefore(a, box); a.appendChild(box);
    };
    img.onerror = () => tryExt(i + 1);
    img.src = `images/etapa-${n}.${GALERIE_EXTENSII[i]}`;
  };
  tryExt(0);
});

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
