import {writeFile,mkdir} from 'node:fs/promises'
import {dirname} from 'node:path'
import {localDay} from './maintenance-policy.mjs'
const day=localDay(),base=process.env.BENCHMARK_BASE||'http://127.0.0.1:8790',rounds=Number(process.env.BENCHMARK_ROUNDS)||10
const paths=[['health','/api/health'],['MY','/api/races?'+new URLSearchParams({date:day,city:'Selangor Malezya'})],['US','/api/races?'+new URLSearchParams({date:day,city:'Belmont Park ABD'})],['coupons','/api/coupon-showcase?'+new URLSearchParams({date:day,city:'Ankara'})]]
const samples=[];const startedAt=new Date().toISOString()
for(let round=0;round<rounds;round++){
 await Promise.all(paths.map(async([name,path])=>{const t=performance.now();try{const r=await fetch(base+path,{signal:AbortSignal.timeout(20000)}),data=await r.json();samples.push({round,name,ms:Math.round(performance.now()-t),status:r.status,races:data.races?.length,budgets:data.selectedMeetingCoupons?.map(r=>r.budget)})}catch(e){samples.push({round,name,ms:Math.round(performance.now()-t),error:e.message})}}))
 await new Promise(r=>setTimeout(r,200))
}
const summary=Object.fromEntries(paths.map(([name])=>{const rows=samples.filter(r=>r.name===name),times=rows.map(r=>r.ms).sort((a,b)=>a-b);return [name,{samples:rows.length,errors:rows.filter(r=>r.error||r.status!==200).length,p50Ms:times[Math.ceil(times.length*.5)-1],p95Ms:times[Math.ceil(times.length*.95)-1],maxMs:times.at(-1)}]}))
const report={startedAt,finishedAt:new Date().toISOString(),base,rounds,summary,samples,note:'Small controlled sample, not long-term service SLO. First round includes cold application caches.'},path=process.argv[2]||'data/maintenance/api-benchmark-latest.json'
await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(report,null,2));console.log(JSON.stringify(summary))
