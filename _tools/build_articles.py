#!/usr/bin/env python3
# build_articles.py: secțiunea „Articole” (articole.html + 3 articole), idempotent.
#  1) CSS (bloc „ARTICOLE”) + versiunea styles.css?v=NN pe toate paginile RO
#  2) legături: subsol „Articole” (toate paginile RO + 404) și card pe pagina principală
#  3) generează paginile RO din antetul/subsolul lui despre.html (head, nav, footer rămân sincronizate)
#  4) scrie dicționarele de traducere i18n/<lang>/articles.json (în _tools și în forex-ms-tools)
#  5) adaugă URL-urile RO în sitemap.xml (build_i18n.py le propagă în en/es/pt cu hreflang)
# După rulare: python3 build_i18n.py --langs en,es,pt   (NU gen_sitemap.py, NU backup_to_repo.sh)
import re, os, sys, json, html, math, glob, pathlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from articles_a import A
from articles_b import B
from articles_c import C

ROOT = pathlib.Path('/workspace/forex-ms')
SITE = 'https://mariusfx1.github.io/marius-fx/'
WHOP = 'https://whop.com/mariusfx1-github-io/ms-prime-vip/'
CSS_V = '60'
PUB = '2026-10-15'
LANGS = ['ro', 'en', 'es', 'pt']
ART = [A, B, C]
INDEX_FILE = 'articole.html'
DICT_DIRS = ['/workspace/forex-ms/_tools/i18n', '/workspace/forex-ms-tools/i18n']
ARROW = ' <span class="feature-arrow" aria-hidden="true">→</span>'
DSVG = re.search(r'<span class="vip-discord-icon"><svg.*?</svg><span class="vip-lock">.*?</span></span>', (ROOT / 'index.html').read_text(), re.S).group(0)

MONTH = {
 'ro': ['ianuarie','februarie','martie','aprilie','mai','iunie','iulie','august','septembrie','octombrie','noiembrie','decembrie'],
 'en': ['January','February','March','April','May','June','July','August','September','October','November','December'],
 'es': ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembrie'.replace('iem','iem'),'octubre','noviembre','diciembre'],
 'pt': ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'],
}
MONTH['es'][8] = 'septiembre'
def date_txt(i):
    y, m, d = PUB.split('-'); m = int(m) - 1; d = int(d)
    return ['%d %s %s' % (d, MONTH['ro'][m], y), '%s %d, %s' % (MONTH['en'][m], d, y),
            '%d de %s de %s' % (d, MONTH['es'][m], y), '%d de %s de %s' % (d, MONTH['pt'][m], y)][i]

