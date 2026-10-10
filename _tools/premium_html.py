# Aplică stratul "premium" pe toate paginile: meta OG/Twitter, footer nou, scripturi defer, versiuni, secțiuni home.
import re, glob, html, os
ROOT = '/workspace/forex-ms'
SITE = 'https://mariusfx1.github.io/marius-fx/'
CSS_V, JS_V = '35', '32'
TG_PATH = 'M21.94 4.3c.27-1.2-.47-1.67-1.25-1.38L2.9 9.78c-1.2.47-1.18 1.15-.21 1.45l4.56 1.42 1.75 5.4c.22.6.11.84.75.84.49 0 .71-.23.98-.5l2.2-2.14 4.58 3.38c.84.47 1.45.23 1.66-.78l3.01-14.17-.24-.38zM8.44 12.36l9.53-6.01c.48-.29.92-.13.56.19l-8.16 7.36-.32 3.43-1.61-4.97z'
RISK = 'Forex și CFD-urile cu levier pot duce la pierderea rapidă a banilor. Conținut educațional, nu consultanță financiară.'

FOOTER = f'''  <!-- ===== SUBSOL + AVERTISMENT DE RISC ===== -->
  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a href="index.html" class="logo"><span class="logo-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M3 17l5-5 4 3 8-9"/><path d="M15 6h5v5"/></svg></span>Marius <b>FX</b></a>
        <p>Educație pentru swing trading disciplinat: reguli clare, managementul riscului și un proces pe care îl poți repeta.</p>
      </div>
      <nav class="footer-col" aria-label="Învață">
        <h2 class="footer-title">Învață</h2>
        <ul>
          <li><a href="lectie.html">Începători</a></li>
          <li><a href="reguli.html">Reguli</a></li>
          <li><a href="patternuri.html">Patternuri</a></li>
          <li><a href="despre.html">Despre</a></li>
        </ul>
      </nav>
      <nav class="footer-col" aria-label="Instrumente">
        <h2 class="footer-title">Instrumente</h2>
        <ul>
          <li><a href="calculator.html">Calculator</a></li>
          <li><a href="sesiuni.html">Sesiuni</a></li>
          <li><a href="jurnal.html">Jurnal</a></li>
          <li><a href="broker.html">Broker</a></li>
        </ul>
      </nav>
      <div class="footer-col footer-col-community">
        <h2 class="footer-title">Comunitate</h2>
        <ul>
          <li><a class="footer-tg" href="https://t.me/FreeMariusFx" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="{TG_PATH}"/></svg>Telegram (gratuit)</a></li>
          <li><a href="mailto:contact.mariusfx@gmail.com">contact.mariusfx@gmail.com</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
    </div>
    <div class="container footer-legal">
      <p class="footer-risk" id="avertisment">{RISK}</p>
      <div class="footer-bottom">
        <p>© <span id="an"></span> Marius FX · Marius</p>
        <a href="#continut">Înapoi sus ↑</a>
      </div>
    </div>
  </footer>
'''

ICONS = {
  'lectie': '<path d="M2 8.5L12 4l10 4.5L12 13z"/><path d="M6 10.6V15c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.4"/><path d="M22 8.5V14"/>',
  'reguli': '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  'patternuri': '<path d="M3 18l3.5-6 3 3.5L12 6l2.5 9.5 3-3.5L21 18"/><path d="M3 21h18"/>',
  'sesiuni': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  'jurnal': '<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z"/><path d="M6 3v18"/><path d="M10 8h5M10 12h5M10 16h3"/>',
  'calculator': '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7.5h7"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
}
FEATURES = [
  ('lectie', 'Începători', 'Curs gratuit în 8 capitole, pas cu pas: de la pip și lot până la primul tău plan de trading.'),
  ('reguli', 'Reguli', 'Zece principii simple care separă tradingul disciplinat de jocul de noroc.'),
  ('patternuri', 'Patternuri', 'Cinci forme de grafic des întâlnite, explicate pe scurt, cu desene schematice.'),
  ('sesiuni', 'Sesiuni', 'Vezi live ce sesiuni sunt deschise acum, în ora ta locală.'),
  ('jurnal', 'Jurnal', 'Notează-ți tranzacțiile direct în browser și urmărește dacă îți respecți planul.'),
  ('calculator', 'Calculator', 'Află câte loturi corespund riscului ales și stop loss-ului tău.'),
]
def feature(k, t, d):
    return f'''          <li>
            <a class="feature-card" href="{k}.html">
              <span class="feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{ICONS[k]}</svg></span>
              <h3>{t} <span class="feature-arrow" aria-hidden="true">→</span></h3>
              <p>{d}</p>
            </a>
          </li>'''
