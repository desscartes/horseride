import {analysisFingerprint} from './data-quality.mjs'
import {analysisEntryFingerprint} from './analysis-entry-policy.mjs'
export function reusableDailyAnalysis(record,{version,rankingSignature,program,rankedProgram=[]}){
 const analysis=record?.analysis
 if(analysis?.version!==version||!Array.isArray(analysis.races)||analysis.rankingSignature!==rankingSignature)return false
 if(analysis.programFingerprint===analysisFingerprint(program))return true
 if(!analysis.entryFingerprint||analysis.entryFingerprint!==analysisEntryFingerprint(program))return false
 if(analysis.races.length!==program.length)return false
 return analysis.races.every(p=>{
  const current=program.find(r=>r.city===p.city&&Number(r.no)===Number(p.raceNo))
  if(!current)return false
  const ranked=rankedProgram.find(r=>r.city===p.city&&Number(r.no)===Number(p.raceNo))
  return ranked?.rankingSource!=='local_trained_model'||p.picks.every((pick,i)=>pick.horseName===ranked.horses[i]?.name)
 })
}
