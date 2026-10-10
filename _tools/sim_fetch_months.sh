#!/bin/bash
# Descarcă lunile complete ale anului curent de la HistData.com (M1 ASCII): un zip pe pereche/lună.
# Folosire: YEAR=2026 MONTHS="1 2 3" ./sim_fetch_months.sh   (implicit: lunile încheiate ale anului curent)
# Fișierele valide existente nu se descarcă din nou. Pauză politicoasă între cereri.
set -u
DIR=${DIR:-/workspace/forex-ms-tools/simdata/hd}; mkdir -p "$DIR"; cd "$DIR"
Y=${YEAR:-$(date -u +%Y)}
if [ -z "${MONTHS:-}" ]; then last=$(( $(date -u +%m | sed 's/^0//') - 1 )); [ "$Y" -lt "$(date -u +%Y)" ] && last=12; MONTHS=$(seq 1 $last); fi
fail=0
for p in ${PAIRS:-eurusd gbpusd usdjpy xauusd audusd gbpjpy}; do for m in $MONTHS; do
  f=$p-$Y-$(printf %02d $m).zip
  [ -s $f ] && unzip -tq $f >/dev/null 2>&1 && continue
  U="https://www.histdata.com/download-free-forex-historical-data/?/ascii/1-minute-bar-quotes/$p/$Y/$m"
  tk=$(curl -s -c cj -A "Mozilla/5.0" "$U" | grep -o 'id="tk" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"//')
  P=$(echo $p | tr a-z A-Z)
  curl -s -b cj -A "Mozilla/5.0" -e "$U" -X POST https://www.histdata.com/get.php -d "tk=$tk&date=$Y&datemonth=$Y$(printf %02d $m)&platform=ASCII&timeframe=M1&fxpair=$P" -o $f.part
  if unzip -tq $f.part >/dev/null 2>&1; then mv $f.part $f; echo "ok $f $(stat -c %s $f)"; else rm -f $f.part; echo "FAIL $f"; fail=1; fi
  sleep 3
done; done
exit $fail
