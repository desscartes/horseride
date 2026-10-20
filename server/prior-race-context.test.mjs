import test from 'node:test'
import assert from 'node:assert/strict'
import {priorRaceContext} from './prior-race-context.mjs'
const race={city:'Finger Lakes ABD',horses:[{name:'A (USA)'}]},chart={date:'2026-01-01',track:'FL',raceNo:1,conditions:'Distance: Six Furlongs On The Dirt',winnerTime:'1:12.00'}
test('previous race winner speed stays context, excludes same day and unknown distance',()=>{
 const history=new Map([['A',[{chart},{chart},{chart:{...chart,date:'2026-01-02'}},{chart:{...chart,conditions:'unknown'}}]]])
 const f=priorRaceContext(race,'2026-01-02',history)[0];assert.equal(f[0],1);assert.ok(Math.abs(f[1]-1207.008/72)<1e-8);assert.equal(f[3],1)
 assert.equal(priorRaceContext(race,'2026-01-01',history)[0][0],0)
 assert.deepEqual(priorRaceContext({...race,city:'Bursa'},'2026-01-02',history)[0],[0,0,0,999,1])
})
