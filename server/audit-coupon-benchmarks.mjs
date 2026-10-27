import {readdir,readFile,writeFile} from 'node:fs/promises'
import {DatabaseSync} from 'node:sqlite'
import {evaluateCouponPairs} from './coupon-benchmark-results.mjs'
import {prospectiveOutcome} from './prospective-outcomes.mjs'
import {localDay} from './maintenance-policy.mjs'
const directory='data/external/coupon-benchmarks',pairs=[]
for(const day of await readdir(directory))if(/^\d{4}-\d{2}-\d{2}$/.test(day))for(const file of await readdir(directory+'/'+day))if(file.endsWith('.json'))pairs.push(...JSON.parse(await readFile(directory+'/'+day+'/'+file,'utf8')).pairs||[])
const outcomes=new Map(),db=new DatabaseSync(process.env.HORSERIDE_DB||'data/horseride.sqlite',{readOnly:true})
try{for(const date of new Set(pairs.map(p=>p.date)))for(const r of db.prepare('SELECT city,race_no,race_json,results_json FROM historical_race_data WHERE date=?').iterate(date))outcomes.set(`${date}:${r.city}:${r.race_no}`,prospectiveOutcome(JSON.parse(r.race_json),new Map(JSON.parse(r.results_json))))}finally{db.close()}
const report={checkedAt:new Date().toISOString(),...evaluateCouponPairs(pairs,outcomes)}
await writeFile(`data/maintenance/coupon-benchmarks-${localDay()}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rows:undefined}))
