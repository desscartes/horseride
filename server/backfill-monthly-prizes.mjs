import {mkdirSync,readFileSync,writeFileSync,copyFileSync,existsSync} from 'node:fs'
import {spawn} from 'node:child_process'
const root='data/maintenance/prize-monthly-backfill-20261016',statePath=root+'/state.json'
mkdirSync(root,{recursive:true})
const state=existsSync(statePath)?JSON.parse(readFileSync(statePath,'utf8')):{startedAt:new Date().toISOString(),batches:[],maximumBatches:10,phase:'collecting'}
if(state.phase!=='collecting')throw Error('Completed batch series; inspect before starting a new series')
for(let i=state.batches.length;i<state.maximumBatches;i++){
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['server/collect-historical-prizes.mjs'],{env:{...process.env,PRIZE_COUNTRIES:'TR,US',PRIZE_PERIODS:'train',PRIZE_SPREAD_MONTHS:'1',PRIZE_MEETINGS_PER_PERIOD:'20'},windowsHide:true,stdio:['ignore','ignore','inherit']});child.on('error',reject);child.on('exit',resolve)})
 if(code!==0){state.phase='collector_error';state.exitCode=code;break}
 const path='data/external/race-prizes/historical-collection-report.json',report=JSON.parse(readFileSync(path,'utf8'))
 copyFileSync(path,root+`/batch-${String(i+1).padStart(2,'0')}.json`)
 state.batches.push({batch:i+1,meetings:report.completed.length,added:report.completed.reduce((n,r)=>n+r.added,0),registryAfter:report.registryAfter,failures:report.failures.length})
 state.updatedAt=new Date().toISOString();writeFileSync(statePath,JSON.stringify(state,null,2));console.log(JSON.stringify(state.batches.at(-1)))
 if(report.stoppedReason||!report.completed.length){state.phase=report.stoppedReason||'no_more_available_meetings';break}
}
if(state.phase==='collecting')state.phase='batch_series_complete'
state.finishedAt=new Date().toISOString();writeFileSync(statePath,JSON.stringify(state,null,2))
