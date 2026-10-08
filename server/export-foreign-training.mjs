import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {listHistoricalRaces} from './database.mjs'
import {createRankingHistory,raceFeatures,addRankingDayToHistory,featureNames} from './ranking.mjs'
import {performanceFeatures,performanceFeatureNames} from './performance-features.mjs'
import {paceFeatureNames,paceHistory,paceFeatures} from './pace-features.mjs'
import {equibaseTracks} from './foreign-data.mjs'
import {racingCountry,foreignCoverage,externalFeatureNames,externalChartHistory,externalChartFeatures} from './foreign-data.mjs'
import {matchEquibaseWorkouts} from './equibase-workouts.mjs'
let workoutArchive=[];try{workoutArchive=JSON.parse(await readFile('data/external/equibase-workouts/records.json','utf8')).records||[]}catch{}

const races=listHistoricalRaces().filter(r=>r.foreign&&(!process.env.ARCHIVE_THROUGH_DATE||r.date<=process.env.ARCHIVE_THROUGH_DATE))
let charts=[]
try{charts=JSON.parse(await readFile(process.env.EXTERNAL_CHARTS_PATH || 'data/external/equibase/parsed.json','utf8')).races}catch{}
const externalNames=externalFeatureNames,externalByHorse=externalChartHistory(charts)
const paces=paceHistory(charts),identityVersion=process.env.IDENTITY_VERSION==='2'?2:1
const externalFeatures=(horse,date,country)=>externalChartFeatures(horse,date,country,externalByHorse)
const outputDirectory=process.env.FOREIGN_MODEL_DIR||'data/foreign-models'
await mkdir(outputDirectory,{recursive:true})
const countries=[...new Set(races.map(r=>racingCountry(r.city)).filter(Boolean))].filter(c=>!process.env.TRAIN_COUNTRIES||process.env.TRAIN_COUNTRIES.split(',').includes(c))
for(const country of countries){
  const local=races.filter(r=>racingCountry(r.city)===country),history=createRankingHistory({identityVersion}),dataset=[],days=new Map()
  for(const race of local){if(!days.has(race.date))days.set(race.date,[]);days.get(race.date).push(race)}
  for(const [date,daily] of days){
    for(const race of daily){
      if(country==='US')race.horses=race.horses.map(horse=>({...horse,workouts:matchEquibaseWorkouts(workoutArchive,horse,date)}))
      const results=race.horses.map(h=>race.results.get(h.no))
      const extra=performanceFeatures(race,date,history.performance)
      const pace=country==='US'&&process.env.PACE_FEATURES==='1'?paceFeatures(race,date,paces,equibaseTracks[race.city]?.name):null
      if(results.every(r=>r?.finishPosition)&&results.some(r=>r.finishPosition===1))dataset.push({date,city:race.city,no:race.no,type:race.type,features:raceFeatures(race,date,history).map((f,i)=>[...f,...externalFeatures(race.horses[i],date,country),...(process.env.PERFORMANCE_FEATURES==='1'?extra[i]:[]),...(pace?pace[i]:[])]),labels:results.map(r=>+(r.finishPosition===1)),baseline:race.horses.map(h=>h.probability),odds:results.map(r=>r.closingOdds),horses:race.horses.map(h=>h.name)})
    }
    addRankingDayToHistory(history,daily,date)
  }
  await writeFile(`${outputDirectory}/${country}-training.json`,JSON.stringify({country,identityVersion,featureNames:[...featureNames,...externalNames,...(process.env.PERFORMANCE_FEATURES==='1'?performanceFeatureNames:[]),...(country==='US'&&process.env.PACE_FEATURES==='1'?paceFeatureNames:[])],externalChartRunners:dataset.reduce((n,r)=>n+r.features.filter(f=>f[featureNames.length]>0).length,0),races:dataset}))
}
const report={updatedAt:new Date().toISOString(),source:'TJK official archived program + results',countries:foreignCoverage(races),limitations:'Only TJK-listed foreign meetings; incomplete career histories. Result times, workouts and weather frequently absent. Country separation does not resolve identical horse names without registry IDs. No external paid data acquired.'}
await writeFile(`${outputDirectory}/coverage.json`,JSON.stringify(report,null,2))
console.log(JSON.stringify(report))
