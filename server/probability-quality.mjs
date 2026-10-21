import {racingCountry} from './foreign-data.mjs'
const mean=a=>a.length?a.reduce((n,v)=>n+v,0)/a.length:null
function score(p,y){return {brier:p.reduce((n,v,i)=>n+(v-y[i])**2,0),logLoss:-p.reduce((n,v,i)=>n+y[i]*Math.log(Math.max(1e-12,v)),0)}}
export function verifiedPrestartProbabilityRecord(row){return row.race?.rankingSource==='local_trained_model'&&typeof row.trainedThrough==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.trainedThrough)&&row.trainedThrough<row.date&&Number.isFinite(Date.parse(row.capturedAt))&&Number.isFinite(Date.parse(row.scheduledStart))&&Date.parse(row.capturedAt)<Date.parse(row.scheduledStart)}
export function probabilityQuality(records,outcomes){
 const latest=new Map(),excluded={},reject=k=>excluded[k]=(excluded[k]||0)+1
 for(const row of records){
  if(!verifiedPrestartProbabilityRecord(row)){reject('not_verified_prestart_model');continue}
  const key=JSON.stringify([row.date,row.city,row.raceNo]);if(!latest.has(key)||Date.parse(latest.get(key).capturedAt)<Date.parse(row.capturedAt))latest.set(key,row)
 }
 const bins=Array.from({length:10},(_,i)=>({from:i/10,to:(i+1)/10,runners:0,predictedSum:0,winCredit:0})),rows=[]
 for(const row of latest.values()){
  const horses=(row.race.horses||[]).filter(h=>!h.outOfRace),result=outcomes.get(`${row.date}:${row.city}:${row.raceNo}`),names=new Set(horses.map(h=>h.name))
  if(!result){reject('result_pending');continue}
  if(!horses.length||names.size!==horses.length||result.size!==horses.length||!horses.every(h=>result.has(h.name))){reject('field_or_identity_mismatch');continue}
  const winners=horses.filter(h=>result.get(h.name)===1).length;if(!winners){reject('winner_missing');continue}
  const raw=horses.map(h=>h.probability);if(raw.some(v=>!Number.isFinite(v)||v<0||v>100)||raw.reduce((n,v)=>n+v,0)<=0){reject('invalid_model_probabilities');continue}
  const total=raw.reduce((n,v)=>n+v,0),p=raw.map(v=>v/total),y=horses.map(h=>Number(result.get(h.name)===1)/winners),top=p.indexOf(Math.max(...p)),metrics=score(p,y)
  for(let i=0;i<p.length;i++){const b=bins[Math.min(9,Math.floor(p[i]*10))];b.runners++;b.predictedSum+=p[i];b.winCredit+=y[i]}
  const rawMarket=row.market?.picks||[],market=rawMarket.filter(h=>names.has(h.horseName)),marketNames=new Set(market.map(h=>h.horseName)),capturedNames=new Set((row.race.horses||[]).map(h=>h.name));let paired=null
  if(row.market?.source==='market_prestart'&&Number.isFinite(Date.parse(row.market.capturedAt))&&Date.parse(row.market.capturedAt)<=Date.parse(row.capturedAt)&&Date.parse(row.market.capturedAt)<Date.parse(row.scheduledStart)&&rawMarket.every(h=>capturedNames.has(h.horseName))&&market.length===horses.length&&marketNames.size===horses.length&&market.every(h=>Number.isFinite(h.marketShare)&&h.marketShare>=0)){
   const shares=horses.map(h=>market.find(m=>m.horseName===h.name).marketShare),sum=shares.reduce((n,v)=>n+v,0)
   if(sum>0){const q=shares.map(v=>v/sum);paired={...score(q,y),topOne:Number(y[q.indexOf(Math.max(...q))]>0)}}
  }
  rows.push({date:row.date,country:racingCountry(row.city)||row.country||'TR',modelVersion:row.modelVersion,fieldSize:horses.length,fieldSizeGroup:horses.length<=7?'2-7':horses.length<=11?'8-11':'12+',confidenceGroup:p[top]<.3?'below_30':p[top]<.5?'30_to_50':'50_plus',topOne:Number(y[top]>0),...metrics,market:paired})
 }
 const describe=list=>{const pairs=list.filter(r=>r.market);return {races:list.length,days:new Set(list.map(r=>r.date)).size,topOne:mean(list.map(r=>r.topOne)),brier:mean(list.map(r=>r.brier)),logLoss:mean(list.map(r=>r.logLoss)),pairedMarketRaces:pairs.length,pairedModelTopOne:mean(pairs.map(r=>r.topOne)),pairedMarketTopOne:mean(pairs.map(r=>r.market.topOne)),pairedModelBrier:mean(pairs.map(r=>r.brier)),pairedMarketBrier:mean(pairs.map(r=>r.market.brier)),pairedModelLogLoss:mean(pairs.map(r=>r.logLoss)),pairedMarketLogLoss:mean(pairs.map(r=>r.market.logLoss))}}
 return {recorded:latest.size,excluded,total:describe(rows),byFieldSize:Object.fromEntries(['2-7','8-11','12+'].map(k=>[k,describe(rows.filter(r=>r.fieldSizeGroup===k))])),byTopConfidence:Object.fromEntries(['below_30','30_to_50','50_plus'].map(k=>[k,describe(rows.filter(r=>r.confidenceGroup===k))])),byCountry:Object.fromEntries([...new Set(rows.map(r=>r.country))].map(k=>[k,describe(rows.filter(r=>r.country===k))])),byModel:Object.fromEntries([...new Set(rows.map(r=>r.modelVersion))].map(k=>[k,describe(rows.filter(r=>r.modelVersion===k))])),bins:bins.map(b=>({...b,meanPredicted:b.runners?b.predictedSum/b.runners:null,observedWinCredit:b.runners?b.winCredit/b.runners:null})),automaticModelChange:false,note:'Descriptive pre-start scoring only, not a fitted calibrator. Rounded probabilities are normalized within the captured field. Dead heats share one unit of win credit. Only the last eligible served prediction per race is used across model versions. Runner bins remain correlated within races; runner counts are not independent trials. Only paired identical fields are compared with pre-start market.'}
}
