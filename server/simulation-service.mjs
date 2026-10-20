import {pairModelCoverage} from './coupon-pair-coverage.mjs'
import {simulationDays,reserveSimulationDay,applicationTickets} from './database.mjs'
import {readServedProgram} from './served-program.mjs'
import {officialStarts} from '../src/data/officialMarkets.js'
import {optimalHundredTicket} from './application-report.mjs'
import {horseIdentity} from './data-quality.mjs'
import {localDay} from './maintenance-policy.mjs'
import {simulationAllowance,selectSimulationTickets} from './simulation-policy.mjs'
export function captureSimulation({date=localDay(),now=new Date().toISOString()}={}){
 const days=simulationDays();if(days.some(d=>d.date===date))return {status:'already_recorded'}
 const program=readServedProgram(date);if(!program?.races?.length)return {status:'waiting_program'}
 const allowance=simulationAllowance(date,days);if(allowance.daily<2)return {status:'budget_exhausted'}
 const groups=[]
 for(const city of new Set(program.races.map(r=>r.city))){const meeting=program.races.filter(r=>r.city===city)
  for(const start of officialStarts(meeting,6)){
   const races=Array.from({length:6},(_,i)=>meeting.find(r=>Number(r.no)===start.raceNo+i));if(races.some(r=>!r))continue
   const frontier=[];let last=''
   for(let budget=1;budget<=allowance.daily;budget++){
    const t=optimalHundredTicket(races,date,start.ordinal,{now,budget});if(!t)continue
    const key=JSON.stringify(t.legs.map(l=>l.horses.map(h=>h.number)));if(key===last)continue;last=key
    const template=(program.providerUrls||[]).find(u=>{try{return new URL(u).hostname==='medya-cdn.tjk.org'&&horseIdentity(decodeURIComponent(new URL(u).pathname)).endsWith(horseIdentity(`${city}-GunlukYarisProgrami-TR.csv`))}catch{return false}})
    frontier.push({...t,source:'simulation',algorithm:'simulation-six-v1',resultCsvUrl:template?.replaceAll('GunlukYarisProgrami','GunlukYarisSonuclari')||null})
   }if(frontier.length)groups.push(frontier)
  }
 }
 const tickets=selectSimulationTickets(groups,allowance.daily);if(!tickets.length)return {status:'waiting_eligible_games'}
 const day={date,week:allowance.week,capturedAt:now,dailyAllowance:allowance.daily,spent:Math.round(tickets.reduce((n,t)=>n+t.cost,0)*100)/100,tickets,eligibleGames:groups.length,objective:'Maximize model coverage of at least one hit with shared-race intersections under daily budget',selectionVersion:2,pairModelCoverage:tickets.length===2?pairModelCoverage(...tickets):null,calibrated:false}
 return {status:reserveSimulationDay(day)?'recorded':'already_recorded',date,tickets:tickets.length,spent:day.spent}
}
export function simulationReport(){
 const days=simulationDays(),date=localDay(),allowance=simulationAllowance(date,days),settled=new Map(applicationTickets(days.at(-1)?.date||date).filter(t=>t.source==='simulation').map(t=>[`${t.date}:${t.city}:${t.ordinal}:${t.algorithm}`,t]))
 const history=days.map(day=>({...day,tickets:day.tickets.map(t=>{const saved=settled.get(`${t.date}:${t.city}:${t.ordinal}:${t.algorithm}`)||t,official=saved.officialResult?.winningLegs,status=!official?'pending':saved.officialResult.winningCombinations>0?'won':'lost';return {...saved,status,payout:status==='lost'?0:status==='won'?saved.verifiedPayout??null:null}})}))
 const all=history.flatMap(d=>d.tickets),week=history.filter(d=>d.week===allowance.week).flatMap(d=>d.tickets),returns=week.reduce((n,t)=>n+(t.payout||0),0)
 return {date,weeklyBudget:1000,week:allowance.week,spent:1000-allowance.remaining,remaining:allowance.remaining,returns,balance:allowance.remaining+returns,missingPayouts:week.filter(t=>t.status==='won'&&t.payout===null).length,won:all.filter(t=>t.status==='won').length,settled:all.filter(t=>t.status!=='pending').length,days:history,note:'Sanal oyundur. Haftalık harcama sınırı 1.000 TL; kazançlar yeniden harcanmaz. Yeni seçimlerde iki kupondan en az birinin tutma kapsamı, ortak ayak kesişimleriyle günlük bütçe altında eniyilenir. İlk günün eski seçimleri değiştirilmez. Yüzdeler kalibre edilmiş başarı oranı değildir. Sonuçlar yalnız resmî altılı sonucu ve ikramiyesiyle kesinleşir; geçmişe kupon üretilmez.'}
}
