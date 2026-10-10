# Generează test.html (testul pentru începători) și intrebari.html (FAQ) pornind de la contact.html.
# Meta, JSON-LD (inclusiv FAQPage din textul vizibil) se pun apoi cu seo_update.py. Idempotent.
import re
ROOT = '/workspace/forex-ms'
src = open(f'{ROOT}/contact.html', encoding='utf-8').read()
src = src.replace('<a href="contact.html" aria-current="page">Contact</a>', '<a href="contact.html">Contact</a>')
assert 'aria-current' not in src

def page(name, main, extra_js='', nav_current=None):
    s = src
    for k in ('canonical',):
        s = s.replace('https://mariusfx1.github.io/marius-fx/contact.html', f'https://mariusfx1.github.io/marius-fx/{name}.html')
    if nav_current:
        s, n = re.subn(r'<li><a href="' + nav_current + r'">', f'<li><a href="{nav_current}" aria-current="page">', s, count=1); assert n == 1
    a = s.index('  <main id="continut">'); b = s.index('  </main>\n') + len('  </main>\n')
    s = s[:a] + main + s[b:]
    s = re.sub(r'  <script type="application/ld\+json">.*?</script>\n', '', s, flags=re.S)
    if extra_js:
        s = s.replace('  <script src="script.js?v=35" defer></script>\n', '  <script src="script.js?v=35" defer></script>\n' + extra_js)
    open(f'{ROOT}/{name}.html', 'w', encoding='utf-8').write(s)
    print('ok', name)

CHAPTERS = ['Forex, brokerul și platforma', 'Graficul: lumânări și timeframe-uri', 'Pip, lot și costuri', 'Levier și marjă',
            'Ordine, stop loss și take profit', 'Managementul riscului', 'Psihologie, disciplină și greșeli', 'Primii pași concreți']
ch_list = '\n'.join(f'            <li><a href="lectie.html#cap-{i}"><span class="quiz-topic-n" aria-hidden="true">{i:02d}</span>{t}</a></li>' for i, t in enumerate(CHAPTERS, 1))

