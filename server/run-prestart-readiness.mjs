import {spawn} from 'node:child_process'
import {acquireCollectionGate} from './collection-gate.mjs'
import {localDay} from './maintenance-policy.mjs'
await acquireCollectionGate()
const day=process.argv[2]||localDay()
// Changes update serving inputs and predictions; they never refit/activate models.
const results=[]
for(const script of ['server/program-refresh.mjs','server/refresh-jockey-context.mjs','server/audit-current-runner-gaps.mjs','server/audit-preparation-readiness.mjs']){
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--use-system-ca',script,day],{windowsHide:true,stdio:'inherit',env:process.env});child.once('error',reject);child.once('exit',resolve)})
 results.push({script,code});if(code!==0)process.exitCode=1
}
console.log(JSON.stringify({day,kind:'prestart_input_refresh',results,trainingTriggered:false}))
