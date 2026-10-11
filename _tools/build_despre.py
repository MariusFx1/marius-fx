# build_despre.py: pagina „Despre MS Prime” (înlocuiește <main> din despre.html + meta). Idempotent.
import re, pathlib
from vip_update import DSVG
ROOT = pathlib.Path('/workspace/forex-ms')
TG = 'https://t.me/+sbQPdX_yA1E5NmM0'; X = 'https://x.com/MSPrime1fx'
TGPATH = 'M21.94 4.3c.27-1.2-.47-1.67-1.25-1.38L2.9 9.78c-1.2.47-1.18 1.15-.21 1.45l4.56 1.42 1.75 5.4c.22.6.11.84.75.84.49 0 .71-.23.98-.5l2.2-2.14 4.58 3.38c.84.47 1.45.23 1.66-.78l3.01-14.17-.24-.38zM8.44 12.36l9.53-6.01c.48-.29.92-.13.56.19l-8.16 7.36-.32 3.43-1.61-4.97z'
XPATH = 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'
TITLE = 'Despre MS Prime: educație Forex gratuită și swing trading'
DESC = 'MS Prime: educație Forex gratuită pentru începători și traderi care își testează strategiile. Disciplină, managementul riscului, instrumente gratuite.'
idx = (ROOT / 'index.html').read_text()
ICONS = dict(re.findall(r'<a class="feature-card" href="([^"]+)">\s*<span class="feature-icon" aria-hidden="true">(<svg.*?</svg>)', idx, re.S))
ICONS['simulator.html'] = '<svg viewBox="0 0 24 24" focusable="false"><path d="M6 4v16M12 7v10M18 5v12"/><rect x="4.5" y="8" width="3" height="6" rx=".6"/><rect x="10.5" y="10" width="3" height="4" rx=".6"/><rect x="16.5" y="7" width="3" height="5" rx=".6"/></svg>'
CARDS = [
 ('lectie.html', 'Lecția pentru începători', 'Curs gratuit în 8 capitole: de la pip și lot până la primul tău plan de trading.'),
 ('test.html', 'Test', '15 întrebări din curs, cu explicație după fiecare răspuns.'),
 ('reguli.html', 'Reguli', 'Zece principii de bază pentru un trading disciplinat.'),
 ('patternuri.html', 'Patternuri', 'Formele de grafic des întâlnite, explicate pe scurt.'),
 ('sesiuni.html', 'Sesiuni live', 'Ce piețe sunt deschise acum, în ora ta locală.'),
 ('calendar.html', 'Calendar economic', 'Știrile importante ale săptămânii și impactul lor.'),
 ('jurnal.html', 'Jurnal de tranzacționare', 'Notează fiecare tranzacție și vezi statisticile tale.'),
 ('calculator.html', 'Calculator de risc și lot', 'Lotul corect după risc și stop loss, plus raportul R:R.'),
 ('simulator.html', 'Simulator de backtesting', 'Testează-ți strategia pe date reale din trecut, cu bani virtuali.'),
 ('glosar.html', 'Glosar', 'Termenii din trading explicați simplu.'),
 ('intrebari.html', 'Întrebări frecvente', 'Răspunsuri sincere: bani de început, cont demo, broker, taxe.'),
]
def card(h, t, d):
    return f'''          <li><a class="feature-card" href="{h}"><span class="feature-icon" aria-hidden="true">{ICONS[h]}</span><h3>{t} <span class="feature-arrow" aria-hidden="true">→</span></h3><p>{d}</p></a></li>'''