TEST_MAIN = f'''  <main id="continut">
    <!-- ===== TEST PENTRU ÎNCEPĂTORI ===== -->
    <section class="section container quiz-page" aria-labelledby="quiz-title">
      <header class="section-head">
        <p class="kicker">Verifică-ți cunoștințele</p>
        <h1 id="quiz-title">Test pentru începători</h1>
        <p class="section-sub">15 întrebări din cele 8 capitole ale <a href="lectie.html">cursului gratuit</a>. După fiecare răspuns vezi explicația și capitolul de recitit.</p>
      </header>

      <div class="quiz" id="quiz">
        <div class="quiz-card quiz-start" id="quiz-start">
          <ul class="quiz-facts">
            <li><b>15</b> întrebări</li>
            <li><b>4</b> variante, una corectă</li>
            <li><b>~5</b> minute</li>
          </ul>
          <p>Răspunzi la o întrebare pe rând și afli imediat dacă ai răspuns corect, cu o explicație scurtă. La final vezi scorul și capitolele pe care merită să le recitești. Poți reface testul oricând: întrebările și variantele se amestecă de fiecare dată.</p>
          <p class="quiz-best" id="quiz-best" hidden></p>
          <div class="quiz-actions">
            <button type="button" class="btn btn-primary" id="quiz-start-btn" hidden>Începe testul</button>
            <a class="btn btn-ghost" href="lectie.html">Recitește cursul</a>
          </div>
          <noscript><p class="quiz-noscript">Testul are nevoie de JavaScript activat în browser. Între timp, poți reciti <a href="lectie.html">cursul pentru începători</a>.</p></noscript>
          <div class="quiz-topics">
            <h2 class="quiz-topics-title">Ce verifică testul</h2>
            <ol>
{ch_list}
            </ol>
          </div>
        </div>

        <div class="quiz-card quiz-q" id="quiz-q" hidden>
          <div class="quiz-progress">
            <p class="quiz-count"><span id="quiz-count">Întrebarea 1 din 15</span><span class="quiz-ch" id="quiz-ch"></span></p>
            <div class="quiz-bar" id="quiz-bar" role="progressbar" aria-label="Progresul testului" aria-valuemin="0" aria-valuemax="15" aria-valuenow="0"><span id="quiz-bar-fill"></span></div>
          </div>
          <h2 class="quiz-question" id="quiz-question" tabindex="-1"></h2>
          <ul class="quiz-options" id="quiz-options" aria-labelledby="quiz-question"></ul>
          <div class="quiz-feedback" id="quiz-feedback" role="status" aria-live="polite" hidden></div>
          <div class="quiz-actions quiz-actions-end">
            <p class="quiz-keys">Tastatură: A, B, C, D sau 1 până la 4</p>
            <button type="button" class="btn btn-primary" id="quiz-next" hidden>Următoarea întrebare</button>
          </div>
        </div>

        <div class="quiz-card quiz-result" id="quiz-result" hidden>
          <div class="quiz-result-top">
            <div class="quiz-ring" id="quiz-ring" aria-hidden="true"><span class="quiz-score" id="quiz-score">0/15</span><span class="quiz-pct" id="quiz-pct">0%</span></div>
            <div>
              <p class="kicker">Rezultat</p>
              <h2 id="quiz-result-title" tabindex="-1"></h2>
              <p class="quiz-band" id="quiz-band"></p>
              <p class="quiz-best quiz-best-result" id="quiz-best-result"></p>
            </div>
          </div>
          <div class="quiz-missed" id="quiz-missed"></div>
          <div class="quiz-actions">
            <button type="button" class="btn btn-primary" id="quiz-retry">Refă testul</button>
            <a class="btn btn-ghost" href="lectie.html">Înapoi la curs</a>
          </div>
        </div>
      </div>
      <p class="quiz-note">Cel mai bun scor se salvează doar în browserul tău. Nu trimitem nimic nicăieri. Testul este educațional și nu evaluează dacă ești pregătit să tranzacționezi pe bani reali.</p>
    </section>
  </main>
'''

