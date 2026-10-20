import {priorRaceContext} from './prior-race-context.mjs'
import {enrichAustralianRaces} from './australian-form.mjs'
import {australianFeatures} from './australian-features.mjs'
import {officialWorkoutSpeedFeatures,officialWorkoutSpeedFeatureNames} from './official-workout-speed.mjs'
import {readFileSync,writeFileSync,renameSync} from 'node:fs'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {evaluateTreeModel,raceFeatures,createRankingHistory,addRankingDayToHistory} from './ranking.mjs'
import {externalChartHistory,externalChartFeatures,racingCountry,equibaseTracks} from './foreign-data.mjs'
import {performanceFeatures} from './performance-features.mjs'
import {paceHistory,paceFeatures} from './pace-features.mjs'
import {matchEquibaseWorkouts} from './equibase-workouts.mjs'
import {listHistoricalRaces} from './database.mjs'
import {intelligenceFeatures} from './intelligence-features.mjs'
import {pedigreeFeatures} from './pedigree-features.mjs'
import {summarizeWorkoutHistory} from './workout-history.mjs'
import {historicalRaceDates} from './database.mjs'
import {horseIdentity} from './data-quality.mjs'
import {trainingArchiveDates,trainingArchiveDay} from './training-archive.mjs'
const root=process.argv[2],read=p=>JSON.parse(readFileSync(p,'utf8')),summary=read(`${root}/training-report.json`)
const charts=read(`${root}/charts.json`).races,external=externalChartHistory(charts),paces=paceHistory(charts),dates=trainingArchiveDates(),workouts=read(process.env.WORKOUT_ARCHIVE_PATH||'data/external/equibase-workouts/records.json').records
const verified=[]
const workoutTables=[]
if(process.env.WORKOUT_ARCHIVE_PATH)workoutTables.push(...read(process.env.WORKOUT_ARCHIVE_PATH).tables)
else for(const day of historicalRaceDates()){try{const a=read(`data/training-workouts/${day}.json`);if(a.complete&&a.date===day)workoutTables.push(...a.tables)}catch{}}
const dedup=new Map();for(const table of workoutTables)for(const row of table.rows)dedup.set(JSON.stringify(row),{headers:table.headers,rows:[row]})
const byName=new Map();for(const t of dedup.values()){const key=horseIdentity(t.rows[0][t.headers.indexOf('At Adı')]);if(!byName.has(key))byName.set(key,[]);byName.get(key).push(t)}
for(const report of summary.countries){
 if(!report.shadowEnabled)continue
 const trainingDataPath=`${root}/${report.country}/${report.country}-training.json`
 const fingerprint=createHash('sha256').update(readFileSync(trainingDataPath)).digest('hex').slice(0,12)
 assert.equal(fingerprint,report.trainingFingerprint,'Training data fingerprint mismatch')
 report.trainingDataPath=trainingDataPath
 report.evaluationRole='retrospective_reused_holdout_requires_prospective'
 report.prospectiveRequired=true
 const folder=`${root}/${report.artifactKey||report.country}`,ref=read(`${folder}/reference.json`),model=read(`${folder}/live.json`)
 const delta=Math.max(...ref.features.map((f,i)=>Math.abs(evaluateTreeModel(model,report.featureIndexes.map(j=>f[j]))-ref.scores[i])))
 assert.ok(delta<1e-6,'Python / Node scoring mismatch')
 const history=createRankingHistory({identityVersion:report.identityVersion})
 for(const day of dates.filter(d=>d<ref.date)){const rows=trainingArchiveDay(day).filter(r=>!r.winnerOnly&&(report.country==='TR'?!r.foreign:racingCountry(r.city)===report.country));addRankingDayToHistory(history,rows,day)}
 const original=trainingArchiveDay(ref.date).find(r=>r.city===ref.city&&Number(r.no)===Number(ref.raceNo))
 assert.ok(original,'Reference race missing')
 let race={...original,horses:original.horses.map(h=>report.country==='US'?{...h,workouts:matchEquibaseWorkouts(workouts,h,ref.date)}:report.country==='TR'?{...h,workouts:summarizeWorkoutHistory(byName.get(horseIdentity(h.name))||[],h.name,ref.date,{identityVersion:report.identityVersion})}:h)}
 if(report.australianSchemaVersion===1)race=enrichAustralianRaces([race],ref.date)[0]
 const au=report.australianSchemaVersion===1?australianFeatures(race,ref.date):null
 const base=raceFeatures(race,ref.date,history),extra=performanceFeatures(race,ref.date,history.performance),pace=report.country==='US'?paceFeatures(race,ref.date,paces,equibaseTracks[race.city]?.name):null
 const intelligence=intelligenceFeatures(race,ref.date,history.intelligence,external,{legacy:report.intelligenceSchemaVersion!==2}),family=pedigreeFeatures(race,ref.date,history.pedigree)
 const workoutSpeed=report.featurePipeline==='intelligence_workout_v1'?officialWorkoutSpeedFeatures(race,ref.date):null
 const context=report.featurePipeline==='intelligence_context_v1'&&report.priorRaceContextSchemaVersion===1?priorRaceContext(race,ref.date,external):null
 const vectors=base.map((f,i)=>[...f,...(report.country==='TR'?[]:externalChartFeatures(race.horses[i],ref.date,report.country,external)),...extra[i],...(pace?pace[i]:[]),...intelligence[i],...family[i],...(workoutSpeed?workoutSpeed[i]:[]),...(au?au[i]:[]),...(context?context[i]:[])])
 for(const [i,name]of ref.horses.entries())assert.deepEqual(vectors[race.horses.findIndex(h=>h.name===name)],ref.features[i],'Runtime / export feature mismatch')
 report.runtimeParityMaxDifference=delta;report.fullRuntimeFeatureParity=true
 writeFileSync(`${folder}/report.json`,JSON.stringify(report,null,2))
 verified.push({country:report.country,artifactKey:report.artifactKey||report.country,delta,featureCount:vectors[0].length})
}
// Publish shadow pointers only after every trained country passed runtime verification.
for(const row of verified){const folder=`${root}/${row.artifactKey}`,path=`data/intelligence-models/latest-${row.artifactKey}.json`;writeFileSync(`${path}.tmp`,JSON.stringify({reportPath:`${folder}/report.json`,modelPath:`${folder}/live.json`}));renameSync(`${path}.tmp`,path)}
writeFileSync(`${root}/verification.json`,JSON.stringify({verified,activeModelChanged:false},null,2));console.log(JSON.stringify({verified,activeModelChanged:false}))
