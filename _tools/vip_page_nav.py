# Adaugă „VIP” (vip.html) în meniu (înainte de Contact) și „MS Prime VIP” în subsol (Comunitate),
# pe paginile RO; build_i18n.py îl propagă în EN/ES/PT. Idempotent.
import re, glob
ROOT = '/workspace/forex-ms'
for path in sorted(glob.glob(f'{ROOT}/*.html')):
    s = open(path, encoding='utf-8').read()
    pre = '/marius-fx/' if path.endswith('/404.html') else ''
    cur = ' aria-current="page"' if path.endswith('/vip.html') else ''
    h_end = s.index('</header>', s.index('<header class="site-header">'))
    head, rest = s[:h_end], s[h_end:]
    if 'class="nav-vip"' not in head:
        head, n = re.subn(r'(\n( *)<li><a href="%scontact.html"(?: aria-current="page")?>Contact</a></li>)' % re.escape(pre),
                          lambda m: '\n%s<li><a class="nav-vip" href="%svip.html"%s>VIP</a></li>' % (m.group(2), pre, cur) + m.group(1), head, count=1)
        assert n == 1, path
    f = rest.index('<footer class="site-footer">')
    body, foot = rest[:f], rest[f:]
    if 'vip.html">MS Prime VIP' not in foot:
        foot, n = re.subn(r'(\n( *)<li><a class="footer-vip")', lambda m: '\n%s<li><a href="%svip.html">MS Prime VIP</a></li>' % (m.group(2), pre) + m.group(1), foot, count=1)
        assert n == 1, path
    s = head + body + foot
    s = re.sub(r'styles\.css\?v=\d+', 'styles.css?v=61', s)
    open(path, 'w', encoding='utf-8').write(s)
    print('ok', path.rsplit('/', 1)[1])
