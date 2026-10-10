#!/bin/bash
# lh5.sh <tag> [base]: Lighthouse mobil (implicit) pe 5 pagini, 2 rulări -> rezumat mediană
TAG=$1; BASE=${2:-https://mariusfx1.github.io/marius-fx}
mkdir -p lh
for pg in index lectie calculator simulator calendar; do for run in 1 2; do
  CHROME_PATH=/usr/bin/google-chrome npx lighthouse "$BASE/$pg.html" --quiet --chrome-flags="--headless=new --no-sandbox" \
    --only-categories=performance --output=json --output-path=lh/$TAG-$pg-$run.json >/dev/null 2>&1
done; done
node -e '
const fs=require("fs");const tag=process.argv[1];
for (const pg of ["index","lectie","calculator","simulator","calendar"]) {
  const r=[1,2].map(n=>{try{return JSON.parse(fs.readFileSync(`lh/${tag}-${pg}-${n}.json`))}catch(e){return null}}).filter(Boolean);
  const a=(k)=>r.map(x=>x.audits[k].numericValue);const med=v=>v.sort((x,y)=>x-y)[Math.floor((v.length-1)/2)];
  const blk=r[0].audits["render-blocking-resources"].details?.items?.map(i=>i.url.split("/").pop().slice(0,40)+":"+Math.round(i.wastedMs)).join(" ")||"";
  console.log(pg.padEnd(10),"perf",r.map(x=>Math.round(x.categories.performance.score*100)).join("/"),
   "FCP",(med(a("first-contentful-paint"))/1000).toFixed(2),"LCP",(med(a("largest-contentful-paint"))/1000).toFixed(2),
   "TBT",Math.round(med(a("total-blocking-time"))),"KB",Math.round(med(a("total-byte-weight"))/1024),"| block:",blk);
}' $TAG
