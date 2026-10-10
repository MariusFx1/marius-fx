# Titluri, descrieri, H1 și breadcrumb pentru fiecare pagină (sursa unică pentru seo_update.py)
SITE = 'https://mariusfx1.github.io/marius-fx/'
PAGES = {
  'index': dict(
    title='Marius FX: Forex pentru începători și managementul riscului',
    desc='Educație Forex gratuită în română pentru începători: curs pas cu pas, managementul riscului, calculator de lot, sesiuni live și calendar economic. Fără semnale.',
    crumb=None),
  'lectie': dict(
    title='Curs Forex gratuit pentru începători, pas cu pas | Marius FX',
    desc='Curs Forex gratuit pentru începători, în 8 capitole: broker, lumânări, pip și lot, levier, stop loss, managementul riscului și psihologie, pas cu pas.',
    crumb='Curs pentru începători'),
  'test': dict(
    title='Test Forex pentru începători: 15 întrebări | Marius FX',
    desc='Test Forex gratuit pentru începători: 15 întrebări despre pip, lot, levier, stop loss, risc și psihologie, cu explicații și linkuri spre capitolele cursului.',
    crumb='Test pentru începători'),
  'reguli': dict(
    title='10 reguli de trading disciplinat pentru începători',
    desc='Zece reguli de bază pentru trading disciplinat: risc de 1–2% pe tranzacție, stop loss mereu, plan scris, jurnal și atenție la levier. Educație, fără semnale.',
    h1=('Reguli de bază', 'Reguli de bază în trading'), crumb='Reguli de bază'),
  'patternuri': dict(
    title='Patternuri de grafic Forex explicate simplu | Marius FX',
    desc='Patternuri de grafic Forex explicate simplu, cu desene: cap și umeri, dublu vârf, dublu minim, steag și triunghi. Cum se formează și ce urmărești pe grafic.',
    h1=('Patternuri de grafic', 'Patternuri de grafic'), crumb='Patternuri de grafic'),
  'sesiuni': dict(
    title='Sesiuni Forex live: Sydney, Tokyo, Londra, New York (ora României)',
    desc='Sesiunile Forex live în ora României: Sydney, Tokyo, Londra și New York. Vezi ce piețe sunt deschise acum, suprapunerile și cât mai e până la deschidere.',
    h1=('Sesiuni forex', 'Sesiuni Forex live'), crumb='Sesiuni Forex'),
  'calendar': dict(
    title='Calendar economic Forex live (ora României) | Marius FX',
    desc='Calendar economic Forex live în ora României: NFP, inflația, deciziile Fed și BCE, cu valuta afectată, impactul și numărătoare inversă până la fiecare știre.',
    h1=('Calendar economic', 'Calendar economic'), crumb='Calendar economic'),
  'jurnal': dict(
    title='Jurnal de trading gratuit: online, Excel și PDF | Marius FX',
    desc='Jurnal de tranzacționare gratuit: notează tranzacțiile direct în browser, salvate doar pe dispozitivul tău, sau descarcă șablonul Excel și PDF. Fără cont.',
    h1=('Jurnalul de tranzacționare', 'Jurnalul de tranzacționare'), crumb='Jurnal de trading'),
  'calculator': dict(
    title='Calculator lot Forex și risk/reward (R:R) | Marius FX',
    desc='Calculator Forex gratuit: lotul după risc și stop loss, plus raportul risc/câștig (R:R), profitul potențial și rata de câștig de break-even. Doar educațional.',
    h1=('Calculator de mărime a poziției', 'Calculator de lot Forex'), crumb='Calculator de lot'),
  'despre': dict(
    title='Despre Marius: swing trader și educație Forex | Marius FX',
    desc='Cine este Marius: swing trader de peste șase ani, care împărtășește gratuit educație Forex despre disciplină și managementul riscului. Fără semnale.',
    h1=('Despre Marius', 'Despre Marius'), crumb='Despre'),
  'broker': dict(
    title='Brokerul folosit de Marius: RoboForex (link afiliat)',
    desc='Brokerul pe care îl folosește Marius pentru Forex: RoboForex. Linkul este de afiliere, nu o recomandare independentă. Citește riscurile înainte.',
    h1=('Broker recomandat', 'Broker recomandat'), crumb='Broker'),
  'contact': dict(
    title='Contact Marius FX: întrebări despre educația Forex',
    desc='Scrie-i lui Marius pentru întrebări despre educația Forex, curs sau instrumentele de pe site: e-mail la contact.mariusfx@gmail.com sau prin Telegram.',
    h1=('Contact', 'Contact'), crumb='Contact'),
  'intrebari': dict(
    title='Întrebări frecvente despre Forex pentru începători | Marius FX',
    desc='Răspunsuri sincere la întrebările despre Forex: cu câți bani începi, cont demo, broker, taxe în România, legalitate, timeframe și de ce pierd majoritatea.',
    crumb='Întrebări frecvente'),
  'glosar': dict(
    title='Glosar Forex: termeni explicați simplu | Marius FX',
    desc='Glosar Forex pentru începători: 60 de termeni explicați simplu, de la pip, lot, spread și marjă până la stop loss, R:R, NFP și FOMO. Cu căutare și index A-Z.',
    crumb='Glosar Forex'),
  'simulator': dict(
    title='Simulator de backtesting Forex gratuit | Marius FX',
    desc='Simulator de backtesting Forex gratuit: exersezi pe grafice istorice reale, bară cu bară, cu stop loss, take profit, lot calculat și statistici în R.',
    crumb='Simulator de backtesting'),
}
if __name__ == '__main__':
    for k, v in PAGES.items():
        print(f"{k:11} T{len(v['title']):3} D{len(v['desc']):4}  {v['title']}")
