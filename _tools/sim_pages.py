# Leagă simulatorul din index (bloc evidențiat), lecție (cap. 8) și jurnal. Idempotent.
ROOT = '/workspace/forex-ms'
def edit(name, pairs):
    p = f'{ROOT}/{name}'; s = open(p, encoding='utf-8').read()
    for a, b, marker in pairs:
        if marker in s: continue
        assert a in s, (name, a[:60]); s = s.replace(a, b, 1)
    open(p, 'w', encoding='utf-8').write(s)

SPOT = '''        <a class="sim-spot" href="simulator.html">
          <span class="sim-spot-art" aria-hidden="true"><svg viewBox="0 0 120 64" focusable="false"><path d="M10 40v14M22 30v18M34 34v16M46 20v20M58 24v12M70 12v18M82 18v16M94 8v16M106 14v12" stroke-width="2"/><rect x="7" y="43" width="6" height="7" rx="1"/><rect x="19" y="34" width="6" height="10" rx="1"/><rect x="31" y="37" width="6" height="8" rx="1" class="r"/><rect x="43" y="24" width="6" height="12" rx="1"/><rect x="55" y="26" width="6" height="6" rx="1" class="r"/><rect x="67" y="15" width="6" height="11" rx="1"/><rect x="79" y="21" width="6" height="9" rx="1" class="r"/><rect x="91" y="11" width="6" height="9" rx="1"/><path d="M2 46h116" class="sl"/><path d="M2 10h116" class="tp"/></svg></span>
          <span class="sim-spot-copy">
            <span class="sim-spot-badge">Nou</span>
            <strong>Simulator de backtesting</strong>
            <span class="sim-spot-text">Exersează pe grafice reale din 2019-2025, bară cu bară, cu bani virtuali: Buy sau Sell cu stop loss și take profit, lot calculat automat, statistici în R și curba equity.</span>
          </span>
          <span class="btn btn-primary sim-spot-btn">Încearcă simulatorul <span aria-hidden="true">→</span></span>
        </a>
'''
edit('index.html', [('''          <p class="section-sub">Lecții și instrumente gratuite, ca să înveți un proces, nu să urmezi semnale.</p>
        </header>
''', '''          <p class="section-sub">Lecții și instrumente gratuite, ca să înveți un proces, nu să urmezi semnale.</p>
        </header>
''' + SPOT, 'class="sim-spot"')])
edit('lectie.html', [('<li><h3>Cont demo, cel puțin 6–8 săptămâni</h3><p>Și minimum 30–50 de tranzacții, cu același risc de 1%, același plan și jurnal complet, ca pe bani reali.</p></li>',
  '<li><h3>Cont demo, cel puțin 6–8 săptămâni</h3><p>Și minimum 30–50 de tranzacții, cu același risc de 1%, același plan și jurnal complet, ca pe bani reali. Înainte sau în paralel, exersează pe date istorice în <a href="simulator.html">simulatorul de backtesting</a>: vezi graficul bară cu bară, fără să știi ce urmează.</p></li>', 'simulatorul de backtesting')])
edit('jurnal.html', [('''verifici dacă ți-ai respectat planul.</p>
      </header>''', '''verifici dacă ți-ai respectat planul.</p>
        <p class="section-sub jt-sim-link">Vrei să exersezi întâi fără bani reali? În <a href="simulator.html">simulatorul de backtesting</a> tranzacționezi pe grafice istorice reale, iar tranzacțiile închise le poți trimite aici, marcate cu „Simulator”.</p>
      </header>''', 'jt-sim-link')])
edit('jurnal.js', [
  ("      modificat: str(o.modificat, 30) || ''\n    };", "      modificat: str(o.modificat, 30) || '',\n      sursa: o.sursa === 'simulator' ? 'simulator' : ''\n    };", "sursa: o.sursa"),
  ("            ${t.sesiune ? `<span class=\"jt-sess\">${esc(t.sesiune)}</span>` : ''}", "            ${t.sesiune ? `<span class=\"jt-sess\">${esc(t.sesiune)}</span>` : ''}\n            ${t.sursa === 'simulator' ? '<span class=\"jt-sess jt-src-sim\" title=\"Adăugată din simulatorul de backtesting\">Simulator</span>' : ''}", 'jt-src-sim'),
])
print('ok')
