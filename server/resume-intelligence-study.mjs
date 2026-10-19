import './runtime-env.mjs'
import {readFile,writeFile,unlink,mkdir,access} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'
import {resolve} from 'node:path'
import {isProcessRunning} from './process-liveness.mjs'
const root=process.argv[2],base=resolve('data/intelligence-models')
if(!root||!resolve(root).startsWith(base+'\\')&&!resolve(root).startsWith(base+'/'))throw Error('Use an existing versioned intelligence study')
const json=async p=>JSON.parse(await readFile(p,'utf8')),state=await json(`${root}/training-state.json`)
if(!['training','verifying','error'].includes(state.phase))throw Error('Only an interrupted fitting/verification study may resume')
const archive=await json(`${root}/archive.json`)
if(archive.format!=='daily_v1'||!archive.days?.length||archive.days.some(d=>d>state.through))throw Error('Frozen archive date mismatch')
for(const day of archive.days)await access(`${root}/archive-days/${day}.json`)
for(const file of ['workouts.json','pedigree-registry.json','charts.json'])await access(`${root}/${file}`)
const countries=[];for(const country of ['TR','US','GB','FR','ZA','AU'])try{await access(`${root}/${country}/${country}-training.json`);countries.push(country)}catch{}
if(!countries.length)throw Error('No completed country exports')
const artifacts=countries.includes('TR')?[...countries,'TR-arabian','TR-thoroughbred']:countries,missing=[]
for(const artifact of artifacts){
 const country=artifact.split('-')[0]
 try{
  const report=await json(`${root}/${artifact}/report.json`)
  if(['insufficient_data','insufficient_chronological_test'].includes(report.status))continue
  const bytes=await readFile(`${root}/${country}/${country}-training.json`),fingerprint=createHash('sha256').update(bytes).digest('hex').slice(0,12)
  if(report.trainingFingerprint!==fingerprint||report.trainedThrough>state.through)throw Object.assign(Error('Frozen data mismatch; do not refit a changed study'),{code:'FROZEN_MISMATCH'})
  for(const file of ['live.json','test.json','reference.json'])await access(`${root}/${artifact}/${file}`)
 }catch(error){if(error.code==='FROZEN_MISMATCH')throw error;missing.push(artifact)}
}
// A verified model already exposed to a future study must remain immutable.
for(const artifact of missing){try{const pin=await json(`data/intelligence-models/prospective-${artifact}.json`);if(resolve(pin.reportPath)===resolve(`${root}/${artifact}/report.json`))throw Object.assign(Error('Cannot refit a registered prospective model'),{code:'PINNED'})}catch(error){if(error.code!=='ENOENT')throw error}}
const lock='data/maintenance/intelligence-training.lock';await mkdir('data/maintenance',{recursive:true})
try{const owner=await json(lock);if(isProcessRunning(owner.pid))throw Error(`Training already running: ${owner.root}`);await unlink(lock)}catch(error){if(error.code!=='ENOENT')throw error}
await writeFile(lock,JSON.stringify({pid:process.pid,root,startedAt:new Date().toISOString(),resuming:true}),{flag:'wx'})
const config=await json('data/maintenance/config.json'),env={...process.env,HORSERIDE_NO_LISTEN:'1',TRAINING_ARCHIVE_PATH:`${root}/archive.json`,WORKOUT_ARCHIVE_PATH:`${root}/workouts.json`,PEDIGREE_REGISTRY_PATH:`${root}/pedigree-registry.json`,HORSERIDE_MODEL_SEARCH:'0'}
try{await access(`${root}/prize-registry.json`);env.RACE_PRIZE_REGISTRY_PATH=`${root}/prize-registry.json`}catch{}
const save=()=>writeFile(`${root}/training-state.json`,JSON.stringify(state,null,2))
const run=(command,args)=>new Promise((ok,fail)=>{const child=spawn(command,args,{windowsHide:true,stdio:'inherit',env});child.on('error',fail);child.on('exit',code=>code===0?ok():fail(Error(`${args.join(' ')} exited ${code}`)))})
try{
 state.resumedAt=new Date().toISOString();state.resumeArtifacts=missing;state.phase='training';state.step='resuming_missing_artifacts';await save()
 if(missing.length)await run(config.python,['server/train-intelligence.py',root,missing.join(',')])
 const reports=[];for(const artifact of artifacts)reports.push(await json(`${root}/${artifact}/report.json`))
 await writeFile(`${root}/training-report.json`,JSON.stringify({countries:reports},null,2))
 state.phase='verifying';state.step='verifying_frozen_runtime_parity';await save();await run(process.execPath,['server/verify-intelligence.mjs',root])
 const selected=countries.filter(c=>['TR','US'].includes(c));if(selected.length)await run(process.execPath,['server/audit-training-evidence.mjs',root,selected.join(','),`${root}/input-coverage.json`])
 state.phase='complete';state.step='complete';state.finishedAt=new Date().toISOString();state.inputCoverage=`${root}/input-coverage.json`;await save()
 console.log(JSON.stringify({resumedArtifacts:missing,verified:true,activeModelChanged:false,root}))
}catch(error){state.phase='error';state.errors??=[];state.errors.push(error.message);await save();throw error}
finally{try{const owner=await json(lock);if(owner.pid===process.pid)await unlink(lock)}catch(error){if(error.code!=='ENOENT')console.error(error.message)}}
