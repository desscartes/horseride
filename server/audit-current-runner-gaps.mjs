process.env.HORSERIDE_NO_LISTEN='1'
import './runtime-env.mjs'
import {writeFileSync} from 'node:fs'
import {readServedProgram} from './served-program.mjs'
import {localDay} from './maintenance-policy.mjs'
import {racingCountry} from './foreign-data.mjs'
import {horsePedigree} from './pedigree-features.mjs'
import {horseIdentity} from './data-quality.mjs'
const {buildHistoricalAnalysisContext}=await import('./index.mjs')
const date=process.argv[2]||localDay(),program=readServedProgram(date)
if(!program?.races?.length)throw Error('No served program for requested day')
const rows=[]
for(const race of buildHistoricalAnalysisContext(program.races,date))for(const h of race.horses.filter(h=>!h.outOfRace)){
 const runs=h.horsePerformance?.recentRuns||[],env=race.environment||h.sourceData?.tjk?.raceEnvironment
 const fields={parents:!!h.sire&&!!h.dam,damsire:!!horsePedigree(h).damsire,history:(h.evidenceCoverage?.recentRuns||0)>0,individualTime:runs.some(r=>r.timeSeconds>0),workout:(h.workouts||[]).some(w=>w.dateISO<date),jockey:!!h.jockey,trainer:!!h.trainer,weight:Number(h.weight)>0,draw:Number(h.start)>0,prize:!!race.prizeMoney,trackCondition:env?.date===date&&!!env.tracks?.some(t=>horseIdentity(t.surface)===horseIdentity(race.surface)&&t.condition)}
 rows.push({country:racingCountry(race.city)||'TR',city:race.city,raceNo:race.no,horseNo:h.no,name:h.name,horseId:h.horseId||null,verifiedDebut:h.australianEvidence?.career?.starts===0,missing:Object.keys(fields).filter(k=>!fields[k]),fields})
}
const countries=Object.fromEntries([...new Set(rows.map(r=>r.country))].map(c=>{const list=rows.filter(r=>r.country===c);return [c,{runners:list.length,missing:Object.fromEntries(Object.keys(list[0].fields).map(f=>[f,list.filter(r=>!r.fields[f]).length]))}]}))
const report={date,checkedAt:new Date().toISOString(),scope:'All active runners in served program; field availability only, not proof of model consumption. Missing history never establishes debut; verifiedDebut only explicit source career zero. No source requests or prediction/model changes.',countries,rows}
writeFileSync(`data/maintenance/current-runner-gaps-${date}.json`,JSON.stringify(report,null,2))
console.log(JSON.stringify({date,countries,rows:rows.length}))