FAQ = [
  ('bani', 'Cu câți bani încep?',
   '<p>Cu zero. Începi pe un <strong>cont demo</strong>, cu bani virtuali, și rămâi acolo până ești disciplinat: cel puțin 6 până la 8 săptămâni și 30 până la 50 de tranzacții, cu același plan și același risc ca pe real.</p>'
   '<p>Abia apoi treci pe un cont real mic, cu o sumă pe care îți permiți să o pierzi în întregime, fără să-ți afecteze viața. Nu bani împrumutați și nu banii de chirie. Cu 0,01 loturi și risc de 1% pe tranzacție, un cont mic ajunge ca să înveți.</p>'),
  ('profitabil', 'Cât durează să devin profitabil?',
   '<p>Nu îți pot promite asta și nimeni nu poate. Eu am învățat singur și mi-au trebuit mulți ani de greșeli, răbdare și disciplină până am ajuns să tranzacționez consecvent. Mulți oameni nu ajung niciodată acolo și e bine să știi asta de la început.</p>'
   '<p>Ce poți controla este procesul: risc mic, plan scris, jurnal și răbdare. Rezultatele vin, dacă vin, după foarte multe tranzacții, nu după câteva săptămâni.</p>'),
  ('semnale', 'Dai semnale de tranzacționare?',
   '<p>Nu. MS Prime înseamnă doar educație: nu dau semnale, nu administrez conturi și nu fac consultanță de investiții personalizată. Vreau să înveți să iei singur decizii, după planul tău. Dacă nu știi de ce ai intrat într-o tranzacție, nu vei ști nici când să ieși.</p>'),
  ('incep', 'De unde încep dacă nu știu nimic?',
   '<p>Cu <a href="lectie.html">cursul pentru începători</a>: 8 capitole, de la pip și lot până la primul plan de trading. După ce îl termini, fă <a href="test.html">testul de 15 întrebări</a> ca să vezi ce ai înțeles, apoi exersează calculul lotului cu <a href="calculator.html">calculatorul</a>.</p>'),
  ('broker', 'Ce broker folosești?',
   '<p>Eu folosesc RoboForex. Pe pagina <a href="broker.html">Broker</a> găsești linkul meu de recomandare: dacă îți deschizi cont prin el, eu pot primi un comision de la broker. Nu este o recomandare independentă.</p>'
   '<p>Indiferent ce broker alegi, verifică înainte ce entitate îți deschide contul și de cine este reglementată, ce costuri are și cât de simplu îți retragi banii. Un broker din afara UE nu este obligat să aplice protecțiile pentru clienții retail din UE, cum ar fi levierul limitat și protecția la sold negativ.</p>'),
  ('legal', 'Este Forex-ul legal în România?',
   '<p>Da. Tranzacționarea Forex și CFD este legală în România dacă o faci printr-un broker autorizat: fie de ASF (Autoritatea de Supraveghere Financiară), fie de autoritatea din alt stat al UE și notificat să ofere servicii în România.</p>'
   '<p>Pentru clienții retail din UE se aplică restricțiile ESMA pentru CFD-uri, preluate și de ASF: levier maxim limitat (1:30 pe perechile principale), închiderea pozițiilor la 50% din marja necesară, protecție la sold negativ și avertismente de risc. ASF publică avertismente despre entitățile neautorizate, așa că verifică brokerul înainte să depui bani.</p>'),
  ('taxe', 'Ce taxe plătesc pe câștiguri în România?',
   '<p>Câștigurile din trading sunt impozabile. Pe scurt, la regulile în vigoare în 2026:</p>'
   '<ul><li>Dacă brokerul este intermediar rezident fiscal în România (sau are aici un sediu permanent cu calitatea de intermediar), impozitul se reține la sursă, la fiecare câștig.</li>'
   '<li>Dacă brokerul este din străinătate, declari singur câștigul net al anului în <strong>Declarația unică</strong> (formularul 212), de regulă până la 25 mai a anului următor, și plătești impozitul. Pentru veniturile din 2026, cota este de 16%.</li>'
   '<li>Peste un anumit prag de venituri din investiții și alte surse, se poate datora și CASS (contribuția la sănătate).</li></ul>'
   '<p>Regulile fiscale se schimbă des, iar eu nu sunt consultant fiscal. Verifică informațiile actuale pe site-ul ANAF sau întreabă un contabil.</p>'),
  ('telefon', 'Pot face trading de pe telefon?',
   '<p>Da. MetaTrader 4 și MetaTrader 5 au aplicații pentru telefon, din care poți deschide, urmări și închide poziții. Pentru analiză îți recomand totuși calculatorul: pe ecranul mare vezi graficul mai clar și greșești mai greu un nivel sau mărimea lotului. Înainte de orice ordin dat de pe telefon, verifică de două ori lotul și stop loss-ul.</p>'),
  ('demo', 'Ce este un cont demo?',
   '<p>Un cont cu bani virtuali și prețuri reale, oferit gratuit de brokeri. Înveți platforma și îți testezi planul fără niciun risc. Tratează-l ca pe un cont real: același risc de 1%, același plan, jurnal complet.</p>'
   '<p>Reține două diferențe: pe demo nu simți aceleași emoții, iar execuția poate fi puțin diferită față de un cont real. De aceea, când treci pe real, începi cu sume mici.</p>'),
  ('pierd', 'De ce pierd bani majoritatea celor care tranzacționează?',
   '<p>Brokerii reglementați în UE sunt obligați să afișeze ce procent din conturile de retail pierd bani pe CFD-uri, iar analizele ESMA au arătat că majoritatea conturilor de retail pierd. Motivele tipice: risc prea mare pe tranzacție, levier folosit la maximum, lipsa stop loss-ului, lipsa unui plan scris și deciziile luate din emoție.</p>'
   '<p>Nu există o garanție că tu vei fi în minoritate. Ce poți face este să elimini greșelile evitabile: le găsești pe rând în <a href="lectie.html">curs</a> și în <a href="reguli.html">regulile de bază</a>.</p>'),
  ('timeframe', 'Ce timeframe să folosesc?',
   '<p>Eu sunt swing trader și lucrez în principal pe D1 și H4. Pentru un început îți recomand intervalele mari: au mai puțin zgomot, mai puține semnale false și îți lasă timp să gândești. Pornești de la D1 ca să vezi direcția și cobori pe H4 ca să cauți intrarea. Intervalele de câteva minute sunt cele mai grele pentru un începător.</p>'),
  ('timp', 'Cât timp pe zi îmi ia?',
   '<p>Pe swing trading nu trebuie să stai toată ziua în fața graficelor. Pe D1 și H4, analiza se face de câteva ori pe zi, după închiderea lumânărilor, iar pozițiile rămân deschise zile sau săptămâni, cu stop loss și take profit setate.</p>'
   '<p>La început, pune mai mult timp în învățat decât în tranzacționat: cursul, contul demo, jurnalul. O recapitulare a jurnalului în fiecare weekend contează mai mult decât orele petrecute zilnic în fața ecranului.</p>'),
  ('comunitate', 'Cum intru în comunitate?',
   '<p>Comunitatea Free Marius FX de pe Telegram este gratuită. Intri de aici: <a href="https://t.me/+sbQPdX_yA1E5NmM0" target="_blank" rel="noopener">t.me/+sbQPdX_yA1E5NmM0</a>. Acolo vorbim despre educație, disciplină și managementul riscului, nu despre semnale.</p>'),
  ('contact', 'Cum te contactez?',
   '<p>Îmi scrii pe e-mail la <a href="mailto:contact.mariusfx@gmail.com">contact.mariusfx@gmail.com</a> sau din pagina <a href="contact.html">Contact</a>. Răspund la întrebări despre materialele educaționale, dar nu ofer consultanță de investiții personalizată.</p>'),
]
items = '\n'.join(f'''          <details class="faq-item" id="{fid}">
            <summary><h2 class="faq-q">{q}</h2><span class="faq-icon" aria-hidden="true"></span></summary>
            <div class="faq-a">{a}</div>
          </details>''' for fid, q, a in FAQ)
