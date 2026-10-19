import {horseIdentity} from './data-quality.mjs'
export const officialWorkoutSpeedFeatureNames=['equibaseTimedCount','equibaseMissingTime','equibaseBestSpeedMps','equibaseMeanSpeedMps','equibaseLatestSpeedMps','equibaseLatestDistanceMeters','equibaseSameSurfaceMeanSpeedMps','equibaseBestGroupRankFraction','equibaseHasRank']
const mean=values=>values.length?values.reduce((s,v)=>s+v,0)/values.length:0
function rankFraction(value){const match=String(value||'').match(/^(\d+)\/(\d+)$/);if(!match)return null;const rank=Number(match[1]),group=Number(match[2]);return rank>=1&&rank<=group?(group===1?1:1-(rank-1)/(group-1)):null}
export function officialWorkoutSpeedFeatures(race,date){
 const target=Date.parse(`${date}T12:00:00Z`)
 if(!Number.isFinite(target))throw Error('Invalid workout target date')
 return race.horses.map(horse=>{
  const rows=(horse.workouts||[]).filter(w=>{
   const age=(target-Date.parse(`${w.dateISO}T12:00:00Z`))/86400000
   const speed=w.distanceMeters/w.timeSeconds
   return w.provider==='Equibase'&&w.registryId&&Number.isFinite(age)&&age>0&&age<=90&&Number.isFinite(w.distanceMeters)&&w.distanceMeters>0&&Number.isFinite(w.timeSeconds)&&w.timeSeconds>0&&speed>=5&&speed<=20
  }).sort((a,b)=>b.dateISO.localeCompare(a.dateISO)).slice(0,12)
  // Reject an ambiguous identity rather than combining two horses' times.
  if(new Set(rows.map(w=>w.registryId)).size>1)return [0,1,0,0,0,0,0,0,0]
  const speeds=rows.map(w=>w.distanceMeters/w.timeSeconds),sameSurface=rows.filter(w=>horseIdentity(w.surface)===horseIdentity(race.surface)).map(w=>w.distanceMeters/w.timeSeconds),ranks=rows.map(w=>rankFraction(w.groupRank)).filter(v=>v!=null)
  return [rows.length,+!rows.length,speeds.length?Math.max(...speeds):0,mean(speeds),speeds[0]||0,rows[0]?.distanceMeters||0,mean(sameSurface),ranks.length?Math.max(...ranks):0,+!!ranks.length]
 })
}
