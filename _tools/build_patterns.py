#!/usr/bin/env python3
"""MS Prime: conținutul paginii patternuri.html (SVG inline + plan de tranzacționare + quiz).

  python3 _tools/build_patterns.py      # rescrie blocul <!-- patterns:start/end --> și adaugă
                                       # traducerile EN/ES/PT în i18n/<lang>/pages.json
apoi: python3 _tools/build_i18n.py --langs en,es,pt
Textele RO sunt cheile; orice modificare a unui text RO cere și traducerile din TR.
"""
import json, os, re, html

ROOT = '/workspace/forex-ms'
DICTS = [os.path.join(ROOT, '_tools/i18n'), '/workspace/forex-ms-tools/i18n']
TR = {}   # ro -> (en, es, pt)

def t(ro, en, es, pt):
    TR[re.sub(r'\s+', ' ', ro).strip()] = (en, es, pt)
    return ro

_EXIST = {}
def _ex(lang):
    if lang not in _EXIST:
        _EXIST[lang] = json.load(open(os.path.join(DICTS[0], lang, 'pages.json'), encoding='utf-8'))
    return _EXIST[lang]

def tx(ro, li):
    k = re.sub(r'\s+', ' ', ro).strip()
    if k in TR: return TR[k][li]
    return _ex(('en', 'es', 'pt')[li]).get(k, ro)

def comp(*parts):
    """Segment compus: părți RO traductibile (str) și HTML brut (tuple ('raw', html))."""
    ro = ''.join(x[1] if isinstance(x, tuple) else x for x in parts)
    tr = tuple(''.join(x[1] if isinstance(x, tuple) else tx(x, li) for x in parts) for li in range(3))
    return t(ro, *tr)

# ------------------------------------------------------------------ SVG
W, H = 720, 500
X0, X1 = 34, 590          # zona lumânărilor
def Y(p): return round(452 - p * 3.6, 1)
FONT = 'font-family="Manrope, Segoe UI, sans-serif"'
C_ENTRY, C_SL, C_TP, C_LINE = '#60a5fa', '#f87171', '#22c55e', '#fbbf24'

def path_candles(start, wps):
    """wps = [(pret, nr_lumanari)] -> lista OHLC + indicii punctelor de inflexiune."""
    closes, idx, prev = [], [0], start
    for k, (p, n) in enumerate(wps):
        for j in range(1, n + 1):
            v = prev + (p - prev) * j / n
            if j < n: v += ((len(closes) * 7) % 5 - 2) * 0.55
            closes.append(v)
        prev = p; idx.append(len(closes))
    out, o = [], start
    for i, c in enumerate(closes):
        w1 = 1.2 + (i * 5 % 4) * 0.6; w2 = 1.2 + (i * 3 % 4) * 0.6
        out.append((o, max(o, c) + w1, min(o, c) - w2, c)); o = c
    return out, idx

def cx(i, n): return X0 + (X1 - X0) * (i + 0.5) / n

def candles_svg(cs):
    n = len(cs); bw = min(22, (X1 - X0) / n * 0.62); s = []
    for i, (o, h, l, c) in enumerate(cs):
        x = cx(i, n); col = '#22c55e' if c >= o else '#fb7185'
        top, bot = Y(max(o, c)), Y(min(o, c))
        s.append('<line x1="%.1f" y1="%s" x2="%.1f" y2="%s" stroke="%s" stroke-width="1.7"/>' % (x, Y(h), x, Y(l), col))
        s.append('<rect x="%.1f" y="%s" width="%.1f" height="%.1f" rx="1.2" fill="%s"/>' % (x - bw / 2, top, bw, max(bot - top, 1.6), col))
    return ''.join(s)

def label(x, y, txt, col, anchor='start', size=20):
    return '<text x="%.1f" y="%.1f" fill="%s" stroke="#0b1220" stroke-width="5" stroke-linejoin="round" paint-order="stroke" %s font-size="%d" font-weight="800" text-anchor="%s">%s</text>' % (x, y, col, FONT, size, anchor, txt)

def svg(cs, aria, lines=(), plan=None, hbars=(), small=False):
    n = len(cs); s = ['<svg class="pat-svg" viewBox="0 0 %d %d" role="img" aria-label="%s">' % (W, H, html.escape(aria))]
    s.append('<rect width="%d" height="%d" rx="14" fill="#0b1220"/>' % (W, H))
    s.append('<g stroke="#1e2b45" stroke-width="1">' + ''.join('<line x1="%d" y1="%d" x2="%d" y2="%d"/>' % (X0, y, 700, y) for y in (92, 164, 236, 308, 380, 452)) + '</g>')
    if plan:
        i, entry, sl, tp = plan['i'], plan['entry'], plan['sl'], plan['tp']
        xa = cx(i, n) - 8; xb = 700
        s.append('<rect x="%.1f" y="%s" width="%.1f" height="%.1f" fill="%s" opacity=".13"/>' % (xa, min(Y(entry), Y(tp)), xb - xa, abs(Y(tp) - Y(entry)), C_TP))
        s.append('<rect x="%.1f" y="%s" width="%.1f" height="%.1f" fill="%s" opacity=".13"/>' % (xa, min(Y(entry), Y(sl)), xb - xa, abs(Y(sl) - Y(entry)), C_SL))
    for (i1, p1, i2, p2, lab) in lines:
        x1, x2 = cx(i1, n) - 10, cx(i2, n) + 10
        s.append('<line x1="%.1f" y1="%s" x2="%.1f" y2="%s" stroke="%s" stroke-width="2.4" stroke-linecap="round"/>' % (x1, Y(p1), x2, Y(p2), C_LINE))
    s.append(candles_svg(cs))
    for (i1, p1, i2, p2, lab) in lines:
        if lab: s.append(label(cx(i1, n) - 10, Y(p1) + 22 if p1 < 40 else Y(p1) - 9, lab, C_LINE, size=18))
    for (i, pa, _i2, pb) in hbars:
        x = cx(i, n) + (X1 - X0) / n * 0.5
        s.append('<line x1="%.1f" y1="%s" x2="%.1f" y2="%s" stroke="#e6ebf5" stroke-width="1.6" stroke-dasharray="4 4" marker-end="url(#ar)"/>' % (x, Y(pa), x, Y(pb)))
        s.append(label(x + 8, (Y(pa) + Y(pb)) / 2 + 5, 'H', '#e6ebf5', size=20))
    if plan:
        for p, col, txt, dash in ((plan['entry'], C_ENTRY, plan.get('elab', 'Intrare'), ''), (plan['sl'], C_SL, 'SL', ' stroke-dasharray="7 5"'), (plan['tp'], C_TP, plan.get('tplab', 'TP'), ' stroke-dasharray="7 5"')):
            s.append('<line x1="%.1f" y1="%s" x2="700" y2="%s" stroke="%s" stroke-width="2"%s/>' % (cx(plan['i'], n) - 8, Y(p), Y(p), col, dash))
            s.append(label(698, Y(p) - 7, txt, col, 'end'))
    if plan:
        rr = abs(plan['tp'] - plan['entry']) / abs(plan['entry'] - plan['sl'])
        s.append(label(46, 34, 'RR 1:%.1f' % rr, '#e6ebf5', size=19))
        RRS.append(round(rr, 2))
    s.insert(1, '<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10z" fill="#e6ebf5"/></marker></defs>')
    s.append('</svg>')
    return ''.join(s)

def first_cross(cs, frm, level, up):
    for i in range(frm, len(cs)):
        if (cs[i][3] > level) if up else (cs[i][3] < level): return i
    return len(cs) - 1

# ------------------------------------------------------------------ patternuri
RRS = []
P = []   # dict-uri cu: id, title, svg, intro(html), plan [3], mistakes [1-2]

def chart(start, wps, aria, lines_fn, trade, hb_fn, up):
    cs, w = path_candles(start, wps)
    lines = lines_fn(w)
    i = w[trade['at']] - 1 if 'at' in trade else first_cross(cs, w[trade['after']], trade['entry'], up)
    plan = dict(trade, i=i)
    return svg(cs, aria, lines, plan, hb_fn(w, i)), (cs, w)

def quiz_svg(start, wps, aria, lines_fn=lambda w: []):
    cs, w = path_candles(start, wps)
    return svg(cs, aria, [l[:4] + ('',) for l in lines_fn(w)])

T_ENTRY = t('Intrare', 'Entry', 'Entrada', 'Entrada')
T_NECK = t('linie de gât', 'neckline', 'línea de cuello', 'linha de pescoço')
T_SUP = t('suport', 'support', 'soporte', 'suporte')
T_RES = t('rezistență', 'resistance', 'resistencia', 'resistência')

# 01 Cap și umeri
HS = (30, [(62, 4), (48, 3), (80, 4), (48, 4), (64, 3), (48, 3), (2, 10)])
s, _ = chart(*HS, t('Cap și umeri cu plan de tranzacționare: intrare sub linia de gât, stop loss deasupra umărului drept, take profit egal cu înălțimea capului proiectată în jos.',
    'Head and shoulders with a trade plan: entry below the neckline, stop loss above the right shoulder, take profit equal to the head height projected down.',
    'Hombro-cabeza-hombro con plan de operación: entrada bajo la línea de cuello, stop loss sobre el hombro derecho, take profit igual a la altura de la cabeza proyectada hacia abajo.',
    'Ombro-cabeça-ombro com plano de operação: entrada abaixo da linha de pescoço, stop loss acima do ombro direito, take profit igual à altura da cabeça projetada para baixo.'),
    lambda w: [(w[2], 48, w[6], 48, T_NECK)], dict(after=6, entry=46, sl=67, tp=4), lambda w, i: [(w[3], 48, w[3], 79), (i + 1, 46, i + 1, 15)], False)
