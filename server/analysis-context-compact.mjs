// Only the explanation payload is compacted. Training/ranking and local history
// keep the full records. All runners and the fixed candidate order survive.
export function compactAnalysisContext(races){
 return races.map(r=>({...r,horses:r.horses.map(h=>{
  const detailed=!r.analysisCandidates||r.analysisCandidates.includes(h.name),performance=h.horsePerformance
  const recentRuns=(performance?.recentRuns||[]).slice(0,detailed?2:1).map(run=>({...run,competition:run.competition?{...run.competition,topRivals:run.competition.topRivals?.slice(0,3)}:null}))
  const workouts=(h.workouts||[]).slice(0,detailed?2:1)
  const {sourceData,sourceUrl,horseId,jockeyId,profile,rawSource,rankingScore,probability,independentScore,baselineProbability,marketShare,...fields}=h
  return {...fields,horsePerformance:performance?{...performance,pastRuns:undefined,recentRuns}:performance,workouts,workout:workouts.length?undefined:h.workout}
 })}))
}
