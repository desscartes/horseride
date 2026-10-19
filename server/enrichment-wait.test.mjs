import test from 'node:test'
import assert from 'node:assert/strict'
import {waitForEnrichment} from './enrichment-wait.mjs'
test('optional slow or failed sources do not block analysis and late failures are handled',async()=>{
 assert.deepEqual(await waitForEnrichment(Promise.resolve()),{ready:true})
 assert.equal((await waitForEnrichment(Promise.reject(Error('offline')))).ready,false)
 let reject
 const pending=new Promise((_,r)=>{reject=r})
 assert.equal((await waitForEnrichment(pending,5)).timedOut,true)
 reject(Error('late failure'))
 await new Promise(r=>setImmediate(r))
})