P.append(dict(id='cap-si-umeri', title='Cap și umeri', svg=s, existing=True,
    intro='Capul și umerii (Head and Shoulders) apare, de regulă, după o urcare. Prețul face un prim vârf — umărul stâng — coboară, urcă mai sus în cap, apoi coboară din nou și face un al treilea vârf, umărul drept, mai jos decât capul. Minimele dintre vârfuri se pot uni într-o linie de gât. Pe grafic cauți cele trei vârfuri și vezi dacă prețul trece sub linia de gât; forma singură nu spune ce urmează.',
    plan=[t('<b>Intrare:</b> sell după o închidere de lumânare sub linia de gât (sau la retestarea ei).', '<b>Entry:</b> sell after a candle closes below the neckline (or on its retest).', '<b>Entrada:</b> venta tras un cierre de vela bajo la línea de cuello (o en su retesteo).', '<b>Entrada:</b> venda após um fechamento de vela abaixo da linha de pescoço (ou no reteste).'),
          t('<b>Stop loss:</b> deasupra umărului drept.', '<b>Stop loss:</b> above the right shoulder.', '<b>Stop loss:</b> por encima del hombro derecho.', '<b>Stop loss:</b> acima do ombro direito.'),
          t('<b>Take profit:</b> mișcarea măsurată H extinsă (spre 1,5–2×H sau până la următorul nivel de structură), astfel încât ținta să fie la cel puțin 2R.', '<b>Take profit:</b> the measured move H extended (towards 1.5–2×H or to the next structure level), so that the target is at least 2R.', '<b>Take profit:</b> el movimiento medido H extendido (hacia 1,5–2×H o hasta el siguiente nivel de estructura), de modo que el objetivo esté al menos a 2R.', '<b>Take profit:</b> o movimento medido H estendido (até 1,5–2×H ou até o próximo nível de estrutura), de modo que o alvo fique a pelo menos 2R.')],
    mistakes=[t('Intri înainte ca linia de gât să fie spartă: forma nu e completă.', 'Entering before the neckline breaks: the pattern isn\u2019t complete yet.', 'Entrar antes de que se rompa la línea de cuello: la figura aún no está completa.', 'Entrar antes de a linha de pescoço ser rompida: o padrão ainda não está completo.'),
              t('Vezi „cap și umeri” în orice trei vârfuri, fără o urcare clară înainte.', 'Seeing \u201chead and shoulders\u201d in any three peaks, without a clear rise before them.', 'Ver un „hombro-cabeza-hombro” en cualquier tres picos, sin una subida clara antes.', 'Ver um „ombro-cabeça-ombro” em quaisquer três topos, sem uma alta clara antes.')]))

# 02 Cap și umeri inversat
IHS = (70, [(38, 4), (52, 3), (20, 4), (52, 4), (36, 3), (52, 3), (98, 10)])
s, _ = chart(*IHS, t('Cap și umeri inversat cu plan: intrare peste linia de gât, stop loss sub umărul drept, take profit egal cu adâncimea capului proiectată în sus.',
    'Inverse head and shoulders with a plan: entry above the neckline, stop loss below the right shoulder, take profit equal to the head depth projected up.',
    'Hombro-cabeza-hombro invertido con plan: entrada sobre la línea de cuello, stop loss bajo el hombro derecho, take profit igual a la profundidad de la cabeza proyectada hacia arriba.',
    'Ombro-cabeça-ombro invertido com plano: entrada acima da linha de pescoço, stop loss abaixo do ombro direito, take profit igual à profundidade da cabeça projetada para cima.'),
    lambda w: [(w[2], 52, w[6], 52, T_NECK)], dict(after=6, entry=54, sl=33, tp=96), lambda w, i: [(w[3], 52, w[3], 21), (i + 1, 54, i + 1, 85)], True)
P.append(dict(id='cap-si-umeri-inversat', title=t('Cap și umeri inversat', 'Inverse head and shoulders', 'Hombro-cabeza-hombro invertido', 'Ombro-cabeça-ombro invertido'), svg=s,
    intro=t('Varianta în oglindă a capului și umerilor apare, de regulă, după o scădere: un minim (umărul stâng), un minim mai adânc (capul) și un minim mai puțin adânc (umărul drept). Vârfurile dintre ele formează linia de gât. Forma devine relevantă abia când prețul închide deasupra acestei linii.',
        'The mirror version of head and shoulders usually appears after a decline: a low (left shoulder), a deeper low (head) and a shallower low (right shoulder). The peaks between them form the neckline. The shape only becomes relevant once the price closes above that line.',
        'La versión en espejo del hombro-cabeza-hombro suele aparecer tras una caída: un mínimo (hombro izquierdo), un mínimo más profundo (cabeza) y un mínimo menos profundo (hombro derecho). Los máximos entre ellos forman la línea de cuello. La figura solo cobra relevancia cuando el precio cierra por encima de esa línea.',
        'A versão espelhada do ombro-cabeça-ombro costuma aparecer após uma queda: um fundo (ombro esquerdo), um fundo mais profundo (cabeça) e um fundo menos profundo (ombro direito). Os topos entre eles formam a linha de pescoço. A forma só se torna relevante quando o preço fecha acima dessa linha.'),
    plan=[t('<b>Intrare:</b> buy după o închidere deasupra liniei de gât (sau la retestarea ei).', '<b>Entry:</b> buy after a close above the neckline (or on its retest).', '<b>Entrada:</b> compra tras un cierre por encima de la línea de cuello (o en su retesteo).', '<b>Entrada:</b> compra após um fechamento acima da linha de pescoço (ou no reteste).'),
          t('<b>Stop loss:</b> sub umărul drept.', '<b>Stop loss:</b> below the right shoulder.', '<b>Stop loss:</b> por debajo del hombro derecho.', '<b>Stop loss:</b> abaixo do ombro direito.'),
          t('<b>Take profit:</b> mișcarea măsurată H extinsă (spre 1,5–2×H sau până la următorul nivel de structură), astfel încât ținta să fie la cel puțin 2R.', '<b>Take profit:</b> the measured move H extended (towards 1.5–2×H or to the next structure level), so that the target is at least 2R.', '<b>Take profit:</b> el movimiento medido H extendido (hacia 1,5–2×H o hasta el siguiente nivel de estructura), de modo que el objetivo esté al menos a 2R.', '<b>Take profit:</b> o movimento medido H estendido (até 1,5–2×H ou até o próximo nível de estrutura), de modo que o alvo fique a pelo menos 2R.')],
    mistakes=[t('Pui stop loss-ul imediat sub linia de gât, unde o simplă retestare îl poate atinge.', 'Placing the stop loss just below the neckline, where a simple retest can hit it.', 'Poner el stop loss justo debajo de la línea de cuello, donde un simple retesteo puede alcanzarlo.', 'Colocar o stop loss logo abaixo da linha de pescoço, onde um simples reteste pode atingi-lo.')]))

# 03 Dublu vârf
s, _ = chart(30, [(78, 5), (55, 4), (78, 4), (55, 4), (-7, 10)], t('Dublu vârf cu plan: intrare sub linia de gât, stop loss deasupra vârfurilor, take profit egal cu înălțimea formei.',
    'Double top with a plan: entry below the neckline, stop loss above the peaks, take profit equal to the pattern height.',
    'Doble techo con plan: entrada bajo la línea de cuello, stop loss sobre los picos, take profit igual a la altura de la figura.',
    'Topo duplo com plano: entrada abaixo da linha de pescoço, stop loss acima dos topos, take profit igual à altura do padrão.'),
    lambda w: [(w[1], 78, w[3], 78, T_RES), (w[2], 55, w[4], 55, T_NECK)], dict(after=4, entry=53, sl=82, tp=-5), lambda w, i: [(w[2], 55, w[2], 77), (i + 1, 53, i + 1, 31)], False)
P.append(dict(id='dublu-varf', title='Dublu vârf', svg=s, existing=True,
    intro='Dublul vârf (Double Top) se formează când prețul urcă de două ori cam până la același nivel și nu trece clar de el. Între cele două vârfuri rămâne un minim, iar prin acel minim se trasează linia de gât. Silueta seamănă cu litera „M”. O coborâre sub linia de gât este ceea ce notezi ca posibilă spargere, nu ca pe o certitudine.',
    plan=[t('<b>Intrare:</b> sell după închiderea sub linia de gât (minimul dintre vârfuri).', '<b>Entry:</b> sell after a close below the neckline (the low between the peaks).', '<b>Entrada:</b> venta tras el cierre bajo la línea de cuello (el mínimo entre los picos).', '<b>Entrada:</b> venda após o fechamento abaixo da linha de pescoço (o fundo entre os topos).'),
          t('<b>Stop loss:</b> deasupra celor două vârfuri.', '<b>Stop loss:</b> above the two peaks.', '<b>Stop loss:</b> por encima de los dos picos.', '<b>Stop loss:</b> acima dos dois topos.'),
          t('<b>Take profit:</b> mișcarea măsurată H extinsă (spre 1,5–2×H sau până la următorul nivel de structură), astfel încât ținta să fie la cel puțin 2R.', '<b>Take profit:</b> the measured move H extended (towards 1.5–2×H or to the next structure level), so that the target is at least 2R.', '<b>Take profit:</b> el movimiento medido H extendido (hacia 1,5–2×H o hasta el siguiente nivel de estructura), de modo que el objetivo esté al menos a 2R.', '<b>Take profit:</b> o movimento medido H estendido (até 1,5–2×H ou até o próximo nível de estrutura), de modo que o alvo fique a pelo menos 2R.')],
    mistakes=[t('Vinzi la al doilea vârf, înainte de spargere: de multe ori prețul continuă în sus.', 'Selling at the second peak, before the breakout: the price often keeps going up.', 'Vender en el segundo pico, antes de la ruptura: muchas veces el precio sigue subiendo.', 'Vender no segundo topo, antes do rompimento: muitas vezes o preço continua subindo.')]))

