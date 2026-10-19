import {load} from 'cheerio'
import {createHash} from 'node:crypto'
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises'
import {horseIdentity} from './data-quality.mjs'
import {scheduledRaceStart} from './database.mjs'
import {getBudgetUnitPrice,budgetBetTypes} from '../src/data/ticketData.js'
import {parseSixLegCsv,officialSixLegCsvUrl} from './six-leg-starts.mjs'
import {readServedProgram} from './served-program.mjs'
import {collectXListSources} from './x-social-source.mjs'

const cache=new Map(),pending=new Map(),ttl=5*60_000
const slug=v=>String(v).normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
const safeUrl=(v,host)=>{try{const u=new URL(v);return u.protocol==='https:'&&u.hostname===host?u.href:null}catch{return null}}
export function sixLegStarts(races){return races.filter(r=>r.sixLegStarts?.length).flatMap(r=>r.sixLegStarts.map(ordinal=>({ordinal:Number(ordinal),raceNo:Number(r.no)}))).sort((a,b)=>a.ordinal-b.ordinal)}
export function parseCouponTemplates(text){
 const coupons=[]
 const heading=/\b([12])\s*\.\s*(?:ALTILI|6\s*['’]?\s*LI)\s+GANYAN\s*(?:TAHMINI|SABLONUM|KUPONU|TAHMINLERI)?/gi
 const normalized=String(text).normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').toUpperCase().replace(/\s+/g,' ').replace(/([1-6])\s*\.\s*AYAK/g,m=>`\n${m}`)
 const matches=[...normalized.matchAll(heading)]
 for(let i=0;i<matches.length;i++){
  const match=matches[i],body=normalized.slice(match.index+match[0].length,matches[i+1]?.index??normalized.length)
  const legs=[...body.matchAll(/([1-6])\s*\.\s*AYAK[ \t]*:?[ \t]*([\d \t,\-–/]+)(?=[^\d \t,\-–/]|$)/g)]
  if(legs.length<6)continue
  const six=legs.slice(0,6)
  if(six.some((m,j)=>Number(m[1])!==j+1))continue
  const selections=six.map(m=>[...new Set((m[2].match(/\d+/g)||[]).map(Number))].sort((a,b)=>a-b))
  if(selections.some(a=>!a.length||a.some(n=>n<1||n>99)))continue
  coupons.push({ordinal:Number(match[1]),selections})
 }
 return coupons
}
export function couponText($,node){
 const clone=node.clone();clone.find('br').replaceWith('\n')
 clone.find('h1,h2,h3,h4,h5,p,div,li,section,article').each((_,element)=>{$(element).prepend('\n');$(element).append('\n')})
 return clone.text()
}
export function aggregateSocialCoupons(records,races,date,city,{now=new Date().toISOString()}={}){
 const starts=sixLegStarts(races),byRace=new Map(races.map(r=>[Number(r.no),r])),groups=new Map(),excluded={afterStart:0,invalid:0,unmapped:0}
 for(const record of records){
  if(record.date!==date||horseIdentity(record.city)!==horseIdentity(city)){excluded.invalid++;continue}
  const mapped=starts.find(s=>s.ordinal===record.ordinal)
  if(!mapped){excluded.unmapped++;continue}
  const six=Array.from({length:6},(_,i)=>byRace.get(mapped.raceNo+i))
  const first=six[0],start=first&&scheduledRaceStart(first.scheduledDate||date,first.time,{calendarDate:Boolean(first.scheduledDate)})
  const observed=Date.parse(record.observedAt),published=record.publishedAt&&Date.parse(record.publishedAt),modified=record.modifiedAt&&Date.parse(record.modifiedAt)
  if(!start||!Number.isFinite(observed)||observed>=Date.parse(start)||(record.publishedAt&&(!Number.isFinite(published)||published>=Date.parse(start)))||(record.modifiedAt&&(!Number.isFinite(modified)||modified>=Date.parse(start)))){excluded.afterStart++;continue}
  if(six.some(r=>!r)||record.selections?.length!==6||record.selections.some((a,i)=>!a.length||a.some(n=>!six[i].horses.some(h=>Number(h.no)===n&&!h.outOfRace)))){excluded.invalid++;continue}
  const selections=record.selections.map(a=>[...new Set(a)].sort((a,b)=>a-b)),key=`${mapped.raceNo}:${JSON.stringify(selections)}`
  if(!groups.has(key))groups.set(key,{id:createHash('sha256').update(`${date}:${city}:${key}`).digest('hex').slice(0,16),ordinal:record.ordinal,startRaceNo:mapped.raceNo,selections,sources:new Map(),independentSources:new Set(),latestObservedAt:record.observedAt})
  const group=groups.get(key),url=safeUrl(record.url,record.host)
  if(!url)continue
  group.sources.set(url,{name:record.sourceName,author:record.author||null,url,publishedAt:record.publishedAt||null,observedAt:record.observedAt,platform:record.platform,engagement:record.engagement??null})
  group.independentSources.add(record.platform==='X'?`${record.host}:${record.author||new URL(record.url).pathname.split('/')[1]}`:record.host)
  if(record.observedAt>group.latestObservedAt)group.latestObservedAt=record.observedAt
 }
 const coupons=[...groups.values()].filter(g=>g.sources.size).map(g=>{
  const combinations=g.selections.reduce((n,a)=>n*a.length,1),unitPrice=getBudgetUnitPrice(budgetBetTypes.find(b=>b.id==='6li-ganyan'),city)
  return {...g,sources:[...g.sources.values()],independentSourceCount:g.independentSources.size,independentSources:undefined,publicationCount:g.sources.size,combinations,unitPrice,cost:Math.round(combinations*unitPrice*100)/100,closed:now>=scheduledRaceStart(date,byRace.get(g.startRaceNo).time),legs:g.selections.map((a,i)=>({raceNo:g.startRaceNo+i,horses:a.map(no=>({number:no,name:byRace.get(g.startRaceNo+i).horses.find(h=>Number(h.no)===no).name}))}))}
 }).sort((a,b)=>b.independentSourceCount-a.independentSourceCount||b.publicationCount-a.publicationCount||a.id.localeCompare(b.id))
 return {date,city,coupons,excluded,scope:'Takip edilen açık kaynaklar',rankingLabel:coupons[0]?.independentSourceCount>1?'Takip edilen kaynaklarda en çok paylaşılan':'Paylaşılan kuponlar · popülerlik için yeterli karşılaştırma yok',budgetIndependent:true,unavailableReason:coupons.length?null:!starts.length?'Resmi altılı başlangıç koşuları henüz doğrulanamadı.':'Yarış başlamadan arşivlenmiş, altı ayağı doğrulanmış kupon bulunamadı.'}
}
export async function collectSocialCoupons(date,city,races,{request=fetch,now=()=>new Date().toISOString()}={}){
 const observations=[],failures=[],sources=[]
 const readPage=async url=>{const response=await request(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'GanyanZekasi/1.20 public-coupon-reader'}});if(!response.ok)throw Error(`HTTP ${response.status}`);return load(await response.text())}
 let officialStarts=sixLegStarts(races)
 if(!officialStarts.length){
  const url=readServedProgram(date)?.providerUrls?.find(v=>{try{const u=new URL(v);return u.hostname==='medya-cdn.tjk.org'&&u.pathname.includes(`/${date}/`)&&slug(decodeURIComponent(u.pathname)).includes(`-${slug(city)}-gunlukyarisprogrami-tr-csv`)}catch{return false}})||(races.length>=6?officialSixLegCsvUrl(date,city):null)
  if(url)try{const r=await request(url,{signal:AbortSignal.timeout(10000)});if(r.ok)officialStarts=parseSixLegCsv(await r.text())}catch(e){failures.push({source:'Resmi program',error:e.message})}
 }
 const withStarts=races.map(r=>({...r,sixLegStarts:officialStarts.filter(s=>s.raceNo===Number(r.no)).map(s=>s.ordinal)}))
 try{
  const url=`https://bayganyan.com/at-yarisi-tahminleri/${date}/${slug(city)}`,$=await readPage(url),heading=$('h1').first().text()
  const expected=new Date(`${date}T12:00:00Z`).toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})
  if(!horseIdentity(heading).includes(horseIdentity(city))||!horseIdentity(heading).includes(horseIdentity(expected)))throw Error('Tarih veya şehir eşleşmedi')
  const scope=$('main').length?$('main'):$('body'),text=couponText($,scope)
  const publishedAt=$('meta[property="article:published_time"]').attr('content')||null,modifiedAt=$('meta[property="article:modified_time"]').attr('content')||null
  for(const coupon of parseCouponTemplates(text))observations.push({...coupon,date,city,url,host:'bayganyan.com',sourceName:'BayGanyan',platform:'public_web',observedAt:now(),publishedAt,modifiedAt})
  sources.push({name:'BayGanyan',url,status:'checked'})
 }catch(e){failures.push({source:'BayGanyan',error:e.message})}
 try{
  const home=await readPage('https://www.bankotahminler.com/'),links=[...new Set(home('a[href]').toArray().map(e=>home(e).attr('href')).filter(v=>safeUrl(v,'www.bankotahminler.com')&&v.includes('/tahminler/')&&horseIdentity(v).includes(horseIdentity(city))&&v.includes(`${Number(date.slice(8))}-`)))].slice(0,6)
  for(const url of links){try{
   const $=await readPage(url),title=$('h1').first().text(),expected=new Date(`${date}T12:00:00Z`).toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})
   if(!horseIdentity(title).includes(horseIdentity(expected))||!horseIdentity(title).includes(horseIdentity(city)))continue
   const node=$('.post-content, .entry-content').first(),publishedAt=$('meta[property="article:published_time"]').attr('content')||$('time[datetime]').first().attr('datetime')||null,modifiedAt=$('meta[property="article:modified_time"]').attr('content')||null
   for(const coupon of parseCouponTemplates(couponText($,node)))observations.push({...coupon,date,city,url,host:'www.bankotahminler.com',sourceName:'Banko Tahminler',author:$('[rel="author"]').first().text().trim()||null,platform:'community_web',observedAt:now(),publishedAt,modifiedAt})
   sources.push({name:'Banko Tahminler',url,status:'checked'})
  }catch(e){failures.push({source:'Banko Tahminler',error:e.message})}}
 }catch(e){failures.push({source:'Banko Tahminler',error:e.message})}
 const configuration=JSON.parse(await readFile(new URL('./social-sources.json',import.meta.url),'utf8'))
 const x=await collectXListSources(configuration.xLists||[],date,city,parseCouponTemplates,{enabled:configuration.xApiEnabled===true&&process.env.X_SOCIAL_API_ENABLED==='1'})
 observations.push(...x.observations);sources.push(...x.sources);failures.push(...x.failures)
 const path=`data/social-coupons/${date}-${slug(city)}.json`;await mkdir('data/social-coupons',{recursive:true})
 let previous=[];try{previous=JSON.parse(await readFile(path,'utf8')).records||[]}catch{}
 const dedup=new Map();for(const record of [...previous,...observations]){const key=JSON.stringify([record.url,record.ordinal,record.selections]);if(!dedup.has(key))dedup.set(key,record)}
 const records=[...dedup.values()],payload={...aggregateSocialCoupons(records,withStarts,date,city),officialStarts,fetchedAt:now(),sources,failures,connections:[{platform:'X',status:'not_connected'},{platform:'Telegram',status:'not_connected'}]}
 await writeFile(`${path}.${process.pid}.tmp`,JSON.stringify({records,payload},null,2));await rename(`${path}.${process.pid}.tmp`,path)
 cache.set(`${date}:${city}`,payload);return payload
}
export async function getSocialCoupons(date,city,races){
 const configured=JSON.parse(await readFile(new URL('./social-sources.json',import.meta.url),'utf8'))
 const connections=[...(configured.xLists||[]).map(list=>({platform:'X',...list})),{platform:'Telegram',status:'not_connected'}]
 const key=`${date}:${city}`
 if(!cache.has(key)){try{const saved=JSON.parse(await readFile(`data/social-coupons/${date}-${slug(city)}.json`,'utf8')),mapped=races.map(r=>({...r,sixLegStarts:(saved.payload.officialStarts||[]).filter(s=>s.raceNo===Number(r.no)).map(s=>s.ordinal)}));cache.set(key,{...saved.payload,...aggregateSocialCoupons(saved.records,mapped,date,city)})}catch{}}
 const saved=cache.get(key)
 if((!saved||Date.now()-Date.parse(saved.fetchedAt)>ttl)&&!pending.has(key)){
  const job=collectSocialCoupons(date,city,races).catch(error=>{cache.set(key,{...aggregateSocialCoupons([],races,date,city),fetchedAt:new Date().toISOString(),error:error.message})}).finally(()=>pending.delete(key));pending.set(key,job)
 }
 return saved?{...saved,connections,refreshing:pending.has(key)}:{...aggregateSocialCoupons([],races,date,city),connections,refreshing:true}
}
