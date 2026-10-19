import test from 'node:test'
import assert from 'node:assert/strict'
import {maidenTrainingFeatures} from './maiden-training.mjs'
test('missing monetary evidence stays missing and currencies cannot be mixed',()=>{
 const race={prizeMoney:{prizes:[{position:1,amount:200,currency:'USD'}]}}
 const past=[{date:'2026-01-01',klass:{family:'maiden'},finish:2,prize:{amount:100,currency:'TRY'}}]
 const vector=maidenTrainingFeatures(race,past)
 assert.equal(vector[0],1);assert.equal(vector[1],1);assert.equal(vector[8],0);assert.equal(vector[9],1)
 assert.equal(maidenTrainingFeatures({},past)[7],1)
 assert.equal(maidenTrainingFeatures(race,[{...past[0],prize:{amount:100,currency:'USD'}}])[8],2)
})
