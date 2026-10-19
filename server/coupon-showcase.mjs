import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {officialStarts} from '../src/data/officialMarkets.js'
import {validSurprise} from '../src/data/surprisePolicy.js'
import {analysisEntryFingerprint} from './analysis-entry-policy.mjs'
import {scheduledRaceStart} from './database.mjs'
import {budgetBetTypes,getBudgetUnitPrice} from '../src/data/ticketData.js'
import {readServedProgram} from './served-program.mjs'
import {findDailyAiAnalysis,storeApplicationTickets,applicationTickets} from './database.mjs'
import {aggregateSocialCoupons,getSocialCoupons} from './social-coupons.mjs'
import {dailyApplicationTicket} from './application-report-service.mjs'
import {racingCountry} from './foreign-data.mjs'
import {selectedMeetingCoupons} from './selected-meeting-coupons.mjs'
export function meetingCouponShowcase(date,city,options={}){
 const races=readServedProgram(date)?.races||[],rows=selectedMeetingCoupons(races,date,city,applicationTickets(date),options)
 storeApplicationTickets(rows.map(row=>row.ticket).filter(Boolean))
 return {date,city,selectedMeetingCoupons:selectedMeetingCoupons(races,date,city,applicationTickets(date),options)}
}
const slug=v=>String(v).normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
// Prefix dynamic programming: maximise coverage under the fixed budget. Required
// candidates stay in every prefix; never invent an official starting race.
export function buildShowcaseTicket(races,date,ordinal,{now=new Date().toISOString(),weights,required=new Map(),source}={}){
 if(races.length!==6||races.some((r,i)=>r.city!==races[0].city||Number(r.no)!==Number(races[0].no)+i)||!officialStarts(races,6).some(s=>s.ordinal===ordinal&&s.raceNo===Number(races[0].no)))return null
 const scheduledStart=scheduledRaceStart(races[0].scheduledDate||date,races[0].time,{calendarDate:Boolean(races[0].scheduledDate)})
 if(!scheduledStart||now>=scheduledStart)return null
 const unitPrice=getBudgetUnitPrice(budgetBetTypes.find(b=>b.id==='6li-ganyan'),races[0].city),limit=Math.floor(100/unitPrice)
 let states=new Map([[1,{score:1,legs:[]}]])
 for(const race of races){
  const must=required.get(Number(race.no)),ranked=race.horses.filter(h=>!h.outOfRace&&Number(weights(race,h))>0).sort((a,b)=>Number(b.name===must)-Number(a.name===must)||weights(race,b)-weights(race,a)||a.no-b.no)
  if(!ranked.length||must&&!ranked.some(h=>h.name===must))return null
  const total=ranked.reduce((n,h)=>n+Number(weights(race,h)),0),next=new Map();let mass=0
  for(let count=1;count<=Math.min(ranked.length,limit);count++){
   mass+=Number(weights(race,ranked[count-1]))/total
   for(const [n,state]of states){const combos=n*count,score=state.score*mass;if(combos>limit)continue
    if(!next.has(combos)||next.get(combos).score<score)next.set(combos,{score,legs:[...state.legs,{raceNo:Number(race.no),horses:ranked.slice(0,count).map(h=>({number:Number(h.no),name:h.name,isSurprise:h.name===must})),estimatedCoverage:mass}]})
   }
  }states=next
 }
 const [combinations,best]=[...states].sort((a,b)=>b[1].score-a[1].score||a[0]-b[0])[0]||[];if(!best)return null
 const signature=createHash('sha256').update(JSON.stringify(best.legs)).digest('hex').slice(0,12)
 return {date,city:races[0].city,ordinal,legCount:6,startRaceNo:Number(races[0].no),officialVerified:true,scheduledStart,capturedAt:now,budget:100,unitPrice,combinations,cost:Math.round(combinations*unitPrice*100)/100,remaining:Math.round((100-combinations*unitPrice)*100)/100,multiples:1,estimatedChance:source==='ai_surprise'?best.score:null,legs:best.legs,source,sourceLabel:source==='ai_surprise'?'Gerekçeli sürpriz altılı':'Paylaşımlardan oluşturulan sosyal altılı',algorithm:`showcase-${source}-v1-${signature}`}
}
export function surpriseShowcase(races,date,record,{now=new Date().toISOString()}={}){
 if(!record?.analysis?.entryFingerprint||record.analysis.entryFingerprint!==analysisEntryFingerprint(races))return []
 const required=new Map(),reasons=new Map()
 for(const race of races){const prediction=record.analysis.races.find(p=>p.city===race.city&&Number(p.raceNo)===Number(race.no)),s=validSurprise(race,prediction);if(s?.reason){required.set(Number(race.no),s.horseName);reasons.set(Number(race.no),s.reason)}}
 return officialStarts(races,6).map(start=>{
  const legs=Array.from({length:6},(_,i)=>races.find(r=>Number(r.no)===start.raceNo+i));if(legs.some(r=>!r)||!legs.some(r=>required.has(Number(r.no)))||!legs.every(r=>r.rankingSource==='local_trained_model'))return null
  const ticket=buildShowcaseTicket(legs,date,start.ordinal,{now,required,source:'ai_surprise',weights:(r,h)=>h.probability})
  return ticket&&record.createdAt<ticket.scheduledStart?{...ticket,surpriseReasons:ticket.legs.filter(l=>required.has(l.raceNo)).map(l=>({raceNo:l.raceNo,horseName:required.get(l.raceNo),reason:reasons.get(l.raceNo)}))}:null
 }).filter(Boolean)
}
export function socialShowcase(races,date,coupons,{now=new Date().toISOString()}={}){
 return officialStarts(races,6).map(start=>{
  const group=coupons.filter(c=>c.ordinal===start.ordinal&&c.startRaceNo===start.raceNo&&!c.closed),votes=new Map(),sources=new Map()
  for(const c of group)for(const source of c.sources){const key=source.platform==='X'?`${new URL(source.url).hostname}:${source.author||new URL(source.url).pathname.split('/')[1]}`:new URL(source.url).hostname;sources.set(key,source)
   for(const leg of c.legs)for(const h of leg.horses){const vkey=`${leg.raceNo}:${h.number}`;if(!votes.has(vkey))votes.set(vkey,new Set());votes.get(vkey).add(key)}
  }
  const legs=Array.from({length:6},(_,i)=>races.find(r=>Number(r.no)===start.raceNo+i));if(legs.some(r=>!r)||!sources.size)return null
  const ticket=buildShowcaseTicket(legs,date,start.ordinal,{now,source:'social_consensus',weights:(r,h)=>votes.get(`${r.no}:${h.no}`)?.size||0})
  if(!ticket)return null
  return {...ticket,independentSourceCount:sources.size,publicationCount:new Set(group.flatMap(c=>c.sources.map(s=>s.url))).size,sources:[...sources.values()],legs:ticket.legs.map(l=>({...l,horses:l.horses.map(h=>({...h,sourceCount:votes.get(`${l.raceNo}:${h.number}`).size}))}))}
 }).filter(Boolean)
}
const memo=new Map()
export function couponShowcase(date,{now=new Date().toISOString(),collectSocial=true}={}){
 const program=readServedProgram(date),cached=memo.get(date);if(cached&&cached.program===program&&Date.now()-cached.at<60000&&['ticket','fiveTicket','socialTicket','surpriseTicket'].every(k=>!cached.value[k]||cached.value[k].scheduledStart>now))return cached.value
 const all=program?.races||[],surprises=[],social=[]
 for(const city of [...new Set(all.map(r=>r.city))]){
  const races=all.filter(r=>r.city===city);surprises.push(...surpriseShowcase(races,date,findDailyAiAnalysis(date,city),{now}))
  // Existing public collectors cache for five minutes. Start only eligible
  // domestic meetings in the background; the showcase reads archived records.
  if(collectSocial&&!racingCountry(city)&&officialStarts(races,6).some(s=>{const r=races.find(r=>Number(r.no)===s.raceNo);return scheduledRaceStart(r.scheduledDate||date,r.time,{calendarDate:Boolean(r.scheduledDate)})>now}))void getSocialCoupons(date,city,races).catch(()=>{})
  try{const records=JSON.parse(readFileSync(`data/social-coupons/${date}-${slug(city)}.json`,'utf8')).records||[];social.push(...socialShowcase(races,date,aggregateSocialCoupons(records,races,date,city,{now}).coupons,{now}))}catch{}
 }
 // Frozen pre-start surprise recommendations are measured with the same official
 // result machinery; social selections are not counted as model performance.
 for(const t of surprises){t.resultCsvUrl=(program.providerUrls||[]).find(u=>decodeURIComponent(u).endsWith(`${t.city}-GunlukYarisProgrami-TR.csv`))?.replaceAll('GunlukYarisProgrami','GunlukYarisSonuclari')||null}
 const frozen=applicationTickets(date).filter(t=>t.date===date&&t.source==='ai_surprise'),keys=new Set(frozen.map(t=>`${t.city}:${t.ordinal}`))
 storeApplicationTickets(surprises.filter(t=>!keys.has(`${t.city}:${t.ordinal}`)))
 const current=applicationTickets(date).filter(t=>t.date===date&&t.source==='ai_surprise'&&t.scheduledStart>now&&surprises.some(s=>s.city===t.city&&s.ordinal===t.ordinal&&JSON.stringify(s.legs.map(l=>l.horses.map(h=>h.number)))===JSON.stringify(t.legs.map(l=>l.horses.map(h=>h.number)))))
 const best=dailyApplicationTicket(date),upcoming=n=>best.alternatives.filter(t=>t.legCount===n&&t.scheduledStart>now).sort((a,b)=>b.estimatedChance-a.estimatedChance||a.cost-b.cost)[0]||null
 const value={date,budget:100,ticket:upcoming(6),fiveTicket:upcoming(5),surpriseTicket:current.sort((a,b)=>b.estimatedChance-a.estimatedChance||a.cost-b.cost)[0]||null,socialTicket:social.sort((a,b)=>b.independentSourceCount-a.independentSourceCount||b.publicationCount-a.publicationCount||a.cost-b.cost)[0]||null,note:'Yalnız başlamamış resmî oyunlar. Hesaplanan kapsam gerçek kazanma olasılığı değildir. Sosyal seçimler erişilen paylaşımlara dayanır; gerçek oynanma adedi bilinmez.'}
 if(memo.size>3)memo.clear();memo.set(date,{at:Date.now(),value,program});return value
}
