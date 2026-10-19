import {foreignHorseIdentity} from './foreign-data.mjs'
import {readFileSync} from 'node:fs'
export function readOfficialCharts(through){
 const sources=['data/external/equibase/parsed.json','data/external/equibase-career/parsed.json'].map(path=>{try{return JSON.parse(readFileSync(path,'utf8'))}catch{return {races:[]}}})
 return mergeOfficialCharts(sources,through)
}
const field=chart=>chart.runners.map(r=>foreignHorseIdentity(r.name)).sort().join('|')
const identity=chart=>`${chart.date}:${chart.track.replace(/[^A-Z]/g,'')}:${chart.raceNo}`
export function mergeOfficialCharts(sources,through){
 const rows=new Map(),conflicts=new Set(),rejected=[]
 for(const source of sources)for(const chart of source.races||[]){
  let url;try{url=new URL(chart.sourceUrl)}catch{}
  const validDate=/^\d{4}-\d{2}-\d{2}$/.test(chart.date||'')&&Number.isFinite(Date.parse(chart.date))&&new Date(chart.date).toISOString().slice(0,10)===chart.date
  const names=chart.runners?.map(r=>foreignHorseIdentity(r.name))||[]
  if(!url||url.protocol!=='https:'||!['tvg.equibase.com','www.equibase.com'].includes(url.hostname)||!validDate||chart.date>through||!chart.track||!Number.isInteger(chart.raceNo)||names.length<2||names.some(n=>!n)||new Set(names).size!==names.length||! /\bThoroughbred\b/i.test(chart.conditions||'')){
   rejected.push({sourceUrl:chart.sourceUrl,date:chart.date,reason:'Unverified source/date/field/breed'});continue
  }
  const key=identity(chart),previous=rows.get(key)
  if(previous&&field(previous)!==field(chart)){conflicts.add(key);continue}
  // Prefer the verified positional parser over older raw superscript text.
  const quality=r=>r.runners.filter(h=>h.calls?.Fin).length
  if(!previous||quality(chart)>quality(previous))rows.set(key,chart)
 }
 for(const key of conflicts)rows.delete(key)
 const races=[...rows.values()].sort((a,b)=>a.date.localeCompare(b.date)||identity(a).localeCompare(identity(b)))
 return {provider:'Equibase official charts',through,races,audit:{accepted:races.length,runners:races.reduce((n,r)=>n+r.runners.length,0),tracks:[...new Set(races.map(r=>r.track))].sort(),from:races[0]?.date,through:races.at(-1)?.date,conflictingFields:[...conflicts],rejected:rejected.length,note:'Prior-date chart evidence only. No estimated individual finishing times, speed figures, or complete-career claim.'}}
}
