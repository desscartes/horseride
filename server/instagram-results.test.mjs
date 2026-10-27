import test from 'node:test'
import assert from 'node:assert/strict'
import {instagramResults} from './instagram-results.mjs'
const fields=Array.from({length:6},(_,i)=>({raceNo:i+1,names:['A','B']})),s={date:'2026-10-27',city:'X',fields,ticket:{cost:40,legs:fields.map(f=>({raceNo:f.raceNo,horses:[{name:'A'}]}))},first:{raceNo:1,name:'A'},surprise:{raceNo:2,name:'B'}}
const outcomes=()=>new Map(fields.map(f=>[`2026-10-27:X:${f.raceNo}`,new Map([['A',1],['B',2]])]))
test('reports every published selection, pending/changed fields excluded and no inferred profit',()=>{let r=instagramResults([s],outcomes());assert.equal(r.couponWins,1);assert.equal(r.firstWins,1);assert.equal(r.surpriseWins,0);assert.equal(r.totalCost,40);const o=outcomes();o.delete('2026-10-27:X:6');r=instagramResults([s],o);assert.equal(r.pending,1);assert.equal(r.settled,0);const p=outcomes();p.get('2026-10-27:X:1').delete('B');assert.equal(instagramResults([s],p).excluded,1)})
