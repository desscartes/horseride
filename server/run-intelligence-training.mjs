import './runtime-env.mjs'
import {remoteDeployment} from './deployment-role.mjs'
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises'
import {isProcessRunning} from './process-liveness.mjs'
import {spawn} from 'node:child_process'
import {mergeOfficialCharts} from './overseas-chart-input.mjs'
import {localDay,shiftDay} from './maintenance-policy.mjs'
import {trainingArchiveDates,trainingArchiveDay} from './training-archive.mjs'
if(remoteDeployment())throw Error('Training belongs to the home server')
const root=process.argv[2],countries=[...new Set((process.env.INTELLIGENCE_COUNTRIES||'TR,US,GB,FR,ZA,AU').split(',').map(c=>c.trim()))].join(','),through=shiftDay(localDay(),-1)
if(countries.split(',').some(c=>!['TR','US','GB','FR','ZA','AU'].includes(c)))throw Error('Unsupported intelligence training country')
if(!root?.startsWith('data/intelligence-models/'))throw Error('Use versioned intelligence output directory')
const lock='data/maintenance/intelligence-training.lock'
await mkdir(root,{recursive:true})
const read=async p=>JSON.parse(await readFile(p,'utf8'))
const config=await read('data/maintenance/config.json'),state={startedAt:new Date().toISOString(),through,phase:'exporting',errors:[]}
const save=()=>writeFile(`${root}/training-state.json`,JSON.stringify(state,null,2))
const run=(cmd,args,env={})=>new Promise((ok,fail)=>{const p=spawn(cmd,args,{windowsHide:true,stdio:'inherit',env:{...process.env,HORSERIDE_NO_LISTEN:'1',TRAINING_ARCHIVE_PATH:`${root}/archive.json`,WORKOUT_ARCHIVE_PATH:`${root}/workouts.json`,PEDIGREE_REGISTRY_PATH:`${root}/pedigree-registry.json`,...env}});p.on('error',fail);p.on('exit',c=>c===0?ok():fail(Error(`${args[0]} exited ${c}`)))})
await mkdir('data/maintenance',{recursive:true})
try{const owner=JSON.parse(await readFile(lock,'utf8'));if(isProcessRunning(owner.pid))throw Error(`Intelligence training already running (${owner.root})`);await unlink(lock)}catch(error){if(error.code!=='ENOENT')throw error}
await writeFile(lock,JSON.stringify({pid:process.pid,root,startedAt:new Date().toISOString()}),{flag:'wx'})
try{
 await save()
 if(countries.split(',').includes('AU')){
  for(const [variable,source,name] of [['AU_WINNER_ARCHIVE_PATH','data/external/racing-australia/tjk-winner-targets.json','au-winner-targets.json'],['AU_FORM_REGISTRY_PATH','data/external/racing-australia/registry.json','au-form-registry.json']]){
   try{const snapshot=await read(process.env[variable]||source)
    await writeFile(`${root}/${name}`,JSON.stringify(snapshot));process.env[variable]=`${root}/${name}`
   }catch(error){if(error.code!=='ENOENT'||process.env[variable])throw error;(state.warnings||=[]).push(`${variable}: no cached source; AU coverage remains incomplete`)}
  }
 }
 if(process.env.RACE_PRIZE_REGISTRY_PATH){
  const registry=await read(process.env.RACE_PRIZE_REGISTRY_PATH)
  await writeFile(`${root}/prize-registry.json`,JSON.stringify(registry))
  process.env.RACE_PRIZE_REGISTRY_PATH=`${root}/prize-registry.json`
  state.prizeRegistryRaces=Object.keys(registry.records||{}).length
 }
 let pedigreeRegistry={records:{}};try{pedigreeRegistry=await read('data/external/tjk-pedigree/registry.json')}catch{}
 await writeFile(`${root}/pedigree-registry.json`,JSON.stringify(pedigreeRegistry))
 const dates=trainingArchiveDates().filter(day=>day<=through)
 await mkdir(`${root}/archive-days`,{recursive:true})
 for(const day of dates)await writeFile(`${root}/archive-days/${day}.json`,JSON.stringify(trainingArchiveDay(day).map(r=>({...r,results:[...r.results]}))))
 await writeFile(`${root}/archive.json`,JSON.stringify({format:'daily_v1',days:dates}))
 const tables=[]
 for(const day of dates){try{const a=await read(`data/training-workouts/${day}.json`);if(a.complete&&a.date===day)tables.push(...a.tables)}catch{}}
 await writeFile(`${root}/workouts.json`,JSON.stringify({tables,records:(await read('data/external/equibase-workouts/records.json')).records||[]}))
 const charts=mergeOfficialCharts(await Promise.all(['data/external/equibase/parsed.json','data/external/equibase-career/parsed.json'].map(read)),through)
 await writeFile(`${root}/charts.json`,JSON.stringify(charts))
 for(const country of countries.split(',')){
  state.country=country;state.step='exporting_country';await save()
  let incumbent,modelPath
  try{const pointer=await read(`data/daily-models/active-${country}.json`);incumbent=await read(pointer.reportPath);modelPath=pointer.modelPath}catch{
   try{incumbent=await read(country==='TR'?'data/ranking-report.json':`data/foreign-models/${country}-report.json`);modelPath=country==='TR'?'data/ranking-live.json':`data/foreign-models/${country}-live.json`;if(!incumbent.enabled&&!incumbent.promoted)incumbent=null}catch{}
  }
  const output=`${root}/${country}`;await mkdir(output,{recursive:true})
  const exporter=country==='TR'?'server/export-training.mjs':'server/export-foreign-training.mjs'
  if(incumbent){
   await writeFile(`${root}/incumbent-${country}.json`,JSON.stringify({...incumbent,modelPath}))
   const control=`${root}/control/${country}`;await mkdir(control,{recursive:true})
   await run(process.execPath,[exporter],{OFFICIAL_WORKOUT_SPEED_FEATURES:'',ARCHIVE_THROUGH_DATE:through,PERFORMANCE_FEATURES:'1',PEDIGREE_FEATURES:incumbent.featurePipeline==='pedigree_v1'?'1':'',IDENTITY_VERSION:String(incumbent.identityVersion||1),PACE_FEATURES:incumbent.featurePipeline==='performance_v2'?'1':'',TRAIN_COUNTRIES:country,TRAINING_OUTPUT:`${control}/${country}-training.json`,FOREIGN_MODEL_DIR:control,EXTERNAL_CHARTS_PATH:incumbent.externalChartsPath||'data/external/equibase/parsed.json'})
  }
  await run(process.execPath,[exporter],{ARCHIVE_THROUGH_DATE:through,PERFORMANCE_FEATURES:'1',PEDIGREE_FEATURES:'1',INTELLIGENCE_FEATURES:'1',IDENTITY_VERSION:'1',PACE_FEATURES:'1',TRAIN_COUNTRIES:country,TRAINING_OUTPUT:`${output}/${country}-training.json`,FOREIGN_MODEL_DIR:output,EXTERNAL_CHARTS_PATH:`${root}/charts.json`})
 }
 state.step='auditing_training_contract';await save();await run(process.execPath,['server/audit-training-contract.mjs',root,countries])
 const artifacts=countries.split(',').includes('TR')?`${countries},TR-arabian,TR-thoroughbred`:countries
 state.phase='training';state.step='training_and_evaluation';delete state.country;await save();await run(config.python,['server/train-intelligence.py',root,artifacts])
 state.phase='verifying';await save();await run(process.execPath,['server/verify-intelligence.mjs',root])
 const coverageCountries=countries.split(',').filter(c=>['TR','US'].includes(c))
 if(coverageCountries.length){
  state.step='auditing_training_inputs';await save()
  await run(process.execPath,['server/audit-training-evidence.mjs',root,coverageCountries.join(',')])
  await writeFile(`${root}/input-coverage.json`,JSON.stringify(await read('data/maintenance/training-evidence-audit.json'),null,2))
  state.inputCoverage=`${root}/input-coverage.json`
 }
 state.phase='complete';state.finishedAt=new Date().toISOString();await save()
}catch(e){state.phase='error';state.errors.push(e.message);await save();throw e}
finally{try{const owner=JSON.parse(await readFile(lock,'utf8'));if(owner.pid===process.pid)await unlink(lock)}catch(error){if(error.code!=='ENOENT')console.error('Training lock cleanup:',error.message)}}
