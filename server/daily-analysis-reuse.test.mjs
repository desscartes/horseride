import test from 'node:test'
import assert from 'node:assert/strict'
import {reusableDailyAnalysis} from './daily-analysis-reuse.mjs'
import {analysisEntryFingerprint} from './analysis-entry-policy.mjs'
import {analysisFingerprint} from './data-quality.mjs'
test('evidence enrichment reuses a paid analysis, but entry/model/ranking changes do not',()=>{
 const race={city:'Bursa',no:1,horses:[{no:1,name:'A',weight:55},{no:2,name:'B',weight:56}]}
 const record={analysis:{version:12,rankingSignature:'model',entryFingerprint:analysisEntryFingerprint([race]),programFingerprint:analysisFingerprint([race]),races:[{city:'Bursa',raceNo:1,picks:[{horseName:'A'},{horseName:'B'}]}]}}
 const program=[{...race,horses:race.horses.map(h=>({...h,workouts:[{dateISO:'2026-10-07'}]}))}]
 const args={version:12,rankingSignature:'model',program,rankedProgram:[{...race,rankingSource:'local_trained_model'}]}
 assert.equal(reusableDailyAnalysis(record,args),true)
 assert.equal(reusableDailyAnalysis(record,{...args,rankingSignature:'new-model'}),false)
 assert.equal(reusableDailyAnalysis(record,{...args,rankedProgram:[{...args.rankedProgram[0],horses:[...race.horses].reverse()}]}),false)
 assert.equal(reusableDailyAnalysis(record,{...args,program:[{...race,horses:[{...race.horses[0],weight:60},race.horses[1]]}]}),false)
})