# 04 Dublu minim
s, _ = chart(72, [(24, 5), (47, 4), (24, 4), (47, 4), (109, 10)], t('Dublu minim cu plan: intrare peste linia de gât, stop loss sub minime, take profit egal cu înălțimea formei.',
    'Double bottom with a plan: entry above the neckline, stop loss below the lows, take profit equal to the pattern height.',
    'Doble suelo con plan: entrada sobre la línea de cuello, stop loss bajo los mínimos, take profit igual a la altura de la figura.',
    'Fundo duplo com plano: entrada acima da linha de pescoço, stop loss abaixo dos fundos, take profit igual à altura do padrão.'),
    lambda w: [(w[1], 24, w[3], 24, T_SUP), (w[2], 47, w[4], 47, T_NECK)], dict(after=4, entry=49, sl=20, tp=107), lambda w, i: [(w[2], 47, w[2], 25), (i + 1, 49, i + 1, 71)], True)
P.append(dict(id='dublu-minim', title='Dublu minim', svg=s, existing=True,
    intro='Dublul minim (Double Bottom) este forma inversă și se vede adesea după o scădere. Prețul atinge de două ori o zonă joasă asemănătoare, cu un vârf între ele. Linia de gât trece prin acel vârf. Urmărești dacă prețul urcă și iese deasupra liniei. Este un model de recunoscut pe grafic, nu o invitație de a intra într-o tranzacție.',
    plan=[t('<b>Intrare:</b> buy după închiderea deasupra liniei de gât (vârful dintre minime).', '<b>Entry:</b> buy after a close above the neckline (the peak between the lows).', '<b>Entrada:</b> compra tras el cierre sobre la línea de cuello (el máximo entre los mínimos).', '<b>Entrada:</b> compra após o fechamento acima da linha de pescoço (o topo entre os fundos).'),
          t('<b>Stop loss:</b> sub cele două minime.', '<b>Stop loss:</b> below the two lows.', '<b>Stop loss:</b> por debajo de los dos mínimos.', '<b>Stop loss:</b> abaixo dos dois fundos.'),
          t('<b>Take profit:</b> mișcarea măsurată H extinsă (spre 1,5–2×H sau până la următorul nivel de structură), astfel încât ținta să fie la cel puțin 2R.', '<b>Take profit:</b> the measured move H extended (towards 1.5–2×H or to the next structure level), so that the target is at least 2R.', '<b>Take profit:</b> el movimiento medido H extendido (hacia 1,5–2×H o hasta el siguiente nivel de estructura), de modo que el objetivo esté al menos a 2R.', '<b>Take profit:</b> o movimento medido H estendido (até 1,5–2×H ou até o próximo nível de estrutura), de modo que o alvo fique a pelo menos 2R.')],
    mistakes=[t('Numești „dublu minim” două minime aflate la niveluri foarte diferite.', 'Calling two lows at very different levels a \u201cdouble bottom\u201d.', 'Llamar „doble suelo” a dos mínimos situados en niveles muy distintos.', 'Chamar de „fundo duplo” dois fundos em níveis muito diferentes.')]))

# 05 Triplu vârf / minim
TT = (30, [(74, 4), (56, 3), (74, 3), (56, 3), (74, 3), (56, 3), (4, 9)])
s, _ = chart(*TT, t('Triplu vârf cu plan: trei vârfuri la aceeași rezistență, intrare sub suport, stop loss deasupra vârfurilor, take profit egal cu înălțimea formei.',
    'Triple top with a plan: three peaks at the same resistance, entry below support, stop loss above the peaks, take profit equal to the pattern height.',
    'Triple techo con plan: tres picos en la misma resistencia, entrada bajo el soporte, stop loss sobre los picos, take profit igual a la altura de la figura.',
    'Topo triplo com plano: três topos na mesma resistência, entrada abaixo do suporte, stop loss acima dos topos, take profit igual à altura do padrão.'),
    lambda w: [(w[1], 74, w[5], 74, T_RES), (w[2], 56, w[6], 56, T_SUP)], dict(after=6, entry=54, sl=78, tp=6), lambda w, i: [(w[4], 56, w[4], 73), (i + 1, 54, i + 1, 37)], False)
P.append(dict(id='triplu-varf', title=t('Triplu vârf / triplu minim', 'Triple top / triple bottom', 'Triple techo / triple suelo', 'Topo triplo / fundo triplo'), svg=s,
    intro=t('Seamănă cu dublul vârf, dar prețul testează aceeași rezistență de trei ori fără să treacă de ea, iar minimele dintre vârfuri formează un suport. Triplul minim este oglinda: trei atingeri ale aceluiași suport, apoi ieșire peste rezistența dintre ele, cu planul inversat (buy, stop loss sub minime).',
        'It looks like a double top, but the price tests the same resistance three times without getting through, and the lows between the peaks form a support. The triple bottom is the mirror image: three touches of the same support, then a break above the resistance between them, with the plan reversed (buy, stop loss below the lows).',
        'Se parece al doble techo, pero el precio prueba la misma resistencia tres veces sin superarla, y los mínimos entre los picos forman un soporte. El triple suelo es su reflejo: tres toques del mismo soporte y después una ruptura por encima de la resistencia entre ellos, con el plan invertido (compra, stop loss bajo los mínimos).',
        'Parece um topo duplo, mas o preço testa a mesma resistência três vezes sem passar dela, e os fundos entre os topos formam um suporte. O fundo triplo é o espelho: três toques no mesmo suporte e depois um rompimento acima da resistência entre eles, com o plano invertido (compra, stop loss abaixo dos fundos).'),
    plan=[t('<b>Intrare:</b> sell după închiderea sub suportul format de minime.', '<b>Entry:</b> sell after a close below the support formed by the lows.', '<b>Entrada:</b> venta tras el cierre bajo el soporte formado por los mínimos.', '<b>Entrada:</b> venda após o fechamento abaixo do suporte formado pelos fundos.'),
          t('<b>Stop loss:</b> deasupra celor trei vârfuri (sau deasupra ultimului vârf, dacă e mai jos).', '<b>Stop loss:</b> above the three peaks (or above the last peak, if it is lower).', '<b>Stop loss:</b> por encima de los tres picos (o del último pico, si es más bajo).', '<b>Stop loss:</b> acima dos três topos (ou acima do último topo, se for mais baixo).'),
          t('<b>Take profit:</b> mișcarea măsurată H extinsă (spre 1,5–2×H sau până la următorul nivel de structură), astfel încât ținta să fie la cel puțin 2R.', '<b>Take profit:</b> the measured move H extended (towards 1.5–2×H or to the next structure level), so that the target is at least 2R.', '<b>Take profit:</b> el movimiento medido H extendido (hacia 1,5–2×H o hasta el siguiente nivel de estructura), de modo que el objetivo esté al menos a 2R.', '<b>Take profit:</b> o movimento medido H estendido (até 1,5–2×H ou até o próximo nível de estrutura), de modo que o alvo fique a pelo menos 2R.')],
    mistakes=[t('Confunzi un range (dreptunghi) care continuă cu un triplu vârf: fără spargerea suportului nu există pattern.', 'Mistaking an ongoing range (rectangle) for a triple top: without a break of support there is no pattern.', 'Confundir un rango (rectángulo) que continúa con un triple techo: sin ruptura del soporte no hay figura.', 'Confundir um range (retângulo) que continua com um topo triplo: sem rompimento do suporte não há padrão.')]))

# 06 Steag
FLAG = (24, [(62, 5), (55, 2), (60, 2), (53, 2), (58, 2), (51, 2), (60, 2), (96, 8)])
s, _ = chart(*FLAG, t('Steag cu plan: catarg abrupt, canal mic înclinat în jos, intrare la spargerea canalului, stop loss sub steag, take profit egal cu lungimea catargului.',
    'Flag with a plan: steep pole, small channel sloping down, entry on the channel breakout, stop loss below the flag, take profit equal to the pole length.',
    'Bandera con plan: mástil abrupto, canal pequeño inclinado hacia abajo, entrada en la ruptura del canal, stop loss bajo la bandera, take profit igual a la longitud del mástil.',
    'Bandeira com plano: mastro íngreme, pequeno canal inclinado para baixo, entrada no rompimento do canal, stop loss abaixo da bandeira, take profit igual ao comprimento do mastro.'),
    lambda w: [(w[1], 62, w[5], 58, ''), (w[2], 55, w[6], 51, '')], dict(after=6, entry=59, sl=48, tp=95), lambda w, i: [(w[0] + 1, 25, w[0] + 1, 61), (i + 1, 59, i + 1, 94)], True)
