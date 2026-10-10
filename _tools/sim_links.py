# Adaugă „Simulator” în meniu (după Calculator) și în subsol (Instrumente), bump versiuni CSS/JS. Idempotent.
# patternuri.html: doar meniul, subsolul și versiunile (conținutul paginii nu se atinge).
import re, glob, os
ROOT = '/workspace/forex-ms'
for f in sorted(glob.glob(f'{ROOT}/*.html')):
    s0 = s = open(f, encoding='utf-8').read()
    name = os.path.basename(f)
    if name == '404.html': continue   # se regenerează din contact.html (build_404.py)
    # meniu
    m = re.search(r'<ul class="nav-links" id="nav-links">.*?</ul>', s, re.S)
    if m and 'simulator.html' not in m.group(0):
        blk = re.sub(r'(\n(\s*)<li><a href="calculator\.html"[^>]*>Calculator</a></li>)', lambda x: x.group(1) + f'\n{x.group(2)}<li><a href="simulator.html">Simulator</a></li>', m.group(0), count=1)
        assert blk != m.group(0), name
        s = s.replace(m.group(0), blk)
    # subsol: coloana Instrumente
    m = re.search(r'<nav class="footer-col" aria-label="Instrumente">.*?</nav>', s, re.S)
    if m and 'simulator.html' not in m.group(0):
        blk = re.sub(r'(\n(\s*)<li><a href="calculator\.html">Calculator</a></li>)', lambda x: x.group(1) + f'\n{x.group(2)}<li><a href="simulator.html">Simulator</a></li>', m.group(0), count=1)
        assert blk != m.group(0), name
        s = s.replace(m.group(0), blk)
    s = re.sub(r'styles\.css\?v=(39|40)\b', 'styles.css?v=44', s)
    s = s.replace('script.js?v=35"', 'script.js?v=36"')
    if s != s0:
        open(f, 'w', encoding='utf-8').write(s); print('updated', name)
