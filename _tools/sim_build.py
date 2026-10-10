#!/usr/bin/env python3
"""Agregă M1 HistData (ceas = Europe/Athens - 7h, adică ora New York cu DST european; deschidere duminică 17:00, închidere vineri 16:59) în H1/H4/D1 și scrie JSON compacte în forex-ms/data/sim/.
Ziua de tranzacționare începe la 17:00 New York (cu DST), ca la majoritatea brokerilor; H4 aliniat la aceeași oră.
Format: {"s","tf","dec","t0","b":[dt,o,h,l,c,...]} unde prețurile sunt întregi (x 10^dec):
 dt = minute față de bara anterioară (prima: față de t0), o = open - close anterior, h = high - open, l = open - low, c = close - open."""
import zipfile, json, os, sys, statistics, gzip
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
NY = ZoneInfo('America/New_York')
EET = ZoneInfo('Europe/Athens')  # ceasul HistData = ora Europei de Est minus 7h (urmează DST european; verificat pe săptămânile cu decalaj SUA/UE)
SRC = os.environ.get('SIM_SRC', '/workspace/forex-ms-tools/simdata/hd'); OUT = os.environ.get('SIM_OUT', '/workspace/forex-ms/data/sim')
PAIRS = {'eurusd': 5, 'gbpusd': 5, 'audusd': 5, 'usdjpy': 3, 'gbpjpy': 3, 'xauusd': 2}
import glob, re
def sources(p):
    """Arhivele pentru o pereche: ani compleți (pereche-AAAA.zip) și, pentru anul curent, luni complete (pereche-AAAA-LL.zip)."""
    full = sorted(int(re.search(r'-(\d{4})\.zip$', f).group(1)) for f in glob.glob(f'{SRC}/{p}-[0-9][0-9][0-9][0-9].zip'))
    months = sorted(f for f in glob.glob(f'{SRC}/{p}-[0-9][0-9][0-9][0-9]-[0-9][0-9].zip') if int(re.search(r'-(\d{4})-\d\d\.zip$', f).group(1)) not in full)
    return [f'{SRC}/{p}-{y}.zip' for y in full] + months
YEARS = sorted({int(re.search(r'-(\d{4})(-\d\d)?\.zip$', f).group(1)) for f in sources('eurusd')})
assert YEARS[0] == 2019, YEARS
os.makedirs(OUT, exist_ok=True)
report = {}
TRADE_END = {}
BAD = {}

OFF = {}
def load_m1(p):
    rows = []
    for path in sources(p):
        z = zipfile.ZipFile(path)
        name = [n for n in z.namelist() if n.endswith('.csv')][0]
        for line in z.read(name).decode().splitlines():
            d, o, h, l, c, _ = line.split(';')
            key = d[:11]
            off = OFF.get(key)
            if off is None:
                loc = datetime(int(d[0:4]), int(d[4:6]), int(d[6:8]), int(d[9:11]), tzinfo=EET)
                off = OFF[key] = int(loc.timestamp()) + 7 * 3600
            t = off + int(d[11:13]) * 60
            rows.append((t, float(o), float(h), float(l), float(c)))
    rows.sort(); return rows

