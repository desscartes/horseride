import {claimResearchLock} from './research-lock.mjs'
import {isProcessRunning} from './process-liveness.mjs'
import './runtime-env.mjs'
import {acquireCollectionGate} from './collection-gate.mjs'
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
process.chdir(fileURLToPath(new URL('../',import.meta.url)))
const root=process.argv[3]||'data/intelligence-models/2026-10-21/pedigree-completion-v1',out=process.argv[2]||'data/experiments/observed-load-v2',lock='data/maintenance/intelligence-training.lock'
if(!/^data\/intelligence-models\/[A-Za-z0-9_./-]+$/.test(root)||root.includes('..'))throw Error('Frozen versioned training input required')
if(!/^data\/experiments\/observed-load-v[0-9]+$/.test(out))throw Error('Versioned research output required')
await mkdir(out,{recursive:true});try{const previous=JSON.parse(await readFile(out+'/state.json','utf8'));if(previous.phase==='complete'||previous.pid!==process.pid&&isProcessRunning(previous.pid))process.exit(0)}catch{}
await writeFile(out+'/state.json',JSON.stringify({phase:'waiting_collection_gate',pid:process.pid,root}))
let releaseLock
try{
 await acquireCollectionGate()
 releaseLock=await claimResearchLock(lock,{pid:process.pid,root:out})
 const run=(cmd,args)=>new Promise((ok,fail)=>{const p=spawn(cmd,args,{stdio:'inherit',windowsHide:true,env:process.env});p.on('error',fail);p.on('exit',c=>c===0?ok():fail(Error(`${args[0]} exited ${c}`)))})
 await writeFile(out+'/state.json',JSON.stringify({phase:'preparing_frozen_features',pid:process.pid,root}))
 await run(process.execPath,['server/prepare-load-research.mjs',root,out])
 await writeFile(out+'/state.json',JSON.stringify({phase:'training_control_and_load_candidate',pid:process.pid,root}))
 await run('D:/Apps/HorseRide/.venv/Scripts/python.exe',['server/validate-load-research.py',root,out])
 await run(process.execPath,['server/verify-context-validation.mjs',out])
 await writeFile(out+'/state.json',JSON.stringify({phase:'complete',finishedAt:new Date().toISOString(),activeModelChanged:false}))
}catch(e){await writeFile(out+'/state.json',JSON.stringify({phase:'failed',error:e.message}));throw e}finally{if(releaseLock)await releaseLock()}
