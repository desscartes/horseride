import {writeFile,readFile} from 'node:fs/promises'
import {summarizeWorkoutHistory} from './workout-history.mjs'
import {listHistoricalRaces} from './database.mjs'
import {createRankingHistory,raceFeatures,addRankingDayToHistory,featureNames} from './ranking.mjs'
import {performanceFeatures,performanceFeatureNames} from './performance-features.mjs'
import {horseIdentityV2} from './racing-identity.mjs'
const identityVersion=process.env.IDENTITY_VERSION==='2'?2:1
const races=listHistoricalRaces().filter(r=>!r.foreign&&(!process.env.ARCHIVE_THROUGH_DATE||r.date<=process.env.ARCHIVE_THROUGH_DATE)),history=createRankingHistory({identityVersion}),dataset=[]
const workoutArchives=[]
for(const date of new Set(races.map(r=>r.date))){try{const archive=JSON.parse(await readFile(`data/training-workouts/${date}.json`,'utf8'));if(archive.complete&&archive.date===date)workoutArchives.push(...archive.tables)}catch{}}
// Recover dated records across pages; future workouts are filtered per target race.
const workoutRows=new Map()
for(const table of workoutArchives)for(const row of table.rows)workoutRows.set(JSON.stringify(row),{headers:table.headers,rows:[row]})
const byHorse=new Map()
for(const table of workoutRows.values()){const name=table.rows[0][table.headers.indexOf('At Adı')];if(!byHorse.has(name))byHorse.set(name,[]);byHorse.get(name).push(table)}
const {horseIdentity}=await import('./data-quality.mjs')
const identify=identityVersion===2?horseIdentityV2:horseIdentity
const normalizedWorkouts=new Map()
for(const [name,tables] of byHorse){const key=identify(name);normalizedWorkouts.set(key,[...(normalizedWorkouts.get(key)||[]),...tables])}
const days=new Map()
for(const race of races){if(!days.has(race.date))days.set(race.date,[]);days.get(race.date).push(race)}
for(const [date,daily] of days){
  for(const race of daily){
    for(const horse of race.horses)horse.workouts=summarizeWorkoutHistory(normalizedWorkouts.get(identify(horse.name))||[],horse.name,date,{identityVersion})
    const extra=performanceFeatures(race,date,history.performance)
    const features=raceFeatures(race,date,history).map((f,i)=>process.env.PERFORMANCE_FEATURES==='1'?[...f,...extra[i]]:f)
    const results=race.horses.map(h=>race.results.get(h.no))
    if(results.every(r=>r?.finishPosition)&&results.some(r=>r.finishPosition===1))dataset.push({date,city:race.city,no:race.no,features,labels:results.map(r=>+(r.finishPosition===1)),baseline:race.horses.map(h=>h.probability),odds:results.map(r=>r.closingOdds),horses:race.horses.map(h=>h.name)})
  }
  // Same-day results cannot influence another race's feature vector.
  addRankingDayToHistory(history,daily,date)
}
await writeFile(process.env.TRAINING_OUTPUT||'data/training-races.json',JSON.stringify({featureNames:process.env.PERFORMANCE_FEATURES==='1'?[...featureNames,...performanceFeatureNames]:featureNames,races:dataset}))
console.log(JSON.stringify({races:dataset.length,days:days.size,first:dataset[0]?.date,last:dataset.at(-1)?.date,workoutRunners:dataset.reduce((n,r)=>n+r.features.filter(f=>!f[featureNames.indexOf('missingWorkout')]).length,0)}))
