import {marketBlendShadow} from './market-blend-shadow.mjs'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {remoteDeployment} from './deployment-role.mjs'
import {join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {marketBenchmark,usableWeather} from './temporal-evidence.mjs'
import {attachRaceForecasts} from './race-forecast.mjs'
import {racingCountry} from './foreign-data.mjs'
import {reportPinnedStudies} from './report-pinned-studies.mjs'
export async function captureModelMetadata(race){
  const country=racingCountry(race.city)||'TR'
  try{
    let metadata
    if(country==='TR')try{const pointer=JSON.parse(await readFile('data/pedigree-models/active-TR.json','utf8'));const report=JSON.parse(await readFile(pointer.reportPath,'utf8'));if(report.enabled&&report.method===race.rankingMethod)metadata=report}catch{}
    try{
      const pointer=JSON.parse(await readFile(`data/daily-models/active-${country}.json`,'utf8'))
      const report=JSON.parse(await readFile(pointer.reportPath,'utf8'))
      if(report.enabled&&report.method===race.rankingMethod)metadata=report
    }catch{}
    metadata??=JSON.parse(await readFile(country==='TR'?'data/ranking-report.json':`data/foreign-models/${country}-report.json`,'utf8'))
    return metadata.method===race.rankingMethod&&(metadata.enabled||metadata.promoted)?{trainedThrough:metadata.trainedThrough,modelVersion:metadata.method,country}:null
  }catch{return null}
}
export async function capturePrestart({output,origin=`http://127.0.0.1:${process.env.PORT||8788}`,request=fetch,now=()=>new Date(),weatherProvider=attachRaceForecasts,metadataProvider=captureModelMetadata}){
  const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(now())
  const url=new URL('/api/races',origin);url.search=new URLSearchParams({date,city:'Tümü'}).toString()
  const response=await request(url,{signal:AbortSignal.timeout(180000)});if(!response.ok)throw Error(`Program HTTP ${response.status}`)
  const program=await response.json(),records=[]
  const races=await weatherProvider(program.races||[],date),capturedAt=now().toISOString()
  for(const race of races){
    const match=String(race.time||'').match(/^(\d{1,2})[.:](\d{2})$/);if(!match||+match[1]>23||+match[2]>59)continue
    let day=race.scheduledDate||date
    if(!race.scheduledDate&&+match[1]<5){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+1);day=d.toISOString().slice(0,10)}
    const start=new Date(`${day}T${match[1].padStart(2,'0')}:${match[2]}:00+03:00`).toISOString()
    if(capturedAt>=start)continue
    const weather=race.weatherForecast
    const metadata=await metadataProvider(race)
    records.push({date,city:race.city,raceNo:race.no,capturedAt,scheduledStart:start,trainedThrough:metadata?.trainedThrough||null,country:metadata?.country||racingCountry(race.city)||'TR',modelVersion:race.rankingMethod||program.model,market:marketBenchmark(race,capturedAt,start),weather:weather||null,weatherUsable:weather?usableWeather({...weather,kind:'live_forecast',hourly:{time:[weather.validHourUTC],temperature_2m:[weather.temperatureC],precipitation:[weather.precipitationMm],wind_speed_10m:[weather.windKmh],relative_humidity_2m:[weather.humidityPercent]}},start):null,race})
  }
  for(const row of records)row.marketBlendShadow=marketBlendShadow(row)
  await mkdir(output,{recursive:true})
  const file=join(output,`${capturedAt.replaceAll(':','-')}.json`)
  await writeFile(file,JSON.stringify({capturedAt,records,paidAiRequested:false,scope:'Pre-start evidence only; market benchmark and separately labeled fixed-half shadow; active prediction unchanged'},null,2),{flag:'wx'})
  return {file,records:records.length,marketBenchmarks:records.filter(r=>r.market).length,weather:records.filter(r=>r.weatherUsable).length}
}
async function captureSocialForCurrentProgram(){
 const {readServedProgram}=await import('./served-program.mjs'),{collectSocialCoupons}=await import('./social-coupons.mjs')
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date()),program=readServedProgram(date)
 const cities=[...new Set((program?.races||[]).filter(r=>!r.foreign&&!racingCountry(r.city)).map(r=>r.city))]
 for(const city of cities){try{const payload=await collectSocialCoupons(date,city,program.races.filter(r=>r.city===city));console.log(JSON.stringify({socialCouponCity:city,verifiedCoupons:payload.coupons.length,excluded:payload.excluded}))}catch(e){console.error('Social coupon capture:',e.message)}}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(remoteDeployment())console.log('Pre-start captures are owned by the home server; local run skipped.')
 else {console.log(JSON.stringify(await capturePrestart({output:process.argv[2]||'data/external/prestart'})));try{console.log(JSON.stringify({pinnedStudies:await reportPinnedStudies()}))}catch(error){console.error('Pinned study report:',error.message)}const {captureApplicationTickets,settleApplicationPayouts}=await import('./application-report-service.mjs');console.log(JSON.stringify({applicationTickets:await captureApplicationTickets(),payouts:await settleApplicationPayouts()}));await captureSocialForCurrentProgram();await import('./capture-coupon-benchmarks.mjs');await import('./audit-coupon-benchmarks.mjs');const {captureSimulation}=await import('./simulation-service.mjs');const {retrySqliteBusy}=await import('./sqlite-retry.mjs');console.log(JSON.stringify({simulation:await retrySqliteBusy(()=>captureSimulation())}))}
}
