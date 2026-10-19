import {usableWeather} from './temporal-evidence.mjs'
import {forecastLocation} from './race-forecast.mjs'
import {readdir,readFile} from 'node:fs/promises'
export const prestartWeatherKey=(date,city,no)=>JSON.stringify([date,city,Number(no)])
export async function loadArchivedForecasts(directory='data/external/forecasts'){
 const result={byCity:new Map(),from:null,files:0,invalidFiles:0}
 let names;try{names=await readdir(directory)}catch(e){if(e.code==='ENOENT')return result;throw e}
 for(const name of names.filter(n=>n.endsWith('.json')&&!n.startsWith('latest-'))){
  try{const snapshot=JSON.parse(await readFile(`${directory}/${name}`,'utf8')),time=Date.parse(snapshot.collectedAt)
   if(typeof snapshot.city!=='string'||!Number.isFinite(time)||!Array.isArray(snapshot.hourly?.time))throw Error('Malformed forecast snapshot')
   const day=new Date(time).toISOString().slice(0,10);if(!result.from||day<result.from)result.from=day
   if(!result.byCity.has(snapshot.city))result.byCity.set(snapshot.city,[])
   result.byCity.get(snapshot.city).push({...snapshot,sourceArchivePath:`${directory}/${name}`});result.files++
  }catch{result.invalidFiles++}
 }
 return result
}
export function archivedWeatherForDecision(race,decision,snapshots){
 if(!decision||decision.city!==race.city||Number(decision.raceNo)!==Number(race.no))return null
 const cutoff=Date.parse(decision.capturedAt),start=Date.parse(decision.scheduledStart),town=forecastLocation(race.city)
 if(!town||!Number.isFinite(cutoff)||!Number.isFinite(start)||cutoff>=start)return null
 const choices=snapshots.filter(snapshot=>{
  if(snapshot.city!==race.city||snapshot.location?.country!==town.country)return false
  const available=Date.parse(snapshot.collectedAt)
  if(!Number.isFinite(available)||available>cutoff||cutoff-available>6*3600000)return false
  if(snapshot.kind&&snapshot.kind!=='live_forecast')return false
  try{const url=new URL(snapshot.sourceUrl);return url.protocol==='https:'&&url.hostname==='api.open-meteo.com'&&url.pathname==='/v1/forecast'&&url.searchParams.get('timezone')==='UTC'}catch{return false}
 }).sort((a,b)=>Date.parse(b.collectedAt)-Date.parse(a.collectedAt))
 for(const snapshot of choices){
  const weather=usableWeather({...snapshot,kind:'live_forecast'},decision.scheduledStart)
  if(!weather||[weather.temperatureC,weather.precipitationMm,weather.windKmh,weather.humidity].every(v=>v==null))continue
  return {availability:'archived_prestart_forecast',provider:'Open-Meteo',date:race.date,decisionCapturedAt:decision.capturedAt,scheduledStart:decision.scheduledStart,availableAt:weather.availableAt,validHourUTC:weather.validHourUTC,temperatureC:weather.temperatureC,humidityPercent:weather.humidity,precipitationMm:weather.precipitationMm,windKmh:weather.windKmh,location:snapshot.location,sourceUrl:snapshot.sourceUrl,sourceArchivePath:snapshot.sourceArchivePath||null,numericModelUsed:false}
 }
 return null
}
