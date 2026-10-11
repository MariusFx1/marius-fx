# vip_update.py: bloc „VIP Discord” (home sub Telegram/X), linie în contact, link în subsol (Comunitate). Idempotent.
import re, sys, pathlib
TG = 'https://t.me/+sbQPdX_yA1E5NmM0'
DPATH = 'M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z'
LPATH = 'M17 9V7a5 5 0 0 0-10 0v2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-8-2a3 3 0 0 1 6 0v2H9V7z'
DSVG = f'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="{DPATH}"/></svg>'
LSVG = f'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="{LPATH}"/></svg>'
LINE = 'Grup privat de semnale · acces doar cu abonament lunar'
DISC = 'Semnalele nu sunt sfaturi de investiții. Tradingul implică riscuri.'
def block(ind):
    return (f'\n{ind}<div class="vip-discord">'
            f'\n{ind}  <span class="vip-discord-icon">{DSVG}<span class="vip-lock">{LSVG}</span></span>'
            f'\n{ind}  <div class="vip-discord-text"><p class="vip-discord-title">VIP Discord 🔒</p><p class="vip-discord-line">{LINE}</p></div>'
            f'\n{ind}  <a class="vip-discord-btn" href="{TG}" target="_blank" rel="noopener">Cere acces</a>'
            f'\n{ind}</div>'
            f'\n{ind}<p class="vip-discord-disc">{DISC}</p>')
def fix(t):
    if 'vip-discord' in t or 'footer-vip' in t: return t
    t = re.sub(r'(<li><a class="footer-x"[^\n]*?</a></li>)', lambda m: m.group(1) + f'\n          <li><a class="footer-vip" href="{TG}" target="_blank" rel="noopener">{DSVG}VIP Discord (privat)</a></li>', t, count=1)
    t = re.sub(r'(<li><a class="social-x"[^\n]*?</a></li>)', lambda m: m.group(1) + f'\n            <li class="vip-discord-li"><a class="social-vip" href="{TG}" target="_blank" rel="noopener">{DSVG}VIP Discord 🔒 · Cere acces</a><span class="vip-discord-sub">{LINE}. {DISC}</span></li>', t, count=1)
    t = re.sub(r'(\n(\s*)<div class="hero-social">[\s\S]*?\n\2</div>)', lambda m: m.group(1) + block(m.group(2)), t, count=1)
    return t
if __name__ == '__main__':
    for f in sys.argv[1:]:
        p = pathlib.Path(f); s = p.read_text(); n = fix(s)
        if n != s: p.write_text(n); print('updated', f)
