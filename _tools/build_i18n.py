#!/usr/bin/env python3
"""Marius FX: versiuni EN/ES/PT generate din paginile în română (sursa unică).

  python3 build_i18n.py --langs en [--extract] [--strict]

- paginile RO primesc (idempotent): hreflang, selectorul de limbă, i18n.js;
- /<lang>/<pagina>.html: segmentele de text (blocuri cu inline) și atributele sunt înlocuite
  din forex-ms-tools/i18n/<lang>/*.json (cheia = textul românesc, spații normalizate);
- căile către resurse devin ../, SEO localizat, JSON-LD cu inLanguage, glosarul resortat;
- i18n/<lang>.js: dicționarul pentru textele generate din JS (i18n/<lang>/ui.json).
"""
import argparse, glob, hashlib, html, json, os, re, sys, unicodedata

ROOT = '/workspace/forex-ms'
TOOLS = '/workspace/forex-ms-tools/i18n'
SITE = 'https://mariusfx1.github.io/marius-fx/'
ALL_LANGS = ['ro', 'en', 'es', 'pt']
LOCALE = {'ro': 'ro_RO', 'en': 'en_US', 'es': 'es_ES', 'pt': 'pt_BR'}
NAME = {'ro': 'Română', 'en': 'English', 'es': 'Español', 'pt': 'Português'}
FLAG = {'ro': 'ro', 'en': 'gb', 'es': 'es', 'pt': 'br'}
TV_LOCALE = {'ro': 'ro', 'en': 'en', 'es': 'es', 'pt': 'br'}
UI = {  # textele selectorului (în limba paginii)
    'ro': ('Limba', 'Alege limba'), 'en': ('Language', 'Choose language'),
    'es': ('Idioma', 'Elige el idioma'), 'pt': ('Idioma', 'Escolha o idioma'),
}
INLINE = set('a abbr b bdi br cite code data dfn em i img kbd mark q s samp small span strong sub sup time u wbr'.split())
SKIP_TAGS = {'script', 'style', 'svg', 'noscript', 'template'}
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())
ATTRS = ('title', 'alt', 'aria-label', 'placeholder', 'data-tip')
META_TRANSLATE = {'description', 'og:title', 'og:description', 'og:image:alt', 'twitter:title', 'twitter:description', 'twitter:image:alt'}

TOK = re.compile(r'<!--.*?-->|<![^>]*>|<(/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"\']|"[^"]*"|\'[^\']*\')*)>|[^<]+|<', re.S)
ATTR_RE = re.compile(r'([a-zA-Z_:][-a-zA-Z0-9_:.]*)(\s*=\s*("([^"]*)"|\'([^\']*)\'|[^\s"\'>]+))?')

def norm(s):
    return re.sub(r'\s+', ' ', s).strip()

def visible(raw):
    t = html.unescape(re.sub(r'<[^>]*>', ' ', raw))
    return norm(t)

def has_words(t):
    return bool(re.search(r'[^\W\d_]{2,}', t))

AUTO_KEEP = re.compile(r'^[A-Z0-9 /:.,·+×%€$£–\-()&#;|]+$')   # coduri: EURUSD, H4, R:R, 1:30
BRANDS = {'Marius FX', 'Marius', 'Telegram', 'TradingView', 'MetaTrader', 'ForexFactory', 'Investing.com', 'Myfxbook', 'FX', 'XTB', 'XM', 'HistData.com',
          'contact.mariusfx@gmail.com', 'Marius FX · Marius', 'Buy', 'Sell', 'Stop loss', 'Take profit', 'Swing trading', 'Forex', 'Long', 'Short'}

def auto_keep(key):
    t = visible(key)
    return bool(AUTO_KEEP.match(t)) or t in BRANDS

