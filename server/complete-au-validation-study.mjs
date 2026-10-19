process.env.HORSERIDE_NO_LISTEN='1'
import './runtime-env.mjs'
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs'
import {spawn} from 'node:child_process'
const root='data/intelligence-models/2026-10-16/au-winner-target-v3'
if(existsSync(root+'/training-state.json'))throw Error('Immutable experiment already started')
mkdirSync(root,{recursive:true})
const statePath=root+'/preparation.json'
const state={startedAt:new Date().toISOString(),phase:'collecting_fixed_validation_dates',dates:['2026-08-27','2026-08-28','2026-09-03','2026-09-04'],completed:[],modelActivated:false}
const save=()=>writeFileSync(statePath,JSON.stringify(state,null,2))
save()
const {collectHistoricalDay}=await import('./index.mjs')
for(const date of state.dates){
 const result=await collectHistoricalDay(date,{foreignOnly:true,countries:['AU'],stageWinnerTargetsPath:'data/external/racing-australia/tjk-winner-targets.json'})
 state.completed.push({date,result});save();console.log(JSON.stringify({date,targets:result.reports.reduce((n,r)=>n+(r.stagedWinnerTargets||0),0),failures:result.failures}))
}
const run=args=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{env:process.env,stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Child failed: '+code)))})
await run(['--use-system-ca','server/collect-winner-target-prizes.mjs'])
const targets=JSON.parse(readFileSync('data/external/racing-australia/tjk-winner-targets.json','utf8'))
writeFileSync(root+'/winner-targets.json',JSON.stringify(targets));copyFileSync('data/external/racing-australia/registry.json',root+'/australian-registry.json')
Object.assign(process.env,{INTELLIGENCE_COUNTRIES:'AU',TRAINING_ARCHIVE_PATH:'data/intelligence-models/2026-10-16/australia-form-v1/archive.json',AU_WINNER_ARCHIVE_PATH:root+'/winner-targets.json',AU_FORM_REGISTRY_PATH:root+'/australian-registry.json',RACE_PRIZE_REGISTRY_PATH:'data/external/race-prizes/records.json'})
state.phase='training';save()
await run(['--use-system-ca','server/run-intelligence-training.mjs',root])
state.phase='finished_check_model_report';state.finishedAt=new Date().toISOString();save()
