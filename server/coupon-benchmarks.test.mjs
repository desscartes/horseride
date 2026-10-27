import test from 'node:test'
import assert from 'node:assert/strict'
import {couponBenchmarkPairs} from './coupon-benchmarks.mjs'
const now='2026-10-26T05:00:00.000Z',program={date:'2026-10-26',fetchedAt:now,races:Array.from({length:6},(_,i)=>({city:'Ankara',no:i+1,time:`${10+i}.00`,rankingSource:'local_trained_model',rankingMethod:'test',officialMarketsVerified:true,sixLegStarts:i===0?[1]:[],horses:[{no:1,name:'A',probability:80,marketShare:20},{no:2,name:'B',probability:20,marketShare:80}]}))}
test('market and model are frozen before start on identical fields and budget',()=>{const rows=couponBenchmarkPairs(program,{now,budgets:[2]});assert.equal(rows.length,1);assert.equal(rows[0].model.legs[0].horses[0].name,'A');assert.equal(rows[0].market.legs[0].horses[0].name,'B');assert.equal(rows[0].model.budget,rows[0].market.budget);assert.ok(rows[0].capturedAt<rows[0].scheduledStart)})
test('stale, future, poststart or partial market data cannot fabricate a comparison',()=>{assert.equal(couponBenchmarkPairs(program,{now:'2026-10-26T05:21:00Z'}).length,0);assert.equal(couponBenchmarkPairs(program,{now:'2026-10-26T04:59:00Z'}).length,0);assert.equal(couponBenchmarkPairs({...program,fetchedAt:'2026-10-26T07:00:00Z'},{now:'2026-10-26T07:00:00Z'}).length,0);const p=structuredClone(program);delete p.races[0].horses[0].marketShare;assert.equal(couponBenchmarkPairs(p,{now}).length,0)})

test('missing active runner scores and duplicate runner numbers block new coupons',()=>{
 const p=structuredClone(program);delete p.races[0].horses[1].probability;assert.equal(couponBenchmarkPairs(p,{now,budgets:[2]}).length,0)
 const q=structuredClone(program);q.races[0].horses[1].no=1;assert.equal(couponBenchmarkPairs(q,{now,budgets:[2]}).length,0)
})
