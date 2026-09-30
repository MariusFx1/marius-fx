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

// ===== Calculator de creștere compusă (SIMULARE IPOTETICĂ) =====
const fmt = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const fmtShort = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const $ = id => document.getElementById(id);

function calculeaza() {
  const capital = Math.max(0, parseFloat($('capital').value) || 0);
  const pct = Math.min(100, Math.max(-100, parseFloat($('procent').value) || 0));
  const luni = Math.min(120, Math.max(1, Math.round(parseFloat($('luni').value) || 1)));
  const serie = [capital];
  for (let i = 1; i <= luni; i++) serie.push(serie[i - 1] * (1 + pct / 100));
  const final = serie[luni];
  const dif = final - capital;

  $('rezultat').textContent = fmt.format(final);
  $('rezultat-detalii').textContent =
    `${dif >= 0 ? '+' : '−'}${fmt.format(Math.abs(dif))} față de capitalul inițial, după ${luni} ${luni === 1 ? 'lună' : 'luni'} (ipotetic)`;

  // Tabel
  $('calc-body').innerHTML = serie.slice(1).map((v, i) => {
    const d = v - serie[i];
    return `<tr><td>${i + 1}</td><td>${fmt.format(v)}</td><td class="${d >= 0 ? 'pos' : 'neg'}">${d >= 0 ? '+' : '−'}${fmt.format(Math.abs(d))}</td></tr>`;
  }).join('');

  desenGrafic(serie);
}

function desenGrafic(serie) {
  const box = $('chart');
  const W = Math.max(280, Math.round(box.clientWidth - 24 || 600));
  const H = W < 480 ? 200 : 260, pl = 72, pr = 16, pt = 16, pb = 32;
  const min = Math.min(...serie), max = Math.max(...serie);
  const span = (max - min) || Math.max(1, max * 0.1);
  const lo = min - span * 0.08, hi = max + span * 0.08;
  const x = i => pl + (i / (serie.length - 1)) * (W - pl - pr);
  const y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const pts = serie.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const grid = [0, 0.5, 1].map(t => {
    const v = lo + (hi - lo) * t, yy = y(v).toFixed(1);
    return `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" class="grid"/><text x="${pl - 8}" y="${yy}" class="axis" text-anchor="end" dominant-baseline="middle">${fmtShort.format(v)}</text>`;
  }).join('');
  const n = serie.length - 1;
  const xl = [0, Math.round(n / 2), n].filter((v, i, a) => a.indexOf(v) === i)
    .map(i => `<text x="${x(i)}" y="${H - 8}" class="axis" text-anchor="middle">L${i}</text>`).join('');
  $('chart').innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--green)" stop-opacity=".35"/><stop offset="1" stop-color="var(--green)" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}
      <polygon points="${x(0)},${H - pb} ${pts} ${x(n)},${H - pb}" fill="url(#g)"/>
      <polyline points="${pts}" class="line"/>
      ${xl}
      <text x="${pl + 10}" y="${pt + 12}" class="watermark">SIMULARE IPOTETICĂ</text>
    </svg>`;
}

['capital', 'procent', 'luni'].forEach(id => $(id).addEventListener('input', calculeaza));
$('calc-form').addEventListener('submit', e => e.preventDefault());
calculeaza();
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(calculeaza, 150); });

// ===== Formular contact -> mailto (fără server) =====
$('contact-form').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const subject = encodeURIComponent('Marius FX — mesaj de la ' + f.nume.value);
  const body = encodeURIComponent(f.mesaj.value + '\n\n— ' + f.nume.value + ' (' + f.email.value + ')');
  window.location.href = `mailto:${EMAIL_CONTACT}?subject=${subject}&body=${body}`;
});
