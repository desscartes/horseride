// Results supplied separately after settlement. No historical reconstructed picks.
export function prospectiveMetrics(records,outcomes,{frozenAt,selectionThreshold=.3}={}){
  const freeze=Date.parse(frozenAt);if(!Number.isFinite(freeze))throw Error('A candidate freeze timestamp is required')
  const latest=new Map()
  for(const row of records){
    const capture=Date.parse(row.capturedAt),start=Date.parse(row.scheduledStart)
    if(!Number.isFinite(capture)||!Number.isFinite(start)||capture<freeze||capture>=start||!row.trainedThrough||row.trainedThrough>=row.date)continue
    const key=`${row.date}:${row.city}:${row.raceNo}:${row.modelVersion}`
    if(!latest.has(key)||latest.get(key).capturedAt<row.capturedAt)latest.set(key,row)
  }
  const summary={recorded:latest.size,evaluated:0,hits:0,topThreeHits:0,selectedRaces:0,selectedHits:0,pairedMarketRaces:0,pairedModelHits:0,marketHits:0,marketUnavailable:0,notEvaluated:{outcomeMissing:0,runnerResultMissing:0,winnerMissing:0,emptyField:0},selectionThreshold,selectionIsCalibratedProbability:false}
  for(const row of latest.values()){
    const result=outcomes.get(`${row.date}:${row.city}:${row.raceNo}`),horses=(row.race?.horses||[]).filter(h=>!h.outOfRace)
    if(!horses.length){summary.notEvaluated.emptyField++;continue}
    if(!result){summary.notEvaluated.outcomeMissing++;continue}
    if(!horses.every(h=>result.has(h.name))){summary.notEvaluated.runnerResultMissing++;continue}
    if(!horses.some(h=>result.get(h.name)===1)){summary.notEvaluated.winnerMissing++;continue}
    const winner=h=>result.get(h?.name??h?.horseName)===1
    summary.evaluated++;const hit=+winner(horses[0]);summary.hits+=hit;summary.topThreeHits+=Number(horses.slice(0,3).some(winner))
    if(Number(horses[0].probability)/100>=selectionThreshold){summary.selectedRaces++;summary.selectedHits+=hit}
    const names=new Set(horses.map(h=>h.name)),capturedNames=new Set((row.race?.horses||[]).map(h=>h.name)),rawMarket=row.market?.picks||[],market=rawMarket.filter(h=>names.has(h.horseName))
    if(rawMarket.every(h=>capturedNames.has(h.horseName))&&market.length===horses.length&&new Set(market.map(h=>h.horseName)).size===horses.length){summary.pairedMarketRaces++;summary.pairedModelHits+=hit;summary.marketHits+=+winner(market[0])}else summary.marketUnavailable++
  }
  const rate=(a,b)=>b?Number((100*a/b).toFixed(2)):null
  return {...summary,allRaceTopOne:rate(summary.hits,summary.evaluated),winnerInTopThree:rate(summary.topThreeHits,summary.evaluated),selectedTopOne:rate(summary.selectedHits,summary.selectedRaces),suggestionCoverage:rate(summary.selectedRaces,summary.evaluated),pairedModelTopOne:rate(summary.pairedModelHits,summary.pairedMarketRaces),prestartMarketTopOne:rate(summary.marketHits,summary.pairedMarketRaces)}
}
