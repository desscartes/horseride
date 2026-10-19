import {parseWeight} from './data-quality.mjs'
const dayMs=86400000
const distance=v=>{const m=String(v??'').match(/\d+(?:[.,]\d+)?/);return m?Number(m[0].replace(',','.')):null}
export function recentLoadEvidence(runs,workouts,horse,race,date){
 const target=Date.parse(date+'T12:00:00Z')
 const before=(d,max=730)=>{const n=(target-Date.parse(d+'T12:00:00Z'))/dayMs;return Number.isFinite(n)&&n>0&&n<=max}
 const previous=[...new Map(runs.filter(r=>before(r.date)&&Number(r.finishPosition)>0).map(r=>[`${r.date}:${r.city}:${r.raceNo}`,r])).values()].sort((a,b)=>b.date.localeCompare(a.date))
 const works=workouts.filter(w=>before(w.dateISO,90)).sort((a,b)=>b.dateISO.localeCompare(a.dateISO))
 const last=previous[0],oldWeight=parseWeight(last?.weight),weight=parseWeight(horse.weight),oldDistance=distance(last?.distance),newDistance=distance(race.distance)
 return {historyObserved:previous.length>0,observedStartsLast14:previous.filter(r=>before(r.date,14)).length,observedStartsLast30:previous.filter(r=>before(r.date,30)).length,daysSinceLastObservedStart:last?(target-Date.parse(last.date+'T12:00:00Z'))/dayMs:null,observedWorkoutsLast14:works.filter(w=>before(w.dateISO,14)).length,daysSinceLastObservedWorkout:works.length?(target-Date.parse(works[0].dateISO+'T12:00:00Z'))/dayMs:null,distanceChangeMeters:last&&oldDistance&&newDistance?newDistance-oldDistance:null,carriedWeightChangeKg:last&&oldWeight!=null&&weight!=null?Number((weight-oldWeight).toFixed(2)):null,scope:'Observed prior records only; incomplete careers. Frequency alone does not prove fitness, fatigue or injury.'}
}
