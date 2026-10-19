import './runtime-env.mjs'
import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {listHistoricalRaces} from './database.mjs'
import {localDay,shiftDay} from './maintenance-policy.mjs'
import {remoteDeployment} from './deployment-role.mjs'
import {isProcessRunning} from './process-liveness.mjs'
import {chooseBackfillBatch,applyBackfillProgress,backfillGaps} from './backfill-policy.mjs'
import {historicalDayComplete} from './history-completeness.mjs'
if(remoteDeployment())throw Error('Backfill belongs to the home server')
const directory='data/maintenance/backfill';await mkdir(directory,{recursive:true})
const lock=`${directory}/campaign.lock`
try{const owner=JSON.parse(await readFile(lock,'utf8'));if(isProcessRunning(owner.pid)){console.log('Backfill is already running');process.exit(0)}await unlink(lock)}catch(e){if(e.code!=='ENOENT')throw e}
try{await writeFile(lock,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}),{flag:'wx'})}catch(e){if(e.code==='EEXIST')process.exit(0);throw e}
const today=localDay(),target=shiftDay(today,-730),state={startedAt:new Date().toISOString(),targetFrom:target,batchDays:14,countries:{},errors:[]}
const persist=async()=>{const path=`${directory}/cursor.json`,temporary=`${path}.${process.pid}.tmp`;await writeFile(temporary,JSON.stringify(state,null,2));await rename(temporary,path)}
const run=(args,env={})=>new Promise((ok,fail)=>{const p=spawn(process.execPath,['--use-system-ca',...args],{windowsHide:true,stdio:'inherit',env:{...process.env,HORSERIDE_NO_LISTEN:'1',FOREIGN_COLLECTION_CONCURRENCY:'1',...env}});p.on('error',fail);p.on('exit',c=>c===0?ok():fail(Error(`${args[0]} exited ${c}`)))})
try{
 let previous={};try{previous=JSON.parse(await readFile(`${directory}/cursor.json`,'utf8'));await writeFile(`${directory}/cursor-before-${state.startedAt.replace(/[.:]/g,'-')}.json`,JSON.stringify(previous,null,2))}catch(e){if(e.code!=='ENOENT')throw e}
 const archive=listHistoricalRaces()
 for(const [country,foreign]of [['overseas',true],['TR',false]]){
  const first=archive.filter(r=>Boolean(r.foreign)===foreign).map(r=>r.date).sort()[0],pending=previous.countries?.[country]||{},batch=chooseBackfillBatch({first,target,previous:pending})
  state.current={country,batch};state.countries[country]={...pending,gapBacklog:backfillGaps(pending)};await persist()
  if(batch){
   try{await run([foreign?'server/collect-foreign-history.mjs':'server/collect-history.mjs',String(batch.batchDays),batch.through])}catch(e){state.errors.push(`${country}: ${e.message}`)}
   try{const progress=JSON.parse(await readFile(`data/${foreign?'foreign-':''}history-progress-${batch.batchDays}-${batch.through}.json`,'utf8'));state.countries[country]=applyBackfillProgress(batch,progress,pending)}catch(e){state.errors.push(`${country} progress: ${e.message}`);state.countries[country]={...pending,...batch,status:'partial',attemptedDays:0,nextThrough:batch.through,gapBacklog:backfillGaps(pending)}}
   await persist()
  }else state.countries[country]={...state.countries[country],status:first?'target_reached_with_gaps':'no_archive'}
  const retry=backfillGaps(pending).filter(day=>day>=target&&day<today&&(!batch||day<batch.from||day>batch.through)).slice(0,2)
  if(retry.length){process.env.HORSERIDE_NO_LISTEN='1';const {collectHistoricalDay}=await import('./index.mjs');state.countries[country].gapRetries=[]
   for(const date of retry){try{const report=await collectHistoricalDay(date,{foreignOnly:foreign});state.countries[country].gapRetries.push({...report,complete:historicalDayComplete(report)});if(historicalDayComplete(report))state.countries[country].gapBacklog=state.countries[country].gapBacklog.filter(d=>d!==date)}catch(e){state.errors.push(`${country} gap ${date}: ${e.message}`)}await persist()}
  }
  state.countries[country].failedDates=[...state.countries[country].gapBacklog]
  if(state.countries[country].gapBacklog.length)state.countries[country].status=batch?'partial':'target_reached_with_gaps'
  else if(!batch&&first)state.countries[country].status='target_reached'
  await persist()
  if(batch&&!foreign)try{await run(['server/collect-training-workouts.mjs'],{WORKOUT_FROM_DATE:batch.from,WORKOUT_THROUGH_DATE:batch.through})}catch(e){state.errors.push(`TR workouts: ${e.message}`)}
 }
 state.finishedAt=new Date().toISOString();await persist();await writeFile(`${directory}/${today}.json`,JSON.stringify(state,null,2));console.log(JSON.stringify(state))
}finally{try{if(JSON.parse(await readFile(lock,'utf8')).pid===process.pid)await unlink(lock)}catch{}}
