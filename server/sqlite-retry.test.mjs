import test from 'node:test'
import assert from 'node:assert/strict'
import {retrySqliteBusy} from './sqlite-retry.mjs'
test('recovers transient contention and preserves result',async()=>{
 let calls=0;const waits=[]
 const value=await retrySqliteBusy(()=>{if(++calls<3)throw Error('database is locked');return 42},{wait:async ms=>waits.push(ms)})
 assert.equal(value,42);assert.deepEqual(waits,[1000,2000])
})
test('contention is bounded and source errors are not retried',async()=>{
 let calls=0
 await assert.rejects(retrySqliteBusy(()=>{calls++;throw Error('database is busy')},{wait:async()=>{}}),/busy/)
 assert.equal(calls,3);calls=0
 await assert.rejects(retrySqliteBusy(()=>{calls++;throw Error('Source date mismatch')},{wait:async()=>{}}),/date mismatch/)
 assert.equal(calls,1)
})
