import {priorRaceContext,priorRaceContextNames} from './prior-race-context.mjs'
import {enrichAustralianRaces} from './australian-form.mjs'
import {australianFeatures,australianFeatureNames} from './australian-features.mjs'
import {officialWorkoutSpeedFeatures,officialWorkoutSpeedFeatureNames} from './official-workout-speed.mjs'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {resolvedRunnerResult} from './result-status.mjs'
import {listHistoricalRaces} from './database.mjs'
import {createRankingHistory,raceFeatures,addRankingDayToHistory,featureNames} from './ranking.mjs'
import {performanceFeatures,performanceFeatureNames} from './performance-features.mjs'
import {paceFeatureNames,paceHistory,paceFeatures} from './pace-features.mjs'
import {equibaseTracks} from './foreign-data.mjs'
import {racingCountry,foreignCoverage,externalFeatureNames,externalChartHistory,externalChartFeatures} from './foreign-data.mjs'
import {matchEquibaseWorkouts} from './equibase-workouts.mjs'
import {intelligenceFeatures,intelligenceFeatureNames} from './intelligence-features.mjs'
import {pedigreeFeatures,pedigreeFeatureNames} from './pedigree-features.mjs'
import {trainingArchive} from './training-archive.mjs'
import {trainingSourceRows} from './training-source.mjs'
const workoutArchive=await trainingSourceRows({path:process.env.WORKOUT_ARCHIVE_PATH,fallbackPath:'data/external/equibase-workouts/records.json',field:'records'})

const races=trainingArchive(undefined,{foreign:true}).filter(r=>!process.env.ARCHIVE_THROUGH_DATE||r.date<=process.env.ARCHIVE_THROUGH_DATE)
const charts=await trainingSourceRows({path:process.env.EXTERNAL_CHARTS_PATH,fallbackPath:'data/external/equibase/parsed.json',field:'races'})
const externalNames=externalFeatureNames,externalByHorse=externalChartHistory(charts)
const paces=paceHistory(charts),identityVersion=process.env.IDENTITY_VERSION==='2'?2:1
const externalFeatures=(horse,date,country)=>externalChartFeatures(horse,date,country,externalByHorse)
const outputDirectory=process.env.FOREIGN_MODEL_DIR||'data/foreign-models'
await mkdir(outputDirectory,{recursive:true})
const countries=[...new Set(races.map(r=>racingCountry(r.city)).filter(Boolean))].filter(c=>!process.env.TRAIN_COUNTRIES||process.env.TRAIN_COUNTRIES.split(',').includes(c))
for(const country of countries){
  const local=races.filter(r=>racingCountry(r.city)===country),history=createRankingHistory({identityVersion}),dataset=[],days=new Map()
  for(const race of local){if(!days.has(race.date))days.set(race.date,[]);days.get(race.date).push(race)}
  for(const [date,daily] of [...days].sort(([a],[b])=>a.localeCompare(b))){
    for(const original of daily){
      const race=country==='AU'&&process.env.INTELLIGENCE_FEATURES==='1'?enrichAustralianRaces([original],date)[0]:original
      const au=country==='AU'&&process.env.INTELLIGENCE_FEATURES==='1'?australianFeatures(race,date):null
      if(country==='US')race.horses=race.horses.map(horse=>({...horse,workouts:matchEquibaseWorkouts(workoutArchive,horse,date)}))
      const context=country==='US'&&process.env.OFFICIAL_RACE_CONTEXT_FEATURES==='1'?priorRaceContext(race,date,externalByHorse):null
      const workoutSpeed=country==='US'&&process.env.OFFICIAL_WORKOUT_SPEED_FEATURES==='1'?officialWorkoutSpeedFeatures(race,date):null
      const results=race.horses.map(h=>race.results.get(h.no))
      const extra=performanceFeatures(race,date,history.performance)
      const pace=country==='US'&&process.env.PACE_FEATURES==='1'?paceFeatures(race,date,paces,equibaseTracks[race.city]?.name):null
      const intelligence=process.env.INTELLIGENCE_FEATURES==='1'?intelligenceFeatures(race,date,history.intelligence,externalByHorse):null
      const pedigree=process.env.PEDIGREE_FEATURES==='1'?pedigreeFeatures(race,date,history.pedigree):null
      if((race.winnerOnly?race.winnerEvidence?.historyEligible===false&&race.horses.some(h=>h.no===race.winnerNo)&&results.every(r=>r&&(r.finishPosition>0||r.finishPosition===null&&r.knownNonWinner===true)):results.every(resolvedRunnerResult))&&results.some(r=>r.finishPosition===1))dataset.push({date,city:race.city,no:race.no,type:race.type,features:raceFeatures(race,date,history).map((f,i)=>[...f,...externalFeatures(race.horses[i],date,country),...(process.env.PERFORMANCE_FEATURES==='1'?extra[i]:[]),...(pace?pace[i]:[]),...(intelligence?intelligence[i]:[]),...(pedigree?pedigree[i]:[]),...(workoutSpeed?workoutSpeed[i]:[]),...(au?au[i]:[]),...(context?context[i]:[])]),labels:results.map(r=>+(r.finishPosition===1)),baseline:race.horses.map(h=>h.probability),odds:results.map(r=>r.closingOdds),horses:race.horses.map(h=>h.name),winnerOnly:race.winnerOnly===true})
    }
    addRankingDayToHistory(history,daily.filter(r=>!r.winnerOnly),date)
  }
  await writeFile(`${outputDirectory}/${country}-training.json`,JSON.stringify({country,identityVersion,featureNames:[...featureNames,...externalNames,...(process.env.PERFORMANCE_FEATURES==='1'?performanceFeatureNames:[]),...(country==='US'&&process.env.PACE_FEATURES==='1'?paceFeatureNames:[]),...(process.env.INTELLIGENCE_FEATURES==='1'?intelligenceFeatureNames:[]),...(process.env.PEDIGREE_FEATURES==='1'?pedigreeFeatureNames:[]),...(country==='US'&&process.env.OFFICIAL_WORKOUT_SPEED_FEATURES==='1'?officialWorkoutSpeedFeatureNames:[]),...(country==='AU'&&process.env.INTELLIGENCE_FEATURES==='1'?australianFeatureNames:[]),...(country==='US'&&process.env.OFFICIAL_RACE_CONTEXT_FEATURES==='1'?priorRaceContextNames:[])],...(country==='AU'&&process.env.INTELLIGENCE_FEATURES==='1'?{australianSchemaVersion:1}:{}),...(country==='US'&&process.env.OFFICIAL_RACE_CONTEXT_FEATURES==='1'?{priorRaceContextSchemaVersion:1}:{}),externalChartRunners:dataset.reduce((n,r)=>n+r.features.filter(f=>f[featureNames.length]>0).length,0),races:dataset}))
}
const report={updatedAt:new Date().toISOString(),source:'TJK official archived program + results',countries:foreignCoverage(races),limitations:'Only TJK-listed foreign meetings; incomplete career histories. Result times, workouts and weather frequently absent. Country separation does not resolve identical horse names without registry IDs. No external paid data acquired.'}
await writeFile(`${outputDirectory}/coverage.json`,JSON.stringify(report,null,2))
console.log(JSON.stringify(report))
