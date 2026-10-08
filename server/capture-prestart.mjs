import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {marketBenchmark,usableWeather} from './temporal-evidence.mjs'
import {attachRaceForecasts} from './race-forecast.mjs'
import {racingCountry} from './foreign-data.mjs'
export async function captureModelMetadata(race){
  const country=racingCountry(race.city)||'TR'
  try{
    let metadata
    try{
      const pointer=JSON.parse(await readFile(`data/daily-models/active-${country}.json`,'utf8'))
      const report=JSON.parse(await readFile(pointer.reportPath,'utf8'))
      if(report.enabled)metadata=report
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
  await mkdir(output,{recursive:true})
  const file=join(output,`${capturedAt.replaceAll(':','-')}.json`)
  await writeFile(file,JSON.stringify({capturedAt,records,paidAiRequested:false,scope:'Pre-start evidence only; market is a benchmark, never an input'},null,2),{flag:'wx'})
  return {file,records:records.length,marketBenchmarks:records.filter(r=>r.market).length,weather:records.filter(r=>r.weatherUsable).length}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await capturePrestart({output:process.argv[2]||'data/external/prestart'})))