# texte comune (ro, en, es, pt)
U = dict(
 home=('Acasă', 'Home', 'Inicio', 'Início'),   # „Acasă” există deja în pages.json (are prioritate)
 articole=('Articole', 'Articles', 'Artículos', 'Artigos'),
 crumb_aria=('Traseu de navigare', 'Breadcrumb', 'Ruta de navegación', 'Trilha de navegação'),
 kicker_art=('Articol · {n} min de citit', 'Article · {n} min read', 'Artículo · {n} min de lectura', 'Artigo · {n} min de leitura'),
 meta=('Publicat de Marius · <time datetime="%s">{d}</time>' % PUB,
       'Published by Marius · <time datetime="%s">{d}</time>' % PUB,
       'Publicado por Marius · <time datetime="%s">{d}</time>' % PUB,
       'Publicado por Marius · <time datetime="%s">{d}</time>' % PUB),
 cta_title=('Vrei să vezi aceste idei aplicate în piață?', 'Want to see these ideas applied in the market?',
            '¿Quieres ver estas ideas aplicadas en el mercado?', 'Quer ver essas ideias aplicadas no mercado?'),
 cta_line=('MS Prime VIP: grup privat de semnale pe Discord, acces cu abonament lunar. <a href="vip.html">Vezi ce include VIP</a>',
           'MS Prime VIP: private signals group on Discord, access with a monthly subscription. <a href="vip.html">See what VIP includes</a>',
           'MS Prime VIP: grupo privado de señales en Discord, acceso con suscripción mensual. <a href="vip.html">Mira qué incluye VIP</a>',
           'MS Prime VIP: grupo privado de sinais no Discord, acesso com assinatura mensal. <a href="vip.html">Veja o que o VIP inclui</a>'),
 cta_btn=('Cere acces', 'Request access', 'Solicitar acceso', 'Pedir acesso'),
 cta_disc=('Semnalele nu sunt sfaturi de investiții. Tradingul implică riscuri.',
           'Signals are not investment advice. Trading involves risk.',
           'Las señales no son asesoramiento de inversión. El trading implica riesgos.',
           'Os sinais não são aconselhamento de investimento. Negociar envolve riscos.'),
 disc=('Conținut educațional, nu este sfat financiar. Forex și CFD-urile cu levier pot duce la pierderea rapidă a banilor, iar exemplele cu cifre sunt didactice și nu garantează niciun rezultat.',
       'Educational content, not financial advice. Forex and leveraged CFDs can lead to a rapid loss of money, and the examples with numbers are for teaching and do not guarantee any result.',
       'Contenido educativo, no es asesoramiento financiero. El Forex y los CFD con apalancamiento pueden provocar una pérdida rápida de dinero, y los ejemplos con cifras son didácticos y no garantizan ningún resultado.',
       'Conteúdo educacional, não é aconselhamento financeiro. Forex e CFDs com alavancagem podem levar à perda rápida de dinheiro, e os exemplos com números são didáticos e não garantem nenhum resultado.'),
 more=('Citește și', 'Read next', 'Sigue leyendo', 'Leia também'),
 idx_title=('Articole Forex și swing trading pentru începători | MS Prime',
            'Forex and swing trading articles for beginners | MS Prime',
            'Artículos de Forex y swing trading para principiantes | MS Prime',
            'Artigos de Forex e swing trading para iniciantes | MS Prime'),
 idx_h1=('Articole Forex pentru începători', 'Forex articles for beginners', 'Artículos de Forex para principiantes', 'Artigos de Forex para iniciantes'),
 idx_desc=('Articole gratuite despre swing trading, mărimea lotului și stop loss, scrise simplu de Marius. Conținut educațional, fără promisiuni de câștig.',
           'Free articles on swing trading, lot size and stop loss, written in plain language by Marius. Educational content, no promises of profit.',
           'Artículos gratuitos sobre swing trading, tamaño del lote y stop loss, escritos de forma sencilla por Marius. Contenido educativo, sin promesas de ganancias.',
           'Artigos gratuitos sobre swing trading, tamanho do lote e stop loss, escritos de forma simples por Marius. Conteúdo educacional, sem promessas de lucro.'),
 idx_kicker=('Ghiduri scurte', 'Short guides', 'Guías breves', 'Guias curtos'),
 idx_sub=('Trei ghiduri practice despre swing trading, mărimea lotului și stop loss. Fără promisiuni de câștig: doar explicații clare, cu exemple didactice.',
          'Three practical guides on swing trading, lot size and stop loss. No promises of profit: just clear explanations with teaching examples.',
          'Tres guías prácticas sobre swing trading, tamaño del lote y stop loss. Sin promesas de ganancias: solo explicaciones claras con ejemplos didácticos.',
          'Três guias práticos sobre swing trading, tamanho do lote e stop loss. Sem promessas de lucro: apenas explicações claras com exemplos didáticos.'),
 idx_note=('Vrei să înveți de la zero? Începe cu <a href="lectie.html">cursul pentru începători</a> sau caută un termen în <a href="glosar.html">glosar</a>.',
           'Want to learn from scratch? Start with the <a href="lectie.html">beginner course</a> or look up a term in the <a href="glosar.html">glossary</a>.',
           '¿Quieres aprender desde cero? Empieza con el <a href="lectie.html">curso para principiantes</a> o busca un término en el <a href="glosar.html">glosario</a>.',
           'Quer aprender do zero? Comece pelo <a href="lectie.html">curso para iniciantes</a> ou procure um termo no <a href="glosar.html">glossário</a>.'),
 home_card=('Ghiduri scurte despre swing trading, mărimea lotului și stop loss, scrise simplu pentru începători.',
            'Short guides on swing trading, lot size and stop loss, written simply for beginners.',
            'Guías breves sobre swing trading, tamaño del lote y stop loss, escritas de forma sencilla para principiantes.',
            'Guias curtos sobre swing trading, tamanho do lote e stop loss, escritos de forma simples para iniciantes.'),
)
ICONS = {
 'swing-trading-incepatori.html': '<svg viewBox="0 0 24 24" focusable="false"><path d="M3 16c3 0 3-8 6-8s3 8 6 8 3-8 6-8"/><path d="M3 20h18"/></svg>',
 'marime-lot-forex.html': '<svg viewBox="0 0 24 24" focusable="false"><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7.5h7"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/></svg>',
 'stop-loss-forex.html': '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12h7"/></svg>',
}
HOME_ICON = '<svg viewBox="0 0 24 24" focusable="false"><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/></svg>'

