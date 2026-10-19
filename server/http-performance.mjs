import {monitorEventLoopDelay,performance} from 'node:perf_hooks'
import {mkdir,writeFile,rename} from 'node:fs/promises'
import {dirname} from 'node:path'
export function attachHttpPerformance(server,{path='data/maintenance/http-performance.json',intervalMs=30000}={}){
 const routes=new Map(),lag=monitorEventLoopDelay({resolution:20});lag.enable();let writing=false
 server.prependListener('request',(req,res)=>{
  const started=performance.now(),route=String(req.url||'').split('?')[0]
  if(!route.startsWith('/api/'))return
  const key=/^\/api\/analysis\/jobs\//.test(route)?'/api/analysis/jobs/:id':route
  if(routes.size>=40&&!routes.has(key))return
  res.once('finish',()=>{const item=routes.get(key)||{count:0,errors:0,samples:[]};item.count++;item.errors+=Number(res.statusCode>=500);item.samples.push(performance.now()-started);if(item.samples.length>300)item.samples.shift();routes.set(key,item)})
 })
 const timer=setInterval(async()=>{
  if(writing)return;writing=true
  try{
   const percentile=(v,p)=>{const a=[...v].sort((a,b)=>a-b);return a.length?Math.round(a[Math.max(0,Math.ceil(a.length*p)-1)]):null}
   const report={checkedAt:new Date().toISOString(),pid:process.pid,scope:'Response samples: last 300 per route; counts since process start. No query strings or user data.',eventLoop:{p95Ms:Math.round(lag.percentile(95)/1e6),maxMs:Math.round(lag.max/1e6)},routes:Object.fromEntries([...routes].map(([k,v])=>[k,{count:v.count,errors:v.errors,samples:v.samples.length,p50Ms:percentile(v.samples,.5),p95Ms:percentile(v.samples,.95),maxMs:Math.round(Math.max(...v.samples))}]))}
   await mkdir(dirname(path),{recursive:true});await writeFile(`${path}.${process.pid}.tmp`,JSON.stringify(report,null,2));await rename(`${path}.${process.pid}.tmp`,path);lag.reset()
  }catch(error){console.error('HTTP measurement:',error.message)}finally{writing=false}
 },intervalMs);timer.unref()
 return ()=>{clearInterval(timer);lag.disable()}
}
