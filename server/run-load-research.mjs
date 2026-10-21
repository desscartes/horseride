import './runtime-env.mjs'
import {acquireCollectionGate} from './collection-gate.mjs'
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
process.chdir(fileURLToPath(new URL('../',import.meta.url)))
const root='data/intelligence-models/2026-10-21/pedigree-completion-v1',out=process.argv[2]||'data/experiments/observed-load-v2',lock='data/maintenance/intelligence-training.lock'
if(!/^data\/experiments\/observed-load-v[0-9]+$/.test(out))throw Error('Versioned research output required')
await mkdir(out,{recursive:true});try{if(JSON.parse(await readFile(out+'/state.json','utf8')).phase==='complete')process.exit(0)}catch{}
await writeFile(out+'/state.json',JSON.stringify({phase:'waiting_collection_gate',pid:process.pid,root}))
await acquireCollectionGate()
await writeFile(lock,JSON.stringify({pid:process.pid,root:out}),{flag:'wx'})
try{
 const run=(cmd,args)=>new Promise((ok,fail)=>{const p=spawn(cmd,args,{stdio:'inherit',windowsHide:true,env:process.env});p.on('error',fail);p.on('exit',c=>c===0?ok():fail(Error(`${args[0]} exited ${c}`)))})
 await writeFile(out+'/state.json',JSON.stringify({phase:'preparing_frozen_features',pid:process.pid,root}))
 await run(process.execPath,['server/prepare-load-research.mjs',root,out])
 await writeFile(out+'/state.json',JSON.stringify({phase:'training_control_and_load_candidate',pid:process.pid,root}))
 await run('D:/Apps/HorseRide/.venv/Scripts/python.exe',['server/validate-load-research.py',root,out])
 await run(process.execPath,['server/verify-context-validation.mjs',out])
 await writeFile(out+'/state.json',JSON.stringify({phase:'complete',finishedAt:new Date().toISOString(),activeModelChanged:false}))
}catch(e){await writeFile(out+'/state.json',JSON.stringify({phase:'failed',error:e.message}));throw e}finally{await unlink(lock).catch(()=>{})}