E = lambda s: html.escape(s, quote=True)
def plain(h): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', h))).strip()
def url(f): return SITE + f

# ---------------------------------------------------------------- dicționar
DICT = {l: {} for l in LANGS[1:]}
def reg(t, ro_override=None):
    """t = (ro,en,es,pt) -> cheia = textul RO normalizat."""
    k = re.sub(r'\s+', ' ', t[0]).strip()
    for i, l in enumerate(LANGS[1:], 1): DICT[l][k] = t[i]
    return t[0]
def rega(href, t):
    """<a href=..>text</a> (elementele <li><a> sunt segmente întregi, cu tot cu <a>)"""
    return reg(tuple('<a href="%s">%s</a>' % (href, x) for x in t))
def regf(t, **kw):
    t2 = tuple(x.format(**kw) for x in t); return reg(t2)

# ---------------------------------------------------------------- blocuri
def render_blocks(blocks, ind='      '):
    out = []
    for b in blocks:
        k = b[0]
        if k == 'lead': continue
        if k == 'h2': out.append('%s<h2>%s</h2>' % (ind, reg(b[1])))
        elif k == 'h3': out.append('%s<h3>%s</h3>' % (ind, reg(b[1])))
        elif k == 'p': out.append('%s<p>%s</p>' % (ind, reg(b[1])))
        elif k in ('ul', 'ol'):
            out.append('%s<%s>' % (ind, k))
            for it in b[1]: out.append('%s  <li>%s</li>' % (ind, reg(it)))
            out.append('%s</%s>' % (ind, k))
        elif k == 'ex':
            lab = reg(b[1])
            out.append('%s<aside class="art-ex" aria-label="%s">' % (ind, E(lab)))
            out.append('%s  <p class="art-ex-label">%s</p>' % (ind, lab))
            out.append(render_blocks(b[2], ind + '  '))
            out.append('%s</aside>' % ind)
    return '\n'.join(out)

def words(d):
    n = 0
    def blk(b):
        k = b[0]
        if k in ('lead', 'p', 'h2', 'h3'): return len(plain(b[1][0]).split())
        if k in ('ul', 'ol'): return sum(len(plain(x[0]).split()) for x in b[1])
        if k == 'ex': return sum(blk(x) for x in b[2])
        return 0
    return sum(blk(b) for b in d['blocks'])

# ---------------------------------------------------------------- JSON-LD
ORG = {'@type': 'Organization', '@id': SITE + '#org', 'name': 'MS Prime', 'url': SITE,
       'logo': {'@type': 'ImageObject', 'url': SITE + 'icon-512.png', 'width': 512, 'height': 512},
       'image': SITE + 'og-image.png?v=3', 'email': 'contact.mariusfx@gmail.com',
       'founder': {'@type': 'Person', 'name': 'Marius'}, 'sameAs': ['https://t.me/MSPrimeFree', 'https://x.com/MSPrime1fx']}
def website(desc): return {'@type': 'WebSite', '@id': SITE + '#website', 'url': SITE, 'name': 'MS Prime', 'inLanguage': 'ro', 'description': desc, 'publisher': {'@id': SITE + '#org'}}
INDEX_DESC = re.search(r'<meta name="description" content="([^"]*)"', (ROOT / 'index.html').read_text()).group(1)

