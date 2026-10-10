import re, sys, os, html
ROOT='/workspace/forex-ms'
lang=sys.argv[1]
DIA=re.compile('[ăâîșțşţĂÂÎȘȚ]')
WORDS=re.compile(r'\b(și|sau|pentru|către|este|sunt|nu ai|tranzacți\w*|capitolul|pierdere|câștig\w*|ora României|Înapoi|Șterge|Acasă|lecți\w*|întrebări)\b', re.I)
bad=0
for f in sorted(os.listdir(os.path.join(ROOT,lang))):
    if not f.endswith('.html'): continue
    s=open(os.path.join(ROOT,lang,f),encoding='utf-8').read()
    s=re.sub(r'<script(?![^>]*ld\+json).*?</script>','',s,flags=re.S)
    s=re.sub(r'<style.*?</style>','',s,flags=re.S)
    s=re.sub(r'<link[^>]*>','',s)
    s=re.sub(r'<div class="lang-switch".*?</div>\s*</div>','',s,flags=re.S)
    txt=re.findall(r'>([^<]+)<',s)+re.findall(r'(?:title|alt|aria-label|placeholder|content)="([^"]*)"',s)
    for t in txt:
        t=html.unescape(t).strip()
        if not t: continue
        if re.search(r'Iași|Română|Româna',t): t=re.sub(r'Iași|Română|Româna','',t)
        if DIA.search(t) or WORDS.search(t):
            bad+=1; print(f,'|',t[:160])
print('LEAKS',bad)
