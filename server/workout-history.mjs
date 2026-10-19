import {horseIdentity} from './data-quality.mjs'
import {horseIdentityV2} from './racing-identity.mjs'
export function summarizeWorkoutHistory(tables,horseName,targetDate,{identityVersion=1}={}){
  const identify=identityVersion===2?horseIdentityV2:horseIdentity
  const normalize=value=>horseIdentity(value).toLowerCase()
  const workouts=[]
  for(const table of tables){
    const headers=table.headers.map(normalize)
    const index=labels=>headers.findIndex(h=>labels.some(label=>h===normalize(label)))
    const date=index(['İdman Tarihi','İ. Tarihi','İ.Tarihi','Tarih']),name=index(['At Adı','At İsmi','At'])
    if(date<0||name<0)continue
    for(const row of table.rows){
      if(identify(row[name])!==identify(horseName))continue
      const m=String(row[date]||'').match(/(\d{2})[./-](\d{2})[./-](\d{4})/)
      const dateISO=m?`${m[3]}-${m[2]}-${m[1]}`:null
      if(!dateISO||dateISO>=targetDate)continue
      const read=labels=>row[index(labels)]||null
      const splits=Object.fromEntries(table.headers.map((h,i)=>{const m=h.trim().match(/^(\d{3,4})\s*m?$/i);return m&&row[i]?[m[1],row[i]]:null}).filter(Boolean))
      workouts.push({horseName,date:row[date],dateISO,splits,surface:read(['Pist']),type:read(['İ. Türü','İdman Türü']),hippodrome:read(['İdman Hipodromu','İ. Hip.','Hipodrom','Şehir']),source:'tjk_horse_workout_history'})
    }
  }
  return workouts.sort((a,b)=>b.dateISO.localeCompare(a.dateISO)).slice(0,20)
}
