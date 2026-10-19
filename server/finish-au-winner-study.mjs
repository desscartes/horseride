import './runtime-env.mjs'
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
const root='data/intelligence-models/2026-10-16/au-winner-target-v2',base='data/intelligence-models/2026-10-16/australia-form-v1',source='data/external/racing-australia/tjk-winner-targets.json',statePath='data/maintenance/au-winner-training-followthrough.json'
const read=async p=>JSON.parse(await readFile(p,'utf8'))
const original=await read(base+'/AU/AU-training.json'),key=r=>JSON.stringify([r.date,r.city,Number(r.no)]),existing=new Set(original.races.map(key)),deadline=Date.now()+3*3600000
let state={startedAt:new Date().toISOString(),phase:'waiting_for_validated_targets',minimumRaces:600,baseCompleteRaces:existing.size,modelActivated:false},last=-1
const save=()=>writeFile(statePath,JSON.stringify(state,null,2))
for(;;){
 let staged={races:[]};try{staged=await read(source)}catch{}
 const eligible=staged.races.filter(r=>r.date<='2026-10-15'&&r.winnerOnly&&r.winnerEvidence?.historyEligible===false),keys=new Set([...existing,...eligible.map(key)])
 state.winnerTargets=eligible.length;state.distinctTrainingTargets=keys.size;state.checkedAt=new Date().toISOString();await save()
 if(keys.size!==last){console.log(JSON.stringify({phase:state.phase,distinctTrainingTargets:keys.size,winnerTargets:eligible.length}));last=keys.size}
 if(keys.size>=600){
  await mkdir(root,{recursive:true});try{await readFile(root+'/training-state.json');throw Error('AU training already exists; refusing duplicate')}catch(e){if(e.code!=='ENOENT')throw e}
  const prizeExit=await new Promise((ok,fail)=>{const p=spawn(process.execPath,['--use-system-ca','server/collect-winner-target-prizes.mjs'],{env:process.env,stdio:'inherit',windowsHide:true});p.on('error',fail);p.on('exit',ok)});if(prizeExit!==0)throw Error('Winner target prize collection failed')
  await writeFile(root+'/winner-targets.json',JSON.stringify({races:eligible}));await copyFile('data/external/racing-australia/registry.json',root+'/australian-registry.json')
  state.phase='training';state.trainingRoot=root;await save()
  const env={...process.env,HORSERIDE_NO_LISTEN:'1',INTELLIGENCE_COUNTRIES:'AU',TRAINING_ARCHIVE_PATH:base+'/archive.json',AU_WINNER_ARCHIVE_PATH:root+'/winner-targets.json',AU_FORM_REGISTRY_PATH:root+'/australian-registry.json',RACE_PRIZE_REGISTRY_PATH:'data/external/race-prizes/records.json'}
  const code=await new Promise((ok,fail)=>{const p=spawn(process.execPath,['--use-system-ca','server/run-intelligence-training.mjs',root],{env,stdio:'inherit',windowsHide:true});p.on('error',fail);p.on('exit',ok)})
  state.phase=code===0?'finished_check_training_report':'error';state.exitCode=code;state.finishedAt=new Date().toISOString();await save();break
 }
 const collection=await read('data/maintenance/au-history-expansion.json')
 if(collection.phase!=='collecting'){state.phase='insufficient_targets_after_collection';state.finishedAt=new Date().toISOString();await save();break}
 if(Date.now()>deadline){state.phase='waiting_limit_reached';await save();break}
 await new Promise(resolve=>setTimeout(resolve,15000))
}