import {mkdir,writeFile} from 'node:fs/promises'
import {horseIdentity} from './data-quality.mjs'
const domestic=['İstanbul','Ankara','İzmir','Bursa','Adana','Kocaeli','Antalya','Diyarbakır','Elazığ','Şanlıurfa']
const towns=new Map(domestic.map(city=>[city,{name:city,country:'TR'}]))
for(const [city,name,region] of [['Philadelphia ABD','Bensalem','Pennsylvania'],['Horseshoe Indianapolis ABD','Shelbyville','Indiana'],['Finger Lakes ABD','Farmington','New York'],['Gulfstream Park ABD','Hallandale Beach','Florida']])towns.set(city,{name,region,country:'US'})
const cache=new Map()
export function forecastAtStart(snapshot,race,date,now=new Date()){
 const time=String(race.time||'').match(/^(\d{1,2})[.:](\d{2})$/)
 if(!time||+time[1]>23||+time[2]>59||!snapshot?.collectedAt)return null
 const start=new Date(`${race.scheduledDate||date}T${time[1].padStart(2,'0')}:${time[2]}:00+03:00`)
 const captured=new Date(snapshot.collectedAt)
 if(!Number.isFinite(+start)||!Number.isFinite(+captured)||captured>now||captured>=start||now>=start||now-captured>6*3600000)return null
 const hour=new Date(Math.floor(+start/3600000)*3600000).toISOString().slice(0,16)
 const i=snapshot.hourly?.time?.indexOf(hour);if(i==null||i<0)return null
 const read=key=>{const v=snapshot.hourly[key]?.[i];return typeof v==='number'&&Number.isFinite(v)?v:null}
 return {provider:'Open-Meteo',locationScope:'hipodromun bulunduğu yerleşim için bölgesel tahmin; resmi pist durumu değildir',location:snapshot.location,collectedAt:snapshot.collectedAt,validHourUTC:hour,temperatureC:read('temperature_2m'),humidityPercent:read('relative_humidity_2m'),rainProbabilityPercent:read('precipitation_probability'),precipitationMm:read('precipitation'),windKmh:read('wind_speed_10m'),windDirectionDegrees:read('wind_direction_10m'),sourceUrl:snapshot.sourceUrl,numericModelUsed:false}
}
export async function attachRaceForecasts(races,date){
 const future=races.filter(r=>{const t=String(r.time||'').replace('.',':');const start=new Date(`${r.scheduledDate||date}T${t}:00+03:00`);return Number.isFinite(+start)&&start>Date.now()&&start-Date.now()<3*86400000})
 if(!future.length)return races
 const snapshots=new Map()
 for(const city of new Set(future.map(r=>r.city))){
  const town=towns.get(city);if(!town)continue
  try{
   let snapshot=cache.get(city)
   if(!snapshot||Date.now()-new Date(snapshot.collectedAt)>3600000){
    const geoUrl=new URL('https://geocoding-api.open-meteo.com/v1/search');geoUrl.search=new URLSearchParams({name:town.name,count:'10',countryCode:town.country,language:'en'}).toString()
    const geoResponse=await fetch(geoUrl,{signal:AbortSignal.timeout(8000)});if(!geoResponse.ok)throw Error(`Geocoding HTTP ${geoResponse.status}`)
    const places=(await geoResponse.json()).results?.filter(p=>p.country_code===town.country&&horseIdentity(p.name)===horseIdentity(town.name)&&(!town.region||p.admin1===town.region))||[]
    if(places.length!==1)continue
    const place=places[0],url=new URL('https://api.open-meteo.com/v1/forecast')
    url.search=new URLSearchParams({latitude:String(place.latitude),longitude:String(place.longitude),hourly:'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m',timezone:'UTC',forecast_days:'3'}).toString()
    const response=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error(`Forecast HTTP ${response.status}`)
    const data=await response.json();if(!data.hourly?.time?.length)continue
    snapshot={location:{town:place.name,country:place.country_code,latitude:place.latitude,longitude:place.longitude,scope:'town'},sourceUrl:url.href,collectedAt:new Date().toISOString(),hourly:data.hourly}
    cache.set(city,snapshot);await mkdir('data/external/forecasts',{recursive:true});await writeFile(`data/external/forecasts/${horseIdentity(city)}-${snapshot.collectedAt.replaceAll(':','-')}.json`,JSON.stringify(snapshot))
   }
   snapshots.set(city,snapshot)
  }catch(error){console.error('Regional forecast unavailable:',city,error.message)}
 }
 return races.map(r=>({...r,weatherForecast:forecastAtStart(snapshots.get(r.city),r,date)}))
}
