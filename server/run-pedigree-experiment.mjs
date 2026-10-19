import './runtime-env.mjs'
import {remoteDeployment} from './deployment-role.mjs'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {localDay,shiftDay} from './maintenance-policy.mjs'
if(remoteDeployment())throw Error('Pedigree training belongs to the home server')
const json=async p=>JSON.parse(await readFile(p,'utf8'))
const through=shiftDay(localDay(),-1)
try{const p=await json('data/pedigree-models/active-TR.json');const r=await json(p.reportPath);if(r.enabled){console.log('Pedigree model is active; normal daily training owns subsequent candidates.');process.exit(0)}}catch{}
const root=`data/pedigree-models/${localDay()}/${Date.now()}`
await mkdir(root,{recursive:true})
const fixed=await json('data/ranking-report.json')
let incumbent=fixed,modelPath='data/ranking-live.json'
try{const p=await json('data/daily-models/active-TR.json');incumbent=await json(p.reportPath);modelPath=p.modelPath}catch{}
// Keep the original chronological development boundaries for this new feature experiment.
incumbent={...incumbent,train:fixed.train,validation:fixed.validation,test:fixed.test}
await writeFile(`${root}/incumbent.json`,JSON.stringify(incumbent))
const config=await json('data/maintenance/config.json')
const run=(cmd,args,env={})=>new Promise((ok,fail)=>{const p=spawn(cmd,args,{windowsHide:true,stdio:'inherit',env:{...process.env,...env}});p.on('error',fail);p.on('exit',c=>c===0?ok():fail(Error(`${args[0]} exited ${c}`)))})
const state={startedAt:new Date().toISOString(),root,phase:'exporting'}
const save=()=>writeFile('data/pedigree-models/state.json',JSON.stringify(state,null,2))
try{
  await save()
  await run(process.execPath,['server/export-training.mjs'],{PERFORMANCE_FEATURES:'1',PEDIGREE_FEATURES:'1',IDENTITY_VERSION:'2',ARCHIVE_THROUGH_DATE:through,TRAINING_OUTPUT:`${root}/TR-training.json`})
  state.phase='training';await save()
  await run(config.python||'python',['server/train-pedigree-ranking.py',root,`${root}/incumbent.json`,modelPath])
  state.phase='verifying';await save()
  await run(process.execPath,['server/publish-pedigree-model.mjs',root])
  state.phase='complete';state.reportPath=`${root}/report.json`;state.finishedAt=new Date().toISOString();await save()
}catch(e){state.phase='error';state.error=e.message;await save();throw e}
