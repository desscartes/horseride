import test from 'node:test'
import assert from 'node:assert/strict'
import {surpriseCandidates,validSurprise} from './surprisePolicy.js'
const race={horses:[{name:'A',marketShare:40},{name:'B',marketShare:25},{name:'C',marketShare:25},{name:'D',marketShare:10}]}
test('AGF first two and second-place ties cannot be surprises even outside AI leaders',()=>{
 assert.deepEqual(surpriseCandidates(race,[]),['D'])
 for(const name of ['A','B','C'])assert.equal(validSurprise(race,{picks:[{horseName:'D'}],surprise:{horseName:name}}),null)
 assert.equal(validSurprise(race,{picks:[],surprise:{horseName:'D'}}).horseName,'D')
 assert.deepEqual(surpriseCandidates(race,['D']),[])
})
test('missing, partial or zero AGF cannot justify a surprise label',()=>{
 for(const horses of [[{name:'A'},{name:'B'},{name:'C'}],race.horses.map(h=>({...h,marketShare:0})),[...race.horses,{name:'E'}]])assert.deepEqual(surpriseCandidates({horses}),[])
})
