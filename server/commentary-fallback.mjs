import {jockeyComment} from './jockey-evidence.mjs'
import {preparationHorseReason,baselineSelectionReason} from './commentary-evidence.mjs'
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {localEvidenceAnalysis} from './local-analysis.mjs'
import {raceStartISO} from './preparation-readiness.mjs'
export const commentaryFingerprint=(program,date,city)=>createHash('sha256').update(JSON.stringify({date,city,races:(program?.races||[]).filter(r=>r.city===city)})).digest('hex')
export function emergencyCommentary(program,date,city,{now=new Date()}={}){
 if(program?.date!==date||!Array.isArray(program.races))return null
 const races=program.races.filter(r=>r.city===city&&Date.parse(raceStartISO(r,date))>+now).map(r=>{const horses=r.horses.filter(h=>!h.outOfRace),allowed=new Set(horses.map(h=>h.name));return {...r,horses,analysisCandidates:(r.analysisCandidates||horses.slice(0,4).map(h=>h.name)).filter(n=>allowed.has(n))}}).filter(r=>r.horses.length)
 if(!races.length)return null
 const analysis=localEvidenceAnalysis(races,{date});analysis.partial=false;analysis.summary='Açıklamalar mevcut yarış verilerinden otomatik hazırlandı. Dil modeli tamamlanmadığında bu veri özeti gösterilir.'
 return {date,city,sourceFingerprint:commentaryFingerprint(program,date,city),createdAt:now.toISOString(),cached:true,available:true,source:'automatic_verified_data_summary',analysisIsHistoricalForecast:false,programFetchedAt:program.fetchedAt,analysis}
}
export function supplementCommentary(current,fallback,program,date,city){
 if(current?.date===date&&current?.city===city&&current.analysis?.races){
 const races=current.analysis.races.map(pred=>{const race=program?.races?.find(r=>r.city===city&&Number(r.no)===Number(pred.raceNo));if(!race||Date.parse(raceStartISO(race,date))<=Date.now())return pred;let changed=false;const picks=(pred.picks||[]).map(p=>{const h=race.horses.find(h=>h.name===p.horseName&&!h.outOfRace);if(!h||!p.reason?.includes('Doğrulanmış yarış geçmişi sınırlı olduğu için'))return p;changed=true;return {...p,reason:preparationHorseReason(race,h,date)}});return changed?{...pred,picks}:pred});if(races.some((r,i)=>r!==current.analysis.races[i]))current={...current,analysis:{...current.analysis,races}}
 }

 if(current?.date===date&&current?.city===city&&current.analysis?.races&&(program?.races||[]).some(r=>r.city===city&&Date.parse(raceStartISO(r,date))>Date.now()&&r.horses.some(h=>h.jockeyPerformance?.source==='dated_verified_archive_results'))){
  current={...current,analysis:{...current.analysis,races:current.analysis.races.map(pred=>{
   const race=program.races.find(r=>r.city===city&&Number(r.no)===Number(pred.raceNo));if(!race||Date.parse(raceStartISO(race,date))<=Date.now())return pred
   return {...pred,picks:(pred.picks||[]).map(p=>{const h=race.horses.find(h=>h.name===p.horseName&&!h.outOfRace),other=(pred.picks||[]).map(x=>race.horses.find(h=>h.name===x.horseName&&!h.outOfRace)).find(h=>h&&h.name!==p.horseName),text=h?.jockeyPerformance?.source==='dated_verified_archive_results'?jockeyComment(h,date,other):'';return text&&!p.reason?.includes(text)?{...p,reason:[p.reason,text].filter(Boolean).join(' '),jockeyExplanationRevision:'dated-jockey-v1'}:p})}
  })}}
 }

 if(current?.date===date&&current?.city===city&&current.analysis?.races&&(program?.races||[]).some(r=>r.city===city&&r.rankingSource==='program_baseline'&&Date.parse(raceStartISO(r,date))>Date.now())){
  current={...current,analysis:{...current.analysis,races:current.analysis.races.map(pred=>{
   const race=program?.races?.find(r=>r.city===city&&Number(r.no)===Number(pred.raceNo))
   if(!race||race.rankingSource!=='program_baseline'||Date.parse(raceStartISO(race,date))<=Date.now())return pred
   return {...pred,explanationRevision:'program-comparison-v1',picks:(pred.picks||[]).map(p=>{const horse=race.horses.find(h=>h.name===p.horseName&&!h.outOfRace),rival=(pred.picks||[]).map(x=>race.horses.find(h=>h.name===x.horseName&&!h.outOfRace)).find(h=>h&&h.name!==p.horseName);const baseline=horse&&baselineSelectionReason(race,horse,rival);const reason=baseline&&[baseline,jockeyComment(horse,date,rival)].filter(Boolean).join(' ');return reason?{...p,reason}:p})}
  })}}
 }
 if(!fallback)return current
 if(current?.date!==date||current?.city!==city)current=null
 const valid=new Map((program?.races||[]).filter(r=>r.city===city).map(r=>[Number(r.no),new Set(r.horses.filter(h=>!h.outOfRace).map(h=>h.name))]))
 const preserved=(current?.analysis?.races||[]).filter(r=>{const field=valid.get(Number(r.raceNo));return r.city===city&&field&&(r.picks||[]).every(p=>field.has(p.horseName))})
 const ids=new Set(preserved.map(r=>Number(r.raceNo))),extra=fallback.analysis.races.filter(r=>!ids.has(Number(r.raceNo)))
 if(!extra.length&&current?.analysis)return current
 return {...fallback,analysis:{...fallback.analysis,...(current?.analysis||{}),partial:false,races:[...preserved,...extra].sort((a,b)=>Number(a.raceNo)-Number(b.raceNo)),automaticDataSummaryRaces:extra.map(r=>r.raceNo)}}
}

export async function preparedOrEmergencyCommentary(program,date,city,{now=new Date()}={}){
 const future=(program?.races||[]).filter(r=>r.city===city&&Date.parse(raceStartISO(r,date))>+now),ids=new Set(future.map(r=>Number(r.no)))
 if(program?.date!==date||!ids.size)return null
 try{const id=createHash('sha256').update(city).digest('hex'),path=fileURLToPath(new URL(`../data/maintenance/commentary-ready/${date}/${id}.json`,import.meta.url)),cached=JSON.parse(await readFile(path,'utf8'))
  if(cached.date===date&&cached.city===city&&cached.sourceFingerprint===commentaryFingerprint(program,date,city)){
   const races=cached.analysis.races.filter(r=>ids.has(Number(r.raceNo)))
   if(races.length===ids.size)return {...cached,analysis:{...cached.analysis,races}}
  }
 }catch{}
 return emergencyCommentary(program,date,city,{now})
}
