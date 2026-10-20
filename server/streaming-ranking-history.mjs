import {racingCountry} from './foreign-data.mjs'
import {createRankingHistory,addRankingDayToHistory} from './ranking.mjs'
// Buffer one complete calendar day. Never split a day before computing variants.
export function streamingRankingHistories({dates,readDay,targetDate,versionsForCountry=()=>new Set([1])}){
 const histories=new Map()
 for(const date of dates.filter(d=>d<targetDate).sort()){
  const countries=new Map()
  for(const race of readDay(date)){const country=race.foreign?racingCountry(race.city):'TR';if(!country)continue;if(!countries.has(country))countries.set(country,[]);countries.get(country).push(race)}
  for(const [country,races]of [...countries].sort(([a],[b])=>a.localeCompare(b))){
   for(const identityVersion of versionsForCountry(country)){const key=identityVersion===2?`${country}:v2`:country;if(!histories.has(key))histories.set(key,createRankingHistory({identityVersion}));addRankingDayToHistory(histories.get(key),races,date)}
  }
 }
 return histories
}
