export const loadFeatureNames=['observedFinishedDistanceLast30','observedFinishedStartsLast7','relativeObservedDistanceLast30','workoutGapToRaceGapRatio','missingObservedLoad','missingWorkoutGapRatio']
const distance=v=>{const n=Number(String(v??'').match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',','.'));return n>0?n:null}
export function loadResearchFeatures(race,date){
 const t=Date.parse(date+'T12:00:00Z'),days=d=>(t-Date.parse(d+'T12:00:00Z'))/86400000
 const rows=race.horses.map(h=>{
  const runs=[...new Map((h.horsePerformance?.recentRuns||[]).filter(r=>days(r.date)>0&&days(r.date)<=730&&r.finishPosition>0).map(r=>[`${r.date}:${r.city}:${r.raceNo}`,r])).values()].sort((a,b)=>b.date.localeCompare(a.date))
  const recent=runs.filter(r=>days(r.date)<=30&&distance(r.distance)),meters=recent.reduce((n,r)=>n+distance(r.distance),0),works=(h.workouts||[]).filter(w=>days(w.dateISO)>0&&days(w.dateISO)<=90).sort((a,b)=>b.dateISO.localeCompare(a.dateISO)),ratio=runs.length&&works.length?days(works[0].dateISO)/days(runs[0].date):null
  return {meters,starts7:runs.filter(r=>days(r.date)<=7).length,known:runs.length>0,ratio}
 })
 const known=rows.filter(r=>r.known).map(r=>r.meters).sort((a,b)=>a-b),median=known.length?(known[Math.floor((known.length-1)/2)]+known[Math.ceil((known.length-1)/2)])/2:0
 return rows.map(r=>[r.meters,r.starts7,r.known?r.meters-median:0,r.ratio??-1,Number(!r.known),Number(r.ratio==null)])
}
