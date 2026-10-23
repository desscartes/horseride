import {analysisEntryFingerprint} from './analysis-entry-policy.mjs'
import {fork} from 'node:child_process'
import {existsSync,readFileSync,mkdirSync,writeFileSync,renameSync,statSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const directory=resolve(process.env.HORSERIDE_PROGRAM_CACHE||'data/program-cache')
const memory=new Map(),pending=new Map()
const revisions=new Map()
let queue=Promise.resolve()
export function compactProgramRaces(races){
 return races.map(r=>({...r,horses:r.horses.map(({sourceData,horsePerformance,jockeyPerformance,workout,workouts,externalEvidence,performanceEvidence,paceEvidence,...horse})=>horse)}))
}
export function retainVerifiedMarkets(races,previous=[]){
 return races.map(r=>{
  const previousRace=previous.find(p=>p.city===r.city&&Number(p.no)===Number(r.no))
  if(!r.surpriseSignal&&previousRace?.surpriseSignal&&analysisEntryFingerprint([r])===analysisEntryFingerprint([previousRace]))r={...r,surpriseSignal:previousRace.surpriseSignal}
  if(r.officialMarketsVerified)return r
  const old=previous.find(p=>p.city===r.city&&Number(p.no)===Number(r.no)&&p.time===r.time&&p.officialMarketsVerified)
  return old?{...r,sixLegStarts:old.sixLegStarts||[],fiveLegStarts:old.fiveLegStarts||[],officialMarketsVerified:true,officialMarketsReused:true}:r
 })
}
export function publishProgram(date,payload){
 if(payload.date!==date||!Array.isArray(payload.races)||!payload.races.length)throw Error('Program snapshot mismatch')
 payload={...payload,races:retainVerifiedMarkets(payload.races,readServedProgram(date)?.races||[])}
 mkdirSync(directory,{recursive:true})
 const path=resolve(directory,`${date}.json`),temp=`${path}.${process.pid}.tmp`
 writeFileSync(temp,JSON.stringify(payload));renameSync(temp,path);memory.set(date,payload);revisions.set(date,statSync(path).mtimeMs)
}
export function readServedProgram(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null
 const path=resolve(directory,`${date}.json`)
 if(existsSync(path))try{const revision=statSync(path).mtimeMs;if(memory.has(date)&&revisions.get(date)===revision)return memory.get(date);const value=JSON.parse(readFileSync(path,'utf8'));if(value.date===date&&Array.isArray(value.races)){memory.set(date,value);revisions.set(date,revision);return value}}catch{}
 return null
}
export function refreshServedProgram(date){
 if(pending.has(date))return pending.get(date)
 const job=queue.catch(()=>{}).then(()=>new Promise((resolveJob,reject)=>{
  const child=fork(fileURLToPath(new URL('./program-refresh.mjs',import.meta.url)),[date],{cwd:fileURLToPath(new URL('../',import.meta.url)),execArgv:['--use-system-ca'],env:{...process.env,HORSERIDE_NO_LISTEN:'1'},windowsHide:true,stdio:['ignore','ignore','pipe','ipc']})
  let received=false
  const timer=setTimeout(()=>{child.kill();reject(Error('Program refresh timeout'))},300000)
  child.stderr.on('data',b=>console.error('Program refresh:',b.toString().trim().slice(0,400)))
  child.on('message',message=>{clearTimeout(timer);if(message.ok){received=true;memory.delete(date);resolveJob(readServedProgram(date))}else reject(Error(message.error||'Program refresh failed'))})
  child.on('error',reject)
  child.on('exit',code=>{clearTimeout(timer);if(!received)reject(Error(`Program refresh exited ${code}`))})
 })).finally(()=>pending.delete(date))
 pending.set(date,job);queue=job;return job
}
