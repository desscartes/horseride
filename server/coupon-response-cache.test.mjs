import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {couponInputSignature,saveCouponResponse,readCouponResponse} from './coupon-response-cache.mjs'
const date='2099-10-23',program={date,races:[{city:'Bursa',no:1,horses:[{no:1,name:'A',jockey:'J',probability:50}],sixLegStarts:[1],rankingSource:'local_trained_model'}]}
test('background timestamps do not discard a valid coupon; rider, odds and withdrawals invalidate it',()=>{
 const signature=couponInputSignature(program,'Bursa');assert.equal(signature,couponInputSignature({...program,fetchedAt:'new',races:program.races.map(r=>({...r,horses:r.horses.map(h=>({...h,workouts:[1]}))}))},'Bursa'))
 for(const change of [{jockey:'NEW'},{outOfRace:true},{probability:60}])assert.notEqual(signature,couponInputSignature({...program,races:program.races.map(r=>({...r,horses:r.horses.map(h=>({...h,...change}))}))},'Bursa'))
})
test('prepared coupons stay bounded by exact date, city, program and start time',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'coupon-cache-')),now=new Date('2099-10-23T08:00:00Z'),value={date,ticket:{scheduledStart:'2099-10-23T08:01:00Z'},selectedMeetingCoupons:[{budget:30,ticket:{scheduledStart:'2099-10-23T08:01:00Z'}}]}
 try{await saveCouponResponse(program,date,'Bursa',value,{dir,now});assert.ok((await readCouponResponse(program,date,'Bursa',{dir,now})).ticket)
 const started=await readCouponResponse(program,date,'Bursa',{dir,now:new Date('2099-10-23T08:02:00Z')});assert.equal(started.ticket,null);assert.equal(started.selectedMeetingCoupons[0].ticket,null)
 assert.equal(await readCouponResponse(program,date,'Ankara',{dir,now}),null);assert.equal(await readCouponResponse({...program,date:'2099-10-24'},date,'Bursa',{dir,now}),null)
 assert.equal(await readCouponResponse(program,date,'Bursa',{dir,now:new Date('2099-10-23T08:16:00Z')}),null)
 }finally{await rm(dir,{recursive:true,force:true})}
})