VAL = [
 ('<svg viewBox="0 0 24 24" focusable="false"><path d="M2 8.5L12 4l10 4.5L12 13z"/><path d="M6 10.6V15c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.4"/></svg>', 'Educație gratuită', 'Tot ce e pe site e gratuit, fără cont și fără date personale.'),
 ('<svg viewBox="0 0 24 24" focusable="false"><path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/></svg>', 'Sinceritate', 'Vorbesc deschis și despre pierderi, nu doar despre câștiguri.'),
 ('<svg viewBox="0 0 24 24" focusable="false"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>', 'Riscul pe primul loc', 'Înainte de orice câștig, protejezi capitalul.'),
]
MAIN = f'''  <main id="continut">
    <!-- ===== DESPRE MS PRIME ===== -->
    <section class="section container ab-hero" id="despre">
      <div class="ab-brand" aria-hidden="true"><picture><source srcset="images/logo-bull.webp?v=1" type="image/webp"><img src="images/logo-bull.png?v=1" width="98" height="80" alt="" decoding="async"></picture></div>
      <p class="kicker">04 — Despre</p>
      <h1>Despre MS Prime</h1>
      <p class="ab-lead">MS Prime este un loc de educație Forex și swing trading gratuită, pentru începători și pentru traderii care vor să își testeze strategiile.</p>
      <div class="ab-mission">
        <p class="ab-label">Misiunea</p>
        <p>Să te ajut să devii profitabil mai repede, printr-un proces clar: disciplină, managementul riscului și decizii luate după un plan, nu după emoții.</p>
      </div>
    </section>

    <section class="section container ab-section" aria-labelledby="ab-site">
      <p class="kicker">Ce găsești pe site</p>
      <h2 id="ab-site">Tot ce îți trebuie, într-un singur loc</h2>
      <ul class="features ab-features">
{chr(10).join(card(*c) for c in CARDS)}
      </ul>
    </section>

    <section class="section container ab-section" aria-labelledby="ab-founder">
      <div class="ab-founder">
        <span class="ab-founder-mark" aria-hidden="true">M</span>
        <div>
          <p class="kicker">De la fondator</p>
          <h2 id="ab-founder">O notă de la Marius</h2>
          <p>Sunt swing trader de peste șase ani. Am început fără mentor și cu foarte puține cunoștințe, așa că am învățat din greșeli, ani la rând, până am devenit profitabil.</p>
          <p>Am construit MS Prime ca alții să nu mai piardă atâția ani: să aibă de la început structura, regulile și uneltele pe care eu a trebuit să le descopăr singur.</p>
          <p class="ab-sign">— Marius, fondator MS Prime</p>
        </div>
      </div>
    </section>

    <section class="section container ab-section" aria-labelledby="ab-values">
      <p class="kicker">Valori</p>
      <h2 id="ab-values">Ce contează pentru noi</h2>
      <ul class="ab-values">
{chr(10).join(f'        <li><span class="feature-icon" aria-hidden="true">{i}</span><h3>{t}</h3><p>{d}</p></li>' for i, t, d in VAL)}
      </ul>
    </section>

    <section class="section container ab-section" aria-labelledby="ab-community">
      <div class="ab-cta">
        <h2 id="ab-community">Alătură-te comunității</h2>
        <p>Comunitatea MS Prime de pe Telegram este gratuită. Pentru semnale există un grup <span class="vip-gold">VIP</span> privat, cu abonament lunar.</p>
        <div class="ab-cta-links">
          <a class="hero-telegram" href="{TG}" target="_blank" rel="noopener"><span class="hero-telegram-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="{TGPATH}"/></svg></span><span>Comunitatea gratuită pe Telegram</span></a>
          <a class="ab-vip" href="{TG}" target="_blank" rel="noopener"><span class="vip-discord-icon" aria-hidden="true">{DSVG}</span><span>VIP Discord 🔒 · Cere acces</span></a>
          <a class="hero-x" href="{X}" target="_blank" rel="noopener"><span class="hero-x-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="{XPATH}"/></svg></span><span>X · @MSPrime1fx</span></a>
        </div>
        <p class="ab-disclaimer">Conținutul MS Prime este educațional. Semnalele nu sunt sfaturi de investiții. Tradingul cu levier implică riscuri mari și poți pierde bani.</p>
      </div>
    </section>
  </main>'''
p = ROOT / 'despre.html'; s = p.read_text()
s = re.sub(r'  <main id="continut">.*?</main>', lambda m: MAIN, s, count=1, flags=re.S)
OLD_T = 'Despre Marius: swing trader și educație Forex | MS Prime'
OLD_D = 'Cine este Marius: swing trader de peste șase ani, care împărtășește gratuit educație Forex despre disciplină și risc. Educație gratuită + grup VIP privat.'
s = s.replace(OLD_T, TITLE).replace(OLD_D, DESC)
p.write_text(s)
m = pathlib.Path(__file__).with_name('seo_meta.py'); t = m.read_text()
m.write_text(t.replace(f"title='{OLD_T}'", f"title='{TITLE}'").replace(f"desc='{OLD_D}'", f"desc='{DESC}'").replace("h1=('Despre Marius', 'Despre Marius')", "h1=('Despre MS Prime', 'Despre MS Prime')"))
print('despre ok', len(TITLE), len(DESC))
