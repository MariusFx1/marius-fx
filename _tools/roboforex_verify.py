# roboforex_verify.py: verificare RoboForex Partner — class="qakl" (AgentID) pe linkul de afiliere, fără noreferrer,
# link text către roboforex.com și meta referrer (unsafe-url pe broker, no-referrer-when-downgrade în rest). Idempotent.
import re, sys, pathlib
OLD = '<a class="btn btn-primary" href="https://my.roboforex.com/en/?a=qakl" target="_blank" rel="noopener noreferrer">'
NEW = '<a class="btn btn-primary qakl" href="https://my.roboforex.com/en/?a=qakl" target="_blank" rel="noopener">'
SITE = '<p class="fineprint broker-site">Site oficial: <a href="https://roboforex.com/" class="qakl" target="_blank" rel="noopener">RoboForex - Professional services on Forex market</a></p>'
def fix(name, t):
    pol = 'unsafe-url' if name == 'broker.html' else 'no-referrer-when-downgrade'
    if '<meta name="referrer"' not in t:
        t = t.replace('<meta name="viewport" content="width=device-width, initial-scale=1">', f'<meta name="viewport" content="width=device-width, initial-scale=1">\n  <meta name="referrer" content="{pol}">', 1)
    if name == 'broker.html':
        t = t.replace(OLD, NEW)
        if 'broker-site' not in t:
            t = re.sub(r'(\n(\s*)<p class="fineprint">Acesta este un <strong>link de recomandare</strong>.*?</p>)', lambda m: m.group(1) + '\n' + m.group(2) + SITE, t, count=1, flags=re.S)
    return t
for f in sys.argv[1:]:
    p = pathlib.Path(f); s = p.read_text(); n = fix(p.name, s)
    if n != s: p.write_text(n); print('updated', f)
