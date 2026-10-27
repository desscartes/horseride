import {mkdirSync,readdirSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs'
import {join} from 'node:path'
import {isProcessRunning} from './process-liveness.mjs'
export function jobPriority(command){return /run-morning-preparation|run-prestart-readiness/.test(command)?0:/research|run-intelligence-training/.test(command)?2:1}
export function registerCollectionWaiter({directory='data/maintenance/collection-waiters',pid=process.pid,command=process.argv.join(' '),now=Date.now,alive=isProcessRunning}={}){
 mkdirSync(directory,{recursive:true});const file=join(directory,`${pid}.json`),token=JSON.stringify({pid,queuedAt:now(),priority:jobPriority(command)})
 writeFileSync(file,token,{flag:'wx'})
 const release=()=>{try{if(readFileSync(file,'utf8')===token)unlinkSync(file)}catch(e){if(e.code!=='ENOENT')throw e}}
 return {release,isNext:()=>{
  const rows=[]
  for(const name of readdirSync(directory).filter(n=>/^\d+\.json$/.test(n))){const path=join(directory,name);let raw,r;try{raw=readFileSync(path,'utf8');r=JSON.parse(raw)}catch(e){if(e.code==='ENOENT')continue;throw e}
   if(!alive(r.pid)){try{if(readFileSync(path,'utf8')===raw)unlinkSync(path)}catch(e){if(e.code!=='ENOENT')throw e}continue}
   if(!Number.isSafeInteger(r.queuedAt)||![0,1,2].includes(r.priority))throw Error('Invalid collection queue entry')
   rows.push(r)
  }
  // After 30 minutes all jobs enter the oldest-first lane, preventing starvation.
  const effective=r=>now()-r.queuedAt>=1800000?-1:r.priority
  rows.sort((a,b)=>effective(a)-effective(b)||a.queuedAt-b.queuedAt||a.pid-b.pid)
  return rows[0]?.pid===pid
 }}
}
