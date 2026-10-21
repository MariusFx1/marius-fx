# Verificare independentă a calculatorului risk/reward (aceleași convenții ca în script.js)
import math, json
# Metoda Myfxbook (ca script.js calcLot): curs fix de test, injectat și în pagină (test-rr-glosar.js)
RATES = {"USD": 1, "EUR": 0.89, "GBP": 0.75, "JPY": 158.0, "CHF": 0.82, "CAD": 1.40, "AUD": 1.43, "NZD": 1.76}
def spec(p):
    if p=='XAUUSD': return 100, 0.01
    if p=='XAGUSD': return 5000, 0.01
    return 100000, (0.01 if p.endswith('JPY') else 0.0001)
def pip_size(p): return spec(p)[1]
def calc(p, d, entry, sl, tp, bal, ccy, risk):
    contract, ps = spec(p)
    slp, tpp = round(abs(entry-sl)/ps, 6), round(abs(tp-entry)/ps, 6)
    pc = ps*contract*(RATES[ccy]/RATES[p[3:]])
    target = bal*risk/100
    lot = round(math.floor(target/(slp*pc)*100 + 0.5 + 1e-9)/100, 2)
    R = tpp/slp
    return dict(case=f'{p} {d} {ccy}', sl_pips=round(slp,1), tp_pips=round(tpp,1), rr=f'1:{R:.2f}', lot=lot,
                target=round(target,2), risked=round(lot*slp*pc,2), profit=round(lot*tpp*pc,2), be=f'{100/(1+R):.1f}%', pip_value=round(pc,4))
CASES = [
  ('EURUSD','buy',1.1200,1.1175,1.1250,10000,'USD',1),
  ('USDJPY','sell',150.00,150.70,148.95,5000,'EUR',1),
  ('XAUUSD','buy',4150.00,4130.00,4190.00,20000,'USD',0.5),
  ('EURJPY','buy',177.00,176.40,178.50,8000,'GBP',1.5),
  ('EURGBP','sell',0.8500,0.8530,0.8440,3000,'GBP',2),
  ('XAGUSD','sell',61.00,61.40,60.10,10000,'USD',1),
]
out = [dict(calc(*c), input=dict(zip(['pair','dir','entry','sl','tp','bal','ccy','risk'], c))) for c in CASES]
for o in out: print(json.dumps(o, ensure_ascii=False))
for f in ('/workspace/forex-ms-tools/rr_cases.json','/workspace/forex-ms/_tools/rr_cases.json'): json.dump(out, open(f,'w'), ensure_ascii=False, indent=1)
