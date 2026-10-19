process.env.HORSERIDE_NO_LISTEN='1'
import './runtime-env.mjs'
import {readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {racingCountry} from './foreign-data.mjs'
import {raceEnvironment} from './environment-features.mjs'
import {horsePedigree} from './pedigree-features.mjs'
import {horseIdentity} from './data-quality.mjs'
const focus=['TR','US','GB','FR','ZA','AU'], countries={},examples={}
const files=readdirSync('data/program-cache').filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse()
if(files.length){const latest=JSON.parse(readFileSync(`data/program-cache/${files[0]}`,'utf8'));for(const race of latest.races||[]){const country=racingCountry(race.city)||'TR';if(!focus.includes(country))focus.push(country)}}
const selected=new Map()
for(const file of files){
 const payload=JSON.parse(readFileSync(`data/program-cache/${file}`,'utf8'))
 for(const country of focus)if(!selected.has(country)){
  const races=(payload.races||[]).filter(r=>(racingCountry(r.city)||'TR')===country)
  if(races.length)selected.set(country,{date:payload.date||file.slice(0,10),races})
 }
 if(selected.size===focus.length)break
}
const {buildHistoricalAnalysisContext}=await import('./index.mjs')
for(const country of focus){
 const input=selected.get(country);if(!input){countries[country]={status:'no_cached_program'};continue}
 const races=buildHistoricalAnalysisContext(input.races,input.date)
 const counts={identity:0,parents:0,damsire:0,jockey:0,trainer:0,weight:0,draw:0,form:0,history:0,sameSurface:0,sameDistance:0,workout:0,ownTimedRun:0,speedReference:0,pace:0,jockeyResults:0,prize:0,weather:0,trackCondition:0}
 let runners=0;examples[country]=[]
 for(const race of races){
  const env=raceEnvironment(race,input.date)
  for(const horse of race.horses.filter(h=>!h.outOfRace)){
   runners++;const runs=horse.horsePerformance?.recentRuns||[],coverage=horse.evidenceCoverage||{}
   const values={identity:Number(horse.horseId)>0,parents:!!horse.sire&&!!horse.dam,damsire:!!horse.damsire||String(horse.dam||'').includes('/'),jockey:!!horse.jockey&&!/bilinmiyor/i.test(horse.jockey),trainer:!!horse.trainer&&!/bilinmiyor/i.test(horse.trainer),weight:Number(horse.weight)>0,draw:Number(horse.start)>0,form:/[1-9]/.test(horse.lastSix||''),history:coverage.recentRuns>0,sameSurface:coverage.sameSurfaceRuns>0,sameDistance:coverage.sameDistanceRuns>0,workout:(horse.workouts||[]).some(w=>w.dateISO<input.date),ownTimedRun:runs.some(r=>r.timeSeconds>0),speedReference:horse.performanceEvidence?.speedEvidenceCount>0,pace:horse.paceEvidence?.verifiedPaceStarts>0,jockeyResults:horse.jockeyPerformance?.starts>0,prize:!!race.prizeMoney,weather:!env.missingTemperature,trackCondition:!!(race.environment||horse.sourceData?.tjk?.raceEnvironment)?.tracks?.some(t=>t.condition)}
   values.damsire=!!horsePedigree(horse).damsire
   const environment=race.environment||horse.sourceData?.tjk?.raceEnvironment
   values.trackCondition=environment?.date===input.date&&!!environment.tracks?.some(t=>horseIdentity(t.surface)===horseIdentity(race.surface)&&t.condition)
   for(const [field,ok]of Object.entries(values))counts[field]+=Number(ok)
   if(examples[country].length<5)examples[country].push({name:horse.name,city:race.city,raceNo:race.no,missing:Object.keys(values).filter(k=>!values[k]),environment:race.environment||horse.sourceData?.tjk?.raceEnvironment||null})
  }
 }
 countries[country]={date:input.date,races:races.length,runners,counts,percent:Object.fromEntries(Object.entries(counts).map(([k,n])=>[k,Number((100*n/runners).toFixed(1))]))}
 console.log(JSON.stringify({country,...countries[country]}))
}
const report={checkedAt:new Date().toISOString(),scope:'Latest cached program per country; counts are runner/race rows, not unique horses. Historical context rebuilt locally. Identity means positive TJK id only; foreign official identity may be separate. Missing history does not prove debut. Field presence is not proof of feature consumption. No source fetched, no training or live writes.',countries,examples}
writeFileSync('data/maintenance/country-evidence-audit.json',JSON.stringify(report,null,2))
