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
        <a href="index.html" class="logo"><span class="logo-mark" aria-hidden="true"><picture><source srcset="images/logo-bull.webp?v=1" type="image/webp"><img src="images/logo-bull.png?v=1" width="49" height="40" alt="" decoding="async"></picture></span>MS <b>Prime</b></a>
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
          <li><a class="footer-tg" href="https://t.me/+sbQPdX_yA1E5NmM0" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="{TG_PATH}"/></svg>Telegram (gratuit)</a></li>
          <li><a class="footer-x" href="https://x.com/MSPrime1fx" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>X · @MSPrime1fx</a></li>
          <li><a class="footer-vip" href="https://t.me/+sbQPdX_yA1E5NmM0" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>VIP Discord (privat)</a></li>
          <li><a class="footer-discord" href="https://discord.gg/5ugrydraNF" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>Discord · Semnale (grup privat)</a></li>
          <li><a href="mailto:contact.mariusfx@gmail.com">contact.mariusfx@gmail.com</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
    </div>
    <div class="container footer-legal">
      <p class="footer-risk" id="avertisment">{RISK}</p>
      <div class="footer-bottom">
        <p>© <span id="an"></span> MS Prime · Marius</p>
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
    <section class="home-stats" aria-label="MS Prime pe scurt">
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
    d = html.escape(desc.replace('MS Prime — ', 'MS Prime: ').replace(' — ', ': '), quote=True)
    img = SITE + 'og-image.png'
    return f'''  <link rel="canonical" href="{url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="MS Prime">
  <meta property="og:locale" content="ro_RO">
  <meta property="og:title" content="{t}">
  <meta property="og:description" content="{d}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{img}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="MS Prime: Educație · Disciplină · Managementul riscului">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@MSPrime1fx">
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
