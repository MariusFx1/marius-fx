// Descarcă H1 (bid) de la Dukascopy prin dukascopy-node, cache în simdata/raw/{inst}-{year}.json
const { getHistoricalRates } = require('dukascopy-node');
const fs = require('fs');
const INST = (process.argv[2] || 'eurusd,gbpusd,usdjpy,xauusd,audusd,gbpjpy').split(',');
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
(async () => {
  for (const i of INST) for (const y of YEARS) {
    const f = `simdata/raw/${i}-${y}.json`;
    if (fs.existsSync(f)) continue;
    const t0 = Date.now();
    const d = await getHistoricalRates({ instrument: i, dates: { from: new Date(Date.UTC(y - 1, 11, 31)), to: new Date(Date.UTC(y + 1, 0, 2)) }, timeframe: 'h1', priceType: 'bid', format: 'array', volumes: true, ignoreFlats: true, batchSize: 15, pauseBetweenBatchesMs: 300 });
    fs.writeFileSync(f, JSON.stringify(d));
    console.log(i, y, d.length, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
})().catch(e => { console.error(e); process.exit(1); });