P.append(dict(id='steag', title='Steag', svg=s, existing=True,
    intro='Steagul (Flag) începe cu o mișcare scurtă și abruptă, numită impuls sau catarg. După ea, prețul se liniștește într-un canal mic, de obicei înclinat contra impulsului: acesta este steagul, cu două margini aproape paralele. Pe desen, spargerea iese din canal în direcția impulsului. Canalul poate să nu se confirme; imaginea arată doar forma.',
    plan=[t('<b>Intrare:</b> în direcția impulsului, după închiderea în afara canalului.', '<b>Entry:</b> in the direction of the impulse, after a close outside the channel.', '<b>Entrada:</b> en la dirección del impulso, tras el cierre fuera del canal.', '<b>Entrada:</b> na direção do impulso, após o fechamento fora do canal.'),
          t('<b>Stop loss:</b> dincolo de capătul opus al steagului (sub ultimul minim, la un steag bullish).', '<b>Stop loss:</b> beyond the opposite end of the flag (below the last low, for a bullish flag).', '<b>Stop loss:</b> más allá del extremo opuesto de la bandera (bajo el último mínimo, en una bandera alcista).', '<b>Stop loss:</b> além da extremidade oposta da bandeira (abaixo do último fundo, numa bandeira de alta).'),
          t('<b>Take profit:</b> lungimea catargului (H), proiectată din punctul de spargere.', '<b>Take profit:</b> the pole length (H), projected from the breakout point.', '<b>Take profit:</b> la longitud del mástil (H), proyectada desde el punto de ruptura.', '<b>Take profit:</b> o comprimento do mastro (H), projetado a partir do ponto de rompimento.')],
    mistakes=[t('Corecția e prea adâncă (retrage mare parte din catarg): nu mai e un steag.', 'The pullback is too deep (it retraces most of the pole): it is no longer a flag.', 'La corrección es demasiado profunda (retrocede gran parte del mástil): ya no es una bandera.', 'A correção é profunda demais (devolve grande parte do mastro): já não é uma bandeira.'),
              t('Cumperi în interiorul canalului, înainte de spargere.', 'Buying inside the channel, before the breakout.', 'Comprar dentro del canal, antes de la ruptura.', 'Comprar dentro do canal, antes do rompimento.')]))

# 07 Pană
WEDGE = (20, [(46, 4), (32, 3), (54, 3), (41, 3), (59, 3), (48, 2), (55, 2), (11, 9)])
s, _ = chart(*WEDGE, t('Pană ascendentă cu plan: două linii urcătoare care se strâng, intrare la spargerea liniei de jos, stop loss deasupra ultimului vârf, take profit egal cu înălțimea de la începutul penei.',
    'Rising wedge with a plan: two rising lines that converge, entry on the break of the lower line, stop loss above the last peak, take profit equal to the height at the start of the wedge.',
    'Cuña ascendente con plan: dos líneas alcistas que convergen, entrada en la ruptura de la línea inferior, stop loss sobre el último pico, take profit igual a la altura al inicio de la cuña.',
    'Cunha ascendente com plano: duas linhas de alta que convergem, entrada no rompimento da linha inferior, stop loss acima do último topo, take profit igual à altura no início da cunha.'),
    lambda w: [(w[1], 46, w[5], 59, ''), (w[0], 20, w[6], 48, '')], dict(after=7, entry=45, sl=61, tp=13), lambda w, i: [(w[1], 21, w[1], 45), (i + 1, 45, i + 1, 21)], False)
P.append(dict(id='pana', title=t('Pană (wedge)', 'Wedge', 'Cuña (wedge)', 'Cunha (wedge)'), svg=s,
    intro=t('Pana are două linii înclinate în aceeași direcție care se strâng. Pana ascendentă (rising wedge) urcă tot mai greu: minimele cresc mai repede decât vârfurile, iar spargerea clasică este în jos. Pana descendentă (falling wedge) este oglinda ei: coboară tot mai încet și se urmărește spargerea în sus.',
        'A wedge has two lines sloping in the same direction that converge. The rising wedge climbs with more and more difficulty: the lows rise faster than the peaks, and the classic breakout is down. The falling wedge is its mirror image: it falls more and more slowly and you watch for a breakout up.',
        'La cuña tiene dos líneas inclinadas en la misma dirección que convergen. La cuña ascendente (rising wedge) sube cada vez con más dificultad: los mínimos suben más rápido que los máximos, y la ruptura clásica es hacia abajo. La cuña descendente (falling wedge) es su reflejo: baja cada vez más despacio y se vigila la ruptura hacia arriba.',
        'A cunha tem duas linhas inclinadas na mesma direção que convergem. A cunha ascendente (rising wedge) sobe com cada vez mais dificuldade: os fundos sobem mais rápido que os topos, e o rompimento clássico é para baixo. A cunha descendente (falling wedge) é o espelho: cai cada vez mais devagar e observa-se o rompimento para cima.'),
    plan=[t('<b>Intrare:</b> sell după închiderea sub linia de jos (la pana descendentă: buy peste linia de sus).', '<b>Entry:</b> sell after a close below the lower line (for a falling wedge: buy above the upper line).', '<b>Entrada:</b> venta tras el cierre bajo la línea inferior (en la cuña descendente: compra sobre la línea superior).', '<b>Entrada:</b> venda após o fechamento abaixo da linha inferior (na cunha descendente: compra acima da linha superior).'),
          t('<b>Stop loss:</b> deasupra ultimului vârf din pană.', '<b>Stop loss:</b> above the last peak inside the wedge.', '<b>Stop loss:</b> por encima del último pico de la cuña.', '<b>Stop loss:</b> acima do último topo dentro da cunha.'),
          t('<b>Take profit:</b> mișcarea măsurată H extinsă (spre 1,5–2×H sau până la următorul nivel de structură), astfel încât ținta să fie la cel puțin 2R.', '<b>Take profit:</b> the measured move H extended (towards 1.5–2×H or to the next structure level), so that the target is at least 2R.', '<b>Take profit:</b> el movimiento medido H extendido (hacia 1,5–2×H o hasta el siguiente nivel de estructura), de modo que el objetivo esté al menos a 2R.', '<b>Take profit:</b> o movimento medido H estendido (até 1,5–2×H ou até o próximo nível de estrutura), de modo que o alvo fique a pelo menos 2R.')],
    mistakes=[t('Confunzi pana cu un canal paralel: la pană liniile trebuie să se apropie vizibil.', 'Confusing the wedge with a parallel channel: in a wedge the lines must clearly converge.', 'Confundir la cuña con un canal paralelo: en la cuña las líneas deben acercarse visiblemente.', 'Confundir a cunha com um canal paralelo: na cunha as linhas devem se aproximar visivelmente.'),
              t('Te grăbești să vinzi doar pentru că urcarea „pare obosită”, fără spargere.', 'Rushing to sell just because the rise \u201clooks tired\u201d, without a breakout.', 'Apresurarse a vender solo porque la subida „parece cansada”, sin ruptura.', 'Apressar-se a vender só porque a alta „parece cansada”, sem rompimento.')]))

# 08 Triunghi
TRI = (35, [(70, 4), (40, 3), (65, 3), (45, 3), (61, 2), (49, 2), (57, 2), (90, 8)])
s, _ = chart(*TRI, t('Triunghi simetric cu plan: intrare la spargerea liniei de sus, stop loss sub ultimul minim, take profit egal cu partea cea mai largă a triunghiului.',
    'Symmetrical triangle with a plan: entry on the break of the upper line, stop loss below the last low, take profit equal to the widest part of the triangle.',
    'Triángulo simétrico con plan: entrada en la ruptura de la línea superior, stop loss bajo el último mínimo, take profit igual a la parte más ancha del triángulo.',
    'Triângulo simétrico com plano: entrada no rompimento da linha superior, stop loss abaixo do último fundo, take profit igual à parte mais larga do triângulo.'),
    lambda w: [(w[1], 70, w[7], 56, ''), (w[2], 40, w[7], 52, '')], dict(after=7, entry=59, sl=47, tp=89), lambda w, i: [(w[1], 41, w[1], 69), (i + 1, 59, i + 1, 88)], True)
P.append(dict(id='triunghi', title='Triunghi', svg=s, existing=True,
    intro='Triunghiul simetric (Triangle) se desenează când vârfurile sunt din ce în ce mai joase, iar minimele din ce în ce mai înalte, până când cele două linii se apropie. Prețul se mișcă într-un spațiu tot mai îngust. Marchezi linia de sus ca rezistență și linia de jos ca suport și observi pe unde iese prețul. Mai există triunghi ascendent și descendent; niciunul nu spune singur direcția de după.',
    plan=[t('<b>Intrare:</b> în direcția spargerii, după închiderea în afara triunghiului.', '<b>Entry:</b> in the direction of the breakout, after a close outside the triangle.', '<b>Entrada:</b> en la dirección de la ruptura, tras el cierre fuera del triángulo.', '<b>Entrada:</b> na direção do rompimento, após o fechamento fora do triângulo.'),
          t('<b>Stop loss:</b> dincolo de ultimul vârf sau minim din interiorul triunghiului.', '<b>Stop loss:</b> beyond the last peak or low inside the triangle.', '<b>Stop loss:</b> más allá del último máximo o mínimo dentro del triángulo.', '<b>Stop loss:</b> além do último topo ou fundo dentro do triângulo.'),
          t('<b>Take profit:</b> partea cea mai largă a triunghiului (H), proiectată din punctul de spargere.', '<b>Take profit:</b> the widest part of the triangle (H), projected from the breakout point.', '<b>Take profit:</b> la parte más ancha del triángulo (H), proyectada desde el punto de ruptura.', '<b>Take profit:</b> a parte mais larga do triângulo (H), projetada a partir do ponto de rompimento.')],
    mistakes=[t('Ghicești direcția înainte de spargere.', 'Guessing the direction before the breakout.', 'Adivinar la dirección antes de la ruptura.', 'Adivinhar a direção antes do rompimento.'),
              t('Intri la o spargere foarte aproape de vârful triunghiului, unde forma și-a pierdut, de obicei, sensul.', 'Entering on a breakout very close to the apex, where the shape has usually lost its meaning.', 'Entrar en una ruptura muy cerca del vértice, donde la figura suele haber perdido su sentido.', 'Entrar num rompimento muito perto do vértice, onde a forma geralmente perdeu o sentido.')]))