def ld_article(d):
    f = d['file']; u = url(f); h1 = d['h1'][0]
    crumbs = [{'@type': 'ListItem', 'position': 1, 'name': U['home'][0], 'item': SITE},
              {'@type': 'ListItem', 'position': 2, 'name': U['articole'][0], 'item': url(INDEX_FILE)},
              {'@type': 'ListItem', 'position': 3, 'name': h1, 'item': u}]
    g = [website(html.unescape(INDEX_DESC)), ORG,
         {'@type': 'WebPage', '@id': u + '#webpage', 'url': u, 'name': d['title'][0], 'description': d['desc'][0], 'inLanguage': 'ro',
          'isPartOf': {'@id': SITE + '#website'}, 'breadcrumb': {'@id': u + '#breadcrumb'}, 'mainEntity': {'@id': u + '#article'}},
         {'@type': 'BreadcrumbList', '@id': u + '#breadcrumb', 'itemListElement': crumbs},
         {'@type': 'Article', '@id': u + '#article', 'headline': h1, 'description': d['desc'][0], 'inLanguage': 'ro', 'url': u,
          'mainEntityOfPage': {'@id': u + '#webpage'}, 'datePublished': PUB, 'dateModified': PUB, 'image': SITE + 'og-image.png?v=3',
          'isAccessibleForFree': True, 'author': {'@type': 'Person', 'name': 'Marius'}, 'publisher': {'@id': SITE + '#org'}}]
    return g

def ld_index():
    u = url(INDEX_FILE)
    items = [{'@type': 'ListItem', 'position': i, 'name': d['h1'][0], 'url': url(d['file'])} for i, d in enumerate(ART, 1)]
    return [website(html.unescape(INDEX_DESC)), ORG,
            {'@type': 'CollectionPage', '@id': u + '#webpage', 'url': u, 'name': U['idx_title'][0], 'description': U['idx_desc'][0], 'inLanguage': 'ro',
             'isPartOf': {'@id': SITE + '#website'}, 'breadcrumb': {'@id': u + '#breadcrumb'}, 'mainEntity': {'@id': u + '#list'}},
            {'@type': 'BreadcrumbList', '@id': u + '#breadcrumb', 'itemListElement': [
                {'@type': 'ListItem', 'position': 1, 'name': U['home'][0], 'item': SITE},
                {'@type': 'ListItem', 'position': 2, 'name': U['articole'][0], 'item': u}]},
            {'@type': 'ItemList', '@id': u + '#list', 'itemListElement': items}]

# ---------------------------------------------------------------- pagini

def make_page(file, title, desc, graph, main, og_type='website'):
    s = (ROOT / 'despre.html').read_text()   # șablon: antet, meniu, subsol (la zi)
    s = re.sub(r'<title>.*?</title>', lambda m: '<title>%s</title>' % E(title), s, count=1)
    def meta(attr, name, val):
        nonlocal s
        s, n = re.subn(r'(<meta %s="%s" content=")[^"]*(">)' % (attr, re.escape(name)), lambda m: m.group(1) + E(val) + m.group(2), s)
        assert n == 1, name
    meta('name', 'description', desc)
    for a, n_, v in [('property', 'og:title', title), ('name', 'twitter:title', title), ('property', 'og:description', desc), ('name', 'twitter:description', desc)]:
        meta(a, n_, v)
    meta('property', 'og:url', url(file)); meta('property', 'og:type', og_type)
    s = re.sub(r'(<link rel="canonical" href=")[^"]*(">)', lambda m: m.group(1) + url(file) + m.group(2), s, count=1)
    # hreflang: blocul <!-- i18n:alt --> e rescris de build_i18n.py; aici punem varianta corectă
    alts = ''.join('  <link rel="alternate" hreflang="%s" href="%s">\n' % (l, SITE + ('' if l == 'ro' else l + '/') + file) for l in LANGS)
    alts += '  <link rel="alternate" hreflang="x-default" href="%s">\n' % url(file)
    s = re.sub(r'<!-- i18n:alt -->.*?<!-- /i18n:alt -->', lambda m: '<!-- i18n:alt -->\n' + alts + '  <!-- /i18n:alt -->', s, flags=re.S)
    if og_type == 'article':
        s = s.replace('  <meta property="og:site_name"', '  <meta property="article:published_time" content="%s">\n  <meta property="og:site_name"' % PUB, 1)
    ld = json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    s = re.sub(r'(<script type="application/ld\+json">\n).*?(\n  </script>)', lambda m: m.group(1) + ld + m.group(2), s, count=1, flags=re.S)
    s = s.replace('<a href="despre.html" aria-current="page">Despre</a>', '<a href="despre.html">Despre</a>')
    s = re.sub(r'  <main id="continut">.*?</main>', lambda m: main, s, count=1, flags=re.S)
    assert s.count('G-MVC55DC6H5') == 2 and 'google-site-verification' not in s   # gtag: src + config, o singură etichetă
    (ROOT / file).write_text(s)

