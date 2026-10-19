import {racingCountry} from './foreign-data.mjs'
const rate=(n,d)=>d?Math.round(1000*n/d)/10:null
export function couponMetrics(tickets){
 const settled=tickets.filter(t=>t.status!=='pending'),won=settled.filter(t=>t.status==='won'),missingPayouts=won.filter(t=>t.payout===null).length
 const spent=settled.reduce((n,t)=>n+t.cost,0),verifiedReturns=settled.reduce((n,t)=>n+(t.payout||0),0)
 const distribution=n=>Array.from({length:n+1},(_,hits)=>({hits,total:n,count:settled.filter(t=>(t.legCount||t.legs.length)===n&&t.legsHit===hits).length})).reverse()
 return {recorded:tickets.length,settled:settled.length,won:won.length,pending:tickets.length-settled.length,winRate:rate(won.length,settled.length),spent,verifiedReturns,missingPayouts,net:missingPayouts?null:verifiedReturns-spent,roi:missingPayouts||!spent?null:100*(verifiedReturns-spent)/spent,six:distribution(6),five:distribution(5),nearMissSix:settled.filter(t=>(t.legCount||t.legs.length)===6&&t.legsHit===5).length,nearMissFive:settled.filter(t=>(t.legCount||t.legs.length)===5&&t.legsHit===4).length}
}
export function surpriseMetrics(rows){
 const nominated=rows.filter(r=>r.tracked&&r.horseName),evaluated=nominated.filter(r=>Number.isInteger(r.finish)),wins=evaluated.filter(r=>r.finish===1).length,topThree=evaluated.filter(r=>r.finish<=3).length
 return {trackedRaces:rows.filter(r=>r.tracked).length,untrackedRaces:rows.filter(r=>!r.tracked).length,nominated:nominated.length,evaluated:evaluated.length,pending:nominated.length-evaluated.length,wins,topThree,winRate:rate(wins,evaluated.length),topThreeRate:rate(topThree,evaluated.length)}
}
function groupMetrics(forecasts,tickets,surprises){
 const evaluated=forecasts.filter(r=>r.evaluated),wins=evaluated.filter(r=>r.hit).length,topThree=evaluated.filter(r=>r.topThree).length
 return {recorded:forecasts.length,evaluated:evaluated.length,pending:forecasts.length-evaluated.length,wins,topThree,winRate:rate(wins,evaluated.length),topThreeRate:rate(topThree,evaluated.length),coupons:couponMetrics(tickets),surprises:surpriseMetrics(surprises)}
}
export function reportBreakdowns(forecasts,tickets,surprises){
 const cities=[...new Set([...forecasts,...tickets,...surprises].map(r=>r.city))].sort((a,b)=>a.localeCompare(b,'tr'))
 const regions=[{id:'domestic',label:'Türkiye',country:'TR'},{id:'foreign',label:'Yurt dışı'}].map(region=>{
  const names=cities.filter(city=>Boolean(racingCountry(city))===(region.id==='foreign')),belongs=r=>names.includes(r.city)
  return {...region,...groupMetrics(forecasts.filter(belongs),tickets.filter(belongs),surprises.filter(belongs)),cities:names.map(city=>({city,country:racingCountry(city)||'TR',...groupMetrics(forecasts.filter(r=>r.city===city),tickets.filter(r=>r.city===city),surprises.filter(r=>r.city===city))}))}
 }).filter(r=>r.cities.length)
 const days=[...new Set([...forecasts,...tickets,...surprises].map(r=>r.date))].sort().reverse().map(date=>({date,...groupMetrics(forecasts.filter(r=>r.date===date),tickets.filter(t=>t.date===date),surprises.filter(r=>r.date===date)),cities:cities.filter(city=>tickets.some(t=>t.date===date&&t.city===city)).map(city=>({city,...groupMetrics(forecasts.filter(r=>r.date===date&&r.city===city),tickets.filter(t=>t.date===date&&t.city===city),surprises.filter(r=>r.date===date&&r.city===city))}))}))
 return {regions,days,surpriseSummary:surpriseMetrics(surprises),couponSummary:couponMetrics(tickets)}
}
