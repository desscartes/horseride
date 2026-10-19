import {analysisFingerprint} from './data-quality.mjs'
import {analysisEntryFingerprint} from './analysis-entry-policy.mjs'
export function candidateSignature(races){
 return JSON.stringify(races.map(r=>({city:r.city,no:Number(r.no),method:r.rankingMethod||null,source:r.rankingSource||null,candidates:r.horses.slice(0,4).map(h=>h.name)})).sort((a,b)=>a.city.localeCompare(b.city)||a.no-b.no))
}
export function sameRankingModels(left,right){
 if(left===right)return true
 try{const a=JSON.parse(left),b=JSON.parse(right);return Array.isArray(a.models)&&Array.isArray(b.models)&&JSON.stringify(a.models)===JSON.stringify(b.models)}catch{return false}
}
export function reusableDailyAnalysis(record,{version,rankingSignature,program,rankedProgram=[]}){
 const analysis=record?.analysis
 if(analysis?.version!==version||!Array.isArray(analysis.races)||!sameRankingModels(analysis.rankingSignature,rankingSignature))return false
 if(analysis.programFingerprint!==analysisFingerprint(program)&&(!analysis.entryFingerprint||analysis.entryFingerprint!==analysisEntryFingerprint(program)))return false
 if(analysis.races.length!==program.length&&!analysis.partial)return false
 if(new Set(analysis.races.map(p=>`${p.city}:${p.raceNo}`)).size!==analysis.races.length)return false
 return analysis.races.every(p=>{
  const current=program.find(r=>r.city===p.city&&Number(r.no)===Number(p.raceNo))
  if(!current)return false
  // Retain the captured comment/ranking as one snapshot. Reordering background
  // scores alone is not a change to the horse, jockey, weight or race program.
  return Array.isArray(p.picks)&&p.picks.every(pick=>current.horses.some(h=>!h.outOfRace&&h.name===pick.horseName))
 })
}
export function retainUnchangedDailyAnalysis(record,args){
 if(reusableDailyAnalysis(record,args))return record
 const analysis=record?.analysis
 if(analysis?.version!==args.version||!sameRankingModels(analysis.rankingSignature,args.rankingSignature)||!analysis.entryFingerprints||!Array.isArray(analysis.races))return null
 const races=analysis.races.filter(prediction=>{
  const current=args.program.find(r=>r.city===prediction.city&&Number(r.no)===Number(prediction.raceNo))
  return current&&analysis.entryFingerprints[Number(current.no)]===analysisEntryFingerprint([current])&&prediction.picks?.every(p=>current.horses.some(h=>h.name===p.horseName&&!h.outOfRace))
 })
 if(!races.length)return null
 return {...record,analysis:{...analysis,races,partial:races.length!==args.program.length,entryFingerprint:analysisEntryFingerprint(args.program),programFingerprint:analysisFingerprint(args.program)}}
}
