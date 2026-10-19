import {fork} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {analysisLog,analysisErrorCode} from './analysis-log.mjs'
export function runAnalysisWorker(date,city,onProgress,priorityRaceNo,{worker=new URL('./analysis-worker.mjs',import.meta.url),timeoutMs=10*60000,cacheOnly=false}={}){
 return new Promise((resolve,reject)=>{
  const child=fork(fileURLToPath(worker),[date,city,String(priorityRaceNo||''),cacheOnly?'cache-only':'generate'],{cwd:fileURLToPath(new URL('../',import.meta.url)),execArgv:['--use-system-ca'],env:{...process.env,HORSERIDE_NO_LISTEN:'1',HORSERIDE_ANALYSIS_WORKER:'1'},windowsHide:true,stdio:['ignore','ignore','pipe','ipc']})
  let done=false
  const started=Date.now();analysisLog('worker_started',{date,city,cached:cacheOnly})
  const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);analysisLog(error?'worker_error':'worker_ready',{date,city,durationMs:Date.now()-started,code:error?analysisErrorCode(error):undefined});if(error){child.kill();reject(error)}else resolve(result)}
  const timer=setTimeout(()=>finish(Error('Analiz hazırlığı zaman aşımına uğradı.')),timeoutMs)
  child.stderr.on('data',bytes=>console.error('Analysis worker:',bytes.toString().trim().slice(0,400)))
  child.on('message',message=>{if(message.progress)onProgress(message.progress);else if(message.result)finish(null,message.result);else if(message.error)finish(Object.assign(Error(message.error),{code:message.code,status:message.status}))})
  child.on('error',error=>finish(error))
  child.on('exit',code=>{if(!done)finish(Error(`Analysis worker exited ${code}`))})
 })
}