# 09 Dreptunghi
RNG = (30, [(65, 4), (45, 3), (65, 3), (45, 3), (65, 3), (45, 3), (63, 3), (95, 8)])
s, _ = chart(*RNG, t('Dreptunghi (range) cu plan: preț între suport și rezistență orizontale, intrare la spargerea rezistenței, stop loss în interiorul range-ului, take profit egal cu înălțimea range-ului.',
    'Rectangle (range) with a plan: price between horizontal support and resistance, entry on the resistance break, stop loss inside the range, take profit equal to the range height.',
    'Rectángulo (rango) con plan: precio entre soporte y resistencia horizontales, entrada en la ruptura de la resistencia, stop loss dentro del rango, take profit igual a la altura del rango.',
    'Retângulo (range) com plano: preço entre suporte e resistência horizontais, entrada no rompimento da resistência, stop loss dentro do range, take profit igual à altura do range.'),
    lambda w: [(w[1], 65, w[7], 65, T_RES), (w[2], 45, w[6], 45, T_SUP)], dict(after=7, entry=67, sl=54, tp=93), lambda w, i: [(w[4], 46, w[4], 64), (i + 1, 67, i + 1, 86)], True)
P.append(dict(id='dreptunghi', title=t('Dreptunghi (range)', 'Rectangle (range)', 'Rectángulo (rango)', 'Retângulo (range)'), svg=s,
    intro=t('În dreptunghi prețul oscilează între un suport și o rezistență aproape orizontale, fără direcție clară. Poți trata zona în două feluri: aștepți spargerea unei margini sau, cât timp range-ul ține, cauți reacții la margini. Ambele variante au nevoie de stop loss dincolo de marginea folosită.',
        'In a rectangle the price oscillates between an almost horizontal support and resistance, with no clear direction. You can treat the zone in two ways: wait for one edge to break or, while the range holds, look for reactions at the edges. Both options need a stop loss beyond the edge you use.',
        'En el rectángulo el precio oscila entre un soporte y una resistencia casi horizontales, sin dirección clara. Puedes tratar la zona de dos maneras: esperar la ruptura de un borde o, mientras el rango se mantenga, buscar reacciones en los bordes. Ambas opciones necesitan un stop loss más allá del borde utilizado.',
        'No retângulo o preço oscila entre um suporte e uma resistência quase horizontais, sem direção clara. Você pode tratar a zona de duas formas: esperar o rompimento de uma borda ou, enquanto o range se mantiver, procurar reações nas bordas. As duas opções precisam de stop loss além da borda usada.'),
    plan=[t('<b>Intrare:</b> după închiderea peste rezistență (buy) sau sub suport (sell).', '<b>Entry:</b> after a close above resistance (buy) or below support (sell).', '<b>Entrada:</b> tras el cierre por encima de la resistencia (compra) o por debajo del soporte (venta).', '<b>Entrada:</b> após o fechamento acima da resistência (compra) ou abaixo do suporte (venda).'),
          t('<b>Stop loss:</b> înapoi în interiorul range-ului, de obicei în jurul mijlocului lui.', '<b>Stop loss:</b> back inside the range, usually around its middle.', '<b>Stop loss:</b> de vuelta dentro del rango, normalmente cerca de su mitad.', '<b>Stop loss:</b> de volta dentro do range, normalmente perto do meio dele.'),
          t('<b>Take profit:</b> mișcarea măsurată H extinsă (spre 1,5–2×H sau până la următorul nivel de structură), astfel încât ținta să fie la cel puțin 2R.', '<b>Take profit:</b> the measured move H extended (towards 1.5–2×H or to the next structure level), so that the target is at least 2R.', '<b>Take profit:</b> el movimiento medido H extendido (hacia 1,5–2×H o hasta el siguiente nivel de estructura), de modo que el objetivo esté al menos a 2R.', '<b>Take profit:</b> o movimento medido H estendido (até 1,5–2×H ou até o próximo nível de estrutura), de modo que o alvo fique a pelo menos 2R.')],
    mistakes=[t('Intri la prima atingere a marginii, care se dovedește doar o spargere falsă (fakeout).', 'Entering on the first poke through the edge, which turns out to be just a false breakout (fakeout).', 'Entrar en el primer toque del borde, que resulta ser solo una ruptura falsa (fakeout).', 'Entrar no primeiro toque da borda, que acaba sendo só um rompimento falso (fakeout).'),
              t('Tranzacționezi mijlocul range-ului, unde riscul și ținta sunt prost așezate.', 'Trading the middle of the range, where risk and target are poorly placed.', 'Operar en mitad del rango, donde el riesgo y el objetivo quedan mal situados.', 'Operar no meio do range, onde risco e alvo ficam mal posicionados.')]))

# 10 Cup & Handle
CUP = (52, [(70, 3), (58, 2), (48, 2), (42, 2), (40, 1), (42, 1), (48, 2), (58, 2), (70, 2), (63, 2), (66, 1), (62, 1), (74, 2), (100, 6)])
s, _ = chart(*CUP, t('Cup and handle cu plan: o cupă rotunjită, un mâner mic, intrare peste marginea cupei, stop loss sub mâner, take profit egal cu adâncimea cupei.',
    'Cup and handle with a plan: a rounded cup, a small handle, entry above the cup rim, stop loss below the handle, take profit equal to the cup depth.',
    'Taza con asa con plan: una taza redondeada, un asa pequeña, entrada sobre el borde de la taza, stop loss bajo el asa, take profit igual a la profundidad de la taza.',
    'Xícara com alça com plano: uma xícara arredondada, uma pequena alça, entrada acima da borda da xícara, stop loss abaixo da alça, take profit igual à profundidade da xícara.'),
    lambda w: [(w[1], 70, w[12], 70, t('marginea cupei', 'cup rim', 'borde de la taza', 'borda da xícara'))], dict(after=12, entry=72, sl=59, tp=100), lambda w, i: [(w[5], 69, w[5], 41), (i + 1, 72, i + 1, 99)], True)
P.append(dict(id='cup-handle', title=t('Cup &amp; Handle','Cup &amp; Handle','Cup &amp; Handle','Cup &amp; Handle'), svg=s,
    intro=t('Cup and handle (cupa cu mâner) apare de obicei într-o tendință de creștere: prețul coboară lin și revine în formă de „U” la nivelul de pornire, apoi face o mică retragere — mânerul. Cupa trebuie să fie rotunjită, nu în „V”, iar mânerul să fie mic față de cupă.',
        'Cup and handle usually appears in an uptrend: the price falls smoothly and returns in a \u201cU\u201d shape to the starting level, then makes a small pullback, the handle. The cup should be rounded, not a \u201cV\u201d, and the handle should be small compared with the cup.',
        'La taza con asa (cup and handle) suele aparecer en una tendencia alcista: el precio baja suavemente y vuelve en forma de „U” al nivel de partida, y luego hace un pequeño retroceso: el asa. La taza debe ser redondeada, no en „V”, y el asa pequeña en comparación con la taza.',
        'A xícara com alça (cup and handle) costuma aparecer numa tendência de alta: o preço cai suavemente e volta em forma de „U” ao nível de partida, depois faz um pequeno recuo, a alça. A xícara deve ser arredondada, não em „V”, e a alça deve ser pequena em relação à xícara.'),
    plan=[t('<b>Intrare:</b> buy după închiderea peste marginea cupei (vârful mânerului).', '<b>Entry:</b> buy after a close above the cup rim (the top of the handle).', '<b>Entrada:</b> compra tras el cierre sobre el borde de la taza (el máximo del asa).', '<b>Entrada:</b> compra após o fechamento acima da borda da xícara (o topo da alça).'),
          t('<b>Stop loss:</b> sub minimul mânerului.', '<b>Stop loss:</b> below the low of the handle.', '<b>Stop loss:</b> por debajo del mínimo del asa.', '<b>Stop loss:</b> abaixo do fundo da alça.'),
          t('<b>Take profit:</b> adâncimea H a cupei, proiectată în sus din marginea ei.', '<b>Take profit:</b> the cup depth H, projected up from its rim.', '<b>Take profit:</b> la profundidad H de la taza, proyectada hacia arriba desde su borde.', '<b>Take profit:</b> a profundidade H da xícara, projetada para cima a partir da borda.')],
    mistakes=[t('Mânerul coboară prea adânc (aproape de jumătatea cupei): forma își pierde sensul.', 'The handle drops too deep (close to the middle of the cup): the shape loses its meaning.', 'El asa baja demasiado (cerca de la mitad de la taza): la figura pierde su sentido.', 'A alça desce demais (perto do meio da xícara): a forma perde o sentido.')]))