def reg_meta(d):
    reg(d['title']); reg(d['h1']); reg(d['desc']); reg(d['card'])

def cta():
    return f'''      <div class="art-vip">
        <div class="vip-discord">
          {DSVG}
          <div class="vip-discord-text"><p class="vip-discord-title">{reg(U['cta_title'])}</p><p class="vip-discord-line">{reg(U['cta_line'])}</p></div>
          <a class="vip-discord-btn" href="{WHOP}" target="_blank" rel="noopener">{reg(U['cta_btn'])}</a>
        </div>
        <p class="vip-discord-disc">{reg(U['cta_disc'])}</p>
      </div>'''

def crumb():
    t = tuple('<a href="index.html">%s</a><span aria-hidden="true">›</span><a href="%s">%s</a>' % (U['home'][i], INDEX_FILE, U['articole'][i]) for i in range(4))
    return reg(t)

def article_main(d):
    reg_meta(d)
    n = max(1, math.ceil(words(d) / 200))
    kick = regf(U['kicker_art'], n=n)
    meta_t = tuple(U['meta'][i].format(d=date_txt(i)) for i in range(4))
    lead = [b for b in d['blocks'] if b[0] == 'lead'][0][1]
    rel = ''.join('\n          <li>%s</li>' % rega(f, next(x for x in ART if x['file'] == f)['h1']) for f in d['related'])
    body = render_blocks(d['blocks'])
    return f'''  <main id="continut">
    <article class="section container art" id="articol">
      <div class="art-wrap">
      <nav class="art-crumb" aria-label="{E(reg(U['crumb_aria']))}">{crumb()}</nav>
      <header class="art-head">
        <p class="kicker">{kick}</p>
        <h1>{d['h1'][0]}</h1>
        <p class="art-meta">{reg(meta_t)}</p>
        <p class="art-lead">{reg(lead)}</p>
      </header>
      <div class="art-body">
{body}
      </div>
{cta()}
      <p class="art-disc">{reg(U['disc'])}</p>
      <aside class="art-more" aria-labelledby="art-more-h">
        <h2 id="art-more-h">{reg(U['more'])}</h2>
        <ul>{rel}
          <li>{rega(INDEX_FILE, U['articole'])}</li>
        </ul>
      </aside>
      </div>
    </article>
  </main>''', n

def card(d):
    reg(d['h1']); reg(d['card'])
    h = d['h1']
    DICT_ARROW = tuple(x + ARROW for x in h)
    reg(DICT_ARROW)
    return f'''          <li><a class="feature-card" href="{d['file']}"><span class="feature-icon" aria-hidden="true">{ICONS[d['file']]}</span><h3>{h[0]}{ARROW}</h3><p>{d['card'][0]}</p></a></li>'''

def index_main():
    reg(U['idx_title']); reg(U['idx_desc'])
    cards = '\n'.join(card(d) for d in ART)
    return f'''  <main id="continut">
    <section class="section container art-index" id="articole" aria-labelledby="art-h1">
      <header class="section-head">
        <p class="kicker">{reg(U['idx_kicker'])}</p>
        <h1 id="art-h1">{reg(U['idx_h1'])}</h1>
        <p class="section-sub">{reg(U['idx_sub'])}</p>
      </header>
      <ul class="features art-cards">
{cards}
      </ul>
      <p class="fineprint">{reg(U['idx_note'])}</p>
      <p class="art-disc">{reg(U['disc'])}</p>
    </section>
  </main>'''

