# x_update.py: adaugă contul X (@MSPrime1fx) lângă Telegram: subsol, contact, home CTA, JSON-LD sameAs, twitter:site
import re, sys, pathlib
XURL = 'https://x.com/MSPrime1fx'
XPATH = 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'
XSVG = f'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="{XPATH}"/></svg>'
def fix(t):
    if 'x.com/MSPrime1fx' in t: return t
    t = re.sub(r'(<li><a class="footer-tg"[^\n]*?</a></li>)', lambda m: m.group(1) + f'\n          <li><a class="footer-x" href="{XURL}" target="_blank" rel="noopener">{XSVG}X · @MSPrime1fx</a></li>', t, count=1)
    t = re.sub(r'(<li><a class="social-telegram"[^\n]*?</a></li>)', lambda m: m.group(1) + f'\n            <li><a class="social-x" href="{XURL}" target="_blank" rel="noopener">{XSVG}Urmărește pe X · @MSPrime1fx</a></li>', t, count=1)
    t = re.sub(r'(\n(\s*)<a class="hero-telegram"[\s\S]*?</a>)', lambda m: f'\n{m.group(2)}<div class="hero-social">' + m.group(1).replace('\n', '\n  ') + f'\n{m.group(2)}  <div class="hero-x-wrap"><a class="hero-x" href="{XURL}" target="_blank" rel="noopener"><span class="hero-x-icon" aria-hidden="true">{XSVG.replace(" aria-hidden=\"true\"", "")}</span><span>Urmărește pe X</span></a></div>\n{m.group(2)}</div>', t, count=1)
    t = t.replace('"sameAs":["https://t.me/+sbQPdX_yA1E5NmM0"]', '"sameAs":["https://t.me/+sbQPdX_yA1E5NmM0","https://x.com/MSPrime1fx"]')
    t = t.replace("'sameAs': ['https://t.me/+sbQPdX_yA1E5NmM0']", "'sameAs': ['https://t.me/+sbQPdX_yA1E5NmM0', 'https://x.com/MSPrime1fx']")
    t = re.sub(r'(\n(\s*)<meta name="twitter:card" content="summary_large_image">)', lambda m: m.group(1) + f'\n{m.group(2)}<meta name="twitter:site" content="@MSPrime1fx">', t, count=1)
    return t
for f in sys.argv[1:]:
    p = pathlib.Path(f); s = p.read_text(); n = fix(s)
    if n != s: p.write_text(n); print('updated', f)
