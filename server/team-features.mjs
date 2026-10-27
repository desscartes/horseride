import {horseIdentityV2,jockeyIdentityV2} from './racing-identity.mjs'
const key=v=>horseIdentityV2(v||'')
export const teamFeatureNames=['teamObserved180Starts','teamObserved180Win','teamHorseObservedStarts','teamHorseObservedWin','missingTeamHistory']
export function teamFeatures(horse,date,rows){
 const trainer=key(horse.trainer),jockey=jockeyIdentityV2(horse.jockey||''),name=key(horse.name)
 if(!trainer||!jockey)return [0,.1,0,.1,1]
 const since=new Date(Date.parse(date+'T12:00:00Z')-180*86400000).toISOString().slice(0,10)
 const past=[...new Map(rows.filter(r=>r.date<date&&r.date>=since&&key(r.trainer)===trainer&&jockeyIdentityV2(r.jockey)===jockey&&Number.isInteger(r.finishPosition)&&r.finishPosition>=0).map(r=>[JSON.stringify([r.date,r.city,r.raceNo,key(r.horseName)]),r])).values()]
 const same=past.filter(r=>key(r.horseName)===name),win=a=>(a.filter(r=>r.finishPosition===1).length+1)/(a.length+10)
 return [past.length,win(past),same.length,win(same),Number(!past.length)]
}
