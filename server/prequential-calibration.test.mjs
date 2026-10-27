import test from 'node:test'
import assert from 'node:assert/strict'
import {rollingCalibration,temperatureScale} from './prequential-calibration.mjs'
const row=(date,y=[0,1])=>({date,country:'TR',modelVersion:'v',p:[.9,.1],y})
test('same-day outcomes cannot affect fitted temperature and versions never share fitting rows',()=>{
 const prior=[row('2026-01-01'),row('2026-01-02')],today=row('2026-01-03'),options={minimumRaces:2,minimumDays:2}
 const a=rollingCalibration([...prior,today],options),b=rollingCalibration([...prior,{...today,y:[1,0]},row('2026-01-03')],options)
 assert.equal(a.rows[0].temperature,b.rows[0].temperature);assert.equal(a.rows[0].fitThrough,'2026-01-02');assert.equal(a.rows[0].fitRaces,2);assert.equal(b.rows[1].fitRaces,2)
 assert.equal(rollingCalibration([...prior,{...today,modelVersion:'new'}],options).scoredRaces,0)
 assert.ok(a.calibratedLogLoss<a.baseLogLoss);assert.equal(a.activated,false)
})
test('temperature keeps probability sum and ranking',()=>{const p=temperatureScale([.1,.7,.2],2);assert.ok(Math.abs(p.reduce((a,b)=>a+b,0)-1)<1e-12);assert.ok(p[1]>p[2]&&p[2]>p[0])})
