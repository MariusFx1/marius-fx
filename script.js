// ===== SETĂRI =====
const EMAIL_CONTACT = 'exemplu@email.com';               // adresa pentru formularul de contact
const GALERIE_EXTENSII = ['jpg', 'jpeg', 'png', 'webp'];  // extensii căutate în images/etapa-N.*

document.getElementById('an').textContent = new Date().getFullYear();

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
  EURJPY: 162, GBPJPY: 190, XAUUSD: 2650
};
const USDJPY_PRESUPUS = 150;
const EURUSD_PRESUPUS = 1.08;
const QUOTE_USD = new Set(['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD']);

function pipUsdPeLot(pereche, pret) {
  const p = pret > 0 ? pret : PRET_IMPLICIT[pereche];
  if (QUOTE_USD.has(pereche)) return 10;
  if (pereche === 'USDJPY') return 1000 / p;
  if (pereche === 'USDCAD' || pereche === 'USDCHF') return 10 / p;
  if (pereche === 'EURJPY' || pereche === 'GBPJPY') return 1000 / USDJPY_PRESUPUS;
  if (pereche === 'XAUUSD') return 10; // 100 oz × 0,10
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
  const pipCont = moneda === 'EUR' ? pipUsd / eurusd : pipUsd;
  const suma = sold * (risc / 100);
  const loturi = (stop > 0 && pipCont > 0) ? suma / (stop * pipCont) : NaN;
  const fmt = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: moneda, maximumFractionDigits: 2 });
  $('suma-risc').textContent = fmt.format(suma);
  $('loturi').textContent = Number.isFinite(loturi) ? loturi.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
  const pipTxt = pipCont.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $('pip-nota').textContent =
    `Valoare pip folosită: circa ${pipTxt} ${moneda} per lot standard, per pip. Este o estimare — confirmă valoarea pipului pe platforma brokerului. Nu indică profitul posibil.`;
}

$('pereche').addEventListener('change', () => {
  const p = PRET_IMPLICIT[$('pereche').value];
  if (p) $('pret').value = String(p);
  calculeaza();
});
['sold', 'risc', 'stop', 'pret', 'moneda'].forEach(id => $(id).addEventListener('input', calculeaza));
$('moneda').addEventListener('change', calculeaza);
$('calc-form').addEventListener('submit', e => e.preventDefault());
calculeaza();

// ===== Formular contact -> mailto (fără server) =====
$('contact-form').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const subject = encodeURIComponent('Marius FX — mesaj de la ' + f.nume.value);
  const body = encodeURIComponent(f.mesaj.value + '\n\n— ' + f.nume.value + ' (' + f.email.value + ')');
  window.location.href = `mailto:${EMAIL_CONTACT}?subject=${subject}&body=${body}`;
});
