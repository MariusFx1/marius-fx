const puppeteer=require('puppeteer-core');
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();
for (const w of [1081,1280]) { await p.setViewport({width:w,height:800});
await p.goto('http://localhost:8765/contact.html',{waitUntil:'networkidle0'});
const r=await p.evaluate((extra)=>{const ul=document.querySelector('.nav-links');const nav=document.querySelector('.nav');
const m=()=>{const lis=[...ul.children];const tops=new Set(lis.map(l=>Math.round(l.getBoundingClientRect().top)));const last=lis[lis.length-1].getBoundingClientRect();const lg=document.querySelector('.nav .logo').getBoundingClientRect();return {gap:Math.round(ul.getBoundingClientRect().left-lg.right),rows:tops.size,right:Math.round(last.right),navRight:Math.round(nav.getBoundingClientRect().right),ulW:Math.round(ul.getBoundingClientRect().width)}};
const a=m();
for(const t of extra){const li=document.createElement('li');li.innerHTML='<a href="#">'+t+'</a>';ul.insertBefore(li,ul.children[1]);}
return [a,m()];},process.env.X.split(',')); console.log(w,JSON.stringify(r)); }
await b.close();})();
