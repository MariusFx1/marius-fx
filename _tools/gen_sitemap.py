# Generează sitemap.xml + robots.txt. lastmod = data ultimului commit care a atins pagina (sau azi, dacă are modificări necomise).
import subprocess, datetime, sys
sys.path.insert(0, '/workspace/forex-ms-tools')
from seo_meta import PAGES, SITE
ROOT = '/workspace/forex-ms'
ORDER = ['index', 'lectie', 'test', 'reguli', 'patternuri', 'sesiuni', 'calendar', 'jurnal', 'calculator', 'despre', 'broker', 'contact', 'intrebari', 'glosar', 'simulator']
assert set(ORDER) == set(PAGES)
today = datetime.date.today().isoformat()
def lastmod(f):
    dirty = subprocess.run(['git', 'status', '--porcelain', f], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    if dirty: return today
    out = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', f], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    return out or today
urls = []
for p in ORDER:
    loc = SITE if p == 'index' else f'{SITE}{p}.html'
    urls.append(f'  <url>\n    <loc>{loc}</loc>\n    <lastmod>{lastmod(p + ".html")}</lastmod>\n  </url>')
xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(urls) + '\n</urlset>\n'
open(f'{ROOT}/sitemap.xml', 'w', encoding='utf-8').write(xml)
open(f'{ROOT}/robots.txt', 'w', encoding='utf-8').write(
    '# Notă: site-ul este un „project site” GitHub Pages (/marius-fx/). Google citește robots.txt doar de la\n'
    '# rădăcina domeniului (mariusfx1.github.io/robots.txt), deci acest fișier e doar informativ.\n'
    '# Sitemap-ul se trimite direct în Google Search Console.\n'
    'User-agent: *\nAllow: /\n\n'
    f'Sitemap: {SITE}sitemap.xml\n')
print(xml)
