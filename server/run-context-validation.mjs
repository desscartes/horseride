import './runtime-env.mjs'
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {isProcessRunning} from './process-liveness.mjs'
const [root,out]=process.argv.slice(2)
if(!root?.startsWith('data/intelligence-models/')||!out?.startsWith('data/experiments/'))throw Error('Versioned input/output required')
await mkdir(out,{recursive:true});const lock='data/maintenance/intelligence-training.lock',statePath=out+'/state.json';let state={phase:'waiting_maintenance',pid:process.pid,startedAt:new Date().toISOString(),root,out}
const save=()=>writeFile(statePath,JSON.stringify(state,null,2));await save()
for(;;){let owner;try{owner=JSON.parse(await readFile('data/maintenance/daily.lock','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}if(!owner||!isProcessRunning(owner.pid))break;await new Promise(r=>setTimeout(r,30000))}
try{const owner=JSON.parse(await readFile(lock,'utf8'));if(isProcessRunning(owner.pid))throw Error('Another training owner is running');await unlink(lock)}catch(e){if(e.code!=='ENOENT')throw e}
await writeFile(lock,JSON.stringify({pid:process.pid,root:out,experiment:'prior-race-context-validation'}),{flag:'wx'})
try{
 // A maintenance owner might have appeared while the training lock was acquired.
 let owner;try{owner=JSON.parse(await readFile('data/maintenance/daily.lock','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}if(owner&&isProcessRunning(owner.pid))throw Error('Maintenance started; validation deferred safely')
 state.phase='training_validation_only';await save();const config=JSON.parse(await readFile('data/maintenance/config.json','utf8'))
 await new Promise((ok,fail)=>{const p=spawn(config.python,['server/validate-prior-race-context.py',root,out],{windowsHide:true,stdio:'inherit'});p.on('error',fail);p.on('exit',c=>c===0?ok():fail(Error('Validation exited '+c)))})
 state.phase='complete';state.finishedAt=new Date().toISOString();await save()
}catch(e){state.phase='error';state.error=e.message;await save();throw e}finally{try{const owner=JSON.parse(await readFile(lock,'utf8'));if(owner.pid===process.pid)await unlink(lock)}catch(e){if(e.code!=='ENOENT')throw e}}