# ---- lumânări
def cpl(cs, aria, entry, sl, tp, i, lines=()):
    return svg(cs, aria, lines, dict(i=i, entry=entry, sl=sl, tp=tp, tplab='TP (2R)'))

ENG = [(80, 82, 74, 75), (75, 77, 69, 70), (70, 72, 63, 64), (64, 66, 57, 58), (58, 60, 51, 52), (52, 54, 45, 46), (45, 46.5, 40.5, 42), (40.5, 52.5, 39, 52), (52, 57, 50.5, 56), (56, 62, 54.5, 61), (61, 67, 59.5, 66), (66, 73, 64.5, 72), (72, 79, 70.5, 78), (78, 85, 76.5, 84)]
s = cpl(ENG, t('Engulfing bullish cu plan: o lumânare verde mare acoperă complet corpul lumânării roșii de dinainte; intrare peste maximul ei, stop loss sub minimul ei, take profit la 2R.',
    'Bullish engulfing with a plan: a large green candle fully covers the body of the red candle before it; entry above its high, stop loss below its low, take profit at 2R.',
    'Envolvente alcista con plan: una vela verde grande cubre por completo el cuerpo de la vela roja anterior; entrada sobre su máximo, stop loss bajo su mínimo, take profit a 2R.',
    'Engolfo de alta com plano: uma grande vela verde cobre totalmente o corpo da vela vermelha anterior; entrada acima da máxima dela, stop loss abaixo da mínima dela, take profit em 2R.'),
    53.5, 37.5, 85.5, 8)
CANDLE_TP = t('<b>Take profit:</b> la următoarea rezistență, dar doar dacă oferă cel puțin 2R (de două ori distanța până la stop loss).', '<b>Take profit:</b> at the next resistance, but only if it offers at least 2R (twice the distance to the stop loss).', '<b>Take profit:</b> en la siguiente resistencia, pero solo si ofrece al menos 2R (el doble de la distancia hasta el stop loss).', '<b>Take profit:</b> na próxima resistência, mas só se oferecer pelo menos 2R (o dobro da distância até o stop loss).')
C = []
C.append(dict(id='engulfing', title=t('Engulfing','Engulfing','Engulfing','Engulfing'), svg=s,
    intro=t('O lumânare „înghite” complet corpul lumânării anterioare, în sens opus. Engulfing-ul bullish (verde după roșu) contează mai ales la un suport, după o scădere; cel bearish (roșu după verde) la o rezistență, după o urcare. Nu are o țintă „măsurată” ca formele mari, așa că ținta se pune după structură și raportul risc/câștig.',
        'One candle fully \u201cswallows\u201d the body of the previous candle, in the opposite direction. A bullish engulfing (green after red) matters mostly at support, after a decline; a bearish one (red after green) at resistance, after a rise. It has no \u201cmeasured\u201d target like the larger patterns, so the target is set by structure and the risk/reward ratio.',
        'Una vela „se traga” por completo el cuerpo de la vela anterior, en sentido contrario. La envolvente alcista (verde tras roja) importa sobre todo en un soporte, tras una caída; la bajista (roja tras verde) en una resistencia, tras una subida. No tiene un objetivo „medido” como las figuras grandes, así que el objetivo se fija según la estructura y la relación riesgo/beneficio.',
        'Uma vela „engole” totalmente o corpo da vela anterior, em sentido oposto. O engolfo de alta (verde depois de vermelha) importa sobretudo num suporte, após uma queda; o de baixa (vermelha depois de verde) numa resistência, após uma alta. Não tem um alvo „medido” como os padrões grandes, por isso o alvo é definido pela estrutura e pela relação risco/retorno.'),
    plan=[t('<b>Intrare:</b> buy peste maximul lumânării engulfing (sau la închiderea ei).', '<b>Entry:</b> buy above the high of the engulfing candle (or at its close).', '<b>Entrada:</b> compra sobre el máximo de la vela envolvente (o a su cierre).', '<b>Entrada:</b> compra acima da máxima da vela de engolfo (ou no fechamento dela).'),
          t('<b>Stop loss:</b> sub minimul lumânării engulfing.', '<b>Stop loss:</b> below the low of the engulfing candle.', '<b>Stop loss:</b> por debajo del mínimo de la vela envolvente.', '<b>Stop loss:</b> abaixo da mínima da vela de engolfo.'), CANDLE_TP],
    mistakes=[t('Iei orice engulfing din mijlocul graficului, departe de un suport sau o rezistență.', 'Taking any engulfing in the middle of the chart, far from support or resistance.', 'Tomar cualquier envolvente en mitad del gráfico, lejos de un soporte o una resistencia.', 'Pegar qualquer engolfo no meio do gráfico, longe de um suporte ou de uma resistência.'),
              t('Lumânarea e atât de mare încât stop loss-ul nu mai încape în riscul tău pe tranzacție.', 'The candle is so large that the stop loss no longer fits your risk per trade.', 'La vela es tan grande que el stop loss ya no cabe en tu riesgo por operación.', 'A vela é tão grande que o stop loss já não cabe no seu risco por operação.')]))

PIN = [(80, 82, 74, 75), (75, 77, 69, 70), (70, 72, 64, 65), (65, 67, 59, 60), (60, 62, 55, 56), (56, 59.5, 45, 58.5), (58.5, 63, 57, 62), (62, 67, 60.5, 66), (66, 71, 64.5, 70), (70, 76, 68.5, 75), (75, 81, 73.5, 80), (80, 87, 78.5, 86), (86, 92, 84.5, 91)]
s = cpl(PIN, t('Pin bar bullish cu plan: lumânare cu fitil lung în jos care respinge un suport; intrare peste maximul ei, stop loss sub fitil, take profit la 2R.',
    'Bullish pin bar with a plan: a candle with a long lower wick rejecting support; entry above its high, stop loss below the wick, take profit at 2R.',
    'Pin bar alcista con plan: vela con mecha inferior larga que rechaza un soporte; entrada sobre su máximo, stop loss bajo la mecha, take profit a 2R.',
    'Pin bar de alta com plano: vela com pavio inferior longo que rejeita um suporte; entrada acima da máxima dela, stop loss abaixo do pavio, take profit em 2R.'),
    60.5, 43.5, 94.5, 6, lines=[(0, 46, 12, 46, T_SUP)])
C.append(dict(id='pin-bar', title=t('Pin bar','Pin bar','Pin bar','Pin bar'), svg=s,
    intro=t('Pin bar-ul are corp mic și un fitil lung (cel puțin de două-trei ori corpul) care arată că prețul a fost respins dintr-o zonă. Un fitil lung în jos la un suport sugerează respingerea vânzătorilor; un fitil lung în sus la o rezistență, respingerea cumpărătorilor.',
        'A pin bar has a small body and a long wick (at least two to three times the body) showing that the price was rejected from a zone. A long lower wick at support suggests sellers were rejected; a long upper wick at resistance, that buyers were rejected.',
        'El pin bar tiene un cuerpo pequeño y una mecha larga (al menos dos o tres veces el cuerpo) que muestra que el precio fue rechazado desde una zona. Una mecha larga hacia abajo en un soporte sugiere el rechazo de los vendedores; una mecha larga hacia arriba en una resistencia, el de los compradores.',
        'O pin bar tem corpo pequeno e um pavio longo (pelo menos duas a três vezes o corpo) que mostra que o preço foi rejeitado de uma zona. Um pavio longo para baixo num suporte sugere a rejeição dos vendedores; um pavio longo para cima numa resistência, a dos compradores.'),
    plan=[t('<b>Intrare:</b> buy peste maximul pin bar-ului (sau la o retragere de 50% din fitil).', '<b>Entry:</b> buy above the pin bar high (or on a 50% pullback into the wick).', '<b>Entrada:</b> compra sobre el máximo del pin bar (o en un retroceso del 50% de la mecha).', '<b>Entrada:</b> compra acima da máxima do pin bar (ou num recuo de 50% do pavio).'),
          t('<b>Stop loss:</b> câțiva pips sub vârful fitilului.', '<b>Stop loss:</b> a few pips below the tip of the wick.', '<b>Stop loss:</b> unos pips por debajo de la punta de la mecha.', '<b>Stop loss:</b> alguns pips abaixo da ponta do pavio.'), CANDLE_TP],
    mistakes=[t('Tranzacționezi un pin bar împotriva unei tendințe puternice, fără niciun nivel în spate.', 'Trading a pin bar against a strong trend, with no level behind it.', 'Operar un pin bar contra una tendencia fuerte, sin ningún nivel detrás.', 'Operar um pin bar contra uma tendência forte, sem nenhum nível por trás.')]))

INS = [(15, 21, 13, 20), (20, 26, 18, 25), (25, 31, 23, 30), (30, 36, 28, 35), (35, 51, 33, 49), (47, 48.5, 40, 42), (43, 57, 42, 56), (56, 63, 54.5, 62), (62, 70, 60.5, 69), (69, 77, 67.5, 76), (76, 84, 74.5, 83), (83, 91, 81.5, 90)]
s = cpl(INS, t('Inside bar cu plan: o lumânare mică aflată complet în interiorul lumânării mari de dinainte; intrare la spargerea maximului lumânării mari, stop loss sub minimul ei, take profit la 2R.',
    'Inside bar with a plan: a small candle completely inside the large candle before it; entry on the break of the large candle high, stop loss below its low, take profit at 2R.',
    'Inside bar con plan: una vela pequeña completamente dentro de la vela grande anterior; entrada en la ruptura del máximo de la vela grande, stop loss bajo su mínimo, take profit a 2R.',
    'Inside bar com plano: uma vela pequena completamente dentro da vela grande anterior; entrada no rompimento da máxima da vela grande, stop loss abaixo da mínima dela, take profit em 2R.'),
    52, 32, 92, 6, lines=[(4, 51, 6, 51, ''), (4, 33, 6, 33, '')])
