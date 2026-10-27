import {createHash} from 'node:crypto'
import {officialStarts} from '../src/data/officialMarkets.js'
import {optimalHundredTicket} from './application-report.mjs'
import {raceStartISO} from './preparation-readiness.mjs'
import {analysisEntryFingerprint} from './analysis-entry-policy.mjs'
import {surpriseCandidates} from '../src/data/surprisePolicy.js'
export const instagramMeetingPolicy={budget:50,earliestMinutes:90,latestMinutes:30,maxProgramAgeMinutes:15,maxReadinessAgeMinutes:30,maxMeetingPostsPerDay:4,onePerCity:true}
const active=r=>r.horses.filter(h=>!h.outOfRace)
const ranked=r=>active(r).toSorted((a,b)=>b.probability-a.probability||a.no-b.no)
const mass=(r,h)=>h.probability/active(r).reduce((s,x)=>s+x.probability,0)
const reason=(h,date)=>[h.jockey?`Jokey: ${h.jockey}.`:null,h.jockeyPerformance?.source==='dated_verified_archive_results'&&h.jockeyPerformance.through<date&&h.jockeyPerformance.recent30?.starts>0?`Arşivde son 30 günde ${h.jockeyPerformance.recent30.starts} start, ${h.jockeyPerformance.recent30.wins} galibiyet.`:null,Number(h.weight)>0?`${h.weight} kg, ${h.start}. start yeri.`:null,h.lastSix?`Programdaki sonuç dizisi: ${h.lastSix}.`:null].filter(Boolean).join(' ')
export function instagramMeetingPlan(program,readiness,{now=new Date().toISOString()}={}){
 const time=Date.parse(now),age=(time-Date.parse(program?.fetchedAt))/60000,readyAge=(time-Date.parse(readiness?.checkedAt))/60000,drafts=[],blocked=[]
 if(!Number.isFinite(age)||age<0||age>15)return {drafts,blocked:[{reason:'program_stale'}]}
 if(readiness?.entryFingerprint!==analysisEntryFingerprint(program.races)||readiness?.sourceFetchedAt!==program.fetchedAt||readiness?.date!==program.date||!Number.isFinite(readyAge)||readyAge<0||readyAge>30||Date.parse(readiness.checkedAt)<Date.parse(program.fetchedAt))return {drafts,blocked:[{reason:'readiness_stale'}]}
 for(const city of new Set(program.races.map(r=>r.city))){
  const races=program.races.filter(r=>r.city===city),starts=races.map(r=>raceStartISO(r,program.date)).filter(Boolean).sort(),start=starts[0],minutes=(Date.parse(start)-time)/60000
  if(!Number.isFinite(minutes)||minutes<30||minutes>90){blocked.push({city,reason:'outside_prestart_window'});continue}
  const ready=r=>readiness.races.some(x=>x.city===city&&Number(x.raceNo)===Number(r.no)&&x.start===raceStartISO(r,program.date)&&x.servingReady===true)
  const eligible=races.filter(r=>ready(r)&&r.rankingSource==='local_trained_model'&&active(r).length>=2&&active(r).every(h=>typeof h.probability==='number'&&Number.isFinite(h.probability)&&h.probability>=0&&h.probability<=100)&&active(r).some(h=>h.probability>0))
  const tickets=officialStarts(races,6).map(s=>{const legs=Array.from({length:6},(_,i)=>races.find(r=>Number(r.no)===s.raceNo+i));return legs.every(r=>r&&eligible.includes(r))?optimalHundredTicket(legs,program.date,s.ordinal,{now,budget:50}):null}).filter(Boolean).sort((a,b)=>b.estimatedChance-a.estimatedChance||a.cost-b.cost)
  if(!tickets.length){blocked.push({city,reason:'no_evidence_complete_coupon'});continue}
  const picks=eligible.map(r=>({race:r,horse:ranked(r)[0]})).sort((a,b)=>mass(b.race,b.horse)-mass(a.race,a.horse)),first=picks[0]
  const outsiders=eligible.flatMap(r=>{const order=ranked(r),allowed=surpriseCandidates({...r,horses:active(r)},order.slice(0,2).map(h=>({horseName:h.name})));return order.filter(h=>allowed.includes(h.name)).map(h=>({race:r,horse:h}))}).sort((a,b)=>mass(b.race,b.horse)-mass(a.race,a.horse)),surprise=outsiders[0]||null
  const ticket=tickets[0],key=program.date+'|'+city,id='meeting-'+program.date+'-'+createHash('sha256').update(key).digest('hex').slice(0,12),fingerprint=analysisEntryFingerprint(races),expiresAt=new Date(Date.parse(start)-30*60000).toISOString()
  const caption=`${city} • ${program.date}\n50 TL üst bütçede modelin öne çıkardığı ${ticket.ordinal}. altılı. Tutar: ${ticket.cost.toFixed(2)} TL.\n${ticket.legs.map(l=>`${l.raceNo}. koşu: ${l.horses.map(h=>h.number).join(', ')}`).join('\n')}\n\nİLK ADAY: ${first.race.no}. koşu • ${first.horse.no} ${first.horse.name}\n${reason(first.horse,program.date)}\n\n${surprise?`SÜRPRİZ ADAY: ${surprise.race.no}. koşu • ${surprise.horse.no} ${surprise.horse.name}\n${reason(surprise.horse,program.date)} AGF ve model sıralamasında ilk iki dışında.`:'SÜRPRİZ: Doğrulanmış uygun aday bulunmadı.'}\n\nSeçimler yarış öncesi model puanlarına dayanır. Gerçek sonuçlarla doğrulanmış üstünlük veya kazanç garantisi değildir. Eksik veri varsa paylaşım yapılmaz. 18+\n@ganyan_zekasi`
  drafts.push({fields:races.map(r=>({raceNo:Number(r.no),names:active(r).map(h=>h.name)})),id,kind:'meeting',date:program.date,city,scheduledStart:start,expiresAt,sourceFetchedAt:program.fetchedAt,entryFingerprint:fingerprint,ticket,first:{raceNo:first.race.no,number:Number(first.horse.no),name:first.horse.name,reason:reason(first.horse,program.date)},surprise:surprise?{raceNo:surprise.race.no,number:Number(surprise.horse.no),name:surprise.horse.name,reason:reason(surprise.horse,program.date)}:null,caption})
 }
 return {drafts:drafts.sort((a,b)=>b.ticket.estimatedChance-a.ticket.estimatedChance),blocked}
}