# ---------------------------------------------------------------- CSS
CSS_MARK = '/* ===== ARTICOLE (blog) ===== */'
CSS = CSS_MARK + '''
.art-wrap { max-width: 46rem; margin-inline: auto; overflow-wrap: break-word; }
.art-crumb { display: flex; flex-wrap: wrap; align-items: center; gap: .45rem; margin: 0 0 1.4rem; font-size: .82rem; color: var(--muted); }
.art-crumb a { color: var(--muted); text-decoration: none; }
.art-crumb a:hover, .art-crumb a:focus-visible { color: var(--green-2); }
.art-crumb span { opacity: .6; }
.section .art-head h1 { font-size: clamp(1.8rem, 4.2vw, 2.7rem); line-height: 1.12; margin: 0 0 .9rem; }
.art-meta { margin: 0 0 1.3rem; font-size: .85rem; color: var(--muted); }
.art-lead { margin: 0; padding-bottom: 1.7rem; border-bottom: 1px solid var(--border); font-size: 1.12rem; line-height: 1.7; color: #d5dded; }
.art-body { margin-top: .4rem; }
.section .art-body h2 { margin: 2.5rem 0 .8rem; font-size: clamp(1.4rem, 2.8vw, 1.8rem); line-height: 1.18; }
.art-body h3 { margin: 1.7rem 0 .5rem; font-size: 1.15rem; font-weight: 800; color: #eaf0fa; }
.art-body p, .art-body li { font-size: 1.02rem; line-height: 1.75; color: #c3cde0; }
.art-body p { margin: 0 0 1rem; }
.art-body ul, .art-body ol { margin: 0 0 1.2rem; padding-left: 1.5rem; }
.art-body ul, .art-more ul { list-style: disc; }
.art-body ol { list-style: decimal; }
.art-body li { margin: .45rem 0; padding-left: .2rem; }
.art-body li::marker { color: var(--green-2); font-weight: 700; }
.art-body a, .art-index .fineprint a, .art-more a { color: var(--green-2); text-decoration: underline; text-decoration-color: rgba(74,222,128,.4); text-underline-offset: 3px; }
.art-body a:hover, .art-more a:hover { text-decoration-color: currentColor; }
.art-ex { margin: 1.6rem 0; padding: 1.1rem 1.3rem 1.2rem; border-radius: 14px; border: 1px solid rgba(251,191,36,.38); border-left-width: 4px; background: rgba(251,191,36,.06); }
.art-ex-label { margin: 0 0 .6rem !important; font-family: var(--mono); font-size: .72rem !important; letter-spacing: .1em; text-transform: uppercase; color: var(--amber) !important; }
.art-ex > :last-child { margin-bottom: 0 !important; }
.art-vip { margin: 2.8rem 0 0; }
.art-vip .vip-discord { max-width: none; margin: 0; }
.art-vip .vip-discord-line a { color: #f1e3b0; font-weight: 700; }
.art-disc { margin: 1.3rem 0 0; padding: .8rem 1rem; border-left: 3px solid var(--border); border-radius: 0 10px 10px 0; background: rgba(15,24,41,.6); font-size: .82rem; line-height: 1.55; color: var(--muted); }
.art-more { margin-top: 2.4rem; padding-top: 1.6rem; border-top: 1px solid var(--border); }
.section .art-more h2 { margin: 0 0 .7rem; font-size: 1.15rem; }
.art-more ul { margin: 0; padding-left: 1.2rem; }
.art-more li { margin: .4rem 0; color: var(--muted); }
.art-index .art-cards { margin-top: .3rem; }
.art-index .fineprint { margin-top: 2rem; font-size: .92rem; line-height: 1.6; max-width: 46rem; }
.art-index .art-disc { max-width: 46rem; }
@media (max-width: 600px) { .art-lead { font-size: 1.05rem; } .art-body p, .art-body li { font-size: 1rem; } .art-ex { padding: 1rem 1rem 1.05rem; } }
'''
def do_css():
    p = ROOT / 'styles.css'; s = p.read_text()
    if CSS_MARK in s: s = s[:s.index(CSS_MARK)].rstrip('\n')   # blocul ARTICOLE e ultimul din fișier: se rescrie
    p.write_text(s.rstrip('\n') + '\n\n' + CSS)
    n = 0
    for f in glob.glob(str(ROOT / '*.html')):
        t = open(f, encoding='utf-8').read()
        t2 = re.sub(r'(styles\.css\?v=)\d+', r'\g<1>' + CSS_V, t)
        if t2 != t: open(f, 'w', encoding='utf-8').write(t2); n += 1
    print('css: bumped v=%s on %d pages' % (CSS_V, n))

