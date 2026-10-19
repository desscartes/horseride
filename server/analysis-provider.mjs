import {randomUUID} from 'node:crypto'
import {analysisLog} from './analysis-log.mjs'
import {billingCodes,assertAnalysisAccess,pauseAnalysisAccess} from './analysis-access.mjs'
import {analysisUsageLedger} from './analysis-usage.mjs'
import {localAnalysisEnabled,requestLocalAnalysis} from './local-analysis.mjs'
export async function requestAnalysis(body,apiKey,context,{fetchImpl=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),log=analysisLog,checkAccess=assertAnalysisAccess,pauseAccess=pauseAnalysisAccess,usageLedger}={}){
 checkAccess()
 if(localAnalysisEnabled())return requestLocalAnalysis(body,context,{fetchImpl,log,usageLedger})
 const clientRequestId=randomUUID(),started=Date.now()
 for(let attempt=1;attempt<=2;attempt++){
  const budget=usageLedger||analysisUsageLedger();let reservation
  const queueDeadline=Date.now()+120000
  while(!reservation){try{reservation=budget.reserve(body)}catch(error){if(error.code!=='analysis_capacity_busy'||Date.now()>queueDeadline)throw error;await sleep(2000)}}
  if(reservation.cached){log('provider_cache_hit',{...context,cached:true});return reservation.payload}
  log('provider_started',{...context,clientRequestId,attempt,inputBytes:Buffer.byteLength(body)})
  let response
  try{response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','X-Client-Request-Id':clientRequestId},signal:AbortSignal.timeout(90000),body})}
  catch(error){budget.finish(reservation,null,{uncertain:true});log('provider_error',{...context,clientRequestId,attempt,durationMs:Date.now()-started,code:error.cause?.code||error.name});throw Object.assign(Error('AI servisine bağlantı kurulamadı.'),{status:503,code:error.cause?.code||error.name})}
  const payload=await response.json().catch(()=>({})),requestId=response.headers.get('x-request-id')
  budget.finish(reservation,payload,{ok:response.ok})
  log('provider_finished',{...context,clientRequestId,requestId,attempt,status:response.status,durationMs:Date.now()-started,inputTokens:payload.usage?.input_tokens,cachedInputTokens:payload.usage?.input_tokens_details?.cached_tokens,reasoningTokens:payload.usage?.output_tokens_details?.reasoning_tokens,outputTokens:payload.usage?.output_tokens,code:payload.error?.code||payload.incomplete_details?.reason})
  if(response.ok)return payload
  if(billingCodes.has(payload.error?.code)){pauseAccess(payload.error.code);throw Object.assign(Error('AI yorum servisi geçici olarak kapalı. Kaydedilmiş yorumlar gösterilmeye devam eder.'),{status:503,code:payload.error.code})}
  const retryable=response.status===429||response.status>=500
  const retryHeader=response.headers.get('retry-after'),seconds=Number(retryHeader),retryMs=retryHeader?(Number.isFinite(seconds)?seconds*1000:Date.parse(retryHeader)-Date.now()):1500
  if(attempt===1&&retryable&&retryMs<=10000){await sleep(Math.max(500,retryMs||1500));continue}
  throw Object.assign(Error('AI yorum servisi şu anda yanıt veremiyor.'),{status:response.status===429?429:502,code:payload.error?.code||`http_${response.status}`})
 }
}
