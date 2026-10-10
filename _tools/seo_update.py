# SEO on-site: titluri, descrieri, OG/Twitter, H1, JSON-LD, fonturi neblocante. Idempotent: se poate rula din nou
# (de ex. după build_calendar.py). Sursa textelor: seo_meta.py
import re, json, html, sys
sys.path.insert(0, '/workspace/forex-ms-tools')
from seo_meta import PAGES, SITE
ROOT = '/workspace/forex-ms'
FONT = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap'
FONT_BLOCKING = f'  <link href="{FONT}" rel="stylesheet">\n'
FONT_ASYNC = (f'  <link rel="preload" as="style" href="{FONT}" onload="this.onload=null;this.rel=\'stylesheet\'">\n'
              f'  <noscript><link rel="stylesheet" href="{FONT}"></noscript>\n')
GSC_NOTE = ('  <!-- Google Search Console (metoda „etichetă HTML”): pune aici eticheta primită, de forma\n'
            '       <meta name="google-site-verification" content="CODUL-PRIMIT-DE-LA-GOOGLE">  (doar pe pagina principală) -->\n')

ORG = {'@type': 'Organization', '@id': SITE + '#org', 'name': 'MS Prime', 'url': SITE,
       'logo': {'@type': 'ImageObject', 'url': SITE + 'icon-512.png', 'width': 512, 'height': 512},
       'image': SITE + 'og-image.png', 'email': 'contact.mariusfx@gmail.com',
       'founder': {'@type': 'Person', 'name': 'Marius'}, 'sameAs': ['https://t.me/+sbQPdX_yA1E5NmM0', 'https://x.com/MSPrime1fx']}
WEBSITE = {'@type': 'WebSite', '@id': SITE + '#website', 'url': SITE, 'name': 'MS Prime', 'inLanguage': 'ro',
           'description': PAGES['index']['desc'], 'publisher': {'@id': SITE + '#org'}}

def esc(s): return html.escape(s, quote=True)

def plain(h):
    h = re.sub(r'</?(?:p|li|ul|ol|h\d)(?:\s[^>]*)?>', ' ', h)
    h = re.sub(r'<[^>]+>', '', h)
    return re.sub(r'\s+', ' ', html.unescape(h)).strip()

def jsonld(page, src):
    m = PAGES[page]
    url = SITE if page == 'index' else SITE + page + '.html'
    webpage = {'@type': 'WebPage', '@id': url + '#webpage', 'url': url, 'name': m['title'], 'description': m['desc'],
               'inLanguage': 'ro', 'isPartOf': {'@id': SITE + '#website'}}
    graph = [WEBSITE, ORG, webpage]
    if page == 'index':
        webpage['about'] = {'@id': SITE + '#org'}
    else:
        webpage['breadcrumb'] = {'@id': url + '#breadcrumb'}
        graph.append({'@type': 'BreadcrumbList', '@id': url + '#breadcrumb', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Acasă', 'item': SITE},
            {'@type': 'ListItem', 'position': 2, 'name': m['crumb'], 'item': url}]})
    if page == 'lectie':
        chapters = [html.unescape(re.sub(r'<[^>]+>', '', t)).strip() for t in re.findall(r'<h2 id="cap-\d+-title">(.*?)</h2>', src)]
        assert len(chapters) == 8, chapters
        graph.append({'@type': 'Course', '@id': url + '#course', 'name': 'Forex pentru începători: curs gratuit pas cu pas',
                      'description': m['desc'], 'url': url, 'inLanguage': 'ro', 'isAccessibleForFree': True,
                      'educationalLevel': 'Începător', 'provider': {'@id': SITE + '#org'},
                      'offers': {'@type': 'Offer', 'category': 'Free', 'price': 0, 'priceCurrency': 'EUR'},
                      'hasCourseInstance': {'@type': 'CourseInstance', 'courseMode': 'Online', 'inLanguage': 'ro'},
                      'syllabusSections': [{'@type': 'Syllabus', 'name': c} for c in chapters]})
        webpage['mainEntity'] = {'@id': url + '#course'}
    if page == 'test':
        webpage['about'] = {'@id': SITE + 'lectie.html#course'}
    if page == 'intrebari':
        # FAQPage (subtip de WebPage) cu textul vizibil exact, fără tag-uri
        qa = re.findall(r'<details class="faq-item" id="[^"]+">\s*<summary><h2 class="faq-q">(.*?)</h2>.*?</summary>\s*<div class="faq-a">(.*?)</div>\s*</details>', src, re.S)
        assert len(qa) >= 12, len(qa)
        webpage['@type'] = 'FAQPage'
        webpage['mainEntity'] = [{'@type': 'Question', 'name': plain(q), 'acceptedAnswer': {'@type': 'Answer', 'text': plain(a)}} for q, a in qa]
    if page == 'glosar':
        terms = re.findall(r'<div class="gl-term" id="(t-[a-z0-9-]+)"[^>]*>\s*<dt>(.*?)</dt>\s*<dd>(.*?)</dd>', src, re.S)
        assert 40 <= len(terms) <= 60, len(terms)
        tset = {'@type': 'DefinedTermSet', '@id': url + '#glosar', 'name': 'Glosar Forex', 'url': url, 'inLanguage': 'ro',
                'description': m['desc'], 'hasDefinedTerm': [
                    {'@type': 'DefinedTerm', '@id': url + '#' + tid, 'url': url + '#' + tid, 'name': plain(n), 'description': plain(d),
                     'inDefinedTermSet': {'@id': url + '#glosar'}} for tid, n, d in terms]}
        graph.append(tset)
        webpage['mainEntity'] = {'@id': url + '#glosar'}
    if page == 'simulator':
        graph.append({'@type': 'WebApplication', '@id': url + '#app', 'name': 'Simulator de backtesting Forex', 'url': url,
                      'description': m['desc'], 'inLanguage': 'ro', 'applicationCategory': 'EducationalApplication', 'operatingSystem': 'Orice browser modern',
                      'isAccessibleForFree': True, 'offers': {'@type': 'Offer', 'price': 0, 'priceCurrency': 'EUR'}, 'provider': {'@id': SITE + '#org'}})
        webpage['mainEntity'] = {'@id': url + '#app'}
    data = {'@context': 'https://schema.org', '@graph': graph}
    txt = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    json.loads(txt)  # validare
    return '  <script type="application/ld+json">\n' + txt.replace('</', '<\\/') + '\n  </script>\n'

