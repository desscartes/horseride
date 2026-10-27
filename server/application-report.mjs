import {horseIdentity} from './data-quality.mjs'
import {racingCountry} from './foreign-data.mjs'
import {scheduledRaceStart} from './database.mjs'
import {budgetBetTypes,getBudgetUnitPrice} from '../src/data/ticketData.js'
import {officialMarketAllowed} from '../src/data/officialMarkets.js'
import {reportBreakdowns} from './report-breakdowns.mjs'
export const reportStart='2026-10-10'
export function optimalHundredTicket(races,date,ordinal,{now=new Date().toISOString(),legCount=6,budget=100,requiredRankingSource='local_trained_model'}={}){
 if(!Number.isInteger(budget)||budget<1||budget>1000)return null
 if(![5,6].includes(legCount)||races.length!==legCount||!officialMarketAllowed(races[0],legCount)||!races[0][legCount===6?'sixLegStarts':'fiveLegStarts'].includes(ordinal)||races.some((r,i)=>Number(r.no)!==Number(races[0].no)+i||r.city!==races[0].city))return null
 const start=scheduledRaceStart(races[0].scheduledDate||date,races[0].time,{calendarDate:Boolean(races[0].scheduledDate)})
 if(!start||now>=start||races.some(r=>r.rankingSource!==requiredRankingSource))return null
 const price=getBudgetUnitPrice(budgetBetTypes.find(b=>b.id===`${legCount}li-ganyan`),races[0].city),limit=Math.floor(budget/price)
 let states=new Map([[1,{score:1,legs:[]}]])
 for(const race of races){
  const active=race.horses.filter(h=>!h.outOfRace)
  if(!active.length||new Set(active.map(h=>h.name)).size!==active.length||new Set(active.map(h=>Number(h.no))).size!==active.length||active.some(h=>!h.name||!Number.isInteger(Number(h.no))||Number(h.no)<1||h.probability==null||h.probability===''||!Number.isFinite(Number(h.probability))||Number(h.probability)<0||Number(h.probability)>100))return null
  const horses=race.horses.filter(h=>!h.outOfRace&&Number.isFinite(Number(h.probability))&&Number(h.probability)>=0).sort((a,b)=>b.probability-a.probability||a.no-b.no)
  const total=horses.reduce((n,h)=>n+Number(h.probability),0);if(!total)return null
  const next=new Map();let mass=0
  for(let count=1;count<=Math.min(horses.length,limit);count++){
   mass+=Number(horses[count-1].probability)/total
   for(const [combinations,value]of states){const n=combinations*count;if(n>limit)continue;const score=value.score*mass
    if(!next.has(n)||next.get(n).score<score)next.set(n,{score,legs:[...value.legs,{raceNo:Number(race.no),modelVersion:race.rankingMethod,horses:horses.slice(0,count).map(h=>({number:Number(h.no),name:h.name,estimatedProbability:Number(h.probability)/total})),estimatedCoverage:mass}]})
   }
  }states=next
 }
 const [combinations,best]=[...states].sort((a,b)=>b[1].score-a[1].score||a[0]-b[0])[0]||[];if(!best)return null
 return {date,city:races[0].city,country:racingCountry(races[0].city)||'TR',ordinal,legCount,officialVerified:true,startRaceNo:Number(races[0].no),scheduledStart:start,capturedAt:now,budget,unitPrice:price,combinations,multiples:1,cost:Math.round(combinations*price*100)/100,remaining:Math.round((budget-combinations*price)*100)/100,estimatedChance:best.score,calibrated:false,legs:best.legs,algorithm:`official-optimal-100-v2-${legCount}`}
}
export function summarizeApplication({snapshots,outcomes,tickets,surprises=[],today,scope='all',period='week',source='numeric'}){
 const from=period==='total'?reportStart:new Date(Date.parse(`${today}T12:00:00Z`)-6*86400000).toISOString().slice(0,10),since=from<reportStart?reportStart:from
 const inScope=city=>scope==='all'||(scope==='domestic'?!racingCountry(city):Boolean(racingCountry(city)))
 const latest=new Map()
 for(const row of snapshots){if(row.source!==source||row.date<since||row.date>today||!inScope(row.city)||row.captured_at>=row.scheduled_start)continue
  const key=`${row.date}:${row.city}:${row.race_no}`;if(!latest.has(key)||latest.get(key).captured_at<row.captured_at)latest.set(key,row)
 }
 const totals={recorded:latest.size,evaluated:0,pending:0,topOneHits:0,favouriteTopThree:0,winnerInTopThree:0,pickedTopThree:0,pickedCount:0},weekly=new Map(),versions=new Set()
 const week=date=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10)}
 const raceRows=[],forecastRows=[]
 for(const row of latest.values()){
  versions.add(row.model_version);const result=outcomes.get(`${row.date}:${row.city}:${row.race_no}`),picks=row.picks||[]
  const valid=result&&picks.length&&picks.slice(0,3).every(p=>result.has(horseIdentity(p.horseName)))&&[...result.values()].some(n=>n===1)
  const forecast={date:row.date,city:row.city,evaluated:Boolean(valid),hit:Boolean(valid&&result.get(horseIdentity(picks[0]?.horseName))===1),topThree:Boolean(valid&&result.get(horseIdentity(picks[0]?.horseName))<=3)};forecastRows.push(forecast)
  if(!valid){totals.pending++;continue}totals.evaluated++
  const positions=picks.slice(0,3).map(p=>result.get(horseIdentity(p.horseName))),hit=positions[0]===1,top=positions[0]<=3,winner=positions.includes(1)
  totals.topOneHits+=+hit;totals.favouriteTopThree+=+top;totals.winnerInTopThree+=+winner;totals.pickedCount+=positions.length;totals.pickedTopThree+=positions.filter(p=>p<=3).length
  const key=week(row.date),w=weekly.get(key)||{week:key,evaluated:0,hits:0,topThree:0};w.evaluated++;w.hits+=+hit;w.topThree+=+top;weekly.set(key,w)
  raceRows.push({date:row.date,city:row.city,raceNo:row.race_no,horse:picks[0]?.horseName,finish:positions[0],hit,modelVersion:row.model_version})
 }
 const uniqueTickets=new Map()
 for(const t of tickets.filter(t=>t.date>=since&&t.date<=today&&inScope(t.city)&&t.capturedAt<t.scheduledStart)){
  const key=JSON.stringify([t.date,t.city,t.legCount||t.legs.length,t.startRaceNo,t.cost,t.multiples||1,t.legs.map(l=>[l.raceNo,l.horses.map(h=>h.number).sort((a,b)=>a-b)])])
  const old=uniqueTickets.get(key)
  if(!old||t.dailyBest)uniqueTickets.set(key,{...t,officialResult:t.officialResult||old?.officialResult,verifiedPayout:t.verifiedPayout??old?.verifiedPayout,payoutEvidence:t.payoutEvidence||old?.payoutEvidence,recommendationCount:(old?.recommendationCount||0)+1})
  else old.recommendationCount++
 }
 const couponRows=[...uniqueTickets.values()].map(t=>{
  const legs=t.legs.map((l,i)=>{if(t.officialResult?.winningLegs?.length===t.legs.length&&Array.isArray(t.officialResult.winningLegs[i]))return l.horses.some(h=>t.officialResult.winningLegs[i].includes(h.number));const result=outcomes.get(`${t.date}:${t.city}:${l.raceNo}`);if(!result||![...result.values()].includes(1))return null
   if(l.horses.some(h=>!result.has(horseIdentity(h.name))))return null
   const winners=[...result].filter(([,p])=>p===1).map(([name])=>name);if(winners.length!==1)return null;return l.horses.some(h=>winners.includes(horseIdentity(h.name)))
  })
  const official=t.officialResult?.winningLegs?.length===t.legs.length,status=!official||legs.some(l=>l===null)?'pending':legs.every(Boolean)?'won':'lost',payout=status==='lost'?0:status==='won'?t.verifiedPayout??null:null
  return {...t,legCount:t.legCount||t.legs.length,status,officialVerifiedResult:official,legsHit:legs.filter(Boolean).length,settledLegs:legs.filter(l=>l!==null).length,payout,net:payout===null?null:Math.round((payout-t.cost)*100)/100}
 })
 const settled=couponRows.filter(t=>t.status!=='pending'),known=settled.filter(t=>t.payout!==null),missingPayouts=settled.filter(t=>t.status==='won'&&t.payout===null).length,spend=settled.reduce((n,t)=>n+t.cost,0),returns=known.reduce((n,t)=>n+t.payout,0)
 for(const ticket of couponRows){
  const key=week(ticket.date),w=weekly.get(key)||{week:key,evaluated:0,hits:0,topThree:0}
  w.coupons??={recorded:0,settled:0,won:0,pending:0,spent:0,returns:0,missingPayouts:0}
  w.coupons.recorded++;if(ticket.status==='pending')w.coupons.pending++;else{w.coupons.settled++;w.coupons.spent+=ticket.cost;if(ticket.status==='won')w.coupons.won++;if(ticket.payout!==null)w.coupons.returns+=ticket.payout;else w.coupons.missingPayouts++}
  weekly.set(key,w)
 }
 const rate=(n,d)=>d?Math.round(1000*n/d)/10:null
 const surpriseRows=surprises.filter(row=>row.date>=since&&row.date<=today&&inScope(row.city)&&row.captured_at<row.scheduled_start).map(row=>{const horseName=row.surprise?.horseName||null,result=outcomes.get(`${row.date}:${row.city}:${row.race_no}`);return {date:row.date,city:row.city,raceNo:row.race_no,tracked:row.surpriseTracked,horseName,finish:horseName&&result&&[...result.values()].includes(1)?result.get(horseIdentity(horseName))??null:null}})
 const breakdowns=reportBreakdowns(forecastRows,couponRows,surpriseRows)
 return {...breakdowns,startedAt:reportStart,from:since,through:today,scope,period,source,totals:{...totals,winRate:rate(totals.topOneHits,totals.evaluated),favouriteTopThreeRate:rate(totals.favouriteTopThree,totals.evaluated),winnerInTopThreeRate:rate(totals.winnerInTopThree,totals.evaluated),pickedTopThreeRate:rate(totals.pickedTopThree,totals.pickedCount)},weekly:[...weekly.values()].sort((a,b)=>b.week.localeCompare(a.week)),races:raceRows.reverse().slice(0,100),modelVersions:[...versions],coupons:couponRows.sort((a,b)=>b.date.localeCompare(a.date)),couponSummary:breakdowns.couponSummary,note:'Yalnızca yarış başlamadan kaydedilmiş gerçek tahminler sayılır. Eksik geçmiş tahminler ve kuponlar sonradan üretilmez. Model tahmini kalibre edilmiş kazanma garantisi değildir.'}
}
