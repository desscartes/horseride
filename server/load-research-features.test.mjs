import test from 'node:test'
import assert from 'node:assert/strict'
import {loadResearchFeatures} from './load-research-features.mjs'
test('load excludes same-day/future/unfinished results and duplicates, unknown remains explicit',()=>{const old={date:'2026-10-15',city:'A',raceNo:1,finishPosition:2,distance:1200},race={horses:[{horsePerformance:{recentRuns:[old,old,{...old,date:'2026-10-21'},{...old,date:'2026-10-22'},{...old,date:'2026-10-16',finishPosition:0}]},workouts:[{dateISO:'2026-10-18'},{dateISO:'2026-10-21'}]},{}]};assert.deepEqual(loadResearchFeatures(race,'2026-10-21'),[[1200,1,0,.5,0,0],[0,0,0,-1,1,1]])})
test('field-relative workload uses known runners only',()=>{const run=n=>({horsePerformance:{recentRuns:[{date:'2026-10-15',city:'A',raceNo:1,finishPosition:1,distance:n}]}});const v=loadResearchFeatures({horses:[run(1000),run(2000),{}]},'2026-10-21');assert.equal(v[0][2],-500);assert.equal(v[1][2],500);assert.equal(v[2][4],1)})
