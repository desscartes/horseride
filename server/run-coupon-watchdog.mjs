import {readServedProgram} from './served-program.mjs'
import {runCouponWorker} from './coupon-process.mjs'
import {couponInputSignature,saveCouponResponse} from './coupon-response-cache.mjs'
import {writeFile} from 'node:fs/promises'
import {localDay} from './maintenance-policy.mjs'
const date=localDay(),program=readServedProgram(date);if(!program?.races?.length)throw Error('No current program')
const cities=['',...new Set(program.races.map(r=>r.city))],results=[];let next=0
await Promise.all(Array.from({length:2},async()=>{while(next<cities.length){const city=cities[next++];try{const signature=couponInputSignature(program,city),value=await runCouponWorker(date,city);if(signature!==couponInputSignature(readServedProgram(date),city))throw Error('Entries changed');await saveCouponResponse(program,date,city,value);results.push({city:city||'Tümü',status:'ready'})}catch(e){results.push({city:city||'Tümü',status:'failed',error:e.message})}}}))
await writeFile('data/maintenance/coupon-watchdog.json',JSON.stringify({date,checkedAt:new Date().toISOString(),results},null,2));console.log(JSON.stringify({date,ready:results.filter(r=>r.status==='ready').length,total:results.length}))
