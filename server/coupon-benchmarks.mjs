import {optimalHundredTicket} from './application-report.mjs'
import {officialStarts} from '../src/data/officialMarkets.js'
import {analysisEntryFingerprint} from './analysis-entry-policy.mjs'
export function couponBenchmarkPairs(program,{now=new Date().toISOString(),budgets=[30,50,1000]}={}){
 if(!program?.date||!Number.isFinite(Date.parse(program.fetchedAt))||Date.parse(now)<Date.parse(program.fetchedAt)||Date.parse(now)-Date.parse(program.fetchedAt)>20*60000)return []
 const pairs=[]
 for(const city of new Set(program.races.map(r=>r.city))){const meeting=program.races.filter(r=>r.city===city)
  for(const start of officialStarts(meeting,6)){
   const races=Array.from({length:6},(_,i)=>meeting.find(r=>Number(r.no)===start.raceNo+i));if(races.some(r=>!r))continue
   if(races.some(r=>{const h=r.horses.filter(h=>!h.outOfRace);return !h.length||h.some(h=>typeof h.marketShare!=='number'||!Number.isFinite(h.marketShare)||h.marketShare<0)||!h.some(h=>h.marketShare>0)}))continue
   const market=races.map(r=>({...r,rankingSource:'prestart_market_reference',rankingMethod:'prestart_market_share_v1',horses:r.horses.map(h=>({...h,probability:h.marketShare}))}))
   for(const budget of budgets){const model=optimalHundredTicket(races,program.date,start.ordinal,{now,budget}),reference=optimalHundredTicket(market,program.date,start.ordinal,{now,budget,requiredRankingSource:'prestart_market_reference'});if(!model||!reference)continue
    pairs.push({date:program.date,city,ordinal:start.ordinal,budget,capturedAt:now,scheduledStart:model.scheduledStart,entryFingerprint:analysisEntryFingerprint(races),sourceFetchedAt:program.fetchedAt,role:'prospective_same_budget_shadow_benchmark',model,market:reference,calibrated:false})
   }
  }
 }
 return pairs
}
