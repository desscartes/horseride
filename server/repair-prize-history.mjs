import './runtime-env.mjs'
import {readFile,writeFile} from 'node:fs/promises'
process.env.HORSERIDE_NO_LISTEN='1'
const {collectHistoricalDay}=await import('./index.mjs')
const {racingCountry}=await import('./foreign-data.mjs')
const audit=JSON.parse(await readFile('data/maintenance/prize-coverage.json','utf8'))
if(!Array.isArray(audit.unmatched))throw Error('Run updated prize coverage audit first')
const groups=new Map()
for(const key of audit.unmatched){const [date,city]=JSON.parse(key);if(date>audit.through)continue;const foreignOnly=Boolean(racingCountry(city)),id=JSON.stringify([date,foreignOnly]);groups.set(id,{date,foreignOnly})}
const path='data/maintenance/prize-history-repair.json',state={startedAt:new Date().toISOString(),phase:'running',groups:groups.size,completed:[],failures:[]}
const save=()=>writeFile(path,JSON.stringify(state,null,2));await save()
for(const {date,foreignOnly}of groups.values()){
 try{const result=await collectHistoricalDay(date,{foreignOnly});state.completed.push(result)}catch(error){state.failures.push({date,foreignOnly,error:error.message})}
 await save()
}
state.phase=state.failures.length||state.completed.some(r=>r.failures.length||r.reports.some(m=>m.rejected?.length))?'partial':'complete';state.finishedAt=new Date().toISOString();await save()
console.log(JSON.stringify({phase:state.phase,groups:state.groups,completed:state.completed.length,failures:state.failures.length}))
