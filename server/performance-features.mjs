import {horseIdentity,parseWeight} from './data-quality.mjs'
import {racingCountry} from './foreign-data.mjs'
import {horseIdentityV2,jockeyIdentityV2} from './racing-identity.mjs'

export const performanceFeatureNames=['speedEvidenceCount','adjustedSpeedMean','adjustedSpeedBest','adjustedSpeedTrend','speedReferenceCount','dayVariantEvidence','pastFieldRating','fieldRatingChange','pastWeightChange','sameClassStarts','sameClassFinish','pastTrafficRate','trafficEvidenceCount','jockeyRecent30Win','trainerRecent30Win','pedigreeSurfaceStarts','pedigreeSurfaceWin']
const median=a=>{const s=a.toSorted((a,b)=>a-b);return s.length?(s[Math.floor((s.length-1)/2)]+s[Math.ceil((s.length-1)/2)])/2:0}
const mean=a=>a.length?a.reduce((a,b)=>a+b,0)/a.length:0
const num=v=>Number(String(v??'').match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',','.'))||0
const ground=r=>horseIdentity(r.surface)
const country=r=>racingCountry(r.city)||'TR'
const breed=r=>/ARAP/i.test(r.conditions||'')?'arabian':/QUARTER/i.test(r.conditions||'')?'quarter':/INGILIZ|İNGİLİZ|THOROUGHBRED/i.test(r.conditions||'')?'thoroughbred':'unknown'
const cohort=r=>[country(r),horseIdentity(r.city),ground(r),breed(r),num(r.distance)].join(':')
const category=r=>horseIdentity(r.type)
const rating=h=>num(h.handicapRating??h.sourceData?.values?.[h.sourceData?.headers?.findIndex(x=>x==='H'||x==='HP')])
const validTime=(seconds,distance)=>Number.isFinite(seconds)&&seconds>=distance/25&&seconds<=distance/5
const prior=(rows,date,days=730)=>{const since=new Date(new Date(`${date}T12:00:00Z`).getTime()-days*86400000).toISOString().slice(0,10);return rows.filter(r=>r.date<date&&r.date>=since)}
const identity=(r,h,history)=>`${country(r)}:${(history.identityVersion===2?horseIdentityV2:horseIdentity)(h.name)}`
const jockeyKey=(r,h,history)=>`${country(r)}:${(history.identityVersion===2?jockeyIdentityV2:horseIdentity)(h.jockey)}`
const pedigree=(r,h)=>h.sire?`${country(r)}:${horseIdentity(h.sire)}:${ground(r)}`:null
const normalizedFinish=r=>(r.fieldSize-r.finish)/Math.max(1,r.fieldSize-1)
const smoothedWin=rows=>(rows.filter(r=>r.finish===1).length+1)/(rows.length+10)
export function createPerformanceHistory({identityVersion=1}={}){return {identityVersion,par:new Map(),horse:new Map(),jockey:new Map(),trainer:new Map(),pedigree:new Map()}}
const get=(map,k)=>map.get(k)||[]
const put=(map,k,v)=>{if(!k)return;if(!map.has(k))map.set(k,[]);map.get(k).push(v)}

export function performanceFeatures(race,date,history){
  const currentRating=mean(race.horses.map(rating).filter(v=>v>0))
  return race.horses.map(h=>{
    const past=prior(get(history.horse,identity(race,h,history)),date).slice(-40),speed=past.filter(r=>r.speed!=null&&r.ground===ground(race)&&r.breed===breed(race)).slice(-6)
    const sameClass=past.filter(r=>r.category===category(race)),traffic=past.filter(r=>r.traffic!=null).slice(-10)
    const sire=prior(get(history.pedigree,pedigree(race,h)),date)
    const jockey=prior(get(history.jockey,jockeyKey(race,h,history)),date,30)
    const trainer=prior(get(history.trainer,`${country(race)}:${horseIdentity(h.trainer)}`),date,30)
    const knownRating=past.filter(r=>r.fieldRating>0),knownWeight=past.filter(r=>r.weight!=null),weight=parseWeight(h.weight)
    return [speed.length,mean(speed.map(r=>r.speed)),speed.length?Math.max(...speed.map(r=>r.speed)):0,speed.length>=3?mean(speed.slice(-2).map(r=>r.speed))-mean(speed.slice(0,-2).map(r=>r.speed)):0,mean(speed.map(r=>r.referenceCount)),speed.filter(r=>r.dayVariantKnown).length,mean(knownRating.map(r=>r.fieldRating)),currentRating&&knownRating.length?currentRating-mean(knownRating.map(r=>r.fieldRating)):0,weight!=null&&knownWeight.length?weight-mean(knownWeight.slice(-3).map(r=>r.weight)):0,sameClass.length,mean(sameClass.map(normalizedFinish)),mean(traffic.map(r=>r.traffic)),traffic.length,smoothedWin(jockey),smoothedWin(trainer),sire.length,smoothedWin(sire)]
  })
}

// Add a complete calendar day together. A past day's going adjustment is evidence
// for subsequent days; it is never known to predictions made earlier that day.
export function addPerformanceDay(history,races,date){
  const prepared=races.map(race=>{
    const winner=race.horses.find(h=>race.results.get(h.no)?.finishPosition===1)
    const distance=num(race.distance),seconds=winner&&race.results.get(winner.no)?.timeSeconds
    const reference=prior(get(history.par,cohort(race)),date).slice(-200)
    const sameClass=reference.filter(r=>r.category===category(race))
    const selected=sameClass.length>=8?sameClass:reference
    const par=selected.length>=8?median(selected.map(r=>r.time)):null
    return {race,winnerTime:validTime(seconds,distance)?seconds:null,par,referenceCount:selected.length,variantKey:[country(race),horseIdentity(race.city),ground(race),breed(race)].join(':'),distance}
  })
  const variants=new Map()
  for(const p of prepared)if(p.par&&p.winnerTime)put(variants,p.variantKey,Math.log(p.winnerTime/p.par))
  for(const p of prepared){
    const {race}=p,dayResiduals=get(variants,p.variantKey),dayVariantKnown=dayResiduals.length>=3
    const variant=dayVariantKnown?median(dayResiduals):0,fieldRating=mean(race.horses.map(rating).filter(v=>v>0))
    for(const horse of race.horses){
      const result=race.results.get(horse.no);if(!result?.finishPosition)continue
      const seconds=result.timeSeconds,comment=horse.externalEvidence?.comment
      const traffic=comment?+(/bump|check|stead|block|squeez|stumb|slow|sıkış|engell|geç çık|tereddüt/i.test(comment)):null
      const run={date,ground:ground(race),breed:breed(race),category:category(race),fieldSize:race.horses.length,finish:result.finishPosition,fieldRating,weight:parseWeight(horse.weight),traffic,referenceCount:p.referenceCount,dayVariantKnown,speed:p.par&&validTime(seconds,p.distance)?100*(Math.log(p.par/seconds)+variant):null}
      put(history.horse,identity(race,horse,history),run)
      put(history.jockey,jockeyKey(race,horse,history),run)
      put(history.trainer,`${country(race)}:${horseIdentity(horse.trainer)}`,run)
      put(history.pedigree,pedigree(race,horse),run)
    }
    if(p.winnerTime)put(history.par,cohort(race),{date,time:p.winnerTime,category:category(race)})
  }
}
