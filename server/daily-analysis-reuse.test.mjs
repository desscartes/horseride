import test from 'node:test'
import assert from 'node:assert/strict'
import {reusableDailyAnalysis} from './daily-analysis-reuse.mjs'
import {analysisEntryFingerprint} from './analysis-entry-policy.mjs'
import {analysisFingerprint} from './data-quality.mjs'
test('evidence and background ordering retain the captured analysis; entry and model changes invalidate it',()=>{
 const race={city:'Bursa',no:1,horses:[{no:1,name:'A',weight:55},{no:2,name:'B',weight:56}]}
 const record={analysis:{version:12,rankingSignature:'model',entryFingerprint:analysisEntryFingerprint([race]),programFingerprint:analysisFingerprint([race]),races:[{city:'Bursa',raceNo:1,picks:[{horseName:'A'},{horseName:'B'}]}]}}
 const program=[{...race,horses:race.horses.map(h=>({...h,workouts:[{dateISO:'2026-10-07'}]}))}]
 const args={version:12,rankingSignature:'model',program,rankedProgram:[{...race,rankingSource:'local_trained_model'}]}
 assert.equal(reusableDailyAnalysis(record,args),true)
 assert.equal(reusableDailyAnalysis(record,{...args,rankingSignature:'new-model'}),false)
 assert.equal(reusableDailyAnalysis(record,{...args,rankedProgram:[{...args.rankedProgram[0],horses:[...race.horses].reverse()}]}),true)
 assert.equal(reusableDailyAnalysis(record,{...args,program:[race],rankedProgram:[{...args.rankedProgram[0],horses:[...race.horses].reverse()}]}),true)
 assert.equal(reusableDailyAnalysis(record,{...args,program:[{...race,horses:[{...race.horses[0],weight:60},race.horses[1]]}]}),false)
 assert.equal(reusableDailyAnalysis(record,{...args,program:[{...race,horses:[{...race.horses[0],outOfRace:true},race.horses[1]]}]}),false)
})
test('archive refresh timestamps do not discard unchanged ranked candidates',()=>{
 const race={city:'Ankara',no:1,horses:[{no:1,name:'A',weight:55},{no:2,name:'B',weight:56}],rankingSource:'local_trained_model'}
 const signature=history=>JSON.stringify({models:[{method:'fixed',through:'2026-10-04'}],history})
 const record={analysis:{version:12,rankingSignature:signature('old'),entryFingerprint:analysisEntryFingerprint([race]),races:[{city:'Ankara',raceNo:1,picks:[{horseName:'A'},{horseName:'B'}]}]}}
 const args={version:12,rankingSignature:signature('new'),program:[race],rankedProgram:[race]}
 assert.equal(reusableDailyAnalysis(record,args),true)
 assert.equal(reusableDailyAnalysis(record,{...args,rankedProgram:[{...race,horses:[...race.horses].reverse()}]}),true)
 assert.equal(reusableDailyAnalysis(record,{...args,rankedProgram:[]}),true)
 assert.equal(reusableDailyAnalysis(record,{...args,rankingSignature:JSON.stringify({models:[{method:'changed'}],history:'new'})}),false)
})
