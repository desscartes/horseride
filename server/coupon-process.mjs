import {couponInputSignature,readCouponResponse,saveCouponResponse} from './coupon-response-cache.mjs'
import {readServedProgram} from './served-program.mjs'
import {fork} from 'node:child_process'
import {statSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

function programRevision(date,city=''){return couponInputSignature(readServedProgram(date),city)}
export function runCouponWorker(date,city,{timeoutMs=8000}={}){
 return new Promise((ok,fail)=>{
  // No index.mjs import in this worker: no API, training or LLM startup.
  const child=fork(fileURLToPath(new URL('./coupon-worker.mjs',import.meta.url)),[date,city||''],{cwd:fileURLToPath(new URL('../',import.meta.url)),execArgv:['--use-system-ca'],env:{...process.env,HORSERIDE_NO_LISTEN:'0'},windowsHide:true,stdio:['ignore','ignore','pipe','ipc']})
  let done=false
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);child.kill();error?fail(error):ok(value)}
  const timer=setTimeout(()=>finish(Error('Kupon hazırlığı zaman aşımına uğradı.')),timeoutMs)
  child.stderr.on('data',b=>{const text=b.toString();if(!text.includes('ExperimentalWarning'))console.error('Coupon worker:',text.trim().slice(0,300))})
  child.on('message',m=>m.error?finish(Error(m.error)):finish(null,m.result))
  child.on('error',error=>finish(error))
  child.on('exit',code=>{if(!done)finish(Error(`Coupon worker exited ${code}`))})
 })
}
export function createCouponReader({run=runCouponWorker,revision=programRevision,clock=Date.now,ttlMs=60000,useDiskCache=false,maxEntries=24,concurrency=2}={}){
 const cache=new Map(),pending=new Map(),queue=[];let active=0
 const drain=()=>{while(active<concurrency&&queue.length){active++;const task=queue.shift();Promise.resolve().then(task.action).then(task.ok,task.fail).finally(()=>{active--;drain()})}}
 const schedule=action=>new Promise((ok,fail)=>{queue.push({action,ok,fail});drain()})
 return async function read(date,city=''){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||typeof city!=='string'||city.length>80)throw Error('Invalid coupon request')
  const key=JSON.stringify([date,city]),signature=revision(date,city),cached=cache.get(key)
  if(cached?.signature===signature&&cached.expires>clock())return cached.value
  if(useDiskCache){const prepared=await readCouponResponse(readServedProgram(date),date,city);if(prepared)return prepared}
  const token=JSON.stringify([key,signature]);if(pending.has(token))return pending.get(token)
  if(pending.size>=maxEntries)throw Error('Kupon hazırlığı yoğun; kısa süre sonra tekrar deneyin.')
  const promise=schedule(async()=>{
   const value=await run(date,city)
   // A withdrawal or market revision while the worker runs must never be served.
   if(revision(date,city)!==signature)throw Error('Program kupon hazırlanırken değişti; tekrar deneyin.')
   const tickets=[...Object.values(value),...(value.selectedMeetingCoupons||[]).map(row=>row.ticket)]
   const starts=tickets.filter(v=>v&&typeof v==='object'&&v.scheduledStart).map(v=>Date.parse(v.scheduledStart)).filter(t=>t>clock())
   if(cache.size>=maxEntries)cache.delete(cache.keys().next().value)
   cache.set(key,{signature,value,expires:Math.min(clock()+ttlMs,...starts)})
   if(useDiskCache)await saveCouponResponse(readServedProgram(date),date,city,value)
   return value
  }).finally(()=>pending.delete(token))
  pending.set(token,promise);return promise
 }
}
export const readCouponShowcase=createCouponReader({useDiskCache:true})
