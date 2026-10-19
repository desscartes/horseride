import './runtime-env.mjs'
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
const base='data/intelligence-models/2026-10-15/maiden-prize-v2',root=process.argv[2]||'data/intelligence-models/2026-10-16/prize-history-v3',countries=['TR','US']
if(!/^data\/intelligence-models\/\d{4}-\d{2}-\d{2}\/prize-history-v\d+$/.test(root))throw Error('Use an immutable versioned prize study directory')
const read=async p=>JSON.parse(await readFile(p,'utf8'))
await mkdir(root,{recursive:true})
try{await readFile(root+'/training-state.json');throw Error('Experiment already exists; inspect before restarting')}catch(e){if(e.code!=='ENOENT')throw e}
const prior=await read(base+'/training-state.json');if(prior.phase!=='complete')throw Error('Base experiment incomplete')
const state={startedAt:new Date().toISOString(),through:prior.through,phase:'exporting',base,changedInput:'historical_prize_registry_only',countries,errors:[]}
const save=()=>writeFile(root+'/training-state.json',JSON.stringify(state,null,2))
const registry=await read('data/external/race-prizes/records.json');await writeFile(root+'/prize-registry.json',JSON.stringify(registry));state.prizeRegistryRaces=Object.keys(registry.records).length
for(const file of ['charts.json','workouts.json','pedigree-registry.json'])await copyFile(base+'/'+file,root+'/'+file)
const env={...process.env,HORSERIDE_NO_LISTEN:'1',TRAINING_ARCHIVE_PATH:base+'/archive.json',WORKOUT_ARCHIVE_PATH:root+'/workouts.json',PEDIGREE_REGISTRY_PATH:root+'/pedigree-registry.json',RACE_PRIZE_REGISTRY_PATH:root+'/prize-registry.json',ARCHIVE_THROUGH_DATE:prior.through,PERFORMANCE_FEATURES:'1',PEDIGREE_FEATURES:'1',INTELLIGENCE_FEATURES:'1',IDENTITY_VERSION:'1',PACE_FEATURES:'1',EXTERNAL_CHARTS_PATH:root+'/charts.json'}
const run=(command,args,extra={})=>new Promise((ok,fail)=>{const p=spawn(command,args,{windowsHide:true,stdio:'inherit',env:{...env,...extra}});p.on('error',fail);p.on('exit',code=>code===0?ok():fail(Error(args[0]+' exited '+code)))})
try{
 await save()
 for(const country of countries){
  state.country=country;await save();const output=root+'/'+country;await mkdir(output,{recursive:true});await mkdir(root+'/control/'+country,{recursive:true})
  await copyFile(base+'/incumbent-'+country+'.json',root+'/incumbent-'+country+'.json')
  await copyFile(base+'/control/'+country+'/'+country+'-training.json',root+'/control/'+country+'/'+country+'-training.json')
  await run(process.execPath,[country==='TR'?'server/export-training.mjs':'server/export-foreign-training.mjs'],{TRAIN_COUNTRIES:country,TRAINING_OUTPUT:output+'/'+country+'-training.json',FOREIGN_MODEL_DIR:output})
 }
 state.phase='training';delete state.country;await save()
 const config=await read('data/maintenance/config.json');await run(config.python,['server/train-intelligence.py',root,'TR,US,TR-arabian,TR-thoroughbred'])
 state.phase='verifying';await save();await run(process.execPath,['server/verify-intelligence.mjs',root])
 state.phase='complete';state.finishedAt=new Date().toISOString();await save()
}catch(e){state.phase='error';state.errors.push(e.message);await save();throw e}
