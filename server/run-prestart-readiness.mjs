import {spawn} from 'node:child_process'
import {acquireCollectionGate} from './collection-gate.mjs'
import {localDay} from './maintenance-policy.mjs'
await acquireCollectionGate()
const day=process.argv[2]||localDay()
// Changes update serving inputs and predictions; they never refit/activate models.
const results=[]
for(const script of ['server/program-refresh.mjs','server/refresh-jockey-context.mjs','server/audit-current-runner-gaps.mjs','server/audit-preparation-readiness.mjs']){
 let timedOut=false
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--use-system-ca',script,day],{windowsHide:true,stdio:'inherit',env:{...process.env,HORSERIDE_PROGRAM_ONLY:'1'}});const timer=setTimeout(()=>{timedOut=true;child.kill()},script==='server/program-refresh.mjs'?25*60_000:10*60_000);child.once('error',error=>{clearTimeout(timer);reject(error)});child.once('exit',value=>{clearTimeout(timer);resolve(value)})})
 results.push({script,code,timedOut});if(code!==0||timedOut){process.exitCode=1;break}
}
console.log(JSON.stringify({day,kind:'prestart_input_refresh',results,trainingTriggered:false}))
