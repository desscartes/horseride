// Publication policy, not a statistical claim about predictive accuracy.
export function publicationEvidence(race,row){
 const horses=race.horses.filter(h=>!h.outOfRace),hard=[]
 if(!row?.verifiedModelAvailable||race.rankingSource!=='local_trained_model')hard.push('no_verified_country_model')
 if(!row?.coreReady)hard.push('core_program_incomplete')
 if(!row?.coverageKnown)hard.push('coverage_not_audited')
 if(horses.length<2||new Set(horses.map(h=>h.name)).size!==horses.length||new Set(horses.map(h=>Number(h.no))).size!==horses.length||horses.some(h=>!h.name||!Number.isInteger(Number(h.no))||Number(h.no)<1||typeof h.probability!=='number'||!Number.isFinite(h.probability)||h.probability<0||h.probability>100)||!horses.some(h=>h.probability>0))hard.push('invalid_runner_scores')
 const missing=row?.missing||[],counts={}
 for(const horse of missing)for(const field of horse.missing)counts[field]=(counts[field]||0)+1
 if(horses.length&&counts.history>=horses.length)hard.push('no_verified_runner_history')
 // No arbitrary win-confidence threshold. Optional gaps are disclosed, not imputed.
 return {eligible:!hard.length,hardReasons:hard,tier:missing.length?'limited_data':'evidence_complete',missing:counts,unknownHistoryNames:missing.filter(h=>h.missing.includes('history')).map(h=>h.name)}
}
export const missingLabels={damsire:'anne babası',history:'yarış geçmişi',individualTime:'bireysel derece',workout:'idman',jockeyPerformance:'jokey performansı',jockeySampleSize:'jokey örnek sayısı',trackCondition:'pist durumu'}
export function missingDisclosure(counts){return Object.entries(counts).map(([field,n])=>`${missingLabels[field]||field}: ${n} at`).join('; ')}
export function sourceAgeLimit(minutesToStart){return minutesToStart>120?360:minutesToStart>30?60:20}
