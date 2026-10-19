import {test} from 'node:test'
import assert from 'node:assert/strict'
import {prospectiveOutcome} from './prospective-outcomes.mjs'
import {prospectiveMetrics} from './prospective-metrics.mjs'
const row={date:'2026-10-06',city:'Bursa',raceNo:1,capturedAt:'2026-10-06T09:00:00Z',scheduledStart:'2026-10-06T10:00:00Z',trainedThrough:'2026-10-04',modelVersion:'M',race:{horses:[{no:1,name:'A',probability:40},{no:2,name:'B',probability:30},{no:3,name:'Scratched',outOfRace:true}]},market:{picks:[{horseName:'B'},{horseName:'A'},{horseName:'Scratched'}]}}
const options={frozenAt:'2026-10-05T00:00:00Z'}
test('known non-finisher is scored as a loser; withdrawn starter does not invalidate race',()=>{
 const finish=prospectiveOutcome(row.race,new Map([[1,{finishPosition:0,officialUnplaced:true}],[2,{finishPosition:1}]]))
 assert.equal(finish.get('A'),0)
 const summary=prospectiveMetrics([row],new Map([['2026-10-06:Bursa:1',finish]]),options)
 assert.equal(summary.evaluated,1);assert.equal(summary.hits,0);assert.equal(summary.topThreeHits,1);assert.equal(summary.marketHits,1)
})
test('unverified zero is missing; exclusions reconcile with recorded races',()=>{
 const finish=prospectiveOutcome(row.race,new Map([[1,{finishPosition:0}],[2,{finishPosition:1}]]))
 assert.equal(finish.has('A'),false)
 const summary=prospectiveMetrics([row],new Map([['2026-10-06:Bursa:1',finish]]),options)
 assert.equal(summary.evaluated,0);assert.equal(summary.notEvaluated.runnerResultMissing,1)
 assert.equal(summary.recorded,summary.evaluated+Object.values(summary.notEvaluated).reduce((a,b)=>a+b,0))
})
test('same-length market with wrong horses is not a paired benchmark',()=>{
 const wrong={...row,market:{picks:[{horseName:'A'},{horseName:'C'}]}}
 const summary=prospectiveMetrics([wrong],new Map([['2026-10-06:Bursa:1',new Map([['A',1],['B',2]])]]),options)
 assert.equal(summary.evaluated,1);assert.equal(summary.pairedMarketRaces,0);assert.equal(summary.marketUnavailable,1)
})
