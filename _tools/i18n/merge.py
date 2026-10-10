#!/usr/bin/env python3
"""merge.py <lang> ui|pages <file.tsv>: linii „N<TAB>traducere” -> i18n/<lang>/ui.json sau pages.json.
Cheile vin din i18n/src/ui-keys.json sau i18n/src/segments.json (ordinea fixă)."""
import json, sys, os
T = '/workspace/forex-ms-tools/i18n'
lang, kind, f = sys.argv[1:4]
keys = json.load(open(f'{T}/src/ui-keys.json')) if kind == 'ui' else list(json.load(open(f'{T}/src/segments.json')).keys())
out_p = f'{T}/{lang}/{"ui" if kind == "ui" else "pages"}.json'
os.makedirs(os.path.dirname(out_p), exist_ok=True)
d = json.load(open(out_p)) if os.path.exists(out_p) else {}
n = 0
for line in open(f, encoding='utf-8'):
    line = line.rstrip('\n')
    if not line.strip() or line.startswith('#'): continue
    i, _, txt = line.partition('\t')
    i = int(i)
    if kind == 'ui': txt = txt.replace('\\n', '\n')
    if '—' in txt and '—' not in keys[i]: sys.exit(f'em-dash in {i}: {txt}')
    # aceleași placeholder-e
    import re
    ph = lambda s: sorted(re.findall(r'\{\w+\}', s))
    if ph(keys[i]) != ph(txt): sys.exit(f'placeholder mismatch {i}: {keys[i]!r} -> {txt!r}')
    tags = lambda s: sorted(re.findall(r'<(/?[a-z]+)', s))
    if tags(keys[i]) != tags(txt): sys.exit(f'tag mismatch {i}: {keys[i]!r} -> {txt!r}')
    d[keys[i]] = txt; n += 1
json.dump(d, open(out_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)
print(out_p, '+', n, 'total', len(d))
