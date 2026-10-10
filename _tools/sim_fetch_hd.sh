#!/bin/bash
# Descarcă M1 (ASCII) de la HistData.com: un zip pe pereche/an. Politicos: pauză între cereri.
cd /workspace/forex-ms-tools/simdata/hd
for p in ${PAIRS:-eurusd gbpusd usdjpy xauusd audusd gbpjpy}; do for y in 2019 2020 2021 2022 2023 2024 2025; do
  f=$p-$y.zip; [ -s $f ] && unzip -tq $f >/dev/null 2>&1 && continue
  U="https://www.histdata.com/download-free-forex-historical-data/?/ascii/1-minute-bar-quotes/$p/$y"
  tk=$(curl -s -c cj -A "Mozilla/5.0" "$U" | grep -o 'id="tk" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"//')
  P=$(echo $p | tr a-z A-Z)
  curl -s -b cj -A "Mozilla/5.0" -e "$U" -X POST https://www.histdata.com/get.php -d "tk=$tk&date=$y&datemonth=$y&platform=ASCII&timeframe=M1&fxpair=$P" -o $f
  echo "$p $y $(stat -c %s $f) $(unzip -l $f 2>/dev/null | tail -1)"; sleep 3
done; done