# ---------------------------------------------------------------- legături (subsol + home)
def do_links():
    for f in sorted(glob.glob(str(ROOT / '*.html'))):
        name = os.path.basename(f)
        if name in [INDEX_FILE] + [d['file'] for d in ART]: continue
        s = open(f, encoding='utf-8').read()
        pre = '/marius-fx/' if name == '404.html' else ''
        i = s.index('<footer class="site-footer">'); head, foot = s[:i], s[i:]
        if 'href="%s%s"' % (pre, INDEX_FILE) not in foot:
            foot, n = re.subn(r'(\n( *)<li><a href="%spatternuri\.html">Patternuri</a></li>)' % re.escape(pre),
                              lambda m: m.group(1) + '\n%s<li><a href="%s%s">%s</a></li>' % (m.group(2), pre, INDEX_FILE, U['articole'][0]), foot, count=1)
            assert n == 1, name
        if name == 'index.html' and 'href="%s"' % INDEX_FILE not in head:
            card_html = f'''          <li>
            <a class="feature-card" href="{INDEX_FILE}">
              <span class="feature-icon" aria-hidden="true">{HOME_ICON}</span>
              <h3>{U['articole'][0]}{ARROW}</h3>
              <p>{U['home_card'][0]}</p>
            </a>
          </li>
'''
            m = re.search(r'          <li>\n            <a class="feature-card" href="intrebari\.html">', head)
            assert m
            head = head[:m.start()] + card_html + head[m.start():]
        open(f, 'w', encoding='utf-8').write(head + foot)
    rega(INDEX_FILE, U['articole']); rega('/marius-fx/' + INDEX_FILE, U['articole']); reg(U['articole']); reg(U['home_card']); reg(tuple(x + ARROW for x in U['articole']))

# ---------------------------------------------------------------- sitemap (RO; build_i18n.py generează restul)
def do_sitemap():
    p = ROOT / 'sitemap.xml'; s = p.read_text()
    files = [INDEX_FILE] + [d['file'] for d in ART]
    new = ''
    for f in files:
        if '<loc>%s</loc>' % url(f) in s: continue
        new += '  <url>\n    <loc>%s</loc>\n    <lastmod>%s</lastmod>\n' % (url(f), PUB)
        for l in LANGS: new += '    <xhtml:link rel="alternate" hreflang="%s" href="%s"/>\n' % (l, SITE + ('' if l == 'ro' else l + '/') + f)
        new += '    <xhtml:link rel="alternate" hreflang="x-default" href="%s"/>\n  </url>\n' % url(f)
    if new:
        # după ultimul URL românesc (înainte de primul /en/)
        i = s.index('<loc>%sen/</loc>' % SITE); i = s.rindex('  <url>', 0, i)
        s = s[:i] + new + s[i:]
        p.write_text(s)
    print('sitemap: %d new RO url blocks' % new.count('<url>'))

# ---------------------------------------------------------------- main
def main():
    do_css()
    do_links()
    info = {}
    for d in ART:
        main_html, n = article_main(d)
        make_page(d['file'], d['title'][0], d['desc'][0], ld_article(d), main_html, 'article')
        info[d['file']] = (words(d), n)
    make_page(INDEX_FILE, U['idx_title'][0], U['idx_desc'][0], ld_index(), index_main())
    for l in LANGS[1:]:
        for dd in DICT_DIRS:
            os.makedirs('%s/%s' % (dd, l), exist_ok=True)
            json.dump(DICT[l], open('%s/%s/articles.json' % (dd, l), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)
    do_sitemap()
    for f, (w, n) in info.items(): print('%s: %d words (body, ro), ~%d min' % (f, w, n))
    print('dict entries per lang:', len(DICT['en']))

if __name__ == '__main__':
    main()
