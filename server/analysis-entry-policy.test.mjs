import test from 'node:test'
import assert from 'node:assert/strict'
import {analysisEntryFingerprint} from './analysis-entry-policy.mjs'
import {analysisFingerprint} from './data-quality.mjs'
test('optional evidence refresh preserves in-flight analysis while future cache sees new evidence',()=>{
 const race={city:'Bursa',no:1,time:'14.30',horses:[{no:1,name:'A',weight:55,jockey:'J'}]}
 const refreshed={...race,horses:[{...race.horses[0],workouts:[{dateISO:'2026-10-07'}],marketShare:90}]}
 assert.equal(analysisEntryFingerprint([race]),analysisEntryFingerprint([refreshed]))
 assert.notEqual(analysisFingerprint([race]),analysisFingerprint([refreshed]))
 for(const horses of [[],[{...race.horses[0],weight:56}],[{...race.horses[0],jockey:'Other'}]])assert.notEqual(analysisEntryFingerprint([race]),analysisEntryFingerprint([{...race,horses}]))
})
