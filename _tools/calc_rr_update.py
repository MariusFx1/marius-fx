# Calculatorul risk/reward pe calculator.html: tab-uri „Lot” | „Risk/Reward” + panoul R:R. Idempotent.
import re
P = '/workspace/forex-ms/calculator.html'
s = open(P, encoding='utf-8').read()
if 'id="risc-recompensa"' in s:
    print('already'); raise SystemExit
opts = re.search(r'<select id="pereche">\n(.*?)\n            </select>', s, re.S).group(1)
opts_rr = opts.replace('              <option', '                <option')
SUB_OLD = '<p class="section-sub">Estimează câte loturi corespund riscului ales și stop loss-ului. Nu calculează profit și nu este o recomandare de tranzacționare.</p>'
SUB_NEW = '<p class="section-sub">Estimează câte loturi corespund riscului ales și, în tabul Risk/Reward, raportul risc/câștig al unei tranzacții planificate. Sunt estimări educaționale, nu recomandări de tranzacționare.</p>'
assert SUB_OLD in s; s = s.replace(SUB_OLD, SUB_NEW)
TABS = '''      <div class="calc-tabs" role="tablist" aria-label="Alege calculatorul" hidden>
        <button type="button" class="calc-tab" role="tab" id="tab-lot" aria-controls="panel-lot" aria-selected="true">Lot</button>
        <button type="button" class="calc-tab" role="tab" id="tab-rr" aria-controls="risc-recompensa" aria-selected="false" tabindex="-1">Risk/Reward</button>
      </div>
      <div class="calc" id="panel-lot">'''
assert s.count('      <div class="calc">') == 1
s = s.replace('      <div class="calc">', TABS, 1)
RR = f'''
      <div class="calc calc-rr" id="risc-recompensa">
        <h2 class="calc-rr-title">Calculator risk/reward</h2>
        <p class="calc-rr-sub">Introdu intrarea, stop loss-ul și take profit-ul. Afli distanțele în pips, raportul R:R, lotul pentru riscul ales și rata minimă de câștig ca să fii pe zero.</p>
        <form class="calc-form lot-form rr-form" id="rr-form" novalidate>
          <label>Pereche
            <select id="rr-pereche">
{opts_rr}
            </select>
          </label>
          <fieldset class="rr-dir">
            <legend>Direcție</legend>
            <label><input type="radio" name="rr-dir" value="buy" checked> <span>Buy</span></label>
            <label><input type="radio" name="rr-dir" value="sell"> <span>Sell</span></label>
          </fieldset>
          <label>Preț de intrare
            <input type="text" id="rr-intrare" value="1.1200" inputmode="decimal" autocomplete="off">
          </label>
          <label>Stop loss (preț)
            <input type="text" id="rr-sl" value="1.1175" inputmode="decimal" autocomplete="off">
          </label>
          <label>Take profit (preț)
            <input type="text" id="rr-tp" value="1.1250" inputmode="decimal" autocomplete="off">
          </label>
          <label>Moneda contului
            <select id="rr-moneda">
              <option value="USD" selected>USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </label>
          <label>Sold cont
            <input type="text" id="rr-sold" value="10000" inputmode="decimal" autocomplete="off">
          </label>
          <label>Risc %
            <input type="text" id="rr-risc" value="1" inputmode="decimal" autocomplete="off">
          </label>
          <p class="rr-error" id="rr-error" role="alert" hidden></p>
          <div class="rr-out" aria-live="polite">
            <div class="rr-results">
              <div class="calc-result"><span>Stop loss</span><output id="rr-sl-pips">—</output><small>pips</small></div>
              <div class="calc-result"><span>Take profit</span><output id="rr-tp-pips">—</output><small>pips</small></div>
              <div class="calc-result rr-main"><span>Raport risc/câștig</span><output id="rr-raport">—</output><small>R:R</small></div>
              <div class="calc-result"><span>Loturi</span><output id="rr-loturi">—</output><small>rotunjit în jos la 0,01</small></div>
              <div class="calc-result"><span>Sumă riscată</span><output id="rr-risc-suma">—</output><small>dacă se atinge SL</small></div>
              <div class="calc-result"><span>Profit potențial</span><output id="rr-profit">—</output><small>dacă se atinge TP</small></div>
              <div class="calc-result rr-wide"><span>Rată de câștig pentru break-even</span><output id="rr-be">—</output><small>1 ÷ (1 + R), înainte de costuri</small></div>
            </div>
            <div class="rr-visual" id="rr-visual" aria-hidden="true">
              <div class="rr-zone rr-zone-tp" id="rr-zone-tp"><span>TP <b id="rr-v-tp"></b></span></div>
              <div class="rr-entry"><span>Intrare <b id="rr-v-in"></b></span></div>
              <div class="rr-zone rr-zone-sl" id="rr-zone-sl"><span>SL <b id="rr-v-sl"></b></span></div>
            </div>
          </div>
          <p class="fineprint lot-note" id="rr-nota"></p>
        </form>
      </div>'''
end = '        </form>\n      </div>\n    </section>'
assert s.count(end) == 1
s = s.replace(end, '        </form>\n      </div>' + RR + '\n    </section>')
s = s.replace('  <script src="script.js?v=35" defer></script>\n', '  <script src="script.js?v=35" defer></script>\n  <script src="rr.js?v=1" defer></script>\n')
open(P, 'w', encoding='utf-8').write(s); print('ok calculator.html')