FAQ_MAIN = f'''  <main id="continut">
    <!-- ===== ÎNTREBĂRI FRECVENTE ===== -->
    <section class="section container faq-page" aria-labelledby="faq-title">
      <header class="section-head">
        <p class="kicker">Răspunsuri sincere</p>
        <h1 id="faq-title">Întrebări frecvente</h1>
        <p class="section-sub">Întrebările pe care le primesc cel mai des, cu răspunsuri directe. Fără promisiuni de câștig.</p>
      </header>
      <div class="faq-layout">
        <div class="faq-list">
{items}
        </div>
        <aside class="faq-aside" aria-label="Alte întrebări">
          <div class="faq-aside-card">
            <h2 class="faq-aside-title">Nu ai găsit răspunsul?</h2>
            <p>Scrie-mi sau întreabă în comunitatea gratuită de pe Telegram.</p>
            <div class="faq-aside-cta">
              <a class="btn btn-primary" href="https://t.me/+sbQPdX_yA1E5NmM0" target="_blank" rel="noopener">Comunitatea pe Telegram</a>
              <a class="btn btn-ghost" href="contact.html">Contact</a>
            </div>
          </div>
          <div class="faq-aside-card">
            <h2 class="faq-aside-title">Abia începi?</h2>
            <p>Citește <a href="lectie.html">cursul pentru începători</a>, apoi verifică-te cu <a href="test.html">testul de 15 întrebări</a>.</p>
          </div>
        </aside>
      </div>
    </section>
  </main>
'''
page('test', TEST_MAIN, '  <script src="quiz.js?v=1" defer></script>\n', nav_current='test.html')
page('intrebari', FAQ_MAIN)
