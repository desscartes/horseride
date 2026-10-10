import test from 'node:test'
import assert from 'node:assert/strict'
import {parseEquibaseWorkouts,matchEquibaseWorkouts,mergeWorkoutArchive} from './equibase-workouts.mjs'

test('rolling public workout pages retain older observations and update repeats without duplicates',()=>{
 const old={registryId:'123',dateISO:'2026-09-26',hippodrome:'Parx Racing',distanceMeters:804.672,timeSeconds:49}
 const recent={...old,dateISO:'2026-10-05',timeSeconds:48}
 const merged=mergeWorkoutArchive([old,recent],[{...recent,timeSeconds:47.9}])
 assert.equal(merged.length,2);assert.equal(merged[0].dateISO,'2026-09-26');assert.equal(merged[1].timeSeconds,47.9)
})
test('official workout distance preserves furlongs and dates are validated',()=>{
 const html='<div id="c-workouts-by-track"><h2>for <a>Gulfstream Park</a> October 4, 2026</h2></div><div class="session-info"><h3>Four Furlongs</h3><table><tr><td>Surface:</td><td>Dirt</td></tr></table></div><table class="phone-collapse"><tbody><tr><td data-label="Horse Name"><a href="/profiles/Results.cfm?refno=123">A (KY)</a></td><td data-label="Age">3</td><td data-label="Time">48.20</td><td data-label="Notes">b</td><td data-label="Rank">2/5</td></tr></tbody></table>'
 const [row]=parseEquibaseWorkouts(html,'https://tvg.equibase.com/static/workout/GP100426USA-EQB.html')
 assert.equal(row.distanceMeters,804.672);assert.equal(row.timeSeconds,48.2);assert.equal(row.dateISO,'2026-10-04');assert.deepEqual(row.splits,{})
 assert.throws(()=>parseEquibaseWorkouts(html,'https://tvg.equibase.com/static/workout/GP100326USA-EQB.html'))
})
test('workout matching checks age and unique registry identity and rejects same-day/future records',()=>{
 const row={horseName:'A (KY)',age:3,registryId:'123',dateISO:'2026-10-04'},horse={name:'A (USA) KG',age:'3y d e'}
 assert.equal(matchEquibaseWorkouts([row],'2026-10-05','US').length,0)
 assert.equal(matchEquibaseWorkouts([row],horse,'2026-10-05').length,1)
 assert.equal(matchEquibaseWorkouts([row],horse,'2026-10-04').length,0)
 assert.equal(matchEquibaseWorkouts([row],{...horse,age:'4y d e'},'2026-10-05').length,0)
 assert.equal(matchEquibaseWorkouts([row,{...row,registryId:'456'}],horse,'2026-10-05').length,0)
})
