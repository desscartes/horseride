import {claimResearchLock} from './research-lock.mjs'
import './runtime-env.mjs'
import {acquireCollectionGate} from './collection-gate.mjs'
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {isProcessRunning} from './process-liveness.mjs'
const root=process.argv[2]?.startsWith('data/intelligence-models/')?process.argv[2]:'data/intelligence-models/2026-10-21/pedigree-completion-v1',out=process.argv[3]?.startsWith('data/experiments/jockey-')?process.argv[3]:'data/experiments/jockey-v1',lock='data/maintenance/intelligence-training.lock'
await mkdir(out,{recursive:true})
try{const state=JSON.parse(await readFile(out+'/state.json','utf8'));if(state.phase==='complete'||(state.pid!==process.pid&&isProcessRunning(state.pid)))process.exit(0)}catch{}
await writeFile(out+'/state.json',JSON.stringify({phase:'waiting_collection_gate',pid:process.pid,root}))
if(process.argv.includes('--prepared')){for(;;){try{for(const c of ['TR','US'])JSON.parse(await readFile(`${out}/${c}/jockey-features-v1.json`,'utf8'));break}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e;await new Promise(r=>setTimeout(r,5000))}}}
const run=(cmd,args)=>new Promise((ok,fail)=>{const p=spawn(cmd,args,{stdio:'inherit',windowsHide:true});p.on('error',fail);p.on('exit',c=>c===0?ok():fail(Error('Research child exited '+c)))})
let releaseLock
try{
 await acquireCollectionGate()
 releaseLock=await claimResearchLock(lock,{pid:process.pid,root:out})
 await writeFile(out+'/state.json',JSON.stringify({phase:'preparing_frozen_features',pid:process.pid,root}))
 if(!process.argv.includes('--prepared'))await run(process.execPath,['server/prepare-jockey-research.mjs',root,out])
 for(const country of ['TR','US']){await writeFile(out+'/state.json',JSON.stringify({phase:'training',country,pid:process.pid,root}));await run('.venv/Scripts/python.exe',['server/validate-jockey-research.py',root,`${out}/${country}`,country]);await run(process.execPath,['server/verify-context-validation.mjs',`${out}/${country}`])}
 await writeFile(out+'/state.json',JSON.stringify({phase:'complete',finishedAt:new Date().toISOString(),activeModelChanged:false}))
}catch(e){await writeFile(out+'/state.json',JSON.stringify({phase:'failed',error:e.message}));throw e}finally{if(releaseLock)await releaseLock()}