# ---------------------------------------------------------------- segmentare
def scan(src):
    """Întoarce (segments, attrs): segments = [(start, end, key)], attrs = [(start, end, value_raw, ctx)]."""
    segs, attrs = [], []
    stack = []            # taguri deschise (pentru subarbori sărite)
    skip_depth = 0        # >0: în interiorul unui subarbore sărit
    run = None            # [start, end, has_text]
    pos = 0
    def flush():
        nonlocal run
        if run and run[2]:
            a, b = run[0], run[1]
            raw = src[a:b]
            # nu începe/termina pe spații
            la = len(raw) - len(raw.lstrip()); rb = len(raw.rstrip())
            a2, b2 = a + la, a + rb
            seg = src[a2:b2]
            # taguri inline deschise dar neînchise la margini: le scoatem din segment
            seg_a, seg_b = a2, b2
            while True:
                m = re.match(r'(<(a|span|strong|b|em|i|small|code)\b[^>]*>)', src[seg_a:seg_b])
                if m and not re.search(r'</%s>' % m.group(2), src[seg_a:seg_b]):
                    seg_a += len(m.group(1)); seg_a += len(src[seg_a:seg_b]) - len(src[seg_a:seg_b].lstrip()); continue
                m = re.search(r'(</(a|span|strong|b|em|i|small|code)>)$', src[seg_a:seg_b])
                if m and not re.search(r'<%s\b' % m.group(2), src[seg_a:seg_b]):
                    seg_b -= len(m.group(1)); seg_b = seg_a + len(src[seg_a:seg_b].rstrip()); continue
                break
            if has_words(visible(src[seg_a:seg_b])):
                segs.append((seg_a, seg_b, norm(src[seg_a:seg_b])))
        run = None
    while pos < len(src):
        m = TOK.match(src, pos)
        tok = m.group(0); start, end = m.start(), m.end(); pos = end
        if tok.startswith('<!--') or tok.startswith('<!'):
            continue
        if m.group(2):
            closing, tag, rest = m.group(1) == '/', m.group(2).lower(), m.group(3) or ''
            selfclose = rest.rstrip().endswith('/') or tag in VOID
            if skip_depth:
                if not closing and not selfclose and stack and tag == stack[-1][0] or (not closing and not selfclose and tag not in VOID):
                    pass
                if not closing and not selfclose:
                    stack.append((tag, True)); skip_depth += 1
                elif closing:
                    while stack:
                        t, sk = stack.pop()
                        if sk: skip_depth -= 1
                        if t == tag: break
                continue
            if not closing:
                attrs_here = parse_attrs(rest)
                no_tr = attrs_here.get('translate') == 'no' or 'notranslate' in attrs_here.get('class', '').split()
                if tag in SKIP_TAGS or no_tr:
                    flush()
                    if tag in ('script', 'style'):
                        e = src.lower().find('</%s>' % tag, pos); pos = e + len(tag) + 3
                        continue
                    if not selfclose:
                        stack.append((tag, True)); skip_depth += 1
                    continue
                if tag in ('title', 'textarea'):
                    flush()
                    e = src.lower().find('</%s>' % tag, pos)
                    inner = src[pos:e]
                    if has_words(inner):
                        la = len(inner) - len(inner.lstrip())
                        segs.append((pos + la, pos + len(inner.rstrip()), norm(inner)))
                    pos = e + len(tag) + 3
                    continue
                # atribute traductibile (în afara segmentelor: le filtrăm la final)
                for am in ATTR_RE.finditer(rest):
                    name = am.group(1).lower()
                    if am.group(4) is None: continue
                    val = am.group(4)
                    vstart = m.start(3) + am.start(4)
                    ok = name in ATTRS
                    if tag == 'meta' and name == 'content':
                        key = attrs_here.get('name') or attrs_here.get('property') or ''
                        ok = key in META_TRANSLATE
                    if tag == 'input' and name == 'value' and attrs_here.get('type') in ('submit', 'button'):
                        ok = True
                    if ok and has_words(html.unescape(val)):
                        attrs.append((vstart, vstart + len(val), val, tag + '@' + name))
                if tag in INLINE:
                    if run is None: run = [start, end, False]
                    else: run[1] = end
                    if not selfclose: stack.append((tag, False))
                else:
                    flush()
                    if not selfclose: stack.append((tag, False))
            else:
                if tag in INLINE:
                    if run is not None: run[1] = end
                else:
                    flush()
                while stack:
                    t, sk = stack.pop()
                    if t == tag: break
            continue
        # text
        if skip_depth: continue
        if tok == '<':
            continue
        if run is None:
            if tok.strip(): run = [start, end, True]
        else:
            run[1] = end
            if tok.strip(): run[2] = True
    flush()
    # atributele din interiorul segmentelor sunt traduse odată cu segmentul
    def inside(a):
        return any(s <= a[0] < e for s, e, _ in segs)
    attrs = [a for a in attrs if not inside(a)]
    return segs, attrs

