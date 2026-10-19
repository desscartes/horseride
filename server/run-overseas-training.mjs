import './runtime-env.mjs'
import {remoteDeployment} from './deployment-role.mjs'
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {mergeOfficialCharts} from './overseas-chart-input.mjs'
import {localDay,shiftDay} from './maintenance-policy.mjs'
if(remoteDeployment())throw Error('Training belongs to the home server')
const root=process.argv[2],countries='US,GB,FR,ZA,HK,AU,CA',through=shiftDay(localDay(),-1)
if(!root?.startsWith('data/overseas-expansion/'))throw Error('Use a versioned overseas-expansion output directory')
await mkdir(root,{recursive:true})
const read=async p=>JSON.parse(await readFile(p,'utf8'))
const config=await read('data/maintenance/config.json')
const state={startedAt:new Date().toISOString(),through,phase:'merging',errors:[]}
const save=()=>writeFile(`${root}/training-state.json`,JSON.stringify(state,null,2))
const run=(cmd,args,env={})=>new Promise((ok,fail)=>{const p=spawn(cmd,args,{windowsHide:true,stdio:'inherit',env:{...process.env,HORSERIDE_NO_LISTEN:'1',...env}});p.on('error',fail);p.on('exit',c=>c===0?ok():fail(Error(`${args[0]} exited ${c}`)))})
try{
 await save()
 const sources=await Promise.all(['data/external/equibase/parsed.json','data/external/equibase-career/parsed.json'].map(read))
 const charts=mergeOfficialCharts(sources,through);await writeFile(`${root}/charts.json`,JSON.stringify(charts));state.charts=charts.audit;await save()
 let incumbent,modelPath
 try{const pointer=await read('data/daily-models/active-US.json');incumbent=await read(pointer.reportPath);modelPath=pointer.modelPath}catch{incumbent=await read('data/foreign-models/US-report.json');modelPath='data/foreign-models/US-live.json'}
 await writeFile(`${root}/incumbent-US.json`,JSON.stringify({...incumbent,modelPath}))
 state.phase='exporting_control';await save()
 await run(process.execPath,['server/export-foreign-training.mjs'],{ARCHIVE_THROUGH_DATE:through,PERFORMANCE_FEATURES:'1',IDENTITY_VERSION:String(incumbent.identityVersion||1),PACE_FEATURES:incumbent.featurePipeline==='performance_v2'?'1':'',TRAIN_COUNTRIES:'US',FOREIGN_MODEL_DIR:`${root}/control`,EXTERNAL_CHARTS_PATH:incumbent.externalChartsPath||'data/external/equibase/parsed.json'})
 state.phase='exporting_candidate';await save()
 for(const country of countries.split(','))await run(process.execPath,['server/export-foreign-training.mjs'],{ARCHIVE_THROUGH_DATE:through,PERFORMANCE_FEATURES:'1',IDENTITY_VERSION:'1',PACE_FEATURES:'1',TRAIN_COUNTRIES:country,FOREIGN_MODEL_DIR:`${root}/${country}`,EXTERNAL_CHARTS_PATH:`${root}/charts.json`})
 state.phase='training';await save()
 await run(config.python,['server/train-overseas-expansion.py',root,countries])
 state.phase='verifying';await save()
 await run(process.execPath,['server/verify-overseas-expansion.mjs',root])
 state.phase='complete';state.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify(state))
}catch(e){state.phase='error';state.errors.push(e.message);await save();throw e}
