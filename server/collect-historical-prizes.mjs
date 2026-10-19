import {horseIdentity} from './data-quality.mjs'
import './runtime-env.mjs'
import {DatabaseSync} from 'node:sqlite'
import {mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {parseRacePrizes} from './race-prizes.mjs'
import {racingCountry} from './foreign-data.mjs'
import {selectPrizeMeetings} from './prize-meeting-selection.mjs'
import {localDay,shiftDay} from './maintenance-policy.mjs'
const directory='data/external/race-prizes',db=new DatabaseSync('data/horseride.sqlite',{readOnly:true}),templates=new Map()
const path=directory+'/records.json',registry=JSON.parse(readFileSync(path,'utf8'))
const wanted=new Set((process.env.PRIZE_COUNTRIES||'TR,US,GB,FR,ZA,AU').split(',')),perPeriod=Number(process.env.PRIZE_MEETINGS_PER_PERIOD||3)
const periods=new Set((process.env.PRIZE_PERIODS||'train,validation').split(',')),spreadMonths=process.env.PRIZE_SPREAD_MONTHS==='1'
if([...periods].some(p=>!['train','validation'].includes(p)))throw Error('Invalid prize collection periods')
if([...wanted].some(c=>!['TR','US','GB','FR','ZA','AU'].includes(c))||!Number.isInteger(perPeriod)||perPeriod<1||perPeriod>20)throw Error('Invalid bounded prize collection scope')
for(const r of db.prepare("SELECT date,city,provider_url FROM source_snapshots WHERE source='tjk_csv' AND provider_url LIKE '%GunlukYarisProgrami%' ORDER BY fetched_at DESC").iterate())if(!templates.has(r.city))templates.set(r.city,r)
const meetings=new Map()
const through=process.env.PRIZE_THROUGH_DATE||shiftDay(localDay(),-1),samplingSplit=process.env.PRIZE_SAMPLING_SPLIT||shiftDay(through,-26)
if(!/^\d{4}-\d{2}-\d{2}$/.test(through)||through>=localDay())throw Error('Historical prizes require a prior day cutoff')
// These periods control collection sampling only; chronological model splits are independent.
for(const r of db.prepare('SELECT date,race_json FROM historical_race_data WHERE date <= ? ORDER BY date DESC').iterate(through)){const race=JSON.parse(r.race_json),c=racingCountry(race.city)||'TR';if(!wanted.has(c)||!templates.has(race.city)||registry.records[JSON.stringify([r.date,race.city,Number(race.no)])])continue;const key=r.date+':'+race.city;if(!meetings.has(key))meetings.set(key,{date:r.date,city:race.city,country:c,period:r.date<=samplingSplit?'train':'validation'})}
db.close()
const selected=selectPrizeMeetings([...meetings.values()].filter(r=>periods.has(r.period)),{perPeriod,spreadMonths})
mkdirSync(directory+'/historical-csv',{recursive:true})
const report={startedAt:new Date().toISOString(),countries:[...wanted],periods:[...periods],spreadMonths,perPeriod,selected:selected.length,completed:[],failures:[],registryBefore:Object.keys(registry.records).length};let consecutiveFailures=0
for(const r of selected){
 const t=templates.get(r.city),display=r.date.split('-').reverse().join('.'),oldDisplay=t.date.split('-').reverse().join('.'),url=t.provider_url.replaceAll(t.date,r.date).replaceAll(oldDisplay,display).replace('/TJKPDF/'+t.date.slice(0,4)+'/', '/TJKPDF/'+r.date.slice(0,4)+'/')
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('HTTP '+response.status)
  const text=(await response.text()).replace(/^\uFEFF/,'');const header=text.split(/\r?\n/)[0];if(!header.includes(display.replaceAll('.','/')))throw Error('CSV meeting date mismatch');if(horseIdentity(header.split(';')[0])!==horseIdentity(r.city))throw Error('CSV meeting city mismatch');if(/<html/i.test(text))throw Error('Unexpected HTML')
  let raceNo=null,added=0,parsed=0;for(const line of text.split(/\r?\n/)){const cells=line.split(';'),m=cells[0].match(/^(\d+)\.\s*Ko[sş]u\b/i);if(m){raceNo=Number(m[1]);continue}if(!raceNo||!/^1\.\)/.test(cells[0]))continue;const prizes=parseRacePrizes(cells);if(!prizes.length)continue;parsed++;const key=JSON.stringify([r.date,r.city,raceNo]);if(!registry.records[key]){registry.records[key]={source:'official_tjk_csv',sourceUrl:url,fetchedAt:new Date().toISOString(),prizes};added++}}
  if(!parsed)throw Error('No prize records parsed')
  const id=createHash('sha256').update(url).digest('hex').slice(0,16);writeFileSync(directory+'/historical-csv/'+id+'.csv',text);report.completed.push({...r,added,sourceUrl:url});consecutiveFailures=0;console.log(JSON.stringify(report.completed.at(-1)))
 }catch(e){report.failures.push({...r,sourceUrl:url,error:e.message});consecutiveFailures++;console.log(JSON.stringify(report.failures.at(-1)))}
 writeFileSync(directory+'/historical-collection-report.json',JSON.stringify({...report,registryAfter:Object.keys(registry.records).length},null,2))
 if(consecutiveFailures>=4){report.stoppedReason='four_consecutive_unavailable_official_archive_sources';break}
}
// Merge with the latest registry so independent maintenance additions are retained.
const latest=JSON.parse(readFileSync(path,'utf8'));latest.records={...registry.records,...latest.records};latest.collectedAt=new Date().toISOString();writeFileSync(path+'.tmp',JSON.stringify(latest));renameSync(path+'.tmp',path)
report.finishedAt=new Date().toISOString();report.registryAfter=Object.keys(latest.records).length;writeFileSync(directory+'/historical-collection-report.json',JSON.stringify(report,null,2))
