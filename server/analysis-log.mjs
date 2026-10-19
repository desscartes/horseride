import {appendFileSync,mkdirSync,readdirSync,unlinkSync} from 'node:fs'
import {resolve} from 'node:path'
const fields=new Set(['jobId','date','city','phase','completed','total','elapsedMs','durationMs','status','requestId','clientRequestId','inputBytes','inputTokens','outputTokens','cachedInputTokens','reasoningTokens','cached','code','raceNos','attempt'])
let cleanedDay=''
export function analysisLog(event,details={}){
 try{
  const day=new Date().toISOString().slice(0,10),directory=resolve(process.env.HORSERIDE_ANALYSIS_LOG_DIR||'data/maintenance/analysis-logs')
  mkdirSync(directory,{recursive:true})
  if(cleanedDay!==day){for(const name of readdirSync(directory))if(/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name)&&Date.parse(day)-Date.parse(name.slice(0,10))>30*86400000)unlinkSync(resolve(directory,name));cleanedDay=day}
  const safe=Object.fromEntries(Object.entries(details).filter(([k])=>fields.has(k)))
  appendFileSync(resolve(directory,`${day}.jsonl`),JSON.stringify({at:new Date().toISOString(),pid:process.pid,event,...safe})+'\n','utf8')
 }catch(error){console.error('Analysis log unavailable:',error.code||error.name)}
}
export function analysisErrorCode(error){
 const message=String(error?.message||'')
 if(/aday sırası/i.test(message))return 'ranking_changed'
 if(/timeout|zaman aşımı/i.test(message))return 'timeout'
 if(/worker exited/i.test(message))return 'worker_exit'
 if(/program.*değiş/i.test(message))return 'program_changed'
 if(/surprise|sürpriz/i.test(message))return 'surprise_validation'
 if(/JSON|eşleme|gerekçe|aday/i.test(message))return 'output_validation'
 return error?.code||error?.cause?.code||error?.status||error?.name||'unknown'
}