C.append(dict(id='inside-bar', title=t('Inside bar','Inside bar','Inside bar','Inside bar'), svg=s,
    intro=t('Inside bar-ul este o lumânare al cărei maxim și minim stau în interiorul lumânării anterioare (lumânarea-mamă). Arată o pauză, o comprimare înaintea unei mișcări. Cel mai des este folosit în direcția tendinței, după un impuls.',
        'An inside bar is a candle whose high and low sit inside the previous candle (the mother candle). It shows a pause, a compression before a move. It is most often used in the direction of the trend, after an impulse.',
        'El inside bar es una vela cuyo máximo y mínimo quedan dentro de la vela anterior (la vela madre). Muestra una pausa, una compresión antes de un movimiento. Se usa sobre todo en la dirección de la tendencia, tras un impulso.',
        'O inside bar é uma vela cuja máxima e mínima ficam dentro da vela anterior (a vela-mãe). Mostra uma pausa, uma compressão antes de um movimento. É usado sobretudo na direção da tendência, após um impulso.'),
    plan=[t('<b>Intrare:</b> la spargerea maximului lumânării-mamă (sau a minimului, într-o tendință de scădere).', '<b>Entry:</b> on the break of the mother candle high (or its low, in a downtrend).', '<b>Entrada:</b> en la ruptura del máximo de la vela madre (o de su mínimo, en tendencia bajista).', '<b>Entrada:</b> no rompimento da máxima da vela-mãe (ou da mínima, numa tendência de baixa).'),
          t('<b>Stop loss:</b> sub minimul lumânării-mamă (variantă mai strânsă: la jumătatea ei).', '<b>Stop loss:</b> below the mother candle low (tighter option: at its midpoint).', '<b>Stop loss:</b> por debajo del mínimo de la vela madre (opción más ajustada: en su mitad).', '<b>Stop loss:</b> abaixo da mínima da vela-mãe (opção mais apertada: no meio dela).'), CANDLE_TP],
    mistakes=[t('Iei fiecare inside bar dintr-o piață laterală, unde spargerile false sunt dese.', 'Taking every inside bar in a sideways market, where false breakouts are frequent.', 'Tomar cada inside bar en un mercado lateral, donde las rupturas falsas son frecuentes.', 'Pegar todo inside bar num mercado lateral, onde rompimentos falsos são frequentes.')]))

# ------------------------------------------------------------------ quiz
OPTS = {'hs': 'Cap și umeri', 'ihs': 'Cap și umeri inversat', 'dt': 'Dublu vârf', 'db': 'Dublu minim', 'flag': 'Steag', 'tri': 'Triunghi',
        'wedge': 'Pană (wedge)', 'rng': 'Dreptunghi (range)', 'cup': 'Cup &amp; Handle', 'tt': 'Triplu vârf / triplu minim', 'pin': 'Pin bar', 'eng': 'Engulfing', 'ins': 'Inside bar'}
QA = t('Pattern de ghicit în quiz', 'Pattern to guess in the quiz', 'Figura para adivinar en el quiz', 'Padrão para adivinhar no quiz')
Q = [
    (quiz_svg(30, [(78, 5), (55, 4), (78, 4), (55, 4), (36, 5)], QA, lambda w: [(w[2], 55, w[4], 55, '')]), 'dt', ['tt', 'dt', 'hs'],
     t('Două vârfuri la același nivel, apoi spargere sub minimul dintre ele.', 'Two peaks at the same level, then a break below the low between them.', 'Dos picos al mismo nivel y después una ruptura bajo el mínimo entre ellos.', 'Dois topos no mesmo nível e depois um rompimento abaixo do fundo entre eles.')),
    (quiz_svg(*IHS, QA, lambda w: [(w[2], 52, w[6], 52, '')]), 'ihs', ['db', 'ihs', 'cup'],
     t('Trei minime, cel din mijloc cel mai adânc, apoi ieșire peste linia de gât.', 'Three lows, the middle one the deepest, then a break above the neckline.', 'Tres mínimos, el del medio el más profundo, y luego ruptura sobre la línea de cuello.', 'Três fundos, o do meio o mais profundo, e depois rompimento acima da linha de pescoço.')),
    (quiz_svg(*FLAG, QA, lambda w: [(w[1], 62, w[5], 58, ''), (w[2], 55, w[6], 51, '')]), 'flag', ['tri', 'rng', 'flag'],
     t('Impuls abrupt (catarg), apoi un canal mic înclinat contra lui și continuare.', 'A steep impulse (pole), then a small channel sloping against it and continuation.', 'Impulso abrupto (mástil), luego un canal pequeño inclinado en su contra y continuación.', 'Impulso íngreme (mastro), depois um pequeno canal inclinado contra ele e continuação.')),
    (quiz_svg(*WEDGE, QA, lambda w: [(w[1], 46, w[5], 59, ''), (w[0], 20, w[6], 48, '')]), 'wedge', ['wedge', 'flag', 'tri'],
     t('Ambele linii urcă și se strâng: pană ascendentă, spartă în jos.', 'Both lines rise and converge: a rising wedge, broken to the downside.', 'Ambas líneas suben y convergen: cuña ascendente, rota hacia abajo.', 'As duas linhas sobem e convergem: cunha ascendente, rompida para baixo.')),
    (quiz_svg(*CUP, QA, lambda w: [(w[1], 70, w[12], 70, '')]), 'cup', ['db', 'cup', 'ihs'],
     t('Cupă rotunjită în „U”, mâner mic, apoi spargere peste margine.', 'A rounded \u201cU\u201d cup, a small handle, then a break above the rim.', 'Taza redondeada en „U”, asa pequeña y después ruptura sobre el borde.', 'Xícara arredondada em „U”, alça pequena e depois rompimento acima da borda.')),
    (svg(PIN, QA, [(0, 46, 12, 46, '')]), 'pin', ['eng', 'pin', 'ins'],
     t('Corp mic și fitil lung în jos la suport: respingere.', 'Small body and a long lower wick at support: rejection.', 'Cuerpo pequeño y mecha inferior larga en el soporte: rechazo.', 'Corpo pequeno e pavio inferior longo no suporte: rejeição.')),
]

# ------------------------------------------------------------------ HTML
def article(p, n):
    plan = ''.join('<li class="pp-%s">%s</li>' % (c, x) for c, x in zip(('entry', 'sl', 'tp'), p['plan']))
    mis = ''.join('<li>%s</li>' % x for x in p['mistakes'])
    return f'''
        <article class="pattern pattern-pro" id="{p['id']}">
          <figure>
            {p['svg']}
          </figure>
          <div>
            <span class="num">{n:02d}</span>
            <h3>{p['title']}</h3>
            <p>{p['intro']}</p>
            <h4 class="pat-sub">{t('Plan de tranzacționare', 'Trade plan', 'Plan de operación', 'Plano de operação')}</h4>
            <ul class="pat-plan">{plan}</ul>
            <div class="pat-mistakes">
              <h4>{t('Greșeli frecvente', 'Common mistakes', 'Errores frecuentes', 'Erros frequentes')}</h4>
              <ul>{mis}</ul>
            </div>
          </div>
        </article>'''

