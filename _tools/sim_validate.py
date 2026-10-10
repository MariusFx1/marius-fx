#!/usr/bin/env python3
"""Validează datele noi ale simulatorului (din folderul de lucru) față de cele publicate, înainte de a le copia.
Utilizare: python3 sim_validate.py <folder_nou> [<folder_publicat>]   → cod 0 = în regulă, 1 = NU publica.
Reguli: (1) istoricul deja publicat rămâne neschimbat (fișierele H1 ale anilor încheiați identice, H4/D1 vechi = prefix al celor noi),
(2) data de final nu scade, (3) toate barele noi sunt OHLC-consistente, cu timp strict crescător, fără D1 în weekend,
(4) nu apar perioade incomplete noi, (5) fără salturi absurde de preț în barele noi."""
import json, sys, os, statistics
from datetime import datetime, timezone
NEW = sys.argv[1]; OLD = sys.argv[2] if len(sys.argv) > 2 else '/workspace/forex-ms/data/sim'
errs, notes = [], []
KNOWN = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sim_known_events.json')))
def dec(path):
    j = json.load(open(path)); m = 10 ** j['dec']; t = j['t0']; pc = None; out = []
    b = j['b']
    for k in range(0, len(b), 5):
        t += b[k] * 60; O = b[k + 1] if pc is None else pc + b[k + 1]; H = O + b[k + 2]; L = O - b[k + 3]; C = O + b[k + 4]; pc = C
        out.append((t, O / m, H / m, L / m, C / m))
    return out
ni, oi = json.load(open(f'{NEW}/index.json')), json.load(open(f'{OLD}/index.json'))
if ni['to'] < oi['to']: errs.append(f"data de final a scăzut: {oi['to']} → {ni['to']}")
old_last_year = max(oi['instruments']['EURUSD']['H1'])
for sym, meta in ni['instruments'].items():
    om = oi['instruments'].get(sym)
    if not om: errs.append(f'{sym} lipsește din indexul vechi'); continue
    if meta['incomplete'] != [x for x in meta['incomplete'] if x in om['incomplete']]:
        errs.append(f"{sym}: perioade incomplete noi {[x for x in meta['incomplete'] if x not in om['incomplete']]}")
    for y in om['H1']:
        a, b = f'{OLD}/{sym}-H1-{y}.json', f'{NEW}/{sym}-H1-{y}.json'
        if not os.path.exists(b): errs.append(f'lipsește {b}'); continue
        if y < old_last_year and open(a, 'rb').read() != open(b, 'rb').read(): errs.append(f'{sym} H1 {y}: istoric publicat modificat')
        if y == old_last_year and dec(a) != dec(b)[:len(dec(a))]: errs.append(f'{sym} H1 {y}: barele publicate nu sunt prefix al celor noi')
    for tf in ('H4', 'D1'):
        o, n = dec(f'{OLD}/{sym}-{tf}.json'), dec(f'{NEW}/{sym}-{tf}.json')
        if n[:len(o)] != o: errs.append(f'{sym} {tf}: barele publicate nu sunt prefix al celor noi')
        added = n[len(o):]
        bad = [b for b in n if not (b[3] <= min(b[1], b[4]) <= max(b[1], b[4]) <= b[2])]
        mono = all(y[0] > x[0] for x, y in zip(n, n[1:]))
        if bad or not mono: errs.append(f'{sym} {tf}: {len(bad)} bare inconsistente, timp crescător: {mono}')
        if tf == 'D1' and any(datetime.fromtimestamp(b[0], timezone.utc).weekday() >= 5 for b in n): errs.append(f'{sym} D1: bare în weekend')
        if added:
            # amplitudine relativă la preț, comparată cu mediana celor 500 de bare anterioare (prețul aurului s-a dublat între timp)
            spikes, jumps = [], []
            for k in range(len(o), len(n)):
                med = statistics.median((x[2] - x[3]) / x[4] for x in n[max(0, k - 500):k])
                day = datetime.fromtimestamp(n[k][0], timezone.utc).date().isoformat()
                if (n[k][2] - n[k][3]) / n[k][4] > 12 * med: spikes.append(day)
                if abs(n[k][1] - n[k - 1][4]) / n[k][4] > 6 * med: jumps.append(day)
            known = KNOWN.get(sym, {})
            for d in sorted(set(spikes + jumps)):
                if d in known: notes.append(f'{sym} {tf} {d}: mișcare extremă reală, verificată ({known[d]})')
            spikes = [d for d in spikes if d not in known]; jumps = [d for d in jumps if d not in known]
            if spikes or jumps: errs.append(f'{sym} {tf}: bare suspecte în datele noi (verifică datele M1 și presa, apoi adaugă în sim_known_events.json dacă sunt reale): amplitudine {spikes[:5]} salt {jumps[:5]}')
            notes.append(f'{sym} {tf}: +{len(added)} bare ({datetime.fromtimestamp(added[0][0], timezone.utc).date()} … {datetime.fromtimestamp(added[-1][0], timezone.utc).date()})')
    for y in meta['H1']:
        n = dec(f'{NEW}/{sym}-H1-{y}.json')
        if not all(b[3] <= min(b[1], b[4]) <= max(b[1], b[4]) <= b[2] for b in n) or not all(q[0] > p[0] for p, q in zip(n, n[1:])): errs.append(f'{sym} H1 {y}: bare inconsistente')
print('\n'.join(notes))
print(f"interval: {ni['from']} … {ni['to']}")
if errs: print('VALIDARE EȘUATĂ:\n - ' + '\n - '.join(errs)); sys.exit(1)
print('VALIDARE OK'); sys.exit(0)
