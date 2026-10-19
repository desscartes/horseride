import {officialStarts} from '../src/data/officialMarkets.js'
import {optimalHundredTicket} from './application-report.mjs'
import {createHash} from 'node:crypto'
import {legSurpriseSuggestion} from '../src/data/couponSurpriseSuggestion.js'
// Published rows stay immutable. Before the original start, withdrawn selections
// produce an explicitly linked revision; started games are never reconstructed.
export function selectedMeetingCoupons(races,date,city,saved=[],{now=new Date().toISOString(),predictions=[]}={}){
 const meeting=races.filter(r=>r.city===city),starts=officialStarts(meeting,6)
 return (starts.length?starts:[{ordinal:null,raceNo:null}]).flatMap(start=>[30,50,1000].map(budget=>{
  const wide=budget===1000,algorithm=wide?'selected-meeting-optimal-v2-wide-1000':`selected-meeting-optimal-v1-${budget}`
  const decorate=ticket=>({...ticket,...(wide?{kind:'wide',minimumBudget:500,maximumBudget:1000,sourceLabel:'AI · Geniş kupon (500–1.000 TL)'}:{}),legs:ticket.legs.map(leg=>({...leg,surpriseSuggestion:legSurpriseSuggestion(meeting.find(r=>Number(r.no)===Number(leg.raceNo)),predictions.find(p=>Number(p.raceNo)===Number(leg.raceNo)&&p.city===city))}))})
  const previous=saved.filter(t=>t.date===date&&t.city===city&&t.ordinal===start.ordinal&&t.startRaceNo===start.raceNo&&(t.algorithm===algorithm||t.algorithm?.startsWith(algorithm+'-revision-'))).sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt)||b.algorithm.localeCompare(a.algorithm))[0]
  if(previous){
   const valid=starts.some(s=>s.raceNo===previous.startRaceNo&&s.ordinal===previous.ordinal)&&previous.legs.every(l=>l.horses.every(h=>meeting.find(r=>Number(r.no)===l.raceNo)?.horses.some(current=>Number(current.no)===h.number&&current.name===h.name&&!current.outOfRace)))
   if(valid)return {budget,ordinal:start.ordinal,startRaceNo:start.raceNo,kind:wide?'wide':'fixed',ticket:decorate(previous),reason:null}
   if(!previous.scheduledStart||now>=previous.scheduledStart)return {budget,ordinal:start.ordinal,startRaceNo:start.raceNo,ticket:null,reason:'Bu sabit kuponun oyunu başladı; program değişikliği sonrasında yeni kupon oluşturulamaz.'}
  }
  const eligible=starts.filter(s=>s.raceNo===start.raceNo&&s.ordinal===start.ordinal)
  const candidates=eligible.map(s=>optimalHundredTicket(Array.from({length:6},(_,i)=>meeting.find(r=>Number(r.no)===s.raceNo+i)).filter(Boolean),date,s.ordinal,{now,budget})).filter(Boolean)
  const best=candidates.filter(t=>!wide||t.cost>=500).sort((a,b)=>b.estimatedChance-a.estimatedChance||a.cost-b.cost||a.startRaceNo-b.startRaceNo)[0]
  const revision=best&&previous?createHash('sha256').update(JSON.stringify([best.ordinal,best.startRaceNo,best.unitPrice,best.legs])).digest('hex').slice(0,16):null
  return {budget,ordinal:start.ordinal,startRaceNo:start.raceNo,kind:wide?'wide':'fixed',ticket:best?decorate({...best,algorithm:revision?`${algorithm}-revision-${revision}`:algorithm,source:'selected_meeting',sourceLabel:revision?'Program değişikliği sonrası güncellenen sabit altılı':'Seçilen hipodromun sabit altılısı',...(revision?{supersedesTicketId:previous.id||`${date}:${city}:${previous.ordinal}:${previous.algorithm}`,revisionReason:'Önceki seçimler güncel koşan at listesiyle eşleşmedi; aynı oyunun kuponu başlangıçtan önce yeniden doğrulandı.'}:{})}):null,reason:best?null:wide?'Bu programda 500–1.000 TL aralığında, başlamamış ve doğrulanmış geniş altılı oluşturulamıyor.':'Başlamamış, resmî başlangıcı ve model puanları doğrulanmış altılı bulunamadı.'}
 }))
}