HOME_SECTIONS = '''
    <!-- ===== CIFRE (doar fapte reale) ===== -->
    <section class="home-stats" aria-label="Marius FX pe scurt">
      <div class="container">
        <ul class="stats">
          <li class="stat-item"><span class="stat-num"><span data-count="6">6</span>+</span><span class="stat-label">ani de experiență în swing trading</span></li>
          <li class="stat-item"><span class="stat-num" data-count="8">8</span><span class="stat-label">capitole gratuite pentru începători</span></li>
          <li class="stat-item"><span class="stat-num" data-count="4">4</span><span class="stat-label">instrumente gratuite: calculator, sesiuni, jurnal, patternuri</span></li>
          <li class="stat-item"><span class="stat-num">0</span><span class="stat-label">semnale, doar educație și disciplină</span></li>
        </ul>
      </div>
    </section>

    <!-- ===== CE GĂSEȘTI PE SITE ===== -->
    <section class="section home-features" aria-labelledby="features-title">
      <div class="container">
        <header class="section-head">
          <p class="kicker">Ce găsești aici</p>
          <h2 id="features-title">Totul pentru un început disciplinat</h2>
          <p class="section-sub">Lecții și instrumente gratuite, ca să înveți un proces, nu să urmezi semnale.</p>
        </header>
        <ul class="features">
''' + '\n'.join(feature(*f) for f in FEATURES) + '''
        </ul>
      </div>
    </section>
'''

def meta_block(name, title, desc):
    url = SITE if name == 'index' else SITE + name + '.html'
    t = html.escape(title.replace(' — ', ' · '), quote=True)
    d = html.escape(desc.replace('Marius FX — ', 'Marius FX: ').replace(' — ', ': '), quote=True)
    img = SITE + 'og-image.png'
    return f'''  <link rel="canonical" href="{url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Marius FX">
  <meta property="og:locale" content="ro_RO">
  <meta property="og:title" content="{t}">
  <meta property="og:description" content="{d}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{img}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Marius FX: Educație · Disciplină · Managementul riscului">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{t}">
  <meta name="twitter:description" content="{d}">
  <meta name="twitter:image" content="{img}">
'''

for path in sorted(glob.glob(ROOT + '/*.html')):
    name = os.path.basename(path)[:-5]
    s = open(path, encoding='utf-8').read()
    if 'og:image' in s:
        print('skip (already applied)', name); continue
    title = html.unescape(re.search(r'<title>(.*?)</title>', s).group(1))
    m = re.search(r'  <meta name="description" content="([^"]*)">\n', s)
    s = s[:m.end()] + meta_block(name, title, html.unescape(m.group(1))) + s[m.end():]
    if name == 'index':
        s = s.replace('  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n',
                      '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
                      '  <link rel="preconnect" href="https://s3.tradingview.com">\n'
                      '  <link rel="preconnect" href="https://www.tradingview-widget.com">\n', 1)
        assert s.count('<div class="hero-bg" aria-hidden="true"></div>') == 1
        s = s.replace('<div class="hero-bg" aria-hidden="true"></div>', '<div class="hero-bg" aria-hidden="true"></div>\n      <div class="hero-glow" aria-hidden="true"></div>')
        assert s.count('    </section>\n  </main>') == 1
        s = s.replace('    </section>\n  </main>', '    </section>\n' + HOME_SECTIONS + '  </main>')
    # footer
    fm = re.search(r'(  <!-- ===== SUBSOL \+ AVERTISMENT DE RISC ===== -->\n)?\s*<footer class="site-footer">.*?</footer>\n', s, re.S)
    assert fm, name
    s = s[:fm.start()] + ('\n' if not s[:fm.start()].endswith('\n\n') else '') + FOOTER + s[fm.end():]
    # versions + defer
    assert 'styles.css?v=34' in s
    s = s.replace('styles.css?v=34', 'styles.css?v=' + CSS_V)
    s = s.replace('<script src="script.js?v=31"></script>', f'<script src="script.js?v={JS_V}" defer></script>')
    s = s.replace('<script src="lectie.js?v=2"></script>', '<script src="lectie.js?v=2" defer></script>')
    s = s.replace('<script src="jurnal.js?v=32"></script>', '<script src="jurnal.js?v=32" defer></script>')
    assert f'script.js?v={JS_V}" defer' in s, name
    if name == 'patternuri':
        imgs = list(re.finditer(r'<img src="images/pattern-[^"]+" width="720" height="592"', s))
        for i, im in reversed(list(enumerate(imgs))):
            extra = ' decoding="async"' if i == 0 else ' loading="lazy" decoding="async"'
            s = s[:im.end()] + extra + s[im.end():]
    open(path, 'w', encoding='utf-8').write(s)
    print('ok', name)
