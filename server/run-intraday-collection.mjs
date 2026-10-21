import {acquireCollectionGate} from './collection-gate.mjs'
import './runtime-env.mjs'
import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {localDay} from './maintenance-policy.mjs'
import {isProcessRunning} from './process-liveness.mjs'
import {remoteDeployment} from './deployment-role.mjs'
import {nextCollectionJob} from './intraday-collection-plan.mjs'
process.chdir(fileURLToPath(new URL('../',import.meta.url)))
if(remoteDeployment())throw Error('Intraday collection belongs to home server')
const dir='data/maintenance',lock=dir+'/intraday-collection.lock',day=localDay(),file=`${dir}/intraday-${day}.json`
await mkdir(dir,{recursive:true})
await acquireCollectionGate()
async function owner(path){try{const o=JSON.parse(await readFile(path,'utf8'));return isProcessRunning(o.pid)}catch(e){if(e.code==='ENOENT')return false;throw e}}
for(const name of ['morning.lock','daily.lock','intelligence-training.lock'])if(await owner(dir+'/'+name)){console.log(JSON.stringify({status:'deferred',reason:name}));process.exit(0)}
if(await owner(lock)){console.log(JSON.stringify({status:'already_running'}));process.exit(0)}
await unlink(lock).catch(e=>{if(e.code!=='ENOENT')throw e})
try{await writeFile(lock,JSON.stringify({pid:process.pid,day}),{flag:'wx'})}catch(e){if(e.code==='EEXIST')process.exit(0);throw e}
try{
 for(const name of ['morning.lock','daily.lock','intelligence-training.lock'])if(await owner(dir+'/'+name)){console.log(JSON.stringify({status:'deferred',reason:name}));process.exitCode=0;throw Object.assign(Error('deferred'),{deferred:true})}
 let state={day,jobs:{}};try{state=JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).split(':').map(Number),minute=parts[0]*60+parts[1],job=nextCollectionJob(day,minute,state.jobs)
 if(!job){console.log(JSON.stringify({status:'no_due_job'}))}else{
  const save=async()=>{await writeFile(file+'.tmp',JSON.stringify(state,null,2));await rename(file+'.tmp',file)}
  const old=state.jobs[job.id]||{},record=state.jobs[job.id]={...old,status:'running',attempts:(old.attempts||0)+1,lastAttemptAtMinute:minute,startedAt:new Date().toISOString(),script:job.script};await save()
  const log=await import('node:fs');const fd=log.openSync(`${dir}/intraday-${day}-${job.id.split(':').at(-1)}.log`,'a')
  const code=await new Promise((ok,fail)=>{const p=spawn(process.execPath,['--use-system-ca',job.script,...job.args],{windowsHide:true,stdio:['ignore',fd,fd],env:{...process.env,...job.env}});p.once('error',fail);p.once('exit',c=>ok(c))}).catch(error=>{record.error=error.message;return -1}).finally(()=>log.closeSync(fd))
  record.status=code===0?'complete':'failed';record.exitCode=code;record.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify({job:job.id,...record}));if(code!==0)process.exitCode=1
 }
}catch(e){if(!e.deferred)throw e}finally{await unlink(lock).catch(()=>{})}
