# 404.html în stilul site-ului. GitHub Pages îl servește pentru orice adresă inexistentă din /marius-fx/,
# inclusiv căi adânci, așa că toate linkurile și resursele sunt absolute (/marius-fx/...).
import re
ROOT = '/workspace/forex-ms'; BASE = '/marius-fx/'
src = open(f'{ROOT}/contact.html', encoding='utf-8').read()
s = src
# head: fără canonical / og:url / JSON-LD, cu noindex
s = re.sub(r'  <link rel="canonical"[^>]*>\n', '', s)
s = re.sub(r'  <meta property="og:url"[^>]*>\n', '', s)
s = re.sub(r'  <script type="application/ld\+json">.*?</script>\n', '', s, flags=re.S)
s = re.sub(r'<title>.*?</title>', '<title>Pagina nu a fost găsită (404) | MS Prime</title>', s)
D = 'Pagina căutată nu există pe MS Prime. Mergi la pagina principală, la cursul Forex gratuit pentru începători sau la instrumentele site-ului.'
s = re.sub(r'(<meta name="description" content=")[^"]*', r'\g<1>' + D, s)
s = re.sub(r'(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*', r'\g<1>Pagina nu a fost găsită | MS Prime', s)
s = re.sub(r'(<meta (?:property="og:description"|name="twitter:description") content=")[^"]*', r'\g<1>' + D, s)
s = s.replace('  <meta name="viewport"', '  <meta name="robots" content="noindex">\n  <meta name="viewport"', 1)
s = s.replace('<a href="contact.html" aria-current="page">Contact</a>', '<a href="contact.html">Contact</a>')

def feat(href, icon, title, text):
    return f'''          <li>
            <a class="feature-card" href="{href}">
              <span class="feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{icon}</svg></span>
              <h2 class="nf-card-title">{title} <span class="feature-arrow" aria-hidden="true">→</span></h2>
              <p>{text}</p>
            </a>
          </li>'''
IC = {
  'lectie': '<path d="M2 8.5L12 4l10 4.5L12 13z"/><path d="M6 10.6V15c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.4"/><path d="M22 8.5V14"/>',
  'calculator': '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7.5h7"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
  'sesiuni': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  'calendar': '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
}
MAIN = f'''  <main id="continut">
    <section class="section container nf" aria-labelledby="nf-title">
      <header class="section-head">
        <p class="kicker">Eroare 404</p>
        <h1 id="nf-title">Pagina nu a fost găsită</h1>
        <p class="section-sub">Linkul este greșit sau pagina a fost mutată. Nicio problemă: de aici ajungi ușor oriunde pe site.</p>
      </header>
      <div class="nf-actions">
        <a class="btn btn-primary" href="index.html">Mergi la pagina principală</a>
        <a class="btn btn-ghost" href="lectie.html">Începe cursul gratuit</a>
      </div>
      <ul class="features nf-links">
{feat('lectie.html', IC['lectie'], 'Începători', 'Cursul Forex gratuit, pas cu pas, în 8 capitole.')}
{feat('calculator.html', IC['calculator'], 'Calculator', 'Află mărimea poziției în funcție de riscul ales.')}
{feat('sesiuni.html', IC['sesiuni'], 'Sesiuni', 'Ce piețe sunt deschise acum, în ora ta.')}
{feat('calendar.html', IC['calendar'], 'Calendar', 'Știrile economice importante ale săptămânii.')}
      </ul>
    </section>
  </main>
'''
a = s.index('  <main id="continut">'); b = s.index('  </main>\n') + len('  </main>\n')
s = s[:a] + MAIN + s[b:]
# căi relative -> absolute (/marius-fx/...)
def absol(m):
    attr, q, url = m.group(1), m.group(2), m.group(3)
    if re.match(r'^(https?:|mailto:|tel:|#|/|data:)', url): return m.group(0)
    if url == 'index.html': url = ''
    return f'{attr}={q}{BASE}{url}{q}'
s = re.sub(r'\b(href|src)=(["\'])([^"\']*)\2', absol, s)
assert 'href="styles.css' not in s and '/marius-fx/script.js' in s
open(f'{ROOT}/404.html', 'w', encoding='utf-8').write(s)
print('written 404.html', len(s))
