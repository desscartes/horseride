import {writeFile,readFile} from 'node:fs/promises'
import {resolvedRunnerResult} from './result-status.mjs'
import {summarizeWorkoutHistory} from './workout-history.mjs'
import {historicalRaceDates,iterateHistoricalDay} from './database.mjs'
import {createRankingHistory,raceFeatures,addRankingDayToHistory,featureNames} from './ranking.mjs'
import {performanceFeatures,performanceFeatureNames} from './performance-features.mjs'
import {horseIdentityV2} from './racing-identity.mjs'
import {pedigreeFeatures,pedigreeFeatureNames} from './pedigree-features.mjs'
import {intelligenceFeatures,intelligenceFeatureNames} from './intelligence-features.mjs'
import {trainingArchiveDates,trainingArchiveDay} from './training-archive.mjs'
const identityVersion=process.env.IDENTITY_VERSION==='2'?2:1
const dates=trainingArchiveDates().filter(d=>!process.env.ARCHIVE_THROUGH_DATE||d<=process.env.ARCHIVE_THROUGH_DATE),history=createRankingHistory({identityVersion}),dataset=[]
const workoutArchives=[]
if(process.env.WORKOUT_ARCHIVE_PATH)workoutArchives.push(...JSON.parse(await readFile(process.env.WORKOUT_ARCHIVE_PATH,'utf8')).tables)
else for(const date of dates){try{const archive=JSON.parse(await readFile(`data/training-workouts/${date}.json`,'utf8'));if(archive.complete&&archive.date===date)workoutArchives.push(...archive.tables)}catch{}}
// Recover dated records across pages; future workouts are filtered per target race.
const workoutRows=new Map()
for(const table of workoutArchives)for(const row of table.rows)workoutRows.set(JSON.stringify(row),{headers:table.headers,rows:[row]})
const byHorse=new Map()
for(const table of workoutRows.values()){const name=table.rows[0][table.headers.indexOf('At Adı')];if(!byHorse.has(name))byHorse.set(name,[]);byHorse.get(name).push(table)}
const {horseIdentity}=await import('./data-quality.mjs')
const identify=identityVersion===2?horseIdentityV2:horseIdentity
const normalizedWorkouts=new Map()
for(const [name,tables] of byHorse){const key=identify(name);normalizedWorkouts.set(key,[...(normalizedWorkouts.get(key)||[]),...tables])}
let processedDays=0
for(const date of dates){
  const daily=trainingArchiveDay(date).filter(r=>!r.foreign)
  if(!daily.length)continue
  for(const race of daily){
    for(const horse of race.horses)horse.workouts=summarizeWorkoutHistory(normalizedWorkouts.get(identify(horse.name))||[],horse.name,date,{identityVersion})
    const extra=performanceFeatures(race,date,history.performance)
    const pedigree=process.env.PEDIGREE_FEATURES==='1'?pedigreeFeatures(race,date,history.pedigree):null
    const intelligence=process.env.INTELLIGENCE_FEATURES==='1'?intelligenceFeatures(race,date,history.intelligence):null
    const features=raceFeatures(race,date,history).map((f,i)=>[...f,...(process.env.PERFORMANCE_FEATURES==='1'?extra[i]:[]),...(intelligence?intelligence[i]:[]),...(pedigree?pedigree[i]:[])])
    const results=race.horses.map(h=>race.results.get(h.no))
    if(results.every(resolvedRunnerResult)&&results.some(r=>r.finishPosition===1))dataset.push({date,city:race.city,no:race.no,type:race.type,breed:/ARAP/i.test(race.conditions||'')?'arabian':'thoroughbred',features,labels:results.map(r=>+(r.finishPosition===1)),baseline:race.horses.map(h=>h.probability),odds:results.map(r=>r.closingOdds),horses:race.horses.map(h=>h.name)})
  }
  // Same-day results cannot influence another race's feature vector.
  addRankingDayToHistory(history,daily,date)
  processedDays++
  if(processedDays%60===0)console.log(JSON.stringify({exportedDays:processedDays,date,races:dataset.length}))
}
await writeFile(process.env.TRAINING_OUTPUT||'data/training-races.json',JSON.stringify({identityVersion,featureNames:[...featureNames,...(process.env.PERFORMANCE_FEATURES==='1'?performanceFeatureNames:[]),...(process.env.INTELLIGENCE_FEATURES==='1'?intelligenceFeatureNames:[]),...(process.env.PEDIGREE_FEATURES==='1'?pedigreeFeatureNames:[])],races:dataset}))
console.log(JSON.stringify({races:dataset.length,days:processedDays,first:dataset[0]?.date,last:dataset.at(-1)?.date,workoutRunners:dataset.reduce((n,r)=>n+r.features.filter(f=>!f[featureNames.indexOf('missingWorkout')]).length,0)}))