def bucket_keys(t):
    """H1: oră UTC. H4/D1: după ora New York decalată cu +7h (deci 17:00 NY = 00:00)."""
    u = datetime.fromtimestamp(t, timezone.utc)
    ny = u.astimezone(NY)
    sh = ny.replace(tzinfo=None) + timedelta(hours=7)
    day = sh.date()
    return t - t % 3600, (day, sh.hour // 4), day

def start_ts(day, slot):
    # începutul slotului: 17:00 NY din ziua anterioară + slot*4h, convertit în UTC
    naive = datetime(day.year, day.month, day.day) - timedelta(hours=7) + timedelta(hours=4 * slot)
    return int(naive.replace(tzinfo=NY).timestamp())

def agg(rows, keyf):
    out = []; cur = None
    for t, o, h, l, c in rows:
        k = keyf(t)
        if cur is None or k != cur[0]:
            if cur: out.append(cur)
            cur = [k, o, h, l, c]
        else:
            cur[2] = max(cur[2], h); cur[3] = min(cur[3], l); cur[4] = c
    if cur: out.append(cur)
    return out

def encode(bars, dec, tfname, sym):
    m = 10 ** dec
    b = []; t0 = bars[0][0]; pt = t0; pc = None
    for t, o, h, l, c in bars:
        O, H, L, C = (round(x * m) for x in (o, h, l, c))
        b += [(t - pt) // 60, O - (pc if pc is not None else O) if pc is not None else O, H - O, O - L, C - O]
        pt = t; pc = C
    return {'s': sym, 'tf': tfname, 'dec': dec, 't0': t0, 'n': len(bars), 'b': b}

def check(bars, tf, sec):
    rng = [h - l for _, o, h, l, c in bars]
    med = statistics.median(rng)
    bad = sum(1 for _, o, h, l, c in bars if not (l <= min(o, c) <= max(o, c) <= h))
    gaps = []
    for (t1, *_), (t2, *_) in zip(bars, bars[1:]):
        d = t2 - t1
        ny = datetime.fromtimestamp(t1, timezone.utc).astimezone(NY)
        weekend = ny.weekday() == 4 and ny.hour >= 15 or ny.weekday() == 5
        if d > (3 if tf == 'H1' else 1) * sec and not weekend and d < 2 * 86400 or d > 4 * 86400:
            gaps.append((datetime.fromtimestamp(t1, timezone.utc).strftime('%Y-%m-%d %H:%M'), round(d / 3600, 1)))
    spikes = [(datetime.fromtimestamp(t, timezone.utc).strftime('%Y-%m-%d %H:%M'), round((h - l) / med, 1)) for t, o, h, l, c in bars if h - l > 12 * med]
    jumps = []
    for a, bb in zip(bars, bars[1:]):
        if abs(bb[1] - a[4]) > 6 * med: jumps.append((datetime.fromtimestamp(bb[0], timezone.utc).strftime('%Y-%m-%d %H:%M'), round(abs(bb[1] - a[4]) / med, 1)))
    return {'bars': len(bars), 'median_range': med, 'ohlc_bad': bad, 'gaps': gaps, 'spikes': spikes, 'jumps': jumps}

total = 0
for p, dec in PAIRS.items():
    sym = p.upper(); m1 = load_m1(p)
    # taie la sfârșitul ultimei zile de tranzacționare complete (17:00 New York), ca ultima bară D1/H4 să fie întreagă
    lastny = datetime.fromtimestamp(m1[-1][0] + 60, timezone.utc).astimezone(NY)
    cut = lastny.replace(hour=17, minute=0, second=0, microsecond=0)
    if cut > lastny: cut -= timedelta(days=1)
    while cut.weekday() >= 5: cut -= timedelta(days=1)   # sâmbătă/duminică nu închid o zi de tranzacționare
    m1 = [r for r in m1 if r[0] < cut.timestamp()]
    # zile de tranzacționare aproape goale (lipsă în sursă) în ultimele 30 de zile → datele se opresc înaintea lor
    perday = {}
    for r in m1:
        k = bucket_keys(r[0])[2]; perday[k] = perday.get(k, 0) + 1
    medday = statistics.median(perday.values())
    lastday = cut.date()
    holiday = lambda d: (d.month, d.day) in ((12, 25), (1, 1))
    for i in range(30, -1, -1):
        d = lastday - timedelta(days=i)
        if d.weekday() >= 5 or holiday(d): continue
        if perday.get(d, 0) < 0.5 * medday:
            prev = d - timedelta(days=1)
            while prev.weekday() >= 5: prev -= timedelta(days=1)
            cut = datetime(prev.year, prev.month, prev.day, 17, tzinfo=NY)
            m1 = [r for r in m1 if r[0] < cut.timestamp()]
            print(f'{sym}: zi incompletă în sursă {d} ({perday.get(d, 0)} min față de ~{medday:.0f}); datele se opresc la {prev}', flush=True)
            break
    TRADE_END[sym] = cut.date().isoformat()
    h1 = [[k] + v for k, *v in agg(m1, lambda t: bucket_keys(t)[0])]
    h4 = [[start_ts(*k)] + v for k, *v in agg(m1, lambda t: bucket_keys(t)[1])]
    d1 = [[int(datetime(k.year, k.month, k.day, tzinfo=timezone.utc).timestamp())] + v for k, *v in agg(m1, lambda t: bucket_keys(t)[2])]
    # D1: elimină zilele de duminică (ar fi doar câteva minute) — nu apar, pentru că duminică 17:00 NY = luni în ziua decalată
    report[sym] = {'m1': len(m1), 'from': datetime.fromtimestamp(m1[0][0], timezone.utc).isoformat(), 'to': datetime.fromtimestamp(m1[-1][0], timezone.utc).isoformat(),
                   'H1': check(h1, 'H1', 3600), 'H4': check(h4, 'H4', 14400), 'D1': check(d1, 'D1', 86400)}
    # acoperire lunară H1 față de mediana aceleiași luni din ceilalți ani → luni cu date incomplete în sursă
    cnt = {}
    for b in h1:
        u = datetime.fromtimestamp(b[0], timezone.utc); cnt[(u.year, u.month)] = cnt.get((u.year, u.month), 0) + 1
    import calendar
    endd = datetime.fromisoformat(TRADE_END[sym]).date()
    def wdays(y, m):   # pentru ultima lună: doar zilele lucrătoare până la final
        last = endd.day if (y, m) == (endd.year, endd.month) else calendar.monthrange(y, m)[1]
        return sum(1 for d in range(1, last + 1) if datetime(y, m, d).weekday() < 5)
    dens = {k: c / wdays(*k) for k, c in cnt.items()}
    norm = statistics.median(dens.values())
    bad = [(y, m, round(v / norm, 2)) for (y, m), v in sorted(dens.items()) if v / norm < 0.9 and not (m == 12 and v / norm > 0.85)]
    BAD[sym] = bad
    files = []
    for y in YEARS:
        part = [b for b in h1 if datetime.fromtimestamp(b[0], timezone.utc).year == y]
        files.append((f'{sym}-H1-{y}.json', encode(part, dec, 'H1', sym)))
    files.append((f'{sym}-H4.json', encode(h4, dec, 'H4', sym)))
    files.append((f'{sym}-D1.json', encode(d1, dec, 'D1', sym)))
    for name, obj in files:
        s = json.dumps(obj, separators=(',', ':'))
        open(f'{OUT}/{name}', 'w').write(s); total += len(s)
    print(sym, len(m1), 'H1', len(h1), 'H4', len(h4), 'D1', len(d1), flush=True)
def merge(bad):
    """Lunile incomplete → intervale [început, sfârșit) în secunde UTC, lipite când sunt consecutive."""
    out = []
    for y, m, _ in bad:
        a = int(datetime(y, m, 1, tzinfo=timezone.utc).timestamp())
        b = int(datetime(y + (m == 12), m % 12 + 1, 1, tzinfo=timezone.utc).timestamp())
        if out and out[-1][1] == a: out[-1][1] = b
        else: out.append([a, b])
    return out
# ultima zi acoperită: sfârșitul ultimei luni complete descărcate (aceeași pentru toate perechile)
last_month_end = min(TRADE_END.values())   # ultima zi de tranzacționare completă, comună tuturor perechilor
idx = {'source': 'HistData.com (M1, ASCII)', 'tz_note': 'Ziua începe la 17:00 New York', 'from': '2019-01-01', 'to': last_month_end,
       'instruments': {p.upper(): {'dec': d, 'H1': [y for y in YEARS], 'H4': True, 'D1': True,
       'incomplete': merge(BAD[p.upper()])} for p, d in PAIRS.items()}}
open(f'{OUT}/index.json', 'w').write(json.dumps(idx, ensure_ascii=False, separators=(',', ':')))
json.dump(report, open('/workspace/forex-ms-tools/simdata/report.json', 'w'), indent=1, default=str)
print('total bytes', total)
print('incomplete', json.dumps(BAD))
