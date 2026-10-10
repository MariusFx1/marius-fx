#!/bin/bash
# Actualizarea datelor simulatorului (manual, o dată pe lună, după ce HistData publică luna încheiată, de obicei în primele zile).
#
# De ce manual și nu GitHub Actions: HistData.com nu oferă API. Descărcarea gratuită e un formular web gândit pentru oameni,
# iar singura cale automată oficială e FTP/SFTP cu cont primit pe e-mail (vezi https://www.histdata.com/f-a-q/).
# Un workflow care ar completa formularul de pe serverele GitHub ar fi neoficial și fragil, așa că rulăm acest script de mână.
#
# Ce face (nu suprascrie nimic dacă un pas eșuează):
#   1. descarcă lunile încheiate lipsă ale anului curent (și ale anului trecut, dacă suntem în ianuarie), un zip pe pereche/lună;
#      ultima lună descărcată anterior se descarcă din nou (REFRESH=1, implicit), în caz că sursa a completat-o între timp;
#   2. construiește JSON-urile într-un folder temporar (sim_build.py), tăiat la ultima zi de tranzacționare completă;
#   3. validează (sim_validate.py): istoricul publicat rămâne identic, data de final nu scade, bare consistente,
#      fără perioade incomplete noi, fără salturi suspecte (excepție: evenimente reale verificate din sim_known_events.json);
#   4. abia apoi copiază în forex-ms/data/sim/ și rulează testele motorului.
# După rulare: verifică „git diff --stat data/sim”, rulează test-simulator.js și test-workspace.js, apoi commit + push.
#
# Folosire:  ./sim_update.sh            (sau DRY=1 ./sim_update.sh ca să validezi fără să copiezi)
set -euo pipefail
cd "$(dirname "$0")"
SITE=/workspace/forex-ms/data/sim
HD=simdata/hd
Y=$(date -u +%Y); M=$(date -u +%-m)
years="$Y"; [ "$M" -eq 1 ] && years="$((Y - 1))"
for yy in $years; do
  if [ "$yy" -lt "$Y" ]; then months=$(seq 1 12); else months=$(seq 1 $((M - 1))); fi
  [ -z "$months" ] && continue
  if [ "${REFRESH:-1}" = 1 ]; then   # reîmprospătează cea mai recentă lună deja descărcată
    lastm=$(ls $HD/eurusd-$yy-??.zip 2>/dev/null | sed 's/.*-\([0-9][0-9]\)\.zip/\1/' | sort | tail -1 || true)
    [ -n "$lastm" ] && for p in eurusd gbpusd usdjpy xauusd audusd gbpjpy; do mv -f $HD/$p-$yy-$lastm.zip $HD/$p-$yy-$lastm.zip.prev 2>/dev/null || true; done
  fi
  if ! YEAR=$yy MONTHS="$months" ./sim_fetch_months.sh; then
    echo "Descărcarea a eșuat; refac arhivele anterioare și mă opresc. Nimic nu a fost modificat pe site."
    for f in $HD/*.zip.prev; do [ -e "$f" ] && [ ! -s "${f%.prev}" ] && mv "$f" "${f%.prev}"; done
    exit 1
  fi
  rm -f $HD/*.zip.prev
done
STAGE=$(mktemp -d)
SIM_OUT=$STAGE python3 sim_build.py
python3 sim_validate.py "$STAGE" "$SITE" || { echo "Validarea a eșuat: datele publicate NU au fost modificate ($STAGE păstrat pentru analiză)."; exit 1; }
[ "${DRY:-0}" = 1 ] && { echo "DRY: validare OK, nu copiez."; exit 0; }
cp "$STAGE"/*.json "$SITE"/
node test-sim-engine.js | tail -1
echo "Gata. Interval nou: $(python3 -c "import json;print(json.load(open('$SITE/index.json'))['to'])"). Verifică git diff, rulează suitele, apoi commit + push."
