#!/usr/bin/env python3
"""Rebrand Marius FX -> MS Prime in site sources + i18n sources (revert: git checkout tag pre-msprime).
Keeps: URLs/paths (marius-fx, mariusfx1), email, Telegram handle + community name 'Free Marius FX', localStorage keys, the person Marius."""
import re, glob, sys, os
SITE = '/workspace/forex-ms'; TOOLS = '/workspace/forex-ms-tools'
RULES = [
    (r'Marius <b>FX</b>', 'MS <b>Prime</b>'),
    (r'Marius <span class="accent">FX</span>', 'MS <span class="accent">Prime</span>'),
    (r'Marius <span class=\\"accent\\">FX</span>', 'MS <span class=\\"accent\\">Prime</span>'),
    (r'(?<!Free )Marius FX', 'MS Prime'),
    (r'(?<!FREE )MARIUS FX', 'MS PRIME'),
    (r'jurnal-marius-fx-backup-', 'jurnal-ms-prime-backup-'),
    (r'jurnal-marius-fx-\$\{', 'jurnal-ms-prime-${'),
]
files = [f for f in glob.glob(SITE + '/*.html') + glob.glob(SITE + '/*.js') + glob.glob(SITE + '/i18n/*.js')]
files += [SITE + '/site.webmanifest', SITE + '/images/CITESTE-MA.txt']
files += glob.glob(TOOLS + '/i18n/*/*.json') + glob.glob(TOOLS + '/i18n/tsv/*.tsv') + glob.glob(TOOLS + '/i18n/missing-*.json')
files += [TOOLS + f for f in ['/og-card.html', '/make_xlsx.py', '/make_pdf.py', '/jurnal-print.html', '/seo_meta.py', '/build_i18n.py', '/build_404.py', '/premium_html.py', '/seo_update.py', '/build_new_pages.py']]
tot = 0
for f in files:
    if not os.path.isfile(f): continue
    s = open(f, encoding='utf-8').read(); o = s
    for a, b in RULES: s = re.sub(a, b, s)
    if s != o:
        n = sum(len(re.findall(a, o)) for a, _ in RULES); tot += n
        open(f, 'w', encoding='utf-8').write(s); print(f'{n:4d}  {f}')
print('total', tot)
