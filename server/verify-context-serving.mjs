import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {localRankingFeatureVectors,createRankingHistory,addRankingDayToHistory} from './ranking.mjs'
import {trainingArchiveDates,trainingArchiveDay} from './training-archive.mjs'
import {externalChartHistory,racingCountry} from './foreign-data.mjs'
import {paceHistory} from './pace-features.mjs'
import {matchEquibaseWorkouts} from './equibase-workouts.mjs'
const [root,out]=process.argv.slice(2)
if(!root?.startsWith('data/intelligence-models/')||!out?.startsWith('data/experiments/'))throw Error('Versioned paths required')
const read=async p=>JSON.parse(await readFile(p,'utf8')),data=await read(`${out}/export-qa/US-training.json`),charts=(await read(root+'/charts.json')).races,workouts=(await read(root+'/workouts.json')).records
const lookup=new Map(data.races.map(r=>[JSON.stringify([r.date,r.city,r.no]),r])),history=createRankingHistory({identityVersion:1}),bundle={metadata:{country:'US',featurePipeline:'intelligence_context_v1',intelligenceSchemaVersion:2,priorRaceContextSchemaVersion:1},externalHistory:externalChartHistory(charts),paceHistory:paceHistory(charts)}
let races=0,runners=0
for(const date of trainingArchiveDates()){
 const daily=trainingArchiveDay(date).filter(r=>racingCountry(r.city)==='US')
 for(const race of daily){
  race.horses=race.horses.map(h=>({...h,workouts:matchEquibaseWorkouts(workouts,h,date)}))
  const key=JSON.stringify([date,race.city,race.no]),expected=lookup.get(key);if(!expected)continue
  const actual=localRankingFeatureVectors(race,date,history,bundle)
  assert.deepEqual(race.horses.map(h=>h.name),expected.horses,'Serving runner order mismatch')
  assert.deepEqual(actual.vectors,expected.features,`Serving/export mismatch ${key}`)
  runners+=race.horses.length;races++;lookup.delete(key)
 }
 addRankingDayToHistory(history,daily.filter(r=>!r.winnerOnly),date)
}
assert.equal(lookup.size,0,'Export races missing from serving reconstruction')
const result={checkedAt:new Date().toISOString(),races,runners,features:data.featureNames.length,fullServingFeatureParity:true,scoreParityVerified:false,activeModelChanged:false,note:'Every exported US vector reconstructed through the exact feature builder called by rankRaceLocally. Model scoring and independent success require separate verification.'}
await writeFile(out+'/serving-feature-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
