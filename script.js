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
  EURUSD: 1.08, GBPUSD: 1.27, AUDUSD: 0.66, NZDUSD: 0.60,
  USDJPY: 150, USDCAD: 1.36, USDCHF: 0.88,
  EURGBP: 0.84, EURJPY: 162, EURCHF: 0.94, EURAUD: 1.64, EURCAD: 1.47, EURNZD: 1.80,
  GBPJPY: 190, GBPCHF: 1.12, GBPAUD: 1.94, GBPCAD: 1.75, GBPNZD: 2.14,
  AUDJPY: 98, AUDNZD: 1.10, AUDCAD: 0.90, AUDCHF: 0.57,
  NZDJPY: 89, NZDCAD: 0.82, NZDCHF: 0.52,
  CADJPY: 110, CADCHF: 0.64, CHFJPY: 173,
  XAUUSD: 2650, XAGUSD: 31
};
const USDJPY_PRESUPUS = 150;
const EURUSD_PRESUPUS = 1.08;
const GBPUSD_PRESUPUS = 1.27;
const AUDUSD_PRESUPUS = 0.66;
const NZDUSD_PRESUPUS = 0.60;
const USDCAD_PRESUPUS = 1.36;
const USDCHF_PRESUPUS = 0.88;
const QUOTE_USD = new Set(['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD']);
const USD_BASE = new Set(['USDCAD', 'USDCHF']);
const JPY_CROSS = new Set(['EURJPY', 'GBPJPY', 'AUDJPY', 'NZDJPY', 'CADJPY', 'CHFJPY']);
const QUOTE_GBP = new Set(['EURGBP']);
const QUOTE_CHF = new Set(['EURCHF', 'GBPCHF', 'AUDCHF', 'NZDCHF', 'CADCHF']);
const QUOTE_AUD = new Set(['EURAUD', 'GBPAUD']);
const QUOTE_CAD = new Set(['EURCAD', 'GBPCAD', 'AUDCAD', 'NZDCAD']);
const QUOTE_NZD = new Set(['EURNZD', 'GBPNZD', 'AUDNZD']);

function curs(cod, pereche, pret, implicit) {
  return (pereche === cod && pret > 0) ? pret : implicit;
}

function pipUsdPeLot(pereche, pret) {
  const p = pret > 0 ? pret : PRET_IMPLICIT[pereche];
  if (QUOTE_USD.has(pereche)) return 10;
  if (pereche === 'XAUUSD') return 10; // 100 oz × 0,10
  if (pereche === 'XAGUSD') return 50; // 5000 oz × 0,01
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

function calculeaza() {
  const pereche = $('pereche').value;
  const moneda = $('moneda').value;
  const sold = Math.max(0, parseFloat($('sold').value) || 0);
  const risc = Math.min(100, Math.max(0, parseFloat($('risc').value) || 0));
  const stop = Math.max(0, parseFloat($('stop').value) || 0);
  const pret = parseFloat($('pret').value);
  const pipUsd = pipUsdPeLot(pereche, pret);
  const eurusd = (pereche === 'EURUSD' && pret > 0) ? pret : EURUSD_PRESUPUS;
  const gbpusd = (pereche === 'GBPUSD' && pret > 0) ? pret : GBPUSD_PRESUPUS;
  let pipCont = pipUsd;
  let cursNota = '';
  if (moneda === 'EUR') {
    pipCont = pipUsd / eurusd;
    cursNota = ` Conversie EUR cu EURUSD ≈ ${eurusd.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}.`;
  } else if (moneda === 'GBP') {
    pipCont = pipUsd / gbpusd;
    cursNota = ` Conversie GBP cu GBPUSD ≈ ${gbpusd.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} (ipoteză ~1,27, sau prețul perechii GBPUSD).`;
  }
  const suma = sold * (risc / 100);
  const loturi = (stop > 0 && pipCont > 0) ? suma / (stop * pipCont) : NaN;
  const fmt = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: moneda, maximumFractionDigits: 2 });
  $('suma-risc').textContent = fmt.format(suma);
  $('loturi').textContent = Number.isFinite(loturi) ? loturi.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
  const pipTxt = pipCont.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $('pip-nota').textContent =
    `Valoare pip folosită: circa ${pipTxt} ${moneda} per lot standard, per pip.${cursNota} Este o estimare — confirmă valoarea pipului pe platforma brokerului. Nu indică profitul posibil.`;
}

