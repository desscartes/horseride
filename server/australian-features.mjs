export const australianFeatureNames=['auProfileMissing','auPriorStarts','auPriorWinRate','auRecentFinish','auSameSurfaceStarts','auNearDistanceStarts','auDaysSinceStart','auTrials30','auTrialDays','auCareerDebutKnown']
export function australianFeatures(race,date){
 const elapsed=d=>(Date.parse(date+'T12:00:00Z')-Date.parse(d+'T12:00:00Z'))/86400000
 const distance=Number(String(race.distance).match(/\d+/)?.[0])||0
 return race.horses.map(h=>{
  const p=h.australianEvidence,runs=(p?.pastRuns||[]).filter(r=>r.date<date).sort((a,b)=>b.date.localeCompare(a.date)),trials=(p?.trials||[]).filter(r=>r.date<date).sort((a,b)=>b.date.localeCompare(a.date)),recent=runs.slice(0,6)
  return [+!p,runs.length,runs.length?runs.filter(r=>r.finishPosition===1).length/runs.length:0,recent.length?recent.reduce((n,r)=>n+(r.fieldSize-r.finishPosition)/Math.max(1,r.fieldSize-1),0)/recent.length:0,runs.filter(r=>r.surface===race.surface).length,runs.filter(r=>r.surface===race.surface&&Math.abs(r.distance-distance)<=200).length,runs.length?elapsed(runs[0].date):999,trials.filter(r=>elapsed(r.date)<=30).length,trials.length?elapsed(trials[0].date):999,+(p?.career?.starts===0)]
 })
}