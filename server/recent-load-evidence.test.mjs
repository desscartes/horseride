import test from 'node:test'
import assert from 'node:assert/strict'
import {recentLoadEvidence} from './recent-load-evidence.mjs'
test('observed load excludes target/future results, trials and duplicate races; missing stays unknown',()=>{
 const old={date:'2026-10-10',city:'Ankara',raceNo:1,finishPosition:3,distance:1200,weight:56}
 const e=recentLoadEvidence([old,old,{...old,date:'2026-10-17'},{...old,date:'2026-10-18'},{...old,date:'2026-10-12',finishPosition:null}],[{dateISO:'2026-10-15'},{dateISO:'2026-10-17'}],{weight:58},{distance:'1400m'},'2026-10-17')
 assert.equal(e.observedStartsLast14,1);assert.equal(e.daysSinceLastObservedStart,7);assert.equal(e.distanceChangeMeters,200);assert.equal(e.carriedWeightChangeKg,2);assert.equal(e.observedWorkoutsLast14,1)
 const missing=recentLoadEvidence([],[],{},{},'2026-10-17');assert.equal(missing.historyObserved,false);assert.equal(missing.daysSinceLastObservedStart,null);assert.equal(missing.carriedWeightChangeKg,null)
})