def meta_sub(s, attr, name, value):
    pat = re.compile(r'(<meta ' + attr + r'="' + re.escape(name) + r'" content=")[^"]*(">)')
    s, n = pat.subn(lambda mm: mm.group(1) + esc(value) + mm.group(2), s)
    assert n == 1, (name, n)
    return s

for page, m in PAGES.items():
    path = f'{ROOT}/{page}.html'
    s = open(path, encoding='utf-8').read()
    assert '<html lang="ro">' in s
    s, n = re.subn(r'<title>.*?</title>', '<title>' + esc(m['title']) + '</title>', s, count=1); assert n == 1
    s = meta_sub(s, 'name', 'description', m['desc'])
    for attr, name, key in [('property', 'og:title', 'title'), ('name', 'twitter:title', 'title'),
                            ('property', 'og:description', 'desc'), ('name', 'twitter:description', 'desc')]:
        s = meta_sub(s, attr, name, m[key])
    url = SITE if page == 'index' else SITE + page + '.html'
    assert f'<link rel="canonical" href="{url}">' in s and f'<meta property="og:url" content="{url}">' in s, page
    # H1: primul titlu al paginii devine <h1> (stilul e păstrat în CSS)
    if 'h1' in m:
        old, new = m['h1']
        if f'<h1>{new}</h1>' not in s:
            s, n = re.subn(r'<h2>' + re.escape(old) + r'</h2>', f'<h1>{new}</h1>', s, count=1); assert n == 1, page
    assert len(re.findall(r'<h1[\s>]', s)) == 1, (page, 'h1 count')
    # fonturi fără blocarea randării
    if FONT_BLOCKING in s: s = s.replace(FONT_BLOCKING, FONT_ASYNC)
    assert FONT_ASYNC in s, page
    # JSON-LD (înlocuiește blocul existent)
    s = re.sub(r'  <script type="application/ld\+json">.*?</script>\n', '', s, flags=re.S)
    s = s.replace('</head>', jsonld(page, s) + '</head>', 1)
    if page == 'index' and 'google-site-verification' not in s:
        s = s.replace('  <link rel="canonical"', GSC_NOTE + '  <link rel="canonical"', 1)
    open(path, 'w', encoding='utf-8').write(s)
    print('ok', page)
