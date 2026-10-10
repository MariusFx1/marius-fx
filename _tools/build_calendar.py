# Construiește calendar.html pornind de la sesiuni.html (head, antet, subsol identice cu restul site-ului).
import re, html
ROOT = '/workspace/forex-ms'
SITE = 'https://mariusfx1.github.io/marius-fx/'
src = open(f'{ROOT}/sesiuni.html', encoding='utf-8').read()

# Titlul și descrierea vin din seo_meta.py. După rulare, rulează și seo_update.py (H1, JSON-LD, OG).
import sys; sys.path.insert(0, '/workspace/forex-ms-tools')
from seo_meta import PAGES as SEO
TITLE = SEO['calendar']['title']
DESC = SEO['calendar']['desc']
URL = SITE + 'calendar.html'

head_end = src.index('</head>')
head = src[:head_end]
head = re.sub(r'<title>.*?</title>', f'<title>{TITLE}</title>', head)
head = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{html.escape(DESC, quote=True)}">', head)
head = head.replace(SITE + 'sesiuni.html', URL)
head = re.sub(r'(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*(">)', lambda m: m.group(1) + TITLE + m.group(2), head)
head = re.sub(r'(<meta (?:property="og:description"|name="twitter:description") content=")[^"]*(">)', lambda m: m.group(1) + html.escape(DESC, quote=True) + m.group(2), head)
head += '  <script>document.documentElement.classList.add(\'js\');</script>\n'

body = src[head_end:]
body = body.replace('<a href="sesiuni.html" aria-current="page">Sesiuni</a>', '<a href="sesiuni.html">Sesiuni</a>')
body = body.replace('<a href="calendar.html">Calendar</a>', '<a href="calendar.html" aria-current="page">Calendar</a>')
assert 'aria-current="page">Calendar' in body, 'nav must already contain Calendar (run nav update first)'

def ev(title, badge, what, when):
    return f'''          <article class="cal-event">
            <div class="cal-event-top"><h3>{title}</h3><span class="cal-impact cal-impact-{badge[0]}">{badge[1]}</span></div>
            <p>{what}</p>
            <p class="cal-when"><span>Când</span>{when}</p>
          </article>'''

EVENTS = '\n'.join([
  ev('NFP (Non-Farm Payrolls)', ('high', 'Impact mare'),
     'Raportul locurilor de muncă din SUA: câte locuri de muncă noi au apărut în afara agriculturii, plus rata șomajului și evoluția salariilor.',
     'De obicei în prima vineri a lunii, la 8:30 ora New York, adică <b>15:30 ora României</b> în cea mai mare parte a anului.'),
  ev('CPI (inflația)', ('high', 'Impact mare'),
     'Indicele prețurilor de consum arată cât de repede cresc prețurile. Contează mult, pentru că băncile centrale decid dobânzile în funcție de inflație.',
     'Lunar, pentru fiecare economie mare. În SUA, de obicei pe la mijlocul lunii, la 8:30 ora New York (<b>15:30 ora României</b>).'),
  ev('Deciziile de dobândă', ('high', 'Impact mare'),
     'Fed (SUA), BCE (zona euro), BoE (Marea Britanie) și BoJ (Japonia) stabilesc dobânda de referință, de câte 8 ori pe an. Contează și conferința de presă de după: un ton diferit față de așteptări poate mișca valuta la fel de mult ca decizia.',
     'Fed: decizia la <b>21:00</b>, conferința la <b>21:30</b>. BCE: decizia la <b>15:15</b>, conferința la <b>15:45</b>. BoE: <b>14:00</b>. BoJ: fără oră fixă, de obicei dimineața devreme la noi (ore în ora României).'),
  ev('Minutele FOMC', ('med', 'Impact mediu'),
     'Rezumatul detaliat al ultimei ședințe a Fed. Piața caută în el indicii despre următoarele decizii de dobândă.',
     'La trei săptămâni după fiecare decizie a Fed, la 14:00 ora New York (<b>21:00 ora României</b>).'),
  ev('PIB (GDP)', ('med', 'Impact mediu spre mare'),
     'Produsul intern brut arată cât de mult a crescut sau a scăzut economia. Se publică trimestrial, adesea în mai multe estimări succesive.',
     'Trimestrial. În SUA, prima estimare apare la 8:30 ora New York (<b>15:30 ora României</b>).'),
  ev('PMI', ('med', 'Impact mediu'),
     'Sondaje printre managerii de achiziții din industrie și servicii. Peste 50 înseamnă expansiune, sub 50 înseamnă contracție. Sunt printre primele semnale despre cum merge economia.',
     'Lunar, pentru SUA, zona euro, Germania, Marea Britanie și alte economii.'),
  ev('Vânzările cu amănuntul', ('med', 'Impact mediu'),
     'Cât au cheltuit consumatorii în magazine și online. Consumul este o parte foarte mare din economia SUA.',
     'Lunar. În SUA, de obicei pe la mijlocul lunii, la 8:30 ora New York (<b>15:30 ora României</b>).'),
  ev('Cererile de ajutor de șomaj', ('med', 'Impact mediu'),
     'Câți oameni au cerut pentru prima dată ajutor de șomaj în SUA în săptămâna anterioară (Initial Jobless Claims). Un termometru rapid al pieței muncii.',
     'Săptămânal, de obicei joia, la 8:30 ora New York (<b>15:30 ora României</b>).'),
])

