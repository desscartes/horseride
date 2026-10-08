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
  const summary={recorded:latest.size,evaluated:0,hits:0,selectedRaces:0,selectedHits:0,pairedMarketRaces:0,pairedModelHits:0,marketHits:0,selectionThreshold,selectionIsCalibratedProbability:false}
  for(const row of latest.values()){
    const result=outcomes.get(`${row.date}:${row.city}:${row.raceNo}`),horses=row.race?.horses||[]
    if(!result||!horses.length||!horses.every(h=>result.has(h.name))||![...result.values()].includes(1))continue
    const winner=h=>result.get(h?.name??h?.horseName)===1
    summary.evaluated++;const hit=+winner(horses[0]);summary.hits+=hit
    if(Number(horses[0].probability)/100>=selectionThreshold){summary.selectedRaces++;summary.selectedHits+=hit}
    if(row.market?.picks?.length===horses.length){summary.pairedMarketRaces++;summary.pairedModelHits+=hit;summary.marketHits+=+winner(row.market.picks[0])}
  }
  const rate=(a,b)=>b?Number((100*a/b).toFixed(2)):null
  return {...summary,allRaceTopOne:rate(summary.hits,summary.evaluated),selectedTopOne:rate(summary.selectedHits,summary.selectedRaces),suggestionCoverage:rate(summary.selectedRaces,summary.evaluated),pairedModelTopOne:rate(summary.pairedModelHits,summary.pairedMarketRaces),prestartMarketTopOne:rate(summary.marketHits,summary.pairedMarketRaces)}
}
