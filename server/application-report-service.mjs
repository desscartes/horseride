import {readServedProgram,publishProgram} from './served-program.mjs'
import {parseOfficialMarkets,officialStarts} from '../src/data/officialMarkets.js'
import {parseSixLegCsv,officialSixLegCsvUrl} from './six-leg-starts.mjs'
import {sixLegStarts} from './social-coupons.mjs'
import {optimalHundredTicket,summarizeApplication,reportStart} from './application-report.mjs'
import {storeApplicationTickets,applicationTickets,applicationOutcomes,listApplicationForecasts,updateApplicationSettlement} from './database.mjs'
import {localDay} from './maintenance-policy.mjs'
import {horseIdentity} from './data-quality.mjs'
import {racingCountry} from './foreign-data.mjs'
import {verifiedRecommendationTickets} from './recommendation-recording.mjs'
import {findDailyAiAnalysis} from './database.mjs'
import {selectedMeetingCoupons} from './selected-meeting-coupons.mjs'
export function recordShownRecommendations(body){
 const program=readServedProgram(body.date),record=findDailyAiAnalysis(body.date,body.city),tickets=verifiedRecommendationTickets(body,program,record)
 if(!tickets.length)return {recorded:0,accepted:false,reason:'Başlangıç veya kupon seçimleri güncel kayıtla eşleşmedi.'}
 const original=applicationTickets(body.date).filter(t=>t.date===body.date).length
 for(const t of tickets){t.resultCsvUrl=(program.providerUrls||[]).find(u=>{try{return new URL(u).hostname==='medya-cdn.tjk.org'&&horseIdentity(decodeURIComponent(new URL(u).pathname)).endsWith(horseIdentity(`${t.city}-GunlukYarisProgrami-TR.csv`))}catch{return false}})?.replaceAll('GunlukYarisProgrami','GunlukYarisSonuclari')||null}
 storeApplicationTickets(tickets);reportCache.clear()
 return {accepted:true,recorded:applicationTickets(body.date).filter(t=>t.date===body.date).length-original}
}
export async function captureApplicationTickets(date=localDay(),{request=fetch,now=new Date().toISOString()}={}){
 const program=readServedProgram(date);if(!program?.races?.length)return {recorded:0,reason:'Program hazırlanıyor'}
 const proposals=[],verifiedRaces=[]
 for(const city of [...new Set(program.races.map(r=>r.city))]){
  const races=program.races.filter(r=>r.city===city).sort((a,b)=>a.no-b.no)
  let verified=races.every(r=>r.officialMarketsVerified&&!r.officialMarketsReused),starts=verified?[...officialStarts(races,6),...officialStarts(races,5)]:[]
  if(!verified)try{
   const compact=s=>horseIdentity(s),needle=compact(`${city}-GunlukYarisProgrami-TR.csv`)
   const official=(program.providerUrls||[]).find(u=>{try{return new URL(u).hostname==='medya-cdn.tjk.org'&&compact(decodeURIComponent(new URL(u).pathname)).endsWith(needle)}catch{return false}})
   // Foreign archive filenames keep Turkish letters and abbreviations; use the actual served source.
   if(!official&&racingCountry(city))continue
   const response=await request(official||officialSixLegCsvUrl(date,city),{signal:AbortSignal.timeout(10000)});if(response.ok){const csv=await response.text(),[y,m,d]=date.split('-');if(csv.split(/\r?\n/)[0].includes(`${d}/${m}/${y}`)&&horseIdentity(csv.split(';')[0])===horseIdentity(city)){starts=parseOfficialMarkets(csv);verified=true}}
  }catch{}
  if(!verified)continue
  const verifiedMeeting=races.map(r=>({...r,sixLegStarts:starts.filter(s=>s.legCount===6&&s.raceNo===Number(r.no)).map(s=>s.ordinal),fiveLegStarts:starts.filter(s=>s.legCount===5&&s.raceNo===Number(r.no)).map(s=>s.ordinal),officialMarketsVerified:true,officialMarketsReused:false}))
  verifiedRaces.push(...verifiedMeeting)
  for(const start of starts){const six=Array.from({length:start.legCount},(_,i)=>verifiedMeeting.find(r=>Number(r.no)===start.raceNo+i)),ticket=six.every(Boolean)?optimalHundredTicket(six,date,start.ordinal,{now,legCount:start.legCount}):null
   if(ticket){const meeting=program.meetings?.find(m=>m.city===city);ticket.resultUrl=meeting?.url?.replace('GunlukYarisProgrami','GunlukYarisSonuclari')||null;ticket.resultCsvUrl=(program.providerUrls||[]).find(u=>{try{return new URL(u).hostname==='medya-cdn.tjk.org'&&horseIdentity(decodeURIComponent(new URL(u).pathname)).endsWith(horseIdentity(`${city}-GunlukYarisProgrami-TR.csv`))}catch{return false}})?.replaceAll('GunlukYarisProgrami','GunlukYarisSonuclari')||null;proposals.push(ticket)}
  }
 }
 // Apply metadata to the latest snapshot, preserving rankings published during collection.
 const current=readServedProgram(date);if(current)publishProgram(date,{...current,races:current.races.map(r=>{const v=verifiedRaces.find(v=>v.city===r.city&&Number(v.no)===Number(r.no));return v?{...r,sixLegStarts:v.sixLegStarts,fiveLegStarts:v.fiveLegStarts,officialMarketsVerified:true,officialMarketsReused:false}:r})})
 const existing=applicationTickets(date).filter(t=>t.date===date&&t.officialVerified&&!t.source),frozen=new Map(existing.map(t=>[`${t.city}:${t.legCount}:${t.ordinal}`,t]))
 const candidates=proposals.map(t=>frozen.get(`${t.city}:${t.legCount}:${t.ordinal}`)||t).filter(t=>t.scheduledStart>now&&t.legCount===6)
 const best=candidates.sort((a,b)=>b.estimatedChance-a.estimatedChance||a.cost-b.cost||a.city.localeCompare(b.city))[0]
 const selected=[...new Set(verifiedRaces.map(r=>r.city))].flatMap(city=>selectedMeetingCoupons(verifiedRaces,date,city,applicationTickets(date),{now}).map(r=>r.ticket).filter(Boolean))
 storeApplicationTickets([...proposals,...selected],best);return {recorded:proposals.length,selectedMeetingTickets:selected.length,best:applicationTickets(date).find(t=>t.date===date&&t.dailyBest)||null,programMeetings:new Set(program.races.map(r=>r.city)).size}
}
const reportCache=new Map()
export function applicationReport(options={}){
 const today=localDay(),key=JSON.stringify([today,options]),cached=reportCache.get(key);if(cached&&Date.now()-cached.at<60000)return cached.value
 const source=options.source||'numeric',snapshots=listApplicationForecasts(reportStart,today,source),value=summarizeApplication({snapshots,surprises:source==='daily_ai'?snapshots:listApplicationForecasts(reportStart,today,'daily_ai'),outcomes:applicationOutcomes(reportStart),tickets:applicationTickets(reportStart).filter(t=>t.algorithm!=='optimal-100-v1'),today,...options})
 if(reportCache.size>=24)reportCache.delete(reportCache.keys().next().value);reportCache.set(key,{at:Date.now(),value});return value
}
export function dailyApplicationTicket(date=localDay()){
 const program=readServedProgram(date),valid=t=>t.officialVerified&&(t.legCount===5||t.legCount===6)&&t.legs.length===t.legCount&&officialStarts((program?.races||[]).filter(r=>r.city===t.city),t.legCount).some(s=>s.ordinal===t.ordinal&&s.raceNo===t.startRaceNo)
 const tickets=applicationTickets(date).filter(t=>t.date===date&&!t.source&&valid(t)),best=n=>tickets.filter(t=>t.legCount===n).sort((a,b)=>Number(b.dailyBest)-Number(a.dailyBest)||b.estimatedChance-a.estimatedChance||a.cost-b.cost)[0]||null
 return {date,budget:100,ticket:best(6),fiveTicket:best(5),alternatives:tickets,reason:tickets.length?null:'Resmî altılı ve beşli başlangıçları doğrulanmış kupon hazırlanıyor. Başlamış yarışlardan yeni kupon oluşturulmaz.',note:'Her öneri aynı hipodromdaki resmî oyun ayaklarından oluşur. 100 TL bütçeyle modelin hesapladığı en yüksek kapsam karşılaştırılır. Tahmini kapsam kalibre edilmiş kazanma olasılığı veya kazanma garantisi değildir.'}
}
export function parseSixLegDividends(csv){return parseLegDividends(csv).filter(d=>d.legCount===6)}
export function parseLegDividends(csv){
 const found=[];let endingRaceNo=null
 for(const line of String(csv).split(/\r?\n/)){
  const header=line.match(/^(\d+)\s*\.\s*Ko[şs]u\b/i);if(header)endingRaceNo=Number(header[1])
  for(const m of line.matchAll(/(?:([12])\s*\.\s*)?([56])\s*['’]?\s*L[ıiİI]\s+GANYAN\s*\(([^)]+)\)\s*:\s*([\d.]+,\d{2})\s*(?:TL|₺)/gi)){
   const legCount=Number(m[2]),winningLegs=m[3].split('/').map(leg=>leg.split(',').map(n=>Number(n.trim())))
   if(winningLegs.length!==legCount||winningLegs.some(l=>!l.length||l.some(n=>!Number.isInteger(n)||n<1)))continue
   found.push({legCount,ordinal:m[1]?Number(m[1]):null,endingRaceNo,winningLegs,amount:Number(m[4].replaceAll('.','').replace(',','.')),text:m[0]})
  }
 }return [...new Map(found.map(r=>[`${r.ordinal}:${r.endingRaceNo}:${r.text}`,r])).values()]
}
export async function settleApplicationPayouts({request=fetch}={}){
 const now=new Date().toISOString(),groups=new Map()
 for(const ticket of applicationTickets(reportStart).filter(t=>t.algorithm!=='optimal-100-v1'&&t.resultCsvUrl&&!t.officialResult&&t.scheduledStart<now)){const key=`${ticket.date}:${ticket.city}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(ticket)}
 const results=[]
 for(const tickets of [...groups.values()].slice(0,10)){const ticket=tickets[0],url=ticket.resultCsvUrl
  if(!url||new URL(url).hostname!=='medya-cdn.tjk.org'){results.push({city:ticket.city,status:'official_source_missing'});continue}
  try{const response=await request(url,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error(`HTTP ${response.status}`);const csv=await response.text(),first=csv.split(/\r?\n/)[0],[year,month,day]=ticket.date.split('-')
   if(!first.includes(`${day}/${month}/${year}`)||horseIdentity(first.split(';')[0])!==horseIdentity(ticket.city))throw Error('Resmi sonuç tarihi/hipodrom eşleşmedi')
   const dividends=parseLegDividends(csv)
   for(const t of tickets){const rows=dividends.filter(d=>d.legCount===(t.legCount||6)&&d.endingRaceNo===t.startRaceNo+(t.legCount||6)-1&&(d.ordinal===null||d.ordinal===t.ordinal));if(rows.length!==1)continue
    const row=rows[0],winningCombinations=t.legs.reduce((n,l,i)=>n*l.horses.filter(h=>row.winningLegs[i].includes(h.number)).length,1)
    updateApplicationSettlement(t.id,{winningLegs:row.winningLegs,winningCombinations,unitDividend:row.amount},{url,text:row.text,checkedAt:new Date().toISOString(),unit:'single_winning_combination'},Math.round(row.amount*winningCombinations*t.multiples*100)/100)
   }
   results.push({city:ticket.city,dividends:dividends.length})
  }catch(e){results.push({city:ticket.city,error:e.message})}
 }if(results.length)reportCache.clear();return results
}
