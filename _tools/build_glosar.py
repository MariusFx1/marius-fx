# Generează glosar.html din contact.html + glosar_terms.py (ordine alfabetică românească, A-Z, căutare). Idempotent.
import re, sys, html, unicodedata
sys.path.insert(0, '/workspace/forex-ms-tools')
from glosar_terms import TERMS
ROOT = '/workspace/forex-ms'
ALPHA = 'aăâbcdefghiîjklmnopqrsștțuvwxyz'
def ro_key(s):
    return [(ALPHA.index(c) + 1) if c in ALPHA else (0 if c in ' -(' else 100 + ord(c)) for c in s.lower()]
def fold(s):
    s = s.replace('ş', 'ș').replace('ţ', 'ț')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()
def plain(h): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', h))).strip()
terms = sorted(TERMS, key=lambda t: ro_key(t[1]))
groups = {}
for t in terms: groups.setdefault(fold(t[1][0]).upper(), []).append(t)
src = open(f'{ROOT}/contact.html', encoding='utf-8').read().replace('<a href="contact.html" aria-current="page">Contact</a>', '<a href="contact.html">Contact</a>')
s = src.replace('https://mariusfx1.github.io/marius-fx/contact.html', 'https://mariusfx1.github.io/marius-fx/glosar.html')
s = re.sub(r'  <script type="application/ld\+json">.*?</script>\n', '', s, flags=re.S)
az = '\n'.join((f'          <a href="#litera-{L.lower()}" data-l="{L}">{L}</a>' if L in groups else f'          <span class="is-off" aria-hidden="true">{L}</span>') for L in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')
blocks = []
for L, ts in groups.items():
    items = '\n'.join(f'''            <div class="gl-term" id="t-{tid}" data-s="{html.escape(fold(name + ' ' + plain(d)), quote=True)}">
              <dt>{name}</dt>
              <dd>{d}</dd>
            </div>''' for tid, name, d in ts)
    blocks.append(f'''        <section class="gl-group" id="litera-{L.lower()}" aria-labelledby="gl-h-{L.lower()}">
          <h2 class="gl-letter" id="gl-h-{L.lower()}">{L}</h2>
          <dl class="gl-terms">
{items}
          </dl>
        </section>''')
N = len(terms)
MAIN = f'''  <main id="continut">
    <!-- ===== GLOSAR ===== -->
    <section class="section container gl-page" aria-labelledby="gl-title">
      <header class="section-head">
        <p class="kicker">Dicționar pentru începători</p>
        <h1 id="gl-title">Glosar Forex: termeni explicați simplu</h1>
        <p class="section-sub">{N} de termeni pe care îi întâlnești la început, explicați pe scurt, cu linkuri spre <a href="lectie.html">cursul pentru începători</a> și instrumentele de pe site.</p>
      </header>
      <div class="gl-tools" id="gl-tools" hidden>
        <label class="gl-search" for="gl-q">
          <span class="sr-only">Caută în glosar</span>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>
          <input type="search" id="gl-q" placeholder="Caută un termen, de exemplu „marjă”" autocomplete="off" spellcheck="false" aria-describedby="gl-count">
        </label>
        <p class="gl-count" id="gl-count" aria-live="polite">{N} de termeni</p>
      </div>
      <nav class="gl-az" aria-label="Sari la litera">
{az}
      </nav>
      <div class="gl-list" id="gl-list">
{chr(10).join(blocks)}
        <p class="gl-empty" id="gl-empty" hidden>Niciun termen găsit. Încearcă alt cuvânt sau uită-te în <a href="intrebari.html">întrebările frecvente</a>.</p>
      </div>
      <p class="gl-foot">Lipsește un termen sau o explicație nu e clară? <a href="contact.html">Scrie-mi</a>. Glosarul este educațional, nu consultanță financiară.</p>
    </section>
  </main>
'''
a = s.index('  <main id="continut">'); b = s.index('  </main>\n') + len('  </main>\n')
s = s[:a] + MAIN + s[b:]
s = s.replace('  <script src="script.js?v=35" defer></script>\n', '  <script src="script.js?v=35" defer></script>\n  <script src="glosar.js?v=1" defer></script>\n')
open(f'{ROOT}/glosar.html', 'w', encoding='utf-8').write(s)
print('ok glosar.html', N, 'terms;', ' '.join(f'{k}:{len(v)}' for k, v in groups.items()))
