#!/bin/bash
# Folosire: lh-run.sh <tag> <base-url>  -> lh/<tag>-<page>.json (mobil, implicit Lighthouse)
TAG=$1; BASE=$2
for pg in index lectie calculator; do
  for run in 1 2; do
    CHROME_PATH=/usr/bin/google-chrome npx lighthouse "$BASE/$pg.html" --quiet --chrome-flags="--headless=new --no-sandbox" \
      --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=lh/$TAG-$pg-$run.json >/dev/null 2>&1
  done
done
node -e '
const fs=require("fs");const tag=process.argv[1];
for (const pg of ["index","lectie","calculator"]) {
  const r=[1,2].map(n=>{try{return JSON.parse(fs.readFileSync(`lh/${tag}-${pg}-${n}.json`))}catch(e){return null}}).filter(Boolean);
  const c=k=>r.map(x=>Math.round(x.categories[k].score*100));
  console.log(pg.padEnd(11), "perf", c("performance").join("/"), " a11y", c("accessibility").join("/"), " bp", c("best-practices").join("/"), " seo", c("seo").join("/"));
}' $TAG
