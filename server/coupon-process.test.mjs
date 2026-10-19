import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createCouponReader} from './coupon-process.mjs'
test('concurrent requests share a worker; cache expires and new program invalidates it',async()=>{
 let rev='a',now=100,calls=0,release
 const read=createCouponReader({revision:()=>rev,clock:()=>now,run:async()=>{calls++;await new Promise(r=>release=r);return {call:calls}},ttlMs:100})
 const one=read('2026-10-17','Ankara'),two=read('2026-10-17','Ankara');await new Promise(setImmediate);assert.equal(calls,1);release();assert.deepEqual(await one,await two)
 assert.equal((await read('2026-10-17','Ankara')).call,1)
 rev='withdrawal';const changed=read('2026-10-17','Ankara');await new Promise(setImmediate);release();assert.equal((await changed).call,2)
 now=201;const expired=read('2026-10-17','Ankara');await new Promise(setImmediate);release();assert.equal((await expired).call,3)
})
test('withdrawal during worker execution is rejected and failed work is retried',async()=>{
 let rev='a',calls=0
 const read=createCouponReader({revision:()=>rev,run:async()=>{calls++;if(calls===1)rev='b';return {valid:true}}})
 await assert.rejects(read('2026-10-17','Ankara'),/Program/)
 assert.deepEqual(await read('2026-10-17','Ankara'),{valid:true});assert.equal(calls,2)
})
test('a daily ticket disappears from cache exactly at its start',async()=>{
 let now=Date.parse('2026-10-17T12:00:00Z'),calls=0
 const read=createCouponReader({revision:()=>1,clock:()=>now,run:async()=>({call:++calls,ticket:{scheduledStart:'2026-10-17T12:00:01Z'}})})
 await read('2026-10-17');now+=1000;assert.equal((await read('2026-10-17')).call,2)
})

test('city coupon cache expires at the earliest nested game start, including second games',async()=>{
 let now=Date.parse('2026-10-19T12:00:00Z'),calls=0
 const read=createCouponReader({revision:()=>1,clock:()=>now,run:async()=>({call:++calls,selectedMeetingCoupons:[
  {budget:30,ticket:{scheduledStart:'2026-10-19T12:00:10Z'}},
  {budget:50,ticket:{scheduledStart:'2026-10-19T12:00:01Z'}},
  {budget:1000,ticket:null}
 ]})})
 await read('2026-10-19','Bursa');now+=999
 assert.equal((await read('2026-10-19','Bursa')).call,1)
 now+=1;assert.equal((await read('2026-10-19','Bursa')).call,2)
})
