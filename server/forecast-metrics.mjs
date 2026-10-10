import {horseIdentity} from './data-quality.mjs'
import {racingCountry} from './foreign-data.mjs'
export function summarizeForecasts(snapshots,outcomes,extendedActive=false,country='TR',activeMethod=null){
  // Official outcome collection and the learned model currently cover Turkey.
  const domestic=new Set(['İstanbul','Ankara','İzmir','Bursa','Adana','Kocaeli','Antalya','Diyarbakır','Elazığ','Şanlıurfa'].map(horseIdentity))
  snapshots=snapshots.filter(row=>country==='TR'?domestic.has(horseIdentity(row.city)):racingCountry(row.city)===country)
  const latest=new Map(),groups=new Map()
  const category=row=>`${row.source}:${/country_US|performance_US/.test(String(row.model_version||''))?'foreign_learned':/performance_TR/.test(String(row.model_version||''))?'expanded':String(row.model_version||'').includes('workout_weather')?'extended':'previous'}`
  for(const row of snapshots)latest.set(`${row.date}:${row.city}:${row.race_no}:${category(row)}`,row)
  if(country==='TR')for(const source of ['daily_ai','numeric'])groups.set(`${source}:${/performance_TR/.test(activeMethod||'')?'expanded':extendedActive?'extended':'previous'}`,{source,extended:extendedActive})
  for(const row of latest.values())groups.set(category(row),{source:row.source,extended:/:extended$|:expanded$/.test(category(row))})
  return [...groups.entries()].map(([key,{source,extended}])=>{
    const summary={source,key:country==='TR'?key:`${country}:${key}`,country,label:country!=='TR'?`${country==='US'?'ABD':country} · ${source==='daily_ai'?`Günlük AI${key.endsWith('foreign_learned')?' · öğrenen sıralama':''}`:key.endsWith('foreign_learned')?'öğrenen model':extended?'önceki genel model':'temel model'}`:source==='daily_ai'?`Günlük AI${extended?' · idman/hava destekli':''}`:`${extended?'İdman/hava destekli model':'Önceki sayısal model'}`,recorded:0,evaluated:0,topOneHits:0,winnerInTopFour:0}
    if(source==='shadow_performance')summary.label='Hız ve sınıf denemesi · kuponlara uygulanmaz'
    if(source==='shadow_data')summary.label=`${country==='US'?'ABD tempo':'Geniş geçmiş'} denemesi · kuponlara uygulanmaz`
    if(source==='shadow_daily')summary.label='Günlük yeniden eğitim denemesi · kuponlara uygulanmaz'
    if(country==='TR'&&source==='numeric'&&key.endsWith(':expanded'))summary.label='Geniş geçmiş · hız, pist ve sınıf modeli'
    for(const forecast of latest.values()){
      if(category(forecast)!==key)continue
      summary.recorded++
      const result=outcomes.get(`${forecast.date}:${forecast.city}:${forecast.race_no}`)
      if(!result||!forecast.picks.every(p=>result.has(horseIdentity(p.horseName))))continue
      summary.evaluated++
      if(result.get(horseIdentity(forecast.picks[0]?.horseName))===1)summary.topOneHits++
      if(forecast.picks.slice(0,4).some(p=>result.get(horseIdentity(p.horseName))===1))summary.winnerInTopFour++
    }
    return {...summary,topOneRate:summary.evaluated?Number((summary.topOneHits/summary.evaluated*100).toFixed(1)):null,topFourRate:summary.evaluated?Number((summary.winnerInTopFour/summary.evaluated*100).toFixed(1)):null}
  })
}
