import {publicationEvidence,missingDisclosure,sourceAgeLimit} from './instagram-evidence-policy.mjs'
import {createHash} from 'node:crypto'
import {officialStarts} from '../src/data/officialMarkets.js'
import {optimalHundredTicket} from './application-report.mjs'
import {raceStartISO} from './preparation-readiness.mjs'
import {analysisEntryFingerprint} from './analysis-entry-policy.mjs'
import {surpriseCandidates} from '../src/data/surprisePolicy.js'
export const instagramMeetingPolicy={budget:50,earliestMinutes:1440,latestMinutes:10,maxProgramAgeMinutes:360,maxReadinessAgeMinutes:30,maxMeetingPostsPerDay:4,onePerCity:true}
const active=r=>r.horses.filter(h=>!h.outOfRace)
const ranked=r=>active(r).toSorted((a,b)=>b.probability-a.probability||a.no-b.no)
const mass=(r,h)=>h.probability/active(r).reduce((s,x)=>s+x.probability,0)
const reason=(h,date)=>[h.jockey?`Jokey: ${h.jockey}.`:null,h.jockeyPerformance?.source==='dated_verified_archive_results'&&h.jockeyPerformance.through<date&&h.jockeyPerformance.recent30?.starts>0?`Arşivde son 30 günde ${h.jockeyPerformance.recent30.starts} start, ${h.jockeyPerformance.recent30.wins} galibiyet.`:null,Number(h.weight)>0?`${h.weight} kg, ${h.start}. start yeri.`:null,h.lastSix?`Programdaki sonuç dizisi: ${h.lastSix}.`:null].filter(Boolean).join(' ')
export function instagramMeetingPlan(program,readiness,{now=new Date().toISOString(),confirmation=null}={}){
 const time=Date.parse(now),age=(time-Date.parse(program?.fetchedAt))/60000,readyAge=(time-Date.parse(readiness?.checkedAt))/60000,drafts=[],blocked=[]
 if(!Number.isFinite(age)||age<0||age>360)return {drafts,blocked:[{reason:'program_stale'}]}
 if(readiness?.entryFingerprint!==analysisEntryFingerprint(program.races)||readiness?.sourceFetchedAt!==program.fetchedAt||readiness?.date!==program.date||!Number.isFinite(readyAge)||readyAge<0||readyAge>30||Date.parse(readiness.checkedAt)<Date.parse(program.fetchedAt))return {drafts,blocked:[{reason:'readiness_stale'}]}
 for(const city of new Set(program.races.map(r=>r.city))){
  const proof=confirmation?.cities?.find(c=>c.city===city&&c.confirmed&&c.originalProgramFetchedAt===program.fetchedAt&&c.entryFingerprint===analysisEntryFingerprint(program.races.filter(r=>r.city===city))),proofAge=proof?(time-Date.parse(proof.checkedAt))/60000:Infinity,sourceAge=proofAge>=0?Math.min(age,proofAge):age;
  const races=program.races.filter(r=>r.city===city),future=races.filter(r=>{const t=Date.parse(raceStartISO(r,program.date));return Number.isFinite(t)&&t-time>10*60000&&t-time<=1440*60000})
  if(!future.length){blocked.push({city,reason:'no_future_race'});continue}
  const decisions=new Map(future.map(r=>{const row=readiness.races.find(x=>x.city===city&&Number(x.raceNo)===Number(r.no)&&x.start===raceStartISO(r,program.date));return [r.no,publicationEvidence(r,row)]}))
  const eligible=future.filter(r=>decisions.get(r.no).eligible&&(!proof||proof.raceNumbers?.includes(Number(r.no))))
  const tickets=officialStarts(races,6).map(s=>{const legs=Array.from({length:6},(_,i)=>races.find(r=>Number(r.no)===s.raceNo+i)),start=legs[0]&&raceStartISO(legs[0],program.date),minutes=(Date.parse(start)-time)/60000;if(proof&&!legs.every(r=>proof.raceNumbers?.includes(Number(r?.no))))return null;if(minutes<10||minutes>1440||!Number.isFinite(minutes)||sourceAge>sourceAgeLimit(minutes))return null;return legs.every(r=>r&&eligible.includes(r))?optimalHundredTicket(legs,program.date,s.ordinal,{now,budget:50}):null}).filter(Boolean).sort((a,b)=>b.estimatedChance-a.estimatedChance||a.cost-b.cost)
  if(!tickets.length){blocked.push({city,reason:'no_eligible_coupon',sourceAgeMinutes:age,races:[...decisions].map(([raceNo,d])=>({raceNo,...d}))});continue}
  const proven=(r,h)=>!decisions.get(r.no).unknownHistoryNames.includes(h.name)
  const picks=eligible.flatMap(r=>{const horse=ranked(r)[0];return horse&&proven(r,horse)?[{race:r,horse}]:[]}).sort((a,b)=>mass(b.race,b.horse)-mass(a.race,a.horse)),first=picks[0]
  if(!first){blocked.push({city,reason:'no_evidence_supported_single'});continue}
  const outsiders=eligible.flatMap(r=>{const order=ranked(r),allowed=surpriseCandidates({...r,horses:active(r)},order.slice(0,2).map(h=>({horseName:h.name})));return order.filter(h=>allowed.includes(h.name)&&proven(r,h)).map(h=>({race:r,horse:h}))}).sort((a,b)=>mass(b.race,b.horse)-mass(a.race,a.horse)),surprise=outsiders[0]||null
  const ticket=tickets[0],start=ticket.scheduledStart,key=program.date+'|'+city,id='meeting-'+program.date+'-'+createHash('sha256').update(key).digest('hex').slice(0,12),fingerprint=analysisEntryFingerprint(races),expiresAt=new Date(Math.min(Date.parse(start),Date.parse(raceStartISO(first.race,program.date)),surprise?Date.parse(raceStartISO(surprise.race,program.date)):Infinity)-10*60000).toISOString()
  const counts={};for(const r of eligible)for(const [field,n]of Object.entries(decisions.get(r.no).missing))counts[field]=(counts[field]||0)+n
  const disclosure=missingDisclosure(counts),tier=disclosure?'limited_data':'evidence_complete',phase=(Date.parse(start)-time)>120*60000?'Erken program analizi':'Yarış öncesi analiz'
  const caption=`${city} • ${program.date}\n${phase} • Kaynak: ${new Date(program.fetchedAt).toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'})} TSİ${proof?` • Girişler kontrol: ${new Date(proof.checkedAt).toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'})} TSİ`:''}\n${ticket.ordinal}. altılı tahmini.\n${ticket.legs.map(l=>`${l.raceNo}. koşu: ${l.horses.map(h=>h.number).join(', ')}`).join('\n')}\n\nİLK ADAY: ${first.race.no}. koşu • ${first.horse.no} ${first.horse.name}\n${reason(first.horse,program.date)}\n\n${surprise?`SÜRPRİZ ADAY: ${surprise.race.no}. koşu • ${surprise.horse.no} ${surprise.horse.name}\n${reason(surprise.horse,program.date)} AGF ve model sıralamasında ilk iki dışında.`:'SÜRPRİZ: Doğrulanmış uygun aday bulunmadı.'}\n\nSeçimler yarış öncesi model puanlarına dayanır. Gerçek sonuçlarla doğrulanmış üstünlük veya kazanç garantisi değildir. ${disclosure?`Sınırlı veri: ${disclosure}. Eksik alanlar doldurulmadı; sıralama mevcut verilerle hesaplandı.`:''} Koşan atlar ve jokeyler değişebilir. 18+\n@ganyan_zekasi`
  drafts.push({tier,phase,missing:counts,fields:races.map(r=>({raceNo:Number(r.no),names:active(r).map(h=>h.name)})),id,kind:'meeting',date:program.date,city,scheduledStart:start,expiresAt,sourceFetchedAt:program.fetchedAt,entriesConfirmedAt:proof?.checkedAt||null,entryFingerprint:fingerprint,ticket,first:{raceNo:first.race.no,number:Number(first.horse.no),name:first.horse.name,reason:reason(first.horse,program.date)},surprise:surprise?{raceNo:surprise.race.no,number:Number(surprise.horse.no),name:surprise.horse.name,reason:reason(surprise.horse,program.date)}:null,caption})
 }
 return {drafts:drafts.sort((a,b)=>b.ticket.estimatedChance-a.ticket.estimatedChance),blocked}
}
