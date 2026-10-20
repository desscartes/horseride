import {readdir,readFile,writeFile} from 'node:fs/promises'
import {DatabaseSync} from 'node:sqlite'
import {probabilityQuality,verifiedPrestartProbabilityRecord} from './probability-quality.mjs'
import {prospectiveOutcome} from './prospective-outcomes.mjs'
import {localDay} from './maintenance-policy.mjs'
const latest=new Map(),directory='data/external/prestart';let invalidCaptures=0,files=0
for(const file of (await readdir(directory)).filter(f=>f.endsWith('.json')).sort()){
 const value=JSON.parse(await readFile(directory+'/'+file,'utf8'));files++
 for(const row of value.records||[]){if(!verifiedPrestartProbabilityRecord(row)){invalidCaptures++;continue}const key=JSON.stringify([row.date,row.city,row.raceNo]);if(!latest.has(key)||Date.parse(latest.get(key).capturedAt)<Date.parse(row.capturedAt))latest.set(key,row)}
}
const records=[...latest.values()]
const since=records.map(r=>r.date).filter(Boolean).sort()[0];if(!since)throw Error('No prestart records')
const database=new DatabaseSync(process.env.HORSERIDE_DB||'data/horseride.sqlite',{readOnly:true}),outcomes=new Map()
try{for(const row of database.prepare('SELECT date,city,race_no,race_json,results_json FROM historical_race_data WHERE date>=?').iterate(since))outcomes.set(`${row.date}:${row.city}:${row.race_no}`,prospectiveOutcome(JSON.parse(row.race_json),new Map(JSON.parse(row.results_json))))}finally{database.close()}
const report={checkedAt:new Date().toISOString(),since,files,...probabilityQuality(records,outcomes)};report.excluded.not_verified_prestart_model=invalidCaptures
await writeFile(`data/maintenance/probability-quality-${localDay()}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({checkedAt:report.checkedAt,recorded:report.recorded,excluded:report.excluded,total:report.total,byCountry:report.byCountry}))
