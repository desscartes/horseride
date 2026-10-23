import {workoutTime} from './environment-features.mjs'
import {horseIdentityV2} from './racing-identity.mjs'
import {horseIdentity} from './data-quality.mjs'
const number=n=>Number(n).toLocaleString('tr-TR',{maximumFractionDigits:1})
const identify=n=>horseIdentityV2(String(n||'').replace(/\s*\([^)]*\)/g,''))
export function workoutEvidence(horse,date){
 const target=Date.parse(date+'T12:00:00Z'),seen=new Set(),rows=[]
 for(const w of horse.workouts||[]){const day=w.dateISO||(/^\d{4}-\d{2}-\d{2}$/.test(w.date||'')?w.date:null),time=Date.parse(day+'T12:00:00Z'),age=(target-time)/86400000
  if(!day||!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==day||age<=0||age>90||w.horseName&&identify(w.horseName)!==identify(horse.name))continue
  if(w.provider==='Equibase'&&!w.registryId)continue
  const key=JSON.stringify([w.registryId||null,day,w.hippodrome,w.surface,w.distanceMeters,w.timeSeconds,w.splits]);if(seen.has(key))continue;seen.add(key)
  const splits=Object.fromEntries(Object.entries(w.splits||{}).map(([d,v])=>[d,workoutTime(v,Number(d))]).filter(([,v])=>v!=null)),speed=Number(w.distanceMeters)/Number(w.timeSeconds),timed=Number(w.distanceMeters)>0&&Number(w.timeSeconds)>0&&speed>=5&&speed<=20
  rows.push({...w,dateISO:day,ageDays:age,validSplits:splits,timed})
 }
 const ids=new Set(rows.filter(w=>w.provider==='Equibase').map(w=>w.registryId).filter(Boolean));if(ids.size>1)return {rows:[],count30:0,count14:0,ambiguousIdentity:true}
 rows.sort((a,b)=>b.dateISO.localeCompare(a.dateISO));return {rows,count30:rows.filter(w=>w.ageDays<=30).length,count14:rows.filter(w=>w.ageDays<=14).length,ambiguousIdentity:false}
}
export function workoutComment(race,horse,date){
 const e=workoutEvidence(horse,date),last=e.rows[0]
 if(!last)return e.ambiguousIdentity?'İdman kayıtlarında birden fazla sicil eşleştiği için ara dereceler değerlendirmeye alınmadı.':'Bu açıklamada son 90 güne ait doğrulanmış idman kaydı yok; bu, atın idman yapmadığı anlamına gelmez.'
 const pieces=[`Görünen kayıtlarda son 30 günde ${e.count30}, son 14 günde ${e.count14} idmanı var. Son çalışma ${last.dateISO}${last.hippodrome?' '+last.hippodrome:''}${last.surface?' '+last.surface+' pistte':''}.`]
 const splits=Object.entries(last.validSplits).filter(([d])=>[400,600,800,1000,1200].includes(Number(d))).map(([d,t])=>`${d} metre ${number(t)} saniye`)
 if(last.timed)pieces.push(`${number(last.distanceMeters)} metrelik çalışmayı ${number(last.timeSeconds)} saniyede tamamlamış${/^\d+\/\d+$/.test(last.groupRank||'')?'; kaynakta aynı çalışma grubundaki sırası '+last.groupRank:''}.`)
 else if(splits.length)pieces.push('Kayıtlı ara dereceler: '+splits.join(', ')+'.')
 if(last.surface&&race.surface&&horseIdentity(last.surface)!==horseIdentity(race.surface))pieces.push(`İdman pisti bugünkü ${race.surface} yüzeyinden farklı; bu derece doğrudan yarış hızına çevrilmedi.`)
 else pieces.push('Çalışma şiddeti ve zemin eşitlenmeden bu derece rakiplerine hız üstünlüğü sayılmaz.')
 return pieces.join(' ')
}
