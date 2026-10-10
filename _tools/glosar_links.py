# Linkuri spre glosar: subsol (coloana Învață, toate paginile în afară de patternuri.html, care nu se modifică),
# lectie.html (cuprins + final), intrebari.html (caseta laterală), home (card). Idempotent.
import glob
ROOT = '/workspace/forex-ms'
SKIP = {'patternuri.html', '404.html'}
G = '          <li><a href="glosar.html">Glosar</a></li>\n'
for path in sorted(glob.glob(f'{ROOT}/*.html')):
    name = path.rsplit('/', 1)[1]
    if name in SKIP: continue
    s = open(path, encoding='utf-8').read()
    f = s.index('<footer class="site-footer">')
    head, foot = s[:f], s[f:]
    if 'href="glosar.html">Glosar<' not in foot:
        k = '          <li><a href="test.html">Test</a></li>\n'; assert foot.count(k) == 1, name
        foot = foot.replace(k, k + G)
    s2 = head + foot
    if name == 'lectie.html':
        k = '<p class="lc-toc-foot">'
        if 'lc-toc-gloss' not in s2:
            i = s2.index(k); j = s2.index('</p>', i) + 4
            s2 = s2[:j] + '\n            <p class="lc-toc-gloss">Un termen nu e clar? Vezi <a href="glosar.html">glosarul Forex</a>.</p>' + s2[j:]
        k2 = '        <aside class="lc-quiz-cta"'
        if 'lc-gloss-note' not in s2:
            assert s2.count(k2) == 1
            s2 = s2.replace(k2, '        <p class="lc-gloss-note">Ai dat peste un termen pe care nu-l știi? Îl găsești explicat simplu în <a href="glosar.html">glosarul Forex</a>.</p>\n\n' + k2)
    if name == 'intrebari.html' and 'href="glosar.html">glosarul' not in s2:
        old = 'apoi verifică-te cu <a href="test.html">testul de 15 întrebări</a>.</p>'
        assert s2.count(old) == 1
        s2 = s2.replace(old, 'apoi verifică-te cu <a href="test.html">testul de 15 întrebări</a>. Termenii noi îi găsești în <a href="glosar.html">glosarul Forex</a>.</p>')
    if name == 'index.html' and 'class="feature-card" href="glosar.html"' not in s2:
        card = '''          <li>
            <a class="feature-card" href="glosar.html">
              <span class="feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 8h6M9 11.5h4"/></svg></span>
              <h3>Glosar <span class="feature-arrow" aria-hidden="true">→</span></h3>
              <p>60 de termeni Forex explicați simplu, de la pip și marjă până la FOMO.</p>
            </a>
          </li>
'''
        k = '            <a class="feature-card" href="intrebari.html">'
        i = s2.rindex('          <li>\n', 0, s2.index(k))
        s2 = s2[:i] + card + s2[i:]
        assert 'content="O7g1XoiifBLTrr8a1nMvz4BTCeQoflJg5ez10yfZFzg"' in s2
    if s2 != s: open(path, 'w', encoding='utf-8').write(s2); print('ok', name)
