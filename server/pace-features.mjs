import {foreignHorseIdentity} from './foreign-data.mjs'

export const paceFeatureNames=['verifiedPaceStarts','earlyLeadRate','earlyPositionMean','lateGainMean','stretchGainMean','paceCompetition','trackPaceStarts','surfacePaceStarts','missingPaceEvidence']
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0
const ground=value=>/turf|çim|cim/i.test(value)?'turf':/all weather|synthetic|sentetik/i.test(value)?'synthetic':/dirt|kum/i.test(value)?'dirt':null
const earlyCall=calls=>Object.entries(calls||{}).find(([label])=>label!=='Start'&&label!=='Fin'&&label!=='Str')?.[1]
export function paceHistory(charts){
 const history=new Map()
 for(const chart of charts){
  const surface=ground(chart.conditions?.match(/Distance:[^\n]+? On The ([^\n]+?)(?: Current|$)/)?.[1])
  for(const runner of chart.runners){
   const early=earlyCall(runner.calls),finish=runner.calls?.Fin,fieldSize=chart.runners.length
   if(!early||!finish||fieldSize<2||early>fieldSize||finish>fieldSize)continue
   const key=foreignHorseIdentity(runner.name)
   if(!history.has(key))history.set(key,[])
   history.get(key).push({date:chart.date,track:chart.track.replace(/[^A-Z]/g,''),surface,early,finish,stretch:runner.calls.Str||null,fieldSize})
  }
 }
 return history
}
export function paceFeatures(race,date,history,trackName){
 if(!race.city.endsWith('ABD'))return race.horses.map(()=>Array(paceFeatureNames.length).fill(0).map((v,i)=>i===8?1:v))
 const summaries=race.horses.map(h=>{
  const rows=(history.get(foreignHorseIdentity(h.name))||[]).filter(r=>r.date<date).toSorted((a,b)=>b.date.localeCompare(a.date)).slice(0,8)
  return {rows,lead:mean(rows.map(r=>+(r.early===1)))}
 })
 const leadTotal=summaries.reduce((n,s)=>n+s.lead,0),surface=ground(race.surface)
 return summaries.map(({rows,lead})=>{
  const stretches=rows.filter(r=>r.stretch!=null)
  return [rows.length,lead,mean(rows.map(r=>(r.fieldSize-r.early)/(r.fieldSize-1))),mean(rows.map(r=>(r.early-r.finish)/(r.fieldSize-1))),mean(stretches.map(r=>(r.stretch-r.finish)/(r.fieldSize-1))),leadTotal-lead,rows.filter(r=>r.track===trackName).length,rows.filter(r=>surface&&r.surface===surface).length,+!rows.length]
 })
}
