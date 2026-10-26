import {Worker} from 'node:worker_threads'
import {createHash} from 'node:crypto'
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises'
import {localDay} from './maintenance-policy.mjs'
// Expensive SQLite aggregation never runs on the HTTP event loop. One worker,
// identical concurrent reads coalesced, bounded queue and persisted last success.
export function createPublicReader({timeoutMs=60000,directory='data/public-read-cache',workerFactory=()=>new Worker(new URL('./public-read-worker.mjs',import.meta.url),{execArgv:[]})}={}){
 let worker=null,sequence=0
 const jobs=new Map(),pending=new Map(),cache=new Map()
 function reset(error){const old=worker;worker=null;for(const j of jobs.values()){clearTimeout(j.timer);j.reject(error)}jobs.clear();old?.terminate().catch(()=>{})}
 function execute(kind,options){
  if(jobs.size>=8)return Promise.reject(Error('Public read queue full'))
  if(!worker){worker=workerFactory();worker.on('message',({id,value,error})=>{const j=jobs.get(id);if(!j)return;clearTimeout(j.timer);jobs.delete(id);if(!jobs.size)worker?.unref();error?j.reject(Error(error)):j.resolve(value)});const owned=worker;worker.on('error',e=>{if(worker===owned)reset(e)});worker.on('exit',code=>{if(worker===owned&&code!==0)reset(Error('Public read worker exited'))})}
  worker.ref();const id=++sequence
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reset(Error('Public read timeout')),timeoutMs);jobs.set(id,{resolve,reject,timer});worker.postMessage({id,kind,options})})
 }
 return async function read(kind,options={}){
  const key=JSON.stringify([localDay(),kind,options]),path=directory+'/'+createHash('sha256').update(key).digest('hex')+'.json'
  let saved=cache.get(key)
  if(!saved)try{const v=JSON.parse(await readFile(path,'utf8'));if(v.key===key){saved=v;cache.set(key,v)}}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))console.error('Public cache read:',e.message)}
  const deliver=(v,stale)=>({...v.value,_delivery:{preparedAt:v.at,cached:true,stale,reason:stale?'Son başarılı kayıt; güncelleme sürüyor.':null}})
  if(saved&&Date.now()-Date.parse(saved.at)<60000)return deliver(saved,false)
  if(!pending.has(key)){
   const task=execute(kind,options).then(async value=>{const item={key,at:new Date().toISOString(),value};cache.set(key,item);while(cache.size>32)cache.delete(cache.keys().next().value);await mkdir(directory,{recursive:true});const tmp=path+'.'+process.pid+'.tmp';await writeFile(tmp,JSON.stringify(item));await rename(tmp,path);return deliver(item,false)}).finally(()=>pending.delete(key))
   pending.set(key,task)
  }
  if(saved){pending.get(key).catch(e=>console.error('Public read refresh:',kind,e.message));return deliver(saved,true)}
  return pending.get(key)
 }
}
const readers=new Map()
export function publicRead(kind,options={}){if(!readers.has(kind))readers.set(kind,createPublicReader());return readers.get(kind)(kind,options)}
