import {acquireCollectionGate} from './collection-gate.mjs'
import './runtime-env.mjs'
import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {localDay,shiftDay} from './maintenance-policy.mjs'
import {isProcessRunning} from './process-liveness.mjs'
import {remoteDeployment} from './deployment-role.mjs'
process.chdir(fileURLToPath(new URL('../',import.meta.url)))
if(remoteDeployment())throw Error('Morning preparation belongs to the home server')
await acquireCollectionGate()
const day=localDay(),directory='data/maintenance',lock=directory+'/morning.lock',path=`${directory}/morning-${day}.json`
await mkdir(directory,{recursive:true})
const json=async p=>JSON.parse(await readFile(p,'utf8'))
try{const owner=await json(lock);if(isProcessRunning(owner.pid)){console.log('Morning preparation already running');process.exit(0)}await unlink(lock)}catch(e){if(e.code!=='ENOENT')throw e}
await writeFile(lock,JSON.stringify({pid:process.pid,day}),{flag:'wx'})
let report={day,startedAt:new Date().toISOString(),phase:'starting',stages:{},meetings:[],errors:[]}
try{const old=await json(path);report={...old,phase:'resuming',resumedAt:new Date().toISOString()}}catch{}
const save=async()=>{await writeFile(path+'.tmp',JSON.stringify(report,null,2));await rename(path+'.tmp',path)}
const run=(script,args=[],env={})=>new Promise((ok,fail)=>{const child=spawn(process.execPath,['--use-system-ca',script,...args],{windowsHide:true,stdio:'inherit',env:{...process.env,HORSERIDE_MORNING_OWNER:String(process.pid),...env}});child.on('error',fail);child.on('exit',code=>code===0?ok():fail(Error(`${script} exited ${code}`)))})
async function stage(name,action){if(report.stages[name]?.status==='complete')return;report.phase=name;await save();try{await action();report.stages[name]={status:'complete',finishedAt:new Date().toISOString()}}catch(e){report.stages[name]={status:'failed',error:e.message};report.errors.push(`${name}: ${e.message}`)}await save()}
const api=async(url,body)=>{const response=await fetch('http://127.0.0.1:8788'+url,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(180000)});const data=await response.json();if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);return data}
try{
 await save()
 await stage('public_access',()=>run('server/check-public-access.mjs'))
 // A live maintenance owner must finish before any collection or training writes.
 await stage('initial_program',()=>run('server/program-refresh.mjs',[day]))
 await stage('jockey_context',()=>run('server/refresh-jockey-context.mjs',[day]))
 await stage('program_maternal_lines',()=>run('server/collect-program-maternal-lines.mjs',[day]))
 await stage('current_pedigree',()=>run('server/collect-tjk-pedigree.mjs',[],{PEDIGREE_COUNTRIES:'TR,US',PEDIGREE_BATCH_SIZE:'200',PEDIGREE_CURRENT_ONLY:'1'}))
 await stage('current_workouts',()=>run('server/collect-current-missing-workouts.mjs'))
 await stage('us_workouts',()=>run('server/collect-equibase-workouts.mjs'))
 await stage('program',()=>run('server/program-refresh.mjs',[day]))
 await stage('coverage',async()=>{await run('server/audit-country-evidence.mjs');const audit=await json(directory+'/country-evidence-audit.json');report.coverage=Object.fromEntries(Object.entries(audit.countries).filter(([,r])=>r.date===day).map(([country,r])=>[country,{runners:r.runners,missing:Object.fromEntries(['damsire','history','workout','ownTimedRun','trackCondition'].map(k=>[k,r.runners-r.counts[k]]))}]));report.dataComplete=Object.values(report.coverage).every(r=>Object.values(r.missing).every(n=>n===0))})
 // Reuse existing forecasts; never delete old predictions to manufacture a better record.
 await stage('runner_gaps',()=>run('server/audit-current-runner-gaps.mjs',[day]))
 await stage('commentaries',async()=>{const program=await api(`/api/races?date=${day}&city=${encodeURIComponent('Tümü')}`);const cities=[...new Set(program.races.map(r=>r.city))];if(!cities.length)throw Error('No current meetings published');report.meetings=[];for(const city of cities){try{let data=await api('/api/analysis/daily',{date:day,city,async:true});const id=data.job?.id;const deadline=Date.now()+30*60_000;while(id&&data.job&&['queued','running','pending'].includes(data.job.status)&&Date.now()<deadline){await new Promise(r=>setTimeout(r,15000));data=await api('/api/analysis/jobs/'+id)}const result=await api(`/api/analysis/daily?date=${day}&city=${encodeURIComponent(city)}`);const count=result.analysis?.races?.length||0,expected=program.races.filter(r=>r.city===city).length;report.meetings.push({city,ready:count,expected,status:count===expected?'ready':'partial'});if(count!==expected)throw Error(`${count}/${expected} comments ready`)}catch(e){report.meetings.push({city,status:'failed',error:e.message})}await save()}if(report.meetings.some(m=>m.status!=='ready'))throw Error('Some meeting comments remain incomplete')})
 await stage('simulation',()=>run('server/run-simulation.mjs'))
 await stage('coupon_quality',()=>run('server/audit-coupon-quality.mjs'))
 await stage('probability_quality',()=>run('server/audit-probability-quality.mjs'))
 await stage('fluent_commentaries',()=>run('server/refresh-fluent-commentaries.mjs'))
 await stage('prestart_readiness',()=>run('server/audit-preparation-readiness.mjs',[day]))
 await stage('maintenance',async()=>{for(;;){let owner;try{owner=await json(directory+'/daily.lock')}catch(e){if(e.code!=='ENOENT')throw e}if(!owner||!isProcessRunning(owner.pid))break;await new Promise(r=>setTimeout(r,30000))}let state;try{state=await json(directory+'/state.json')}catch{}if(state?.day!==day||!state.finishedAt)await run('server/daily-maintenance.mjs');else report.maintenanceReused={finishedAt:state.finishedAt,phase:state.phase,errors:state.errors}})
 await stage('training_pedigree',()=>run('server/collect-tjk-pedigree.mjs',[],{PEDIGREE_COUNTRIES:'TR',PEDIGREE_BATCH_SIZE:'120',PEDIGREE_PRIORITY:'training_frequency',PEDIGREE_HISTORY_THROUGH:shiftDay(day,-30)}))
 await stage('historical_prizes',()=>run('server/collect-historical-prizes.mjs',[],{PRIZE_COUNTRIES:'TR,US',PRIZE_MEETINGS_PER_PERIOD:'20',PRIZE_PERIODS:'train',PRIZE_SPREAD_MONTHS:'1'}))
 // Publish explanations from the verified serving model before lengthy candidate fitting.
 await stage('training',async()=>{const root=`data/intelligence-models/${day}/morning`;let done;try{done=await json(root+'/training-state.json')}catch{}if(done?.phase!=='complete')await run('server/run-intelligence-training.mjs',[root],{RACE_PRIZE_REGISTRY_PATH:'data/external/race-prizes/records.json'});report.trainingReport=root+'/training-report.json'})
 await stage('jockey_candidate_comparison',()=>run('server/run-jockey-research.mjs',[`data/intelligence-models/${day}/morning`,`data/experiments/jockey-${day}-morning`]))
 await stage('training_input_coverage',()=>run('server/audit-training-evidence.mjs',[`data/intelligence-models/${day}/morning`]))
 report.phase=Object.values(report.stages).some(s=>s.status==='failed')?'partial':'complete';report.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify(report));if(report.phase==='partial')process.exitCode=1
}finally{await unlink(lock).catch(()=>{})}
