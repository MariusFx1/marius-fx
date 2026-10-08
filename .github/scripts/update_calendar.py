#!/usr/bin/env python3
"""Descarcă feed-ul săptămânal ForexFactory și scrie data/calendar.json.

Fișierul se rescrie doar dacă evenimentele s-au schimbat sau dacă ultima scriere
are peste HEARTBEAT_H ore (ca pagina să știe că datele sunt încă verificate).
Feed-ul permite maximum 2 cereri la 5 minute per IP și se actualizează cel mult o dată pe oră.
Ieșire: cod 0 dacă totul e în regulă sau dacă feed-ul e temporar indisponibil dar datele
existente sunt recente; cod 1 dacă feed-ul nu răspunde și datele au peste FAIL_AFTER_H ore.
Folosire: update_calendar.py [fișier_local.json]  (fișierul local e doar pentru teste)
FORCE=1 în mediu rescrie fișierul chiar dacă datele nu s-au schimbat (pornire manuală).
"""
import json, os, sys, urllib.request
from datetime import datetime, timezone, timedelta

FEED = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json'
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'calendar.json')
HEARTBEAT_H = 20
FAIL_AFTER_H = 48
IMPACTS = {'High', 'Medium', 'Low', 'Holiday'}


def now_utc():
    return datetime.now(timezone.utc).replace(microsecond=0)


def load_existing():
    try:
        with open(OUT, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def fetch(src):
    if src:
        with open(src, 'rb') as f:
            raw = f.read()
    else:
        req = urllib.request.Request(FEED, headers={
            'User-Agent': 'marius-fx-calendar/1.0 (+https://mariusfx1.github.io/marius-fx/calendar.html)',
            'Accept': 'application/json'})
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
    data = json.loads(raw.decode('utf-8'))  # pagina HTML "Request Denied" pică aici
    if not isinstance(data, list):
        raise ValueError('feed is not a JSON list')
    events = []
    for e in data:
        if not isinstance(e, dict):
            continue
        try:
            title = str(e['title']).strip()
            country = str(e['country']).strip().upper()
            date = str(e['date']).strip()
            datetime.fromisoformat(date)  # validează ISO cu offset
        except (KeyError, ValueError):
            continue
        impact = str(e.get('impact', '')).strip()
        if not title or impact not in IMPACTS:
            continue
        events.append({'title': title, 'country': country, 'date': date, 'impact': impact,
                       'forecast': str(e.get('forecast') or '').strip(),
                       'previous': str(e.get('previous') or '').strip()})
    if len(events) < 10:
        raise ValueError(f'only {len(events)} valid events, refusing to overwrite')
    events.sort(key=lambda x: (datetime.fromisoformat(x['date']), x['country'], x['title']))
    return events


def age_hours(existing):
    try:
        return (now_utc() - datetime.fromisoformat(existing['updated'].replace('Z', '+00:00'))).total_seconds() / 3600
    except (TypeError, KeyError, ValueError):
        return float('inf')


def main():
    existing = load_existing()
    try:
        events = fetch(sys.argv[1] if len(sys.argv) > 1 else None)
    except Exception as exc:  # rețea, limită depășită, JSON invalid
        age = age_hours(existing)
        print(f'::warning::Feed unavailable ({exc}); existing data is {age:.1f}h old')
        sys.exit(1 if age > FAIL_AFTER_H else 0)

    changed = not existing or existing.get('events') != events
    force = os.environ.get('FORCE') == '1'
    if not changed and not force and age_hours(existing) < HEARTBEAT_H:
        print(f'No change ({len(events)} events); data written {age_hours(existing):.1f}h ago. Nothing to commit.')
        return
    doc = {
        'source': 'ForexFactory',
        'sourceUrl': 'https://www.forexfactory.com/calendar',
        'updated': now_utc().isoformat().replace('+00:00', 'Z'),
        'events': events,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    print(('Updated' if changed else 'Heartbeat') + f': {len(events)} events written to data/calendar.json')


if __name__ == '__main__':
    main()
