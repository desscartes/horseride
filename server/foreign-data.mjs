import {horseIdentity,parseWeight} from './data-quality.mjs'
import {raceEnvironment} from './environment-features.mjs'

export function racingCountry(city) {
  const name=horseIdentity(city)
  for(const [suffix,country] of [['BIRLESIKARAPEMIRLIKLERI','AE'],['BIRLESIKKRALLIK','GB'],['GUNEYAFRIKA','ZA'],['HONGKONG','HK'],['AVUSTRALYA','AU'],['MALEZYA','MY'],['FRANSA','FR'],['IRLANDA','IE'],['KANADA','CA'],['ARJANTIN','AR'],['SILI','CL'],['DUBAI','AE'],['ABD','US']]) if(name.endsWith(suffix))return country
  return null
}

export function scheduledMeetingDates(races,date){
  const dates=new Map(),meetings=new Map()
  for(const race of races){if(!meetings.has(race.city))meetings.set(race.city,[]);meetings.get(race.city).push(race)}
  for(const meeting of meetings.values()){
    let previous=-1,offset=0
    for(const race of [...meeting].sort((a,b)=>a.no-b.no)){
      const match=String(race.time||'').match(/^(\d{1,2})[.:](\d{2})$/)
      if(!match||Number(match[1])>23||Number(match[2])>59)continue
      const minute=Number(match[1])*60+Number(match[2])
      if(previous<0&&minute<5*60&&racingCountry(race.city))offset=1
      if(previous>=0&&minute<previous&&previous>=18*60&&minute<=6*60)offset++
      dates.set(race,new Date(new Date(`${date}T12:00:00Z`).getTime()+offset*86400000).toISOString().slice(0,10));previous=minute
    }
  }
  return races.map(race=>({...race,scheduledDate:dates.get(race)||date}))
}

export const foreignHorseIdentity=name=>horseIdentity(String(name||'').replace(/\s*\((?:USA|GB|IRE|FR|GER|AUS|NZ|SAF|JPN|CAN|ARG|BRZ|CHI)\)/gi,'').replace(/(?:\s+(?:KG|DB|SKG|SK|K|OG|GKR|YP))+$/g,''))

export const externalFeatureNames=['externalChartStarts','externalFrontRunning','externalTripProblems','externalTemperature','externalFastGoing','externalPurse','externalChartDays']
export function externalChartHistory(charts){
  const history=new Map()
  for(const chart of charts)for(const runner of chart.runners){const key=foreignHorseIdentity(runner.name);if(!history.has(key))history.set(key,[]);history.get(key).push({...runner,chart})}
  return history
}
export function externalChartFeatures(horse,date,country,history=new Map()){
  const prior=country==='US'?(history.get(foreignHorseIdentity(horse.name))||[]).filter(r=>r.chart.date<date).sort((a,b)=>b.chart.date.localeCompare(a.chart.date)).slice(0,20):[]
  const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0
  const temperatures=prior.map(r=>r.chart.temperatureC).filter(v=>v!=null)
  const purses=prior.map(r=>Number(r.chart.conditions.match(/Purse:\s*\$([\d,]+)/)?.[1]?.replaceAll(',','')||0)).filter(v=>v>0)
  return [prior.length,mean(prior.map(r=>+(/^1(?:\s|$)/.test(r.runningPositionsRaw)))),mean(prior.map(r=>+(/bump|check|stead|block|squeez|stumb|slow/i.test(r.comment)))),mean(temperatures),mean(prior.map(r=>+(r.chart.going==='Fast'))),mean(purses.map(v=>Math.log1p(v))),prior.length?(new Date(`${date}T12:00:00Z`)-new Date(`${prior[0].chart.date}T12:00:00Z`))/86400000:999]
}

export const equibaseTracks = {
  'Gulfstream Park ABD': {code:'GP', name:'GULFSTREAMPARK'},
  'Philadelphia ABD': {code:'PRX', name:'PARXRACING'},
  'Horseshoe Indianapolis ABD': {code:'IND', name:'HORSESHOEINDIANAPOLIS'},
  'Finger Lakes ABD': {code:'FL', name:'FINGERLAKES'},
  'Santa Anita Park ABD': {code:'SA', name:'SANTAANITAPARK'},
  'Keeneland ABD': {code:'KEE', name:'KEENELAND'},
  'Delaware Park ABD': {code:'DEL', name:'DELAWAREPARK'},
  'Laurel Park ABD': {code:'LRL', name:'LAURELPARK'},
  'Saratoga ABD': {code:'SAR', name:'SARATOGA'},
  'Del Mar ABD': {code:'DMR', name:'DELMAR'},
  'Belmont At The Big A ABD': {code:'BAQ', name:'BELMONTATTHEBIGA'},
  'Aqueduct ABD': {code:'AQU', name:'AQUEDUCT'},
  'Belmont Park ABD': {code:'BEL', name:'BELMONTPARK'},
  'Will Rogers Downs ABD': {code:'WRD', name:'WILLROGERSDOWNS'},
  'Fairmount Park ABD': {code:'FP', name:'FAIRMOUNTPARK'},
}
export function matchingEquibaseChart(race,charts) {
  const track=equibaseTracks[race.city]
  if(!track||race.horses.length<4)return null
  const names=race.horses.map(h=>foreignHorseIdentity(h.name))
  if(new Set(names).size!==names.length)return null
  const matches=charts.filter(c=>c.date===race.date&&c.track.replace(/[^A-Z]/g,'')===track.name&&c.runners.length===names.length&&new Set(c.runners.map(h=>foreignHorseIdentity(h.name))).size===names.length&&c.runners.every(h=>names.includes(foreignHorseIdentity(h.name))))
  if(matches.length!==1)return null
  const chart=matches[0],winner=race.horses.find(h=>race.results.get(h.no)?.finishPosition===1)
  if(!winner||foreignHorseIdentity(winner.name)!==foreignHorseIdentity(chart.runners[0].name))return null
  return chart
}

export function foreignCoverage(races) {
  const grouped=new Map()
  for(const race of races.filter(r=>r.foreign)){
    const country=racingCountry(race.city)||'unknown'
    if(!grouped.has(country))grouped.set(country,[])
    grouped.get(country).push(race)
  }
  return [...grouped].map(([country,rows])=>{
    const horses=rows.flatMap(r=>r.horses),days=[...new Set(rows.map(r=>r.date))].sort()
    return {country,races:rows.length,days:days.length,from:days[0],through:days.at(-1),runners:horses.length,coverage:{weight:horses.filter(h=>parseWeight(h.weight)!=null).length,jockey:horses.filter(h=>h.jockey&&h.jockey!=='Bilinmiyor').length,trainer:horses.filter(h=>h.trainer&&h.trainer!=='Bilinmiyor').length,resultTime:rows.reduce((n,r)=>n+[...r.results.values()].filter(v=>v.timeSeconds>0).length,0),weatherRaces:rows.filter(r=>!raceEnvironment(r,r.date).missing).length,workoutRunners:rows.reduce((n,r)=>n+r.horses.filter(h=>(h.workouts||[]).some(w=>w.dateISO&&w.dateISO<r.date)).length,0),externalEvidence:horses.filter(h=>h.externalEvidence).length},missingInputs:['complete_careers','workouts','pre_race_weather','wind','historical_forecast','verified_health'],canAttemptTraining:(new Date(days.at(-1))-new Date(days[0]))/86400000>=179&&rows.length>=600}
  }).sort((a,b)=>b.races-a.races)
}
