import test from 'node:test'
import assert from 'node:assert/strict'
import {pedigreeTrainingTargets} from './pedigree-training-targets.mjs'
const h=id=>({horseId:id,name:'HORSE '+id,sire:'SIRE',dam:'DAM'})
const race=(date,no,horses)=>({date,no,city:'Ankara',horses})
test('targets cover observed prior starts, without using result labels or counting duplicate fields',()=>{
 const a=race('2026-09-01',1,[h(1),h(2)]),b=race('2026-09-02',1,[h(1)])
 const targets=pedigreeTrainingTargets([a,a,b,race('2026-10-17',1,[h(2),h(3)])],{through:'2026-10-04'})
 assert.deepEqual(targets.map(t=>[t.id,t.observedStarts]),[['1',2],['2',1]])
})
test('verified, cooling-down and conflicting identities cannot consume the batch',()=>{
 const targets=pedigreeTrainingTargets([race('2026-09-01',1,[h(1),h(2),h(3),h(4)]),race('2026-09-02',2,[{...h(3),dam:'OTHER'}])],{through:'2026-10-04',registry:{1:{sire:'SIRE',dam:'DAM',damsire:'GRANDSIRE'}},retries:{2:{after:'2026-10-18T00:00:00Z'}},now:Date.parse('2026-10-17')})
 assert.deepEqual(targets.map(t=>t.id),['4'])
 assert.deepEqual(pedigreeTrainingTargets([race('2026-09-01',1,[h(3)]),race('2026-09-01',1,[{...h(3),dam:'OTHER'}])],{through:'2026-10-04'}),[])
})
