import {foreignHorseIdentity,racingCountry} from './foreign-data.mjs'
import {chartDistance} from './pace-evidence.mjs'
import {parseRaceTime} from './data-quality.mjs'
export const priorRaceContextNames=['priorRaceContextCount','priorRaceWinnerSpeedMean','priorRaceWinnerSpeedLatest','priorRaceContextDays','missingPriorRaceContext']
export function priorRaceContext(race,date,history){
 return race.horses.map(h=>{
  if(racingCountry(race.city)!=='US')return [0,0,0,999,1]
  const unique=new Map()
  for(const row of history.get(foreignHorseIdentity(h.name))||[]){const c=row.chart;if(!c||!/^\d{4}-\d{2}-\d{2}$/.test(c.date||'')||!Number.isFinite(Date.parse(c.date))||new Date(c.date).toISOString().slice(0,10)!==c.date||c.date>=date)continue
   const distance=chartDistance(c.conditions),seconds=parseRaceTime(c.winnerTime),speed=distance&&seconds?distance/seconds:null
   if(!Number.isFinite(speed)||speed<5||speed>25)continue
   unique.set(JSON.stringify([c.date,c.track,c.raceNo]),{date:c.date,speed})
  }
  const rows=[...unique.values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8)
  return [rows.length,rows.length?rows.reduce((n,r)=>n+r.speed,0)/rows.length:0,rows[0]?.speed||0,rows.length?(Date.parse(date)-Date.parse(rows[0].date))/86400000:999,+!rows.length]
 })
}