if ($('calc-form')) {
  $('pereche').addEventListener('change', () => {
    const p = PRET_IMPLICIT[$('pereche').value];
    if (p) $('pret').value = String(p);
    calculeaza();
  });
  ['sold', 'risc', 'stop', 'pret', 'moneda'].forEach(id => $(id).addEventListener('input', calculeaza));
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

// ===== Cotații live (OHLC zilnic, biquote) =====
const PAIR_TILES = document.querySelectorAll('.pair-tile[data-symbol]');
const PAIR_DIGITS = { EURUSD: 5, GBPUSD: 5, USDJPY: 3, XAUUSD: 2 };

function formatPairPrice(symbol, value) {
  const digits = PAIR_DIGITS[symbol] ?? 5;
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function drawCandles(canvas, bars) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth || 160;
  const height = canvas.clientHeight || 88;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (!bars.length) return;

  const padT = 4, padB = 4, padX = 2;
  const plotH = height - padT - padB;
  const plotW = width - padX * 2;
  let lo = Infinity, hi = -Infinity;
  bars.forEach(b => {
    lo = Math.min(lo, b.low);
    hi = Math.max(hi, b.high);
  });
  if (!(hi > lo)) { hi = lo + 1; }
  const span = hi - lo;
  const y = p => padT + (hi - p) / span * plotH;

  ctx.strokeStyle = 'rgba(154, 167, 189, 0.16)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const gy = Math.round(padT + plotH * i / 4) + 0.5;
    ctx.beginPath();
    ctx.moveTo(padX, gy);
    ctx.lineTo(width - padX, gy);
    ctx.stroke();
  }

  const slot = plotW / bars.length;
  const bodyW = Math.max(2, Math.min(7, slot * 0.62));
  bars.forEach((b, i) => {
    const up = b.close >= b.open;
    const color = up ? '#26a69a' : '#ef5350';
    const cx = padX + slot * (i + 0.5);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, y(b.high));
    ctx.lineTo(cx, y(b.low));
    ctx.stroke();
    const top = y(Math.max(b.open, b.close));
    const bot = y(Math.min(b.open, b.close));
    const bh = Math.max(1, bot - top);
    ctx.fillRect(cx - bodyW / 2, top, bodyW, bh);
  });
}

async function loadPairTile(tile) {
  const symbol = tile.dataset.symbol;
  const priceEl = tile.querySelector('.pair-price');
  const canvas = tile.querySelector('.pair-chart');
  try {
    const res = await fetch(`https://biquote.io/api/${symbol}/ohlc?interval=1d&limit=40`);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const bars = (data.bars || []).slice().reverse().filter(b =>
      Number.isFinite(b.open) && Number.isFinite(b.high) && Number.isFinite(b.low) && Number.isFinite(b.close)
    );
    if (!bars.length) throw new Error('empty');
    const last = bars[bars.length - 1];
    priceEl.textContent = formatPairPrice(symbol, last.close);
    priceEl.classList.toggle('up', last.close >= last.open);
    priceEl.classList.toggle('down', last.close < last.open);
    canvas._bars = bars;
    drawCandles(canvas, bars);
  } catch (err) {
    priceEl.textContent = '—';
    priceEl.classList.remove('up', 'down');
    if (canvas) drawCandles(canvas, []);
  }
}

function refreshPairTiles() {
  PAIR_TILES.forEach(loadPairTile);
}
if (PAIR_TILES.length) {
  refreshPairTiles();
  setInterval(refreshPairTiles, 60000);
  window.addEventListener('resize', () => {
    PAIR_TILES.forEach(tile => {
      const canvas = tile.querySelector('.pair-chart');
      if (canvas && canvas._bars) drawCandles(canvas, canvas._bars);
    });
  });
}
