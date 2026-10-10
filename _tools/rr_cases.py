# Verificare independentă a calculatorului risk/reward (aceleași convenții ca în script.js)
import math, json
EURUSD, GBPUSD, USDJPY = 1.12, 1.32, 158
def pip_size(p): return 0.10 if p=='XAUUSD' else 0.01 if (p.endswith('JPY') or p=='XAGUSD') else 0.0001
def pip_usd(p, price):
    if p in ('EURUSD','GBPUSD','AUDUSD','NZDUSD','XAUUSD'): return 10.0
    if p=='XAGUSD': return 50.0
    if p=='USDJPY': return 1000/price
    if p in ('USDCAD','USDCHF'): return 10/price
    if p.endswith('JPY'): return 1000/USDJPY
    if p=='EURGBP': return 10*GBPUSD
    raise ValueError(p)
def calc(p, d, entry, sl, tp, bal, ccy, risk):
    ps = pip_size(p)
    slp, tpp = round(abs(entry-sl)/ps, 6), round(abs(tp-entry)/ps, 6)
    pu = pip_usd(p, entry)
    conv = (entry if p=='EURUSD' else EURUSD) if ccy=='EUR' else (entry if p=='GBPUSD' else GBPUSD) if ccy=='GBP' else 1
    pc = pu/conv
    target = bal*risk/100
    lot = math.floor(target/(slp*pc)*100 + 1e-9)/100
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
json.dump(out, open('/workspace/forex-ms-tools/rr_cases.json','w'), ensure_ascii=False, indent=1)
