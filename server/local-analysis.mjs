import {createUsageLedger} from './analysis-usage.mjs'
import {analysisLog} from './analysis-log.mjs'
import {detailedHorseChoices,evidenceSurprise,enrichCommentaryRace} from './commentary-evidence.mjs'
export const localAnalysisEnabled=()=>process.env.HORSERIDE_ANALYSIS_PROVIDER==='local'
export const explanationModel=()=>localAnalysisEnabled()?(process.env.HORSERIDE_LOCAL_MODEL||'qwen3:4b-instruct'):(process.env.OPENAI_MODEL||'gpt-6-luna')
let ledger,queue=Promise.resolve()
export const localAnalysisLedger=()=>ledger||=createUsageLedger(process.env.HORSERIDE_LOCAL_USAGE_FILE||'data/maintenance/local-analysis.sqlite',{tokenLimit:1e9,callLimit:1e9})
const select=(object,fields)=>Object.fromEntries(fields.filter(k=>object?.[k]!=null).map(k=>[k,object[k]]))
export function localAnalysisInput(date,city,races){
 const program=races.map(r=>({...select(r,['no','type','distance','surface','conditions','analysisCandidates','surpriseCandidates','environment','weatherForecast']),city:r.city,horses:r.horses.map(h=>{
  const detailed=(r.analysisCandidates||r.horses.slice(0,4).map(v=>v.name)).includes(h.name)||(r.surpriseCandidates||[]).includes(h.name)
  return {...select(h,['no','name','weight','start','jockey','handicapRating','sire','dam','lastSix','jockeyPerformance']),...(detailed?{performance:select(h.horsePerformance,['sameDistance','sameSurface','sameDistanceAndSurface','starts','wins']),recentRuns:[...(h.horsePerformance?.recentRuns||[])].filter(r=>r.date<date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3).map(v=>select(v,['date','city','distance','surface','className','finishPosition','timeSeconds','weight','jockey'])),workouts:(h.workouts||[]).slice(0,1).map(v=>select(v,['date','dateISO','distance','distanceMeters','time','timeSeconds','surface','hippodrome','type','groupRank','splits'])),coverage:h.evidenceCoverage}:{})}
 })}))
 return 'Verilen yarış verileriyle kısa, doğal Türkçe yorum yaz. JSON şemasındaki aday1, aday2, aday3, aday4 alanları analysisCandidates sırasına karşılık gelir; bu liste yoksa ilk dört program atı kullanılır. Her aday için form, uyum, risk alanlarında şemadaki izinli ve doğrulanmış cümlelerden uygun olanı seç. Şema dışında cümle veya yeni bilgi ekleme. Form geçmiş bitiriş ve sınıfı, uyum aynı pist ve mesafeyi, risk belirsizliği açıklar. Summary izinli kısa cümlelerden biri olsun. Confidence low, surprise null olsun. En çok bir doğrulanmış risk yaz.\n'+JSON.stringify({revision:'evidence-v2',date,city,races:program})
}
export function localGenerationPlan(schema,input){
 const race=schema.properties.races.items.anyOf?.[0]||schema.properties.races.items,names=race.properties.picks.items.properties.horseName.enum.slice(0,race.properties.picks.maxItems||4)
 const context=JSON.parse(input.slice(input.indexOf('\n')+1)),data=context.races[0]
 const allowedSurprises=race.properties.surprise?.anyOf?.[1]?.properties?.horseName?.enum||[]
 const evidenceRace={...data,horses:data.horses.map(h=>({...h,horsePerformance:{...h.performance,recentRuns:h.recentRuns}}))}
 const surprise=evidenceSurprise(evidenceRace,names,context.date,{allowedNames:allowedSurprises})
 const properties={summary:{type:'string',enum:['Adayların geçmiş yarışları, mesafe ve pist uyumu incelendi.','Veri sıralamasındaki adaylar kayıtlı performans bilgileriyle değerlendirildi.']},confidence:{type:'string',enum:['low']},risks:{type:'array',maxItems:1,items:{type:'string',enum:['Geçmiş performans bugünkü sonucu garanti etmez.']}},surprise:{type:'null'}}
 const choices=[]
 names.forEach((name,i)=>{
  const h=data.horses.find(h=>h.name===name),last=h?.recentRuns?.[0],stats=h?.performance?.sameDistanceAndSurface
  const form=Number(last?.finishPosition)>0?[`Son kayıtlı ${last.className?last.className+' ':''}koşusunu ${last.finishPosition}. sırada tamamladı.`,`Son geçmiş yarışındaki bitiriş sırası ${last.finishPosition} olarak kayıtlıdır.`]:['Geçmiş yarış sonuçları sınırlı olduğu için form değerlendirmesi belirsizdir.']
  const uyum=Number(stats?.starts)>0?[`${data.surface} pistte ve yakın mesafede ${stats.starts} geçmiş koşu kaydı bulunuyor.`,`Yakın mesafe ve aynı pist birleşiminde arşivde ${stats.starts} koşusu var.`]:['Bu mesafe ve pist birleşimi için doğrulanmış geçmiş özeti yok.']
  const risk=Number(stats?.starts)<3||!stats?['Aynı mesafe ve pistte örnek sayısı sınırlı; çıkarım belirsizlik taşır.']:[`Geçmiş sonuçlar bugünkü ${data.type||'yarış'} koşusunda aynı sonucun alınacağını garanti etmez.`,'Bugünkü rakipler ve yarış şartları geçmiş sonuçlardan farklı olabilir.']
  const detailed=detailedHorseChoices(evidenceRace,evidenceRace.horses.find(h=>h.name===name),context.date)
  const selected=(h?.recentRuns||[]).some(r=>r.date)?detailed:{form,uyum,risk}
  choices.push(selected);properties['aday'+(i+1)]={type:'object',properties:{form:{type:'string',enum:selected.form},uyum:{type:'string',enum:selected.uyum},risk:{type:'string',enum:selected.risk}},required:['form','uyum','risk'],additionalProperties:false}
 })
 return {schema:{type:'object',properties,required:Object.keys(properties),additionalProperties:false},normalize(output){
  if(!properties.summary.enum.includes(output.summary)||output.confidence!=='low'||output.surprise!==null||!Array.isArray(output.risks)||output.risks.some(v=>!properties.risks.items.enum.includes(v)))throw Error('Unverified local statement')
  return {summary:output.summary,races:[{city:race.properties.city.enum[0],raceNo:race.properties.raceNo.enum[0],confidence:output.confidence,risks:output.risks,surprise,picks:names.map((horseName,i)=>{const reasons=output['aday'+(i+1)],allowed=choices[i];if(!reasons||['form','uyum','risk'].some(key=>!allowed[key].includes(reasons[key])))throw Error('Unverified local evidence');return {horseName,reason:[reasons.form,reasons.uyum,reasons.risk].join(' ')}})}]}
 }}
}
export function localEvidenceAnalysis(races,{date}={}){
 const result={summary:'Yorum üretimi tamamlanamadığı için doğrulanmış yarış verilerinden açıklama gösteriliyor.',races:races.map(r=>({city:r.city,raceNo:r.no,commentaryMethod:'verified_data_summary',confidence:'low',surprise:null,risks:['Bu açıklama kayıtlı verilere dayanır; yeni dil modeli yorumu tamamlanamamıştır.'],picks:(r.analysisCandidates||r.horses.slice(0,4).map(h=>h.name)).map((name,index)=>{
  const h=r.horses.find(h=>h.name===name),stats=h.horsePerformance?.sameDistanceAndSurface,last=h.horsePerformance?.recentRuns?.[0]
  const first=`Veri sıralamasında ${index+1}. adaydır; sıralama kazanma garantisi değildir.`
  const second=Number(stats?.starts)>0?`Yakın mesafede ve aynı pist yüzeyinde ${stats.starts} geçmiş koşu kaydı bulunuyor.`:'Yakın mesafe ve aynı pist yüzeyi için yeterli geçmiş koşu kaydı bulunmuyor.'
  const third=Number(last?.finishPosition)>0?`Son kayıtlı yarışını ${last.finishPosition}. sırada tamamlamıştır; farklı yarış şartları ayrıca değerlendirilmelidir.`:'Geçmiş performans kanıtı sınırlı olduğundan bu aday dikkatle değerlendirilmelidir.'
  return {horseName:name,reason:[first,second,third].join(' ')}
 })}))}
 if(date)result.races=result.races.map((p,i)=>enrichCommentaryRace(races[i],p,date))
 return result
}
export function compactLocalGenerationPlan(schema,input){
 const original=localGenerationPlan(schema,input),compact=structuredClone(original.schema)
 const encode=(field)=>({type:'integer',enum:field.enum.map((_,i)=>i),description:field.enum.map((text,i)=>`${i}: ${text}`).join('\n')})
 compact.properties.summary=encode(original.schema.properties.summary)
 compact.properties.risks.items=encode(original.schema.properties.risks.items)
 for(const [key,field] of Object.entries(original.schema.properties))if(key.startsWith('aday'))for(const part of ['form','uyum','risk'])compact.properties[key].properties[part]=encode(field.properties[part])
 const decode=(field,value)=>{if(!Number.isInteger(value)||value<0||value>=field.enum.length)throw Error('Unverified local choice');return field.enum[value]}
 return {schema:compact,normalize(output){
  const decoded={...output,summary:decode(original.schema.properties.summary,output.summary),risks:Array.isArray(output.risks)?output.risks.map(v=>decode(original.schema.properties.risks.items,v)):output.risks}
  for(const [key,field] of Object.entries(original.schema.properties))if(key.startsWith('aday'))decoded[key]=Object.fromEntries(['form','uyum','risk'].map(part=>[part,decode(field.properties[part],output[key]?.[part])]))
  return original.normalize(decoded)
 }}
}
export async function requestLocalAnalysis(body,context,{fetchImpl=fetch,usageLedger=localAnalysisLedger(),log=analysisLog}={}){
 const run=async()=>{
  const reservation=usageLedger.reserve(JSON.stringify({version:'verified-local-v5-evidence',request:JSON.parse(body)}));if(reservation.cached){log('local_cache_hit',{...context,cached:true});return reservation.payload}
  const request=JSON.parse(body),started=Date.now();log('local_started',context)
  let measured
  try{
   const endpoint=new URL(process.env.HORSERIDE_LOCAL_URL||'http://127.0.0.1:11434');if(!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname))throw Error('Local provider must use loopback')
   const plan=compactLocalGenerationPlan(request.text.format.schema,request.input)
   const response=await fetchImpl(new URL('/api/chat',endpoint),{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(600000),body:JSON.stringify({model:request.model,messages:[{role:'system',content:'Verilen doğrulanmış cümle seçeneklerini değerlendir. Her alan için şemadaki seçenek numarasını JSON olarak döndür. Açıklama yazma.'},{role:'user',content:request.input}],format:plan.schema,stream:false,think:false,keep_alive:'30m',options:{temperature:0,num_ctx:8192,num_predict:512}})})
   const result=await response.json();measured={usage:{input_tokens:result.prompt_eval_count||0,output_tokens:result.eval_count||0}};if(!response.ok||result.error)throw Error('Local inference unavailable')
   if(!result.done||result.done_reason==='length')throw Error('Local response incomplete')
   const payload={status:'completed',output_text:JSON.stringify(plan.normalize(JSON.parse(result.message.content))),usage:{input_tokens:result.prompt_eval_count||0,output_tokens:result.eval_count||0}}
   usageLedger.finish(reservation,payload,{ok:true});log('local_finished',{...context,durationMs:Date.now()-started,inputTokens:payload.usage.input_tokens,outputTokens:payload.usage.output_tokens});return payload
  }catch(error){usageLedger.finish(reservation,measured);log('local_error',{...context,durationMs:Date.now()-started,code:error.cause?.code||error.code||error.name,inputTokens:measured?.usage.input_tokens,outputTokens:measured?.usage.output_tokens});throw Object.assign(Error('Yerel yorum hazırlanamadı; kayıtlı yorumlar korunuyor. Ücretli servise geçilmedi.'),{code:'local_analysis_unavailable',status:503,cause:error})}
 }
 const pending=queue.catch(()=>{}).then(run);queue=pending;return pending
}
