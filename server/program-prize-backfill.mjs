process.env.HORSERIDE_NO_LISTEN='1'
import './runtime-env.mjs'
import {DatabaseSync} from 'node:sqlite'
import {writeFileSync} from 'node:fs'
import {readServedProgram,publishProgram} from './served-program.mjs'
import {horseIdentity} from './data-quality.mjs'
const date=process.argv[2]
if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw Error('Valid program date required')
const {parseCsv}=await import('./index.mjs')
const snapshot=readServedProgram(date);if(!snapshot)throw Error('No cached program')
const fingerprint=JSON.stringify(snapshot)
const db=new DatabaseSync('data/horseride.sqlite',{readOnly:true})
const sources=db.prepare("SELECT city,provider_url,raw_content FROM source_snapshots WHERE date=? AND source='tjk_csv' ORDER BY fetched_at DESC").all(date);db.close()
const byCity=new Map();for(const row of sources)if(!byCity.has(row.city))byCity.set(row.city,row)
const report={date,checkedAt:new Date().toISOString(),updated:[],rejected:[],rankingChanged:false}
const races=snapshot.races.map(race=>{
 if(race.prizeMoney)return race
 const source=byCity.get(race.city);if(!source)return race
 const parsed=parseCsv(source.raw_content)
 const matches=parsed.races.filter(r=>Number(r.no)===Number(race.no))
 const raw=matches[0]
 const key=h=>`${h.no}:${horseIdentity(h.name)}`
 const left=race.horses.filter(h=>!h.outOfRace).map(key).sort(),right=raw?.horses.map(key).sort()
 if(parsed.meetingDate!==date||matches.length!==1||!raw.prizeMoney||raw.distance!==race.distance||raw.surface!==race.surface||JSON.stringify(left)!==JSON.stringify(right)){
  report.rejected.push({city:race.city,no:race.no,reason:'date/race/field/conditions/prize mismatch'});return race
 }
 report.updated.push({city:race.city,no:race.no})
 return {...race,prizeMoney:{...raw.prizeMoney,date,providerUrl:source.provider_url}}
})
if(JSON.stringify(readServedProgram(date))!==fingerprint)throw Error('Program changed during backfill; retry with new snapshot')
if(report.updated.length)publishProgram(date,{...snapshot,races})
writeFileSync('data/maintenance/program-prize-backfill.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