def parse_attrs(rest):
    out = {}
    for am in ATTR_RE.finditer(rest):
        v = am.group(4) if am.group(4) is not None else (am.group(5) if am.group(5) is not None else (am.group(3) or ''))
        out[am.group(1).lower()] = v
    return out

# ---------------------------------------------------------------- dicționare
def load_dict(lang):
    d = {}
    for f in sorted(glob.glob(os.path.join(TOOLS, lang, '*.json'))):
        if os.path.basename(f) == 'ui.json': continue
        for k, v in json.load(open(f, encoding='utf-8')).items():
            d[norm(k)] = v
    return d

def load_ui(lang):
    p = os.path.join(TOOLS, lang, 'ui.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}

# ---------------------------------------------------------------- blocuri comune
def page_url(lang, page):
    base = SITE if lang == 'ro' else SITE + lang + '/'
    return base if page == 'index.html' else base + page

def rel_link(from_lang, to_lang, page):
    if from_lang == to_lang: return page
    if from_lang == 'ro': return to_lang + '/' + page
    return ('../' if to_lang == 'ro' else '../' + to_lang + '/') + page

def hreflang_block(page, langs):
    lines = ['<!-- i18n:alt -->']  # pad separat
    for l in langs:
        lines.append('  <link rel="alternate" hreflang="%s" href="%s">' % (l, page_url(l, page)))
    lines.append('  <link rel="alternate" hreflang="x-default" href="%s">' % page_url('ro', page))
    lines.append('  <!-- /i18n:alt -->')
    return '\n'.join(lines)

CHEV = '<svg class="lang-chev" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>'
def switch_block(lang, page, langs):
    root = '/marius-fx/' if page == '404.html' else '' if lang == 'ro' else '../'
    lab, choose = UI[lang]
    items = []
    for l in langs:
        cur = ' aria-current="true"' if l == lang else ''
        href = ('/marius-fx/' + ('' if l == 'ro' else l + '/')) if page == '404.html' else rel_link(lang, l, page)
        items.append('<li><a href="%s" hreflang="%s" lang="%s"%s><img src="%simages/flags/%s.svg" alt="" width="20" height="15"><b>%s</b><span>%s</span></a></li>'
                     % (href, l, l, cur, root, FLAG[l], l.upper(), NAME[l]))
    return ('      <!-- i18n:switch --><div class="lang-switch" translate="no">'
            '<button type="button" class="lang-btn" aria-expanded="false" aria-controls="lang-menu" aria-label="%s: %s. %s" title="%s">'
            '<img src="%simages/flags/%s.svg" alt="" width="20" height="15"><span>%s</span>%s</button>'
            '<ul class="lang-menu" id="lang-menu" hidden>%s</ul></div><!-- /i18n:switch -->'
            % (lab, NAME[lang], choose, choose, root, FLAG[lang], lang.upper(), CHEV, ''.join(items)))

SUGGEST = {
    'en': ('This site is also available in English.', 'Switch to English'),
    'es': ('Este sitio también está disponible en español.', 'Ver en español'),
    'pt': ('Este site também está disponível em português.', 'Ver em português'),
}
def suggest_block(langs):
    opts = ''.join('<p data-lang="%s" lang="%s" hidden>%s <a class="lang-suggest-go" href="%s/index.html" hreflang="%s">%s</a></p>'
                   % (l, l, SUGGEST[l][0], l, l, SUGGEST[l][1]) for l in langs if l != 'ro')
    return ('<!-- i18n:suggest --><div class="lang-suggest" id="lang-suggest" translate="no" hidden>%s'
            '<button type="button" class="lang-suggest-close" aria-label="Închide / Close">×</button></div><!-- /i18n:suggest -->' % opts)

def replace_block(src, name, block, anchor_re, after=True, pad=''):
    pat = re.compile(r'[ \t]*<!-- i18n:%s -->.*?<!-- /i18n:%s -->' % (name, name), re.S)
    if pat.search(src):
        return pat.sub(lambda m: block, src, count=1)
    m = re.search(anchor_re, src)
    if not m: raise SystemExit('anchor not found for %s: %s' % (name, anchor_re))
    i = m.end() if after else m.start()
    return src[:i] + block + pad + src[i:]

def ensure_scripts(src, lang, dict_ver, i18n_ver, page=''):
    src = re.sub(r'\s*<script src="(\.\./|/marius-fx/)?i18n/[a-z]{2}\.js[^"]*" defer></script>', '', src)
    src = re.sub(r'\s*<script src="(\.\./|/marius-fx/)?i18n\.js[^"]*" defer></script>', '', src)
    m = re.search(r'\n(\s*)<script src="[^"]+" defer></script>', src)
    if not m: return src
    ind = m.group(1); root = '/marius-fx/' if page == '404.html' else '' if lang == 'ro' else '../'
    tags = ''
    if lang != 'ro': tags += '\n%s<script src="%si18n/%s.js?v=%s" defer></script>' % (ind, root, lang, dict_ver)
    tags += '\n%s<script src="%si18n.js?v=%s" defer></script>' % (ind, root, i18n_ver)
    return src[:m.start()] + tags + src[m.start():]

# copiile traduse se afișează la URL-ul greșit: oprim încărcarea paginii RO, aducem /<lang>/404.html și înlocuim DOM-ul
# (fără document.write: după window.stop() Chrome îl ignoră), apoi rulăm scripturile paginii traduse o singură dată.
LOADER = ("<!-- i18n:404 --><script>(function(){var m=location.pathname.match(/^\\/marius-fx\\/(%s)\\//);if(!m||document.documentElement.lang!=='ro')return;document.documentElement.style.visibility='hidden';try{window.stop();}catch(e){}setTimeout(function(){fetch('/marius-fx/'+m[1]+'/404.html').then(function(r){if(!r.ok)throw 0;return r.text();}).then(function(t){var n=new DOMParser().parseFromString(t,'text/html'),ss=[].slice.call(n.querySelectorAll('script[src]'));ss.forEach(function(x){x.parentNode.removeChild(x);});document.replaceChild(document.importNode(n.documentElement,true),document.documentElement);document.title=n.title;ss.forEach(function(x){var e=document.createElement('script');e.src=x.getAttribute('src');e.async=false;document.body.appendChild(e);});}).catch(function(){location.replace('/marius-fx/404.html');});},0);})();</script><!-- /i18n:404 -->")
def decorate(src, lang, page, langs, dict_ver, i18n_ver):
    if page == '404.html':
        if lang != 'ro':   # copiile traduse nu au voie să conțină loader-ul (altfel se reîncarcă la infinit)
            src = re.sub(r'<!-- i18n:404 -->.*?<!-- /i18n:404 -->\n?\s*', '', src, flags=re.S)
        elif len(langs) > 1:
            src = replace_block(src, '404', LOADER % '|'.join(l for l in langs if l != 'ro'), r'<meta name="robots"[^>]*>\n  ', pad='\n  ')
    else:
        src = replace_block(src, 'alt', hreflang_block(page, langs), r'<link rel="canonical"[^>]*>\n  ', pad='\n  ')
    if re.search(r'<ul class="nav-links"', src):
        src = replace_block(src, 'switch', switch_block(lang, page, langs), r'</ul>\n(?=\s*</nav>\s*</header>)', after=True, pad='\n')
    if lang == 'ro' and page == 'index.html':
        src = replace_block(src, 'suggest', suggest_block(langs), r'</header>\n', after=True)
    return ensure_scripts(src, lang, dict_ver, i18n_ver, page)

# ---------------------------------------------------------------- căi și SEO
def rewrite_paths(src):
    def fix(url):
        if re.match(r'^(https?:|//|mailto:|tel:|#|data:|javascript:|\.\./)', url) or url == '': return url
        path = re.split(r'[?#]', url)[0]
        if path.endswith('.html'): return url
        return '../' + url
    def attr(m):
        name, q, val = m.group(1), m.group(2), m.group(3)
        if name == 'srcset':
            val = ', '.join(fix(p.strip().split(' ')[0]) + (' ' + ' '.join(p.strip().split(' ')[1:]) if len(p.strip().split(' ')) > 1 else '') for p in val.split(','))
        else:
            val = fix(val)
        return '%s=%s%s%s' % (name, q, val, q)
    src = re.sub(r'\b(src|href|srcset|data-tv-src|poster|data-src)=(["\'])([^"\']*)\2', attr, src)
    src = re.sub(r'url\((["\']?)(?!https?:|data:|\.\./|/)([^)"\']+)\1\)', lambda m: 'url(%s../%s%s)' % (m.group(1), m.group(2), m.group(1)), src)
    return src

_PLAIN = {}
def plain_map(tr):
    key = id(tr)
    if key not in _PLAIN:
        m = {}
        for a, b in tr.items():
            pa = norm(html.unescape(re.sub(r'<[^>]*>', '', a)))
            if pa and has_words(pa): m.setdefault(pa, norm(html.unescape(re.sub(r'<[^>]*>', '', b))))
        _PLAIN[key] = (m, sorted(m, key=len, reverse=True))
    return _PLAIN[key]

def plain_compose(k, tr):
    """Text JSON-LD = concatenare de segmente HTML (fără taguri) -> traducere compusă."""
    m, keys = plain_map(tr)
    if k in m: return m[k]
    out, i = [], 0
    while i < len(k):
        if k[i] == ' ': i += 1; continue
        for c in keys:
            if k.startswith(c, i) and (i + len(c) == len(k) or k[i + len(c)] == ' '):
                out.append(m[c]); i += len(c); break
        else:
            return None
    return ' '.join(out) if out else None

def jsonld(src, lang, page, tr, missing):
    def walk(o, key=None):
        if isinstance(o, dict):
            for k in list(o.keys()):
                o[k] = walk(o[k], k)
            if '@type' in o and 'inLanguage' in o: o['inLanguage'] = lang
            return o
        if isinstance(o, list): return [walk(x, key) for x in o]
        if isinstance(o, str):
            if key == 'inLanguage': return lang
            if o.startswith(SITE):
                rest = o[len(SITE):]
                if rest == '' or rest.split('#')[0].endswith('.html') or rest.startswith('#'):
                    if not re.match(r'^(images|downloads|data)/', rest):
                        return SITE + lang + '/' + rest
                return o
            if key in ('@type', '@context', '@id', 'url', 'image', 'logo', 'sameAs', 'email', 'priceCurrency', 'datePublished', 'dateModified', 'encodingFormat', 'contentUrl', 'thumbnailUrl', 'applicationCategory', 'operatingSystem'):
                return o
            k = norm(o)
            if k in tr: return tr[k]
            d = plain_compose(k, tr)
            if d is not None: return d
            if has_words(k) and not auto_keep(k):
                missing.setdefault(page, []).append(o)
            return o
        return o
    def repl(m):
        data = json.loads(m.group(2))
        data = walk(data)
        tops = data if isinstance(data, list) else data.get('@graph', [data]) if isinstance(data, dict) else []
        for t in tops:
            if isinstance(t, dict) and t.get('@type') in ('WebPage', 'Article', 'FAQPage', 'Course', 'WebSite', 'CollectionPage', 'AboutPage', 'ContactPage', 'WebApplication', 'SoftwareApplication', 'Quiz', 'DefinedTermSet', 'HowTo', 'ItemList'):
                t['inLanguage'] = lang
        return m.group(1) + json.dumps(data, ensure_ascii=False, indent=2).replace('</', '<\\/') + m.group(3)
    return re.sub(r'(<script type="application/ld\+json">\s*)(.*?)(\s*</script>)', repl, src, flags=re.S)

def fold(s):
    s = s.replace('\u015f', '\u0219').replace('\u0163', '\u021b')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()

def regroup_glossary(src, lang):
    m = re.search(r'(<div class="gl-list" id="gl-list">)(.*?)(\n      </div>\n)', src, re.S)
    if not m: return src
    terms = re.findall(r'(            <div class="gl-term"[^>]*>.*?\n            </div>)', m.group(2), re.S)
    items = []
    for t in terms:
        dt = re.search(r'<dt>(.*?)</dt>', t, re.S).group(1)
        dd = re.search(r'<dd>(.*?)</dd>', t, re.S).group(1)
        txt = fold(html.unescape(re.sub(r'<[^>]*>', '', dt + ' ' + dd)))
        t = re.sub(r'data-s="[^"]*"', 'data-s="%s"' % html.escape(norm(txt), quote=True), t, count=1)
        name = html.unescape(re.sub(r'<[^>]*>', '', dt)).strip()
        items.append((fold(name), name, t))
    items.sort(key=lambda x: x[0])
    groups = {}
    for k, name, t in items:
        L = k[:1].upper() if k[:1].isalpha() else '#'
        groups.setdefault(L, []).append(t)
    out = []
    for L in sorted(groups):
        l = L.lower()
        out.append('\n        <section class="gl-group" id="litera-%s" aria-labelledby="gl-h-%s">\n          <h2 class="gl-letter" id="gl-h-%s">%s</h2>\n          <dl class="gl-terms">\n%s\n          </dl>\n        </section>'
                   % (l, l, l, L, '\n'.join(groups[L])))
    tail = re.findall(r'\n        <p class="gl-empty".*?</p>', m.group(2), re.S)
    src = src[:m.start(2)] + ''.join(out) + ''.join(tail) + src[m.end(2):]
    az = []
    for L in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
        if L in groups: az.append('          <a href="#litera-%s" data-l="%s">%s</a>' % (L.lower(), L, L))
        else: az.append('          <span class="is-off" aria-hidden="true">%s</span>' % L)
    src = re.sub(r'(<nav class="gl-az"[^>]*>\n).*?(\n      </nav>)', lambda mm: mm.group(1) + '\n'.join(az) + mm.group(2), src, count=1, flags=re.S)
    return src

def translate_svgs(src, tr, page, missing):
    def one(m):
        svg = m.group(0)
        def txt(mm):
            raw = mm.group(1); k = norm(html.unescape(raw))
            if not k or not re.search(r'[A-Za-z\u0100-\u024f]{2}|\d,\d', k): return mm.group(0)
            if k in tr: return '>' + html.escape(tr[k], quote=False) + '<'
            if not auto_keep(k): missing.setdefault(page, []).append(k)
            return mm.group(0)
        def att(mm):
            k = norm(html.unescape(mm.group(2)))
            if k in tr: return '%s="%s"' % (mm.group(1), html.escape(tr[k], quote=True))
            if has_words(k) and not auto_keep(k): missing.setdefault(page, []).append(k)
            return mm.group(0)
        svg = re.sub(r'>([^<>]+)<', txt, svg)
        svg = re.sub(r'(aria-label)="([^"]*)"', att, svg)
        return svg
    return re.sub(r'<svg\b.*?</svg>', one, src, flags=re.S)

def translate_page(src, lang, page, tr, missing):
    segs, attrs = scan(src)
    edits = []
    for a, b, key in segs:
        if key in tr: edits.append((a, b, tr[key]))
        elif auto_keep(key): pass
        else: missing.setdefault(page, []).append(key)
    for a, b, val, ctx in attrs:
        k = norm(html.unescape(val))
        if k in tr: edits.append((a, b, html.escape(tr[k], quote=True)))
        elif norm(val) in tr: edits.append((a, b, tr[norm(val)]))
        elif auto_keep(k): pass
        else: missing.setdefault(page, []).append('@' + k)
    edits.sort()
    out, last = [], 0
    for a, b, t in edits:
        if a < last: raise SystemExit('overlap in %s at %d' % (page, a))
        out.append(src[last:a]); out.append(t); last = b
    out.append(src[last:])
    s = ''.join(out)
    # <html lang>, SEO
    s = re.sub(r'<html lang="ro"', '<html lang="%s"' % lang, s, count=1)
    s = re.sub(r'\s*<meta name="google-site-verification"[^>]*>', '', s)
    s = re.sub(r'(<link rel="canonical" href=")[^"]*(")', lambda m: m.group(1) + page_url(lang, page) + m.group(2), s)
    s = re.sub(r'(<meta property="og:url" content=")[^"]*(")', lambda m: m.group(1) + page_url(lang, page) + m.group(2), s)
    s = re.sub(r'(<meta property="og:locale" content=")[^"]*(")', lambda m: m.group(1) + LOCALE[lang] + m.group(2), s)
    s = re.sub(r'"locale": "ro"', '"locale": "%s"' % TV_LOCALE[lang], s)
    s = translate_svgs(s, tr, page, missing)
    s = jsonld(s, lang, page, tr, missing)
    if page == '404.html':
        s = re.sub(r'(href=")/marius-fx/((?:[\w-]+\.html)?(?:#[^"]*)?")', lambda m: m.group(1) + '/marius-fx/' + lang + '/' + m.group(2), s)
        s = s.replace('<script src="/marius-fx/', '<script src="/marius-fx/')
    else:
        s = rewrite_paths(s)
    if page == 'glosar.html': s = regroup_glossary(s, lang)
    return s

# ---------------------------------------------------------------- main
def pages():
    return sorted(os.path.basename(p) for p in glob.glob(os.path.join(ROOT, '*.html')))

def write_sitemap(active):
    path = os.path.join(ROOT, 'sitemap.xml')
    src = open(path, encoding='utf-8').read()
    entries = re.findall(r'<url>\s*<loc>([^<]+)</loc>(?:\s*<lastmod>([^<]+)</lastmod>)?', src)
    ro = []
    for loc, mod in entries:
        rest = loc[len(SITE):] if loc.startswith(SITE) else None
        if rest is None: continue
        if rest.split('/')[0] in ('en', 'es', 'pt'): continue
        ro.append((rest or 'index.html', mod))
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for l in active:
        for page, mod in ro:
            out.append('  <url>')
            out.append('    <loc>%s</loc>' % page_url(l, page))
            if mod: out.append('    <lastmod>%s</lastmod>' % mod)
            for a in active:
                out.append('    <xhtml:link rel="alternate" hreflang="%s" href="%s"/>' % (a, page_url(a, page)))
            out.append('    <xhtml:link rel="alternate" hreflang="x-default" href="%s"/>' % page_url('ro', page))
            out.append('  </url>')
    out.append('</urlset>')
    open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--langs', default='en')
    ap.add_argument('--extract', action='store_true', help='scrie lista segmentelor sursă în i18n/src/')
    ap.add_argument('--strict', action='store_true')
    a = ap.parse_args()
    langs = [l for l in a.langs.split(',') if l]
    active = ['ro'] + langs
    i18n_ver = hashlib.md5(open(os.path.join(ROOT, 'i18n.js'), 'rb').read()).hexdigest()[:8]
    os.makedirs(os.path.join(ROOT, 'i18n'), exist_ok=True)
    dict_ver = {}
    for l in langs:
        ui = load_ui(l)
        body = 'window.I18N_DICT = window.I18N_DICT || {};\nwindow.I18N_DICT.%s = %s;\n' % (l, json.dumps(ui, ensure_ascii=False, indent=0, sort_keys=True))
        open(os.path.join(ROOT, 'i18n', l + '.js'), 'w', encoding='utf-8').write(body)
        dict_ver[l] = hashlib.md5(body.encode()).hexdigest()[:8]
    # 1) paginile RO (sursa): blocuri comune
    ro_src = {}
    for p in pages():
        path = os.path.join(ROOT, p)
        s = open(path, encoding='utf-8').read()
        s2 = decorate(s, 'ro', p, active, '', i18n_ver)
        if s2 != s: open(path, 'w', encoding='utf-8').write(s2)
        ro_src[p] = s2
    if a.extract:
        os.makedirs(os.path.join(TOOLS, 'src'), exist_ok=True)
        seen = {}
        for p, s in ro_src.items():
            segs, attrs = scan(s)
            keys = [k for _, _, k in segs if not auto_keep(k)] + [norm(html.unescape(v)) for _, _, v, _ in attrs if not auto_keep(norm(html.unescape(v)))]
            for k in keys: seen.setdefault(k, []).append(p)
        json.dump(seen, open(os.path.join(TOOLS, 'src', 'segments.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('segments:', len(seen))
    # 2) limbile
    report = {}
    for l in langs:
        tr = load_dict(l)
        missing = {}
        os.makedirs(os.path.join(ROOT, l), exist_ok=True)
        for p, s in ro_src.items():
            out = translate_page(s, l, p, tr, missing)
            out = decorate(out, l, p, active, dict_ver[l], i18n_ver)
            open(os.path.join(ROOT, l, p), 'w', encoding='utf-8').write(out)
        n = sum(len(v) for v in missing.values())
        report[l] = n
        json.dump(missing, open(os.path.join(TOOLS, 'missing-%s.json' % l), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(l, 'missing segments:', n, {k: len(v) for k, v in missing.items() if v})
    write_sitemap(active)
    if a.strict and any(report.values()): sys.exit(1)

if __name__ == '__main__':
    main()
