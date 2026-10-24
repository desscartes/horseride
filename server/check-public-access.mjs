import {readFile,writeFile} from 'node:fs/promises'
const configuration=JSON.parse((await readFile('data/maintenance/public-address.json','utf8')).replace(/^\uFEFF/,''))
const report={checkedAt:new Date().toISOString(),checks:[]}
for(const [name,base] of [['api','http://127.0.0.1:8788'],['gateway',configuration.gateway||'http://127.0.0.1:8790'],['external',configuration.url]]){
 try{const url=new URL('/api/health',base),response=await fetch(url,{signal:AbortSignal.timeout(12000)}),payload=await response.json();report.checks.push({name,status:response.status,ok:response.ok&&payload.ok===true,service:payload.service})}catch(error){report.checks.push({name,ok:false,error:error.cause?.code||error.message})}
}
report.ok=report.checks.every(c=>c.ok)
await writeFile('data/maintenance/public-access-health.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.ok)process.exitCode=1