WHOP = 'https://whop.com/mariusfx1-github-io/ms-prime-vip/'
def build():
    arts = ''.join(article(p, i + 1) for i, p in enumerate(P))
    carts = ''.join(article(p, i + 1 + len(P)) for i, p in enumerate(C))
    qs = []
    for k, (sv, ans, opts, why) in enumerate(Q):
        btns = ''.join('<button type="button" class="pq-opt" data-ok="%s">%s</button>' % ('1' if o == ans else '0', OPTS[o]) for o in opts)
        qs.append(f'''
          <li class="pq-item">
            <div class="pq-q"><span class="num">{k + 1}/{len(Q)}</span><p>{t('Ce pattern e acesta?', 'Which pattern is this?', '¿Qué figura es esta?', 'Que padrão é este?')}</p></div>
            <div class="pq-fig">{sv}</div>
            <div class="pq-opts">{btns}</div>
            <p class="pq-fb pq-yes" hidden>{comp(('raw', '<b>'), t('Corect!', 'Correct!', '¡Correcto!', 'Correto!'), ('raw', '</b> '), why)}</p>
            <p class="pq-fb pq-no" hidden>{comp(('raw', '<b>'), t('Nu chiar.', 'Not quite.', 'No exactamente.', 'Não exatamente.'), ('raw', '</b> '), t('Răspunsul corect:', 'The correct answer:', 'La respuesta correcta:', 'A resposta correta:'), ('raw', ' <strong>'), OPTS[ans], ('raw', '</strong>. '), why)}</p>
          </li>''')
    return f'''<!-- patterns:start (generat de _tools/build_patterns.py; editează scriptul, nu blocul) -->
      <ul class="pat-legend" aria-label="{t('Legenda desenelor', 'Drawing legend', 'Leyenda de los dibujos', 'Legenda dos desenhos')}">
        <li class="pl-entry">{t('Intrare (entry)', 'Entry', 'Entrada', 'Entrada')}</li>
        <li class="pl-sl">{t('Stop loss (SL)', 'Stop loss (SL)', 'Stop loss (SL)', 'Stop loss (SL)')}</li>
        <li class="pl-tp">{t('Take profit (TP)', 'Take profit (TP)', 'Take profit (TP)', 'Take profit (TP)')}</li>
        <li class="pl-h">{t('H = înălțimea formei (mișcarea măsurată)', 'H = pattern height (measured move)', 'H = altura de la figura (movimiento medido)', 'H = altura do padrão (movimento medido)')}</li>
      </ul>
      <p class="pattern-note">{comp(t('Nivelurile din desene sunt didactice. Pe un grafic real le ajustezi după structură, spread și volatilitate și riști doar un procent mic din cont pe tranzacție.', 'The levels in the drawings are for teaching. On a real chart you adjust them to structure, spread and volatility, and you risk only a small percentage of your account per trade.', 'Los niveles de los dibujos son didácticos. En un gráfico real los ajustas según la estructura, el spread y la volatilidad, y arriesgas solo un pequeño porcentaje de la cuenta por operación.', 'Os níveis dos desenhos são didáticos. Num gráfico real você os ajusta à estrutura, ao spread e à volatilidade, e arrisca só uma pequena porcentagem da conta por operação.'), ('raw', ' <a href="calculator.html">'), t('Calculează lotul', 'Calculate the lot size', 'Calcula el lote', 'Calcule o lote'), ('raw', '</a>.'))}</p>

      <p class="pat-rule">{t('Intri doar dacă take profit-ul îți oferă cel puțin 2R (raport risc/câștig minim 1:2).', 'You only enter if the take profit gives you at least 2R (minimum risk/reward ratio of 1:2).', 'Solo entras si el take profit te ofrece al menos 2R (relación riesgo/beneficio mínima de 1:2).', 'Você só entra se o take profit lhe oferecer pelo menos 2R (relação risco/retorno mínima de 1:2).')}</p>

      <h2 class="pat-group">{t('Formații de grafic', 'Chart patterns', 'Figuras de gráfico', 'Padrões gráficos')}</h2>
      <div class="patterns">{arts}
      </div>

      <h2 class="pat-group" id="lumanari">{t('Formații de lumânări', 'Candlestick patterns', 'Patrones de velas', 'Padrões de velas')}</h2>
      <p class="section-sub">{t('Semnale formate din una-două lumânări. Contează doar la un nivel important (suport, rezistență, linie de trend), nu oriunde pe grafic.', 'Signals made of one or two candles. They only matter at an important level (support, resistance, trendline), not anywhere on the chart.', 'Señales formadas por una o dos velas. Solo importan en un nivel importante (soporte, resistencia, línea de tendencia), no en cualquier parte del gráfico.', 'Sinais formados por uma ou duas velas. Só importam num nível importante (suporte, resistência, linha de tendência), não em qualquer parte do gráfico.')}</p>
      <div class="patterns">{carts}
      </div>

      <!-- EXEMPLE REALE (placeholder, ascuns): Marius poate adăuga aici capturi proprii de grafic.
      <section class="pat-real" id="exemple-reale">
        <h2 class="pat-group">Exemple reale</h2>
        <figure><img src="images/exemplu-pattern-1.webp" alt="..." loading="lazy"><figcaption>...</figcaption></figure>
      </section>
      -->

      <section class="pat-quiz" id="quiz-patternuri" aria-labelledby="pq-title">
        <h2 class="pat-group" id="pq-title">{t('Quiz: ce pattern e acesta?', 'Quiz: which pattern is this?', 'Quiz: ¿qué figura es esta?', 'Quiz: que padrão é este?')}</h2>
        <p class="section-sub">{t('Alege răspunsul pentru fiecare desen. Afli imediat dacă ai nimerit.', 'Pick the answer for each drawing. You find out right away if you got it.', 'Elige la respuesta para cada dibujo. Sabrás al instante si acertaste.', 'Escolha a resposta para cada desenho. Você descobre na hora se acertou.')}</p>
        <ol class="pq-list">{''.join(qs)}
        </ol>
        <div class="pq-result" aria-live="polite">
          <p class="pq-score">{comp(t('Scor:', 'Score:', 'Puntuación:', 'Pontuação:'), ('raw', ' <b class="pq-n">0</b> / %d' % len(Q)))}</p>
          <button type="button" class="pq-reset">{t('Reia quiz-ul', 'Restart the quiz', 'Repetir el quiz', 'Refazer o quiz')}</button>
        </div>
      </section>

      <div class="pat-vip">
        <div class="vip-discord">
          <a class="vip-banner" href="{WHOP}" target="_blank" rel="noopener"><picture><source srcset="images/vip-banner.webp" type="image/webp"><img src="images/vip-banner.png" alt="Banner MS Prime VIP — grup privat de semnale pe Discord, acces cu abonament prin Whop" width="1200" height="675" loading="lazy" decoding="async"></picture></a>
          <div class="vip-discord-text"><p class="vip-discord-title">{t('Vrei să vezi patternurile aplicate în piață?', 'Want to see the patterns applied in the market?', '¿Quieres ver las figuras aplicadas en el mercado?', 'Quer ver os padrões aplicados no mercado?')}</p><p class="vip-discord-line">{comp(t('MS Prime VIP: grup privat de semnale pe Discord, acces cu abonament lunar.', 'MS Prime VIP: private signals group on Discord, monthly subscription access.', 'MS Prime VIP: grupo privado de señales en Discord, acceso con suscripción mensual.', 'MS Prime VIP: grupo privado de sinais no Discord, acesso com assinatura mensal.'), ('raw', ' <a href="vip.html">'), t('Vezi ce include VIP', 'See what VIP includes', 'Mira qué incluye el VIP', 'Veja o que o VIP inclui'), ('raw', '</a>'))}</p></div>
          <a class="vip-discord-btn" href="{WHOP}" target="_blank" rel="noopener">Cere acces</a>
        </div>
        <p class="vip-discord-disc">Semnalele nu sunt sfaturi de investiții. Tradingul implică riscuri.</p>
      </div>
      <!-- patterns:end -->'''

def main():
    path = os.path.join(ROOT, 'patternuri.html')
    src = open(path, encoding='utf-8').read()
    block = build()
    if '<!-- patterns:start' in src:
        src = re.sub(r'<!-- patterns:start.*?<!-- patterns:end -->', lambda m: block, src, flags=re.S)
    else:  # prima rulare: înlocuiește <div class="patterns">...</div> original
        src = re.sub(r'<div class="patterns">.*?</div>\n    </section>', lambda m: block + '\n    </section>', src, count=1, flags=re.S)
    if 'patterns.js' not in src:
        src = src.replace('<script src="script.js', '<script src="patterns.js?v=1" defer></script>\n  <script src="script.js')
    SUB_OLD = 'Cinci forme des întâlnite în educația forex. Fiecare desen arată cum se construiește patternul, ca să știi ce urmărești.'
    SUB = t('Zece formații de grafic și trei formații de lumânări des întâlnite în educația forex. Fiecare desen arată forma și un plan didactic: unde intri, unde pui stop loss-ul și unde iei profit.',
        'Ten chart patterns and three candlestick patterns common in forex education. Each drawing shows the shape and a teaching plan: where you enter, where you place the stop loss and where you take profit.',
        'Diez figuras de gráfico y tres patrones de velas habituales en la formación forex. Cada dibujo muestra la forma y un plan didáctico: dónde entras, dónde pones el stop loss y dónde tomas beneficios.',
        'Dez padrões gráficos e três padrões de velas comuns na educação forex. Cada desenho mostra a forma e um plano didático: onde você entra, onde coloca o stop loss e onde realiza o lucro.')
    src = src.replace(SUB_OLD, SUB)
    DESC_OLD = 'Patternuri de grafic Forex explicate simplu, cu desene: cap și umeri, dublu vârf, dublu minim, steag și triunghi. Cum se formează și ce urmărești pe grafic.'
    DESC = t('Patternuri de grafic Forex explicate simplu, cu desene și plan de tranzacționare (intrare, stop loss, take profit): cap și umeri, dublu vârf, pană, triunghi, cup and handle, engulfing, pin bar și quiz.',
        'Forex chart patterns explained simply, with drawings and a trade plan (entry, stop loss, take profit): head and shoulders, double top, wedge, triangle, cup and handle, engulfing, pin bar and a quiz.',
        'Figuras de gráfico Forex explicadas de forma sencilla, con dibujos y plan de operación (entrada, stop loss, take profit): hombro-cabeza-hombro, doble techo, cuña, triángulo, taza con asa, envolvente, pin bar y quiz.',
        'Padrões gráficos Forex explicados de forma simples, com desenhos e plano de operação (entrada, stop loss, take profit): ombro-cabeça-ombro, topo duplo, cunha, triângulo, xícara com alça, engolfo, pin bar e quiz.')
    src = src.replace(DESC_OLD, DESC)
    open(path, 'w', encoding='utf-8').write(src)
    for d in DICTS:
        for li, lang in enumerate(('en', 'es', 'pt')):
            f = os.path.join(d, lang, 'pages.json')
            if not os.path.exists(f): continue
            data = json.load(open(f, encoding='utf-8'))
            for ro, tr in TR.items(): data[ro] = tr[li]
            json.dump(data, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)
    print('RR:', [(p['id'], r) for p, r in zip(P + C, RRS)])
    print('patterns:', len(P), 'candles:', len(C), 'quiz:', len(Q), 'strings:', len(TR))

if __name__ == '__main__':
    main()
