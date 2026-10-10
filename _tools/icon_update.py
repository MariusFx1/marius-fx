# icon_update.py: aplică noul icon MS Prime (logo-mark img + linkuri icon v=17) în toate paginile și template-uri
import re, sys, pathlib
SVG = re.compile(r'(<span class="(?:ws-logo )?logo-mark" aria-hidden="true">)\s*<svg viewBox="0 0 24 24"><path d="M3 17l5-5 4 3 8-9"/><path d="M15 6h5v5"/></svg>(</span>)')
def fix(text, pre):
    text = SVG.sub(lambda m: f'{m.group(1)}<img src="{pre}images/logo-mark.webp?v=1" width="34" height="34" alt="" decoding="async">{m.group(2)}', text)
    text = re.sub(r'((?:favicon\.ico|favicon\.png|icon-512\.png|apple-touch-icon\.png|site\.webmanifest)\?v=)16', r'\g<1>17', text)
    if 'favicon-16.png' not in text:
        text = re.sub(r'(\n(\s*)<link rel="icon" type="image/png" sizes="32x32" href="([^"]*?)favicon\.png\?v=17">)',
                      lambda m: m.group(1) + f'\n{m.group(2)}<link rel="icon" type="image/png" sizes="16x16" href="{m.group(3)}favicon-16.png?v=17">', text)
    if 'icon-192.png' not in text:
        text = re.sub(r'(\n(\s*)<link rel="icon" type="image/png" sizes="512x512" href="([^"]*?)icon-512\.png\?v=17">)',
                      lambda m: f'\n{m.group(2)}<link rel="icon" type="image/png" sizes="192x192" href="{m.group(3)}icon-192.png?v=17">' + m.group(1), text)
    text = text.replace('styles.css?v=49', 'styles.css?v=49')
    return text
for f in sys.argv[1:]:
    p = pathlib.Path(f); t = p.read_text()
    pre = '../' if p.parent.name in ('en', 'es', 'pt') else ''
    n = fix(t, pre)
    if n != t: p.write_text(n); print('updated', f)