def rule(n, title, text):
    return f'''          <li class="rule"><span class="num">{n:02d}</span><h3>{title}</h3><p>{text}</p></li>'''
RULES = '\n'.join([
  rule(1, 'Verifică săptămâna duminica și ziua dimineața', 'Duminică mă uit ce știri mari vin în săptămâna care urmează, iar dimineața verific ziua respectivă. Notează-ți orele știrilor cu impact mare pentru perechile pe care le urmărești.'),
  rule(2, 'Fără tranzacții noi cu 15–30 de minute înainte și după', 'În jurul unei știri cu impact mare, nu deschid poziții noi. Las piața să se liniștească și abia apoi mă uit din nou la grafic.'),
  rule(3, 'Spread-ul crește, apare slippage', 'Chiar înainte și imediat după anunț, lichiditatea scade. Spread-ul se poate mări de câteva ori, iar ordinele se pot executa la alt preț decât cel cerut.'),
  rule(4, 'Stop loss-ul poate fi executat mai prost', 'Dacă prețul sare peste nivelul tău, stop loss-ul se închide la primul preț disponibil. Pierderea poate fi mai mare decât ai planificat, chiar dacă ai respectat totul.'),
  rule(5, 'Redu lotul sau stai deoparte', 'Dacă totuși tranzacționezi într-o zi cu știri mari, folosește un risc mai mic și recalculează lotul în <a href="calculator.html">calculator</a>. Să nu tranzacționezi deloc este și asta o decizie bună.'),
  rule(6, 'Swing trading: atenție la pozițiile ținute peste știri', 'Dacă ții o poziție mai multe zile, uită-te ce știri mari vin până la ținta ta. Hotărăște dinainte, în planul tău, dacă o păstrezi, îți reduci riscul sau o închizi.'),
])

def feat(href, icon, title, text):
    return f'''          <li>
            <a class="feature-card" href="{href}">
              <span class="feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{icon}</svg></span>
              <h3>{title} <span class="feature-arrow" aria-hidden="true">→</span></h3>
              <p>{text}</p>
            </a>
          </li>'''
IC = {
  'sesiuni': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  'lectie': '<path d="M2 8.5L12 4l10 4.5L12 13z"/><path d="M6 10.6V15c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.4"/><path d="M22 8.5V14"/>',
  'calculator': '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7.5h7"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
  'jurnal': '<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z"/><path d="M6 3v18"/><path d="M10 8h5M10 12h5M10 16h3"/>',
}
NEXT = '\n'.join([
  feat('sesiuni.html', IC['sesiuni'], 'Sesiuni', 'Vezi ce sesiuni sunt deschise acum și când se suprapun Londra și New York.'),
  feat('lectie.html', IC['lectie'], 'Începători', 'Lecția pas cu pas: stop loss, slippage, risc de 1% și primii pași.'),
  feat('calculator.html', IC['calculator'], 'Calculator', 'Recalculează lotul când îți reduci riscul în zilele cu știri mari.'),
  feat('jurnal.html', IC['jurnal'], 'Jurnal', 'Notează dacă ai avut știri în timpul tranzacției și ce ai învățat din asta.'),
])

