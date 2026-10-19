// Input-download time is not prediction availability time. Observe the clock
// only after every ranking is computed, before attempting pre-start persistence.
export function recordCompletedNumericForecasts({date,races,save,fingerprint,baselineModel,now=()=>new Date()}){
 const capturedAt=new Date(now()).toISOString()
 return races.reduce((count,race)=>count+save({date,races:[race],source:'numeric',modelVersion:race.rankingMethod||baselineModel,inputHash:fingerprint([race]),capturedAt}),0)
}
