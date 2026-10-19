import {prospectiveMetrics} from './prospective-metrics.mjs'
const key=r=>`${r.date}:${r.city}:${r.race_no}`
function record(row,pin){return {date:row.date,city:row.city,raceNo:row.race_no,capturedAt:row.captured_at,scheduledStart:row.scheduled_start,trainedThrough:pin.trainedThrough,modelVersion:row.model_version,race:{horses:row.picks.map(h=>({name:h.horseName,probability:h.probability}))}}}
export function pinnedStudyMetrics(pin,candidates,incumbents,outcomes){
 const future=candidates.filter(r=>r.source==='shadow_intelligence'&&r.model_version===pin.method&&Date.parse(r.captured_at)>=Date.parse(pin.registeredAt)&&r.captured_at<r.scheduled_start&&pin.trainedThrough<r.date)
 const latest=new Map();for(const row of future)if(!latest.has(key(row))||latest.get(key(row)).captured_at<row.captured_at)latest.set(key(row),row)
 const prior=new Map();for(const row of incumbents.filter(r=>r.source==='numeric'&&r.captured_at<r.scheduled_start&&r.captured_at>=pin.registeredAt)){if(!prior.has(key(row)))prior.set(key(row),[]);prior.get(key(row)).push(row)}
 const days=new Set(),paired={races:0,candidateHits:0,incumbentHits:0,missingIncumbent:0,fieldMismatch:0,captureTimeMismatch:0,maxCaptureSeparationSeconds:0}
 for(const row of latest.values()){
  const measured=prospectiveMetrics([record(row,pin)],outcomes,{frozenAt:pin.registeredAt});if(!measured.evaluated)continue;days.add(row.date)
  const controls=prior.get(key(row));if(!controls?.length){paired.missingIncumbent++;continue}
  const field=r=>r.picks.map(h=>h.horseName).sort().join('\n'),same=controls.filter(r=>field(r)===field(row))
  if(!same.length){paired.fieldMismatch++;continue}
  const old=same.sort((a,b)=>Math.abs(Date.parse(a.captured_at)-Date.parse(row.captured_at))-Math.abs(Date.parse(b.captured_at)-Date.parse(row.captured_at)))[0]
  const separation=Math.abs(Date.parse(old.captured_at)-Date.parse(row.captured_at))/1000
  if(separation>120){paired.captureTimeMismatch++;continue}
  const result=outcomes.get(key(row));paired.races++;paired.candidateHits+=Number(result.get(row.picks[0]?.horseName)===1);paired.incumbentHits+=Number(result.get(old.picks[0]?.horseName)===1);paired.maxCaptureSeparationSeconds=Math.max(paired.maxCaptureSeparationSeconds,separation)
 }
 const measured=prospectiveMetrics([...latest.values()].map(r=>record(r,pin)),outcomes,{frozenAt:pin.registeredAt})
 const rate=n=>paired.races?Number((100*n/paired.races).toFixed(2)):null
 return {artifact:pin.artifact,method:pin.method,registeredAt:pin.registeredAt,role:'shadow_only',...measured,settledDays:days.size,minimumSampleReached:days.size>=pin.minimumDays&&paired.races>=pin.minimumRaces,minimumDays:pin.minimumDays,minimumRaces:pin.minimumRaces,paired:{...paired,candidateTopOne:rate(paired.candidateHits),incumbentTopOne:rate(paired.incumbentHits)},automaticActivation:false}
}
