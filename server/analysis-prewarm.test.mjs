import test from 'node:test'
import assert from 'node:assert/strict'
import {createAnalysisPrewarmer} from './analysis-prewarm.mjs'
test('prepares without a client, skips ready cities, deduplicates ticks and backs off failures',async()=>{
 let time=0,release;const calls=[],ready=new Set(['A'])
 const warm=createAnalysisPrewarmer({now:()=>time,retryMs:100,ready:(_,city)=>ready.has(city),run:async(_,city)=>{calls.push(city);if(city==='B'){await new Promise(r=>release=r);ready.add(city)}else throw Error('offline')}})
 const races=['A','B','C'].map(city=>({city}))
 const first=warm.tick('2026-10-09',races)
 assert.equal(warm.tick('2026-10-09',races),first)
 release();await first
 assert.deepEqual(calls,['B','C'])
 await warm.tick('2026-10-09',races);assert.equal(calls.length,2)
 time=101;await warm.tick('2026-10-09',races);assert.deepEqual(calls,['B','C','C'])
})