MAIN = f'''  <main id="continut">
    <!-- ===== CALENDAR ECONOMIC ===== -->
    <section class="section container" id="calendar">
      <header class="section-head">
        <p class="kicker">Știri economice</p>
        <h2>Calendar economic</h2>
        <p class="section-sub">Știrile economice importante ale săptămânii, într-un singur loc, afișate în ora ta locală. Eu mă uit aici înainte să deschid orice tranzacție.</p>
      </header>

      <div class="cal-intro">
        <p>Calendarul economic îți arată când apar datele și deciziile care pot mișca puternic valutele: raportul locurilor de muncă din SUA, inflația, deciziile băncilor centrale și multe altele. Pentru fiecare știre vezi valuta afectată, ora ta locală, cât timp mai e până la anunț, cât de importantă este și cifrele așteptate.</p>
        <p>Ca începător, nu trebuie să tranzacționezi știrile. Trebuie doar să știi când vin, ca să nu te prindă o mișcare bruscă cu o poziție deschisă sau cu un stop loss prea strâns. De asta verific calendarul în fiecare duminică pentru săptămâna care urmează și în fiecare dimineață pentru ziua respectivă.</p>
      </div>

      <div class="cal-app" id="cal-app" aria-busy="true">
        <div class="cal-hero" id="cal-hero">
          <p class="cal-hero-kicker"><span class="cal-hero-dot"></span>Următoarea știre importantă</p>
          <p class="cal-loading">Se încarcă știrile săptămânii…</p>
        </div>

        <div class="cal-card cal-board">
          <div class="cal-board-head">
            <h3>Calendarul săptămânii</h3>
            <p class="cal-meta" id="cal-meta"></p>
          </div>
          <div class="cal-toolbar">
            <div class="cal-filter">
              <span class="cal-filter-label" id="cal-lbl-ccy">Valute</span>
              <div class="cal-chips-row" id="cal-ccy-chips" role="group" aria-labelledby="cal-lbl-ccy"></div>
            </div>
            <div class="cal-filter cal-filter-inline">
              <span class="cal-filter-label" id="cal-lbl-imp">Impact</span>
              <div class="cal-seg" id="cal-impact-seg" role="group" aria-labelledby="cal-lbl-imp">
                <button type="button" data-impact="high" aria-pressed="false">Mare</button>
                <button type="button" data-impact="hm" aria-pressed="true">Mare + mediu</button>
                <button type="button" data-impact="all" aria-pressed="false">Toate</button>
              </div>
              <button type="button" class="cal-toggle" id="cal-today" aria-pressed="false"><span class="cal-switch" aria-hidden="true"></span>Doar azi</button>
            </div>
          </div>
          <div class="cal-list" id="cal-list"></div>
          <div class="cal-fallback" id="cal-fallback" role="status">
            <p id="cal-fallback-msg"><strong>Calendarul live are nevoie de JavaScript.</strong> Dacă nu apare, găsești aceleași știri, în ora ta, pe calendarele de mai jos.</p>
            <div class="cal-fallback-links">
              <a class="btn btn-ghost" href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener nofollow">Calendarul ForexFactory ↗</a>
              <a class="btn btn-ghost" href="https://www.tradingview.com/economic-calendar/" target="_blank" rel="noopener nofollow">Calendarul TradingView ↗</a>
            </div>
          </div>
          <p class="cal-note">Datele vin din calendarul public <a href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener nofollow">ForexFactory</a> și se actualizează automat cam o dată la 30 de minute. Titlurile rămân în engleză, ca la sursă, iar dedesubt ai explicația în română pentru știrile importante. Rezultatul (cifra actuală) nu apare aici: îl vezi pe ForexFactory sau pe TradingView imediat după anunț.</p>
        </div>
      </div>
    </section>

    <section class="section container" id="stiri" aria-labelledby="stiri-title">
      <header class="section-head">
        <p class="kicker">Ghid rapid</p>
        <h2 id="stiri-title">Știrile care mișcă piața</h2>
        <p class="section-sub">Nu trebuie să le știi pe toate. Acestea sunt cele pe care le urmăresc eu în fiecare lună. Orele sunt în ora României.</p>
      </header>
      <div class="cal-events">
{EVENTS}
      </div>
      <p class="cal-dst">SUA și Europa schimbă ora în date diferite. În câteva săptămâni din martie și de la sfârșitul lui octombrie, știrile din New York apar la noi cu o oră mai devreme (de exemplu NFP la 14:30). Calendarul de mai sus face automat conversia în ora ta, iar pe pagina <a href="sesiuni.html">Sesiuni</a> vezi live ce piețe sunt deschise.</p>

      <div class="cal-read">
        <div class="cal-read-col">
          <h3>Cât de importantă e o știre</h3>
          <ul class="cal-levels">
            <li><span class="cal-impact cal-impact-low">Scăzut</span><p>De obicei are un efect mic asupra prețului.</p></li>
            <li><span class="cal-impact cal-impact-med">Mediu</span><p>Poate mișca perechile legate de acea valută, mai ales dacă cifra surprinde.</p></li>
            <li><span class="cal-impact cal-impact-high">Mare</span><p>NFP, inflația, deciziile de dobândă. Mișcări bruște, spread-uri mari și slippage.</p></li>
          </ul>
          <p class="cal-small">Calendarul de pe această pagină afișează implicit știrile cu impact mare și mediu. Le poți vedea și pe cele cu impact scăzut alegând „Toate”.</p>
        </div>
        <div class="cal-read-col">
          <h3>Actual, prognoză, anterior</h3>
          <dl class="cal-fields">
            <div><dt>Actual</dt><dd>Cifra publicată. Apare abia în momentul anunțului.</dd></div>
            <div><dt>Prognoză <span>(forecast)</span></dt><dd>Ce așteaptă piața: media estimărilor făcute înainte de anunț.</dd></div>
            <div><dt>Anterior <span>(previous)</span></dt><dd>Cifra din perioada trecută, uneori revizuită.</dd></div>
          </dl>
          <p class="cal-small">În calendarul de mai sus vezi prognoza și valoarea anterioară. Cifra actuală o găsești pe ForexFactory sau pe TradingView imediat după anunț.</p>
          <p class="cal-small"><strong>Prețul reacționează la surpriză</strong>, adică la diferența dintre actual și prognoză, nu la cifra în sine. O cifră bună dar deja așteptată poate muta puțin prețul, iar una neașteptată poate produce o mișcare mare, în orice direcție. Direcția nu o știe nimeni dinainte, așa că nu încerca să o ghicești.</p>
        </div>
      </div>
    </section>

    <section class="section container" id="protectie" aria-labelledby="protectie-title">
      <header class="section-head">
        <p class="kicker">Managementul riscului</p>
        <h2 id="protectie-title">Cum te protejezi</h2>
        <p class="section-sub">Regulile pe care le folosesc eu în jurul știrilor. Sunt reguli de management al riscului, nu recomandări de tranzacționare.</p>
      </header>
      <ol class="rules cal-rules">
{RULES}
      </ol>
      <div class="lc-retine cal-retine">
        <p class="lc-retine-title">Reține</p>
        <ul>
          <li>Verifici calendarul înainte de fiecare zi de trading și știi orele știrilor mari.</li>
          <li>Știrile cu impact mare aduc spread-uri mai mari, slippage și mișcări bruște.</li>
          <li>Prețul reacționează la surpriza față de prognoză, nu la cifra în sine.</li>
          <li>Fără tranzacții noi chiar înainte și după știrile mari. Dacă ai dubii, stai deoparte.</li>
        </ul>
      </div>
    </section>

    <section class="section container" id="continua" aria-labelledby="continua-title">
      <header class="section-head">
        <p class="kicker">Continuă</p>
        <h2 id="continua-title">Pune calendarul în procesul tău</h2>
      </header>
      <ul class="features cal-next">
{NEXT}
      </ul>
    </section>
  </main>
'''
mstart = body.index('  <main id="continut">'); mend = body.index('  </main>\n') + len('  </main>\n')
body = body[:mstart] + MAIN + body[mend:]
body = re.sub(r'(<script src="script\.js\?v=\d+" defer></script>)', r'\1\n  <script src="calendar.js?v=1" defer></script>', body, count=1)
assert 'calendar.js?v=1' in body
open(f'{ROOT}/calendar.html', 'w', encoding='utf-8').write(head + body)
print('written calendar.html', len(head + body))
