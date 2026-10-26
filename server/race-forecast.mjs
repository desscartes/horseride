import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {horseIdentity} from './data-quality.mjs'
const domestic=['İstanbul','Ankara','İzmir','Bursa','Adana','Kocaeli','Antalya','Diyarbakır','Elazığ','Şanlıurfa']
const towns=new Map(domestic.map(city=>[city,{name:city,country:'TR'}]))
for(const [city,name,region] of [['Philadelphia ABD','Bensalem','Pennsylvania'],['Horseshoe Indianapolis ABD','Shelbyville','Indiana'],['Finger Lakes ABD','Farmington','New York'],['Gulfstream Park ABD','Hallandale Beach','Florida'],['Keeneland ABD','Lexington','Kentucky'],['Santa Anita Park ABD','Arcadia','California'],['Belmont Park ABD','Elmont','New York'],['Del Mar ABD','Del Mar','California'],['Saratoga ABD','Saratoga Springs','New York']])towns.set(city,{name,region,country:'US'})
for(const [city,name,region,country]of [['Sha Tin Hong Kong','Sha Tin',null,'HK'],['Happy Valley Hong Kong','Hong Kong',null,'HK'],['ParisLongchamp Fransa','Paris',null,'FR'],['Chantilly Fransa','Chantilly',null,'FR'],['Deauville Fransa','Deauville',null,'FR'],['Ascot Birleşik Krallık','Ascot',null,'GB'],['Newmarket Birleşik Krallık','Newmarket',null,'GB'],['Sydney Avustralya','Sydney','New South Wales','AU'],['Melbourne Avustralya','Melbourne','Victoria','AU'],['Turffontein Güney Afrika','Johannesburg',null,'ZA'],['Kenilworth Güney Afrika','Cape Town',null,'ZA']])towns.set(city,{name,region,country})
const cache=new Map()
for(const [city,name,region,country]of [['Marseille Borely Fransa','Marseille',null,'FR'],['Roscommon İrlanda','Roscommon',null,'IE'],['Yarmouth Birleşik Krallık','Great Yarmouth',null,'GB'],['Kempton Park Birleşik Krallık','Sunbury-on-Thames',null,'GB']])towns.set(city,{name,region,country})
for(const [city,name,region,country,addressSource] of [
 ['Fairview Güney Afrika','Port Elizabeth','Eastern Cape','ZA','https://www.4racing.com/venues/fairview/'],
 ['Leopardstown İrlanda','Dublin','Leinster','IE','https://www.leopardstown.com/getmedia/6bc88e5f-ecf3-4372-8f21-353338923721/LRC-NH-O-T-Guide-2024_2025-WEB-141124.pdf'],
 ['Woodbine Kanada','Toronto','Ontario','CA','https://woodbine.com/contact-us/'],
 ['Perak Malezya','Ipoh','Perak','MY','https://www.perakturfclub.my/'],
 ['Mahoning Valley ABD','Austintown','Ohio','US','https://www.hollywoodmahoningvalley.com/visit'],
 ['Gowran Park İrlanda','Gowran','Leinster','IE','https://www.gowranpark.ie/racing/get-in-touch/'],
 ['Wolverhampton Birleşik Krallık','Wolverhampton','England','GB','https://www.wolverhampton-racecourse.co.uk/contact-us'],
 ['ClubHipico Santiago Şili','Santiago',null,'CL','https://www.clubhipico.cl/contacto/']
])towns.set(city,{name,region,country,addressSource})
towns.set('Redcar Birleşik Krallık',{name:'Redcar',country:'GB',addressSource:'https://www.redcarracing.co.uk/contact/'})
towns.set('Leicester Birleşik Krallık',{name:'Oadby',country:'GB',addressSource:'https://www.leicester-racecourse.co.uk/contact-us/'})
towns.set('Longchamp Fransa',towns.get('ParisLongchamp Fransa'))
const normalizedTowns=new Map([...towns].map(([city,town])=>[horseIdentity(city),town]))
export const forecastLocation=city=>normalizedTowns.get(horseIdentity(city))||null
// Both the venue's official address and the returned state/ZIP were verified.
// Census coordinates are an address interpolation, not a surveyed track point.
Object.assign(towns.get('Finger Lakes ABD'),{latitude:42.974376692963,longitude:-77.34322698756,coordinateScope:'official_address_geocode',addressSource:'https://www.fingerlakesgaming.com/contact/',coordinateSource:'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=5857%20State%20Route%2096%2C%20Farmington%2C%20NY%2014425&benchmark=Public_AR_Current&format=json'})
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
 const snapshots=new Map(),failures=[]
 const cities=[...new Set(future.map(r=>r.city))];let next=0
 await Promise.all(Array.from({length:Math.min(3,cities.length)},async()=>{while(next<cities.length){const city=cities[next++];
  const town=forecastLocation(city);if(!town){failures.push({city,reason:'Verified weather location missing'});continue}
  try{
   let snapshot=cache.get(city)
   if(!snapshot)try{snapshot=JSON.parse(await readFile(`data/external/forecasts/latest-${horseIdentity(city)}.json`,'utf8'));if(snapshot.city!==city)snapshot=null}catch{}
   if(!snapshot||Date.now()-new Date(snapshot.collectedAt)>3600000){
    let place
    if(Number.isFinite(town.latitude)&&Number.isFinite(town.longitude))place={name:town.name,country_code:town.country,latitude:town.latitude,longitude:town.longitude}
    else{
     const geoUrl=new URL('https://geocoding-api.open-meteo.com/v1/search');geoUrl.search=new URLSearchParams({name:town.name,count:'100',countryCode:town.country,language:'en'}).toString()
     const geoResponse=await fetch(geoUrl,{signal:AbortSignal.timeout(8000)});if(!geoResponse.ok)throw Error(`Geocoding HTTP ${geoResponse.status}`)
     const places=(await geoResponse.json()).results?.filter(p=>p.country_code===town.country&&horseIdentity(p.name)===horseIdentity(town.name)&&(!town.region||p.admin1===town.region))||[]
     if(places.length!==1){failures.push({city,reason:'Weather location was not uniquely verified'});continue}
     place=places[0]
    }
    const url=new URL('https://api.open-meteo.com/v1/forecast')
    url.search=new URLSearchParams({latitude:String(place.latitude),longitude:String(place.longitude),hourly:'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m',timezone:'UTC',forecast_days:'3'}).toString()
    const response=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error(`Forecast HTTP ${response.status}`)
    const data=await response.json();if(!data.hourly?.time?.length)continue
    snapshot={city,location:{town:place.name,country:place.country_code,latitude:place.latitude,longitude:place.longitude,scope:town.coordinateScope||'town',coordinateSource:town.coordinateSource||null,addressSource:town.addressSource||null},sourceUrl:url.href,collectedAt:new Date().toISOString(),hourly:data.hourly}
    cache.set(city,snapshot);await mkdir('data/external/forecasts',{recursive:true});await writeFile(`data/external/forecasts/${horseIdentity(city)}-${snapshot.collectedAt.replaceAll(':','-')}.json`,JSON.stringify(snapshot))
    await writeFile(`data/external/forecasts/latest-${horseIdentity(city)}.json`,JSON.stringify(snapshot))
   }
   snapshots.set(city,snapshot)
  }catch(error){failures.push({city,reason:error.message});console.error('Regional forecast unavailable:',city,error.message)}
 }}))
 const attached=races.map(r=>({...r,weatherForecast:forecastAtStart(snapshots.get(r.city),r,date)}))
 try{await mkdir('data/maintenance/weather',{recursive:true});await writeFile(`data/maintenance/weather/${date}-${cities.length===1?horseIdentity(cities[0]):'all'}.json`,JSON.stringify({updatedAt:new Date().toISOString(),date,futureRaces:future.length,matchedFutureRaces:attached.filter(r=>r.weatherForecast).length,cities:cities.map(city=>({city,location:forecastLocation(city),matched:attached.filter(r=>r.city===city&&r.weatherForecast).length})),failures,numericModelUsed:false},null,2))}catch(error){console.error('Weather coverage report:',error.message)}
 return attached
}
