import {readFile,mkdir,writeFile,access,rename} from 'node:fs/promises'
import {equibaseTracks} from './foreign-data.mjs'
const root='data/intelligence-models/2026-10-20/morning',directory='data/experiments/us-historical-chart-pilot-v1'
await mkdir(directory+'/pdfs',{recursive:true})
try{const previous=JSON.parse(await readFile(directory+'/collection-report.json','utf8'));if(previous.finishedAt){console.log(JSON.stringify({status:'already_probed',sourceChanged:false,report:directory+'/collection-report.json'}));process.exit(0)}}catch(e){if(e.code!=='ENOENT')throw e}
const data=JSON.parse(await readFile(root+'/US/US-training.json','utf8')),knownFailures=new Set()
for(const p of ['data/external/equibase/collection-report.json','data/external/equibase-career/collection-report.json']){try{for(const f of JSON.parse(await readFile(p,'utf8')).failures||[])if(f.name)knownFailures.add(f.name)}catch(e){if(e.code!=='ENOENT')throw e}}
const targets=[]
for(const month of ['2026-01','2026-03','2026-05','2026-07','2026-08']){
 for(const r of data.races.filter(r=>r.date.startsWith(month)&&equibaseTracks[r.city]).sort((a,b)=>a.date.localeCompare(b.date)||a.city.localeCompare(b.city))){
  const [y,m,d]=r.date.split('-'),name=`${equibaseTracks[r.city].code}${m}${d}${y.slice(2)}USA.pdf`;if(knownFailures.has(name))continue
  let exists=false;for(const base of ['data/external/equibase','data/external/equibase-career',directory+'/pdfs'])try{await access(base+'/'+name);exists=true;break}catch(e){if(e.code!=='ENOENT')throw e}if(exists)continue
  targets.push({date:r.date,city:r.city,name,url:'https://tvg.equibase.com/static/chart/pdf/'+name});break
 }
}
const report={startedAt:new Date().toISOString(),scope:'Up to five known TJK archived meetings in earlier fit months; isolated files, no registry or model mutation',targets,completed:[],failures:[],activeModelChanged:false};await writeFile(directory+'/collection-report.json',JSON.stringify(report,null,2))
let misses=0
for(const t of targets){try{
 const response=await fetch(t.url,{signal:AbortSignal.timeout(15000)})
 if([401,403,429].includes(response.status)){report.stopReason='source_access_restricted';report.failures.push({...t,status:response.status});break}
 if(!response.ok){report.failures.push({...t,status:response.status});if(++misses>=2){report.stopReason='repeated_historical_unavailability';break}continue}
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.subarray(0,4).toString()!=='%PDF'){report.stopReason='unexpected_source_response';report.failures.push({...t,error:'Not a PDF; no alternative route attempted'});break}
 await writeFile(directory+'/pdfs/'+t.name+'.tmp',bytes);await rename(directory+'/pdfs/'+t.name+'.tmp',directory+'/pdfs/'+t.name)
 await writeFile(directory+'/pdfs/'+t.name.replace('.pdf','.source.json'),JSON.stringify({url:t.url,date:t.date,retrievedAt:new Date().toISOString(),availability:'post_race',scope:'known_historical_TJK_meeting_pilot'}))
 report.completed.push({...t,bytes:bytes.length});misses=0
 }catch(e){report.failures.push({...t,error:e.message});if(++misses>=2){report.stopReason='repeated_source_transport_failure';break}}
}
report.finishedAt=new Date().toISOString();await writeFile(directory+'/collection-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
