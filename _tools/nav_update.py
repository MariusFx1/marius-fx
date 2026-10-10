# Adaugă „Test” în meniu (după Începători) și în subsol (Învață), plus „Întrebări frecvente” în subsol (Comunitate). Idempotent.
import re, glob
ROOT = '/workspace/forex-ms'
TEST_LI = '<li><a href="test.html">Test</a></li>'
for path in sorted(glob.glob(f'{ROOT}/*.html')):
    if path.endswith('/404.html'): continue
    s = open(path, encoding='utf-8').read()
    h_end = s.index('</header>', s.index('<header class="site-header">'))
    head, rest = s[:h_end], s[h_end:]
    if 'href="test.html"' not in head:
        head, n = re.subn(r'(        <li><a href="lectie.html"(?: aria-current="page")?>Începători</a></li>\n)', r'\1        ' + TEST_LI + '\n', head, count=1)
        assert n == 1, path
    f = rest.index('<footer class="site-footer">')
    body, foot = rest[:f], rest[f:]
    if 'href="test.html"' not in foot:
        foot, n = re.subn(r'(          <li><a href="lectie.html">Începători</a></li>\n)', r'\1          ' + TEST_LI + '\n', foot, count=1); assert n == 1, path
    if 'href="intrebari.html"' not in foot:
        foot, n = re.subn(r'(          <li><a href="contact.html">Contact</a></li>\n)', r'          <li><a href="intrebari.html">Întrebări frecvente</a></li>\n\1', foot, count=1); assert n == 1, path
    open(path, 'w', encoding='utf-8').write(head + body + foot)
    print('ok', path.rsplit('/', 1)[1])
