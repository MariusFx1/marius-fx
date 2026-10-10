# CTA „Verifică-ți cunoștințele” la finalul lecției, carduri noi pe home (Test, Întrebări), link spre FAQ pe Contact. Idempotent.
ROOT = '/workspace/forex-ms'
def edit(name, fn):
    p = f'{ROOT}/{name}'; s = open(p, encoding='utf-8').read(); t = fn(s)
    open(p, 'w', encoding='utf-8').write(t); print('ok' if t != s else 'unchanged', name)

CTA = '''        <aside class="lc-quiz-cta" aria-labelledby="lc-quiz-title">
          <span class="lc-quiz-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3h6v1"/><path d="M8.5 13l2.5 2.5 4.5-5"/></svg></span>
          <div class="lc-quiz-copy">
            <p class="lc-quiz-kicker">Ai terminat cursul?</p>
            <h2 id="lc-quiz-title">Verifică-ți cunoștințele</h2>
            <p>15 întrebări din cele 8 capitole, cu explicație după fiecare răspuns și linkuri spre capitolele de recitit.</p>
          </div>
          <a class="btn btn-primary lc-quiz-btn" href="test.html">Începe testul <span aria-hidden="true">→</span></a>
        </aside>

'''
def lectie(s):
    if 'class="lc-quiz-cta"' in s: return s
    k = '        <p class="lc-disclaimer">'; assert s.count(k) == 1
    return s.replace(k, CTA + k)

def card(href, icon, title, text):
    return f'''          <li>
            <a class="feature-card" href="{href}">
              <span class="feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{icon}</svg></span>
              <h3>{title} <span class="feature-arrow" aria-hidden="true">→</span></h3>
              <p>{text}</p>
            </a>
          </li>
'''
TEST_CARD = card('test.html', '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3h6v1"/><path d="M8.5 13l2.5 2.5 4.5-5"/>', 'Test',
                 '15 întrebări din curs, cu explicație după fiecare răspuns. Vezi ce ai înțeles și ce merită recitit.')
FAQ_CARD = card('intrebari.html', '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.8"/><path d="M12 17h.01"/>', 'Întrebări frecvente',
                'Cu câți bani începi, cont demo, broker, taxe în România: răspunsuri sincere, fără promisiuni de câștig.')
def index(s):
    if 'class="feature-card" href="test.html"' not in s:
        a = s.index('            <a class="feature-card" href="lectie.html">'); b = s.index('          </li>\n', a) + len('          </li>\n')
        s = s[:b] + TEST_CARD + s[b:]
    if 'class="feature-card" href="intrebari.html"' not in s:
        a = s.index('            <a class="feature-card" href="calculator.html">'); b = s.index('          </li>\n', a) + len('          </li>\n')
        s = s[:b] + FAQ_CARD + s[b:]
    assert 'content="O7g1XoiifBLTrr8a1nMvz4BTCeQoflJg5ez10yfZFzg"' in s
    return s

def contact(s):
    if 'href="intrebari.html">Întrebări frecvente</a>:' in s: return s
    k = '          <p>Ai întrebări despre materialele educaționale? Scrie-mi.</p>\n'; assert s.count(k) == 1
    return s.replace(k, k + '          <p class="contact-faq">Poate găsești răspunsul mai repede în <a href="intrebari.html">Întrebări frecvente</a>: bani de început, cont demo, broker, taxe.</p>\n')

edit('lectie.html', lectie); edit('index.html', index); edit('contact.html', contact)
