import { readFileSync } from 'node:fs'
import { horseIdentity, parseWeight } from './data-quality.mjs'
import {raceEnvironment,workoutTime} from './environment-features.mjs'
import {racingCountry,externalChartFeatures,externalChartHistory} from './foreign-data.mjs'
import {createPerformanceHistory,addPerformanceDay,performanceFeatures} from './performance-features.mjs'
import {horseIdentityV2,jockeyIdentityV2} from './racing-identity.mjs'
import {paceFeatureNames,paceHistory,paceFeatures} from './pace-features.mjs'
import {equibaseTracks} from './foreign-data.mjs'

export const featureNames=['fieldSize','distance','turf','synthetic','arabian','maiden','handicapRating','age','weight','weightDiff','gateFraction','daysOff','form','historyStarts','winRate','placeRate','recentFinish','recentSpeed','speedTrend','sameSurfaceWin','sameDistanceWin','sameTrackWin','distanceChange','jockeyWin','trainerWin','partnershipWin','headToHead','pastRivalStrength','workoutCount','workoutDays','workout400','workout1000','missingWeight','missingHistory','missingWorkout','temperature','humidity','rain','wetGoing','turfGoing','missingWeather','missingTemperature','missingHumidity','wetHistoryStarts','wetHistoryWin','wetHistoryFinish','similarTemperatureStarts','similarTemperatureFinish','workoutsLast30','workoutsLast14','workout800','workout400Mean','workout400Trend','workoutSameSurface','workoutSameTrack','workoutHas400','workoutHas800','workoutHas1000']
const mean=(a,fallback=0)=>a.length?a.reduce((x,y)=>x+y,0)/a.length:fallback
const key=horseIdentity
const number=value=>{const m=String(value||'').match(/\d+(?:[.,]\d+)?/);return m?Number(m[0].replace(',','.')):0}
const workoutSeconds=value=>{const m=String(value||'').match(/^(\d+)[.:](\d{2})[.:](\d{1,2})$/);return m?Number(m[1])*60+Number(m[2])+Number(m[3].padEnd(2,'0'))/100:number(value)}
const surface=value=>{const text=key(value);return text.includes('SENTETIK')?'synthetic':text.includes('CIM')?'turf':'dirt'}
const rate=(runs)=> (runs.filter(r=>r.finish===1).length+1)/(runs.length+10)
const places=(runs)=>(runs.filter(r=>r.finish<=3).length+3)/(runs.length+10)
const by=(map,id)=>map.get(id)||[]
export function createRankingHistory({identityVersion=1}={}){return {identityVersion,horse:new Map(),jockey:new Map(),trainer:new Map(),partnership:new Map(),performance:createPerformanceHistory({identityVersion})}}
export function addRankingDayToHistory(history,races,date){for(const race of races)addRaceToHistory(history,race,date);addPerformanceDay(history.performance,races,date)}

export function raceFeatures(race,date,history){
  const horseKey=history.identityVersion===2?horseIdentityV2:key,jockeyKey=history.identityVersion===2?jockeyIdentityV2:key
  const distance=number(race.distance),track=key(race.city),ground=surface(race.surface)
  const environment=raceEnvironment(race,date)
  const weights=race.horses.map(h=>parseWeight(h.weight)).filter(v=>v!=null)
  const averageWeight=mean(weights,55)
  const runners=new Set(race.horses.map(h=>horseKey(h.name)))
  return race.horses.map(horse=>{
    const past=by(history.horse,horseKey(horse.name)).filter(r=>r.date<date&&r.date>=new Date(new Date(`${date}T12:00:00Z`).getTime()-730*86400000).toISOString().slice(0,10)).slice(-40)
    const recent=past.slice(-6),sameGround=past.filter(r=>r.surface===ground),sameDistance=sameGround.filter(r=>Math.abs(r.distance-distance)<=200),sameTrack=sameDistance.filter(r=>r.track===track)
    const normalizedFinish=recent.map(r=>(r.fieldSize-r.finish)/Math.max(1,r.fieldSize-1))
    const speeds=recent.map(r=>r.relativeSpeed).filter(v=>v>0)
    const headToHead=past.slice(-12).flatMap(run=>Object.entries(run.field).filter(([id])=>runners.has(id)&&id!==horseKey(horse.name)).map(([,finish])=>run.finish<finish?1:run.finish===finish?0.5:0))
    const workouts=(horse.workouts||horse.sourceData?.tjk?.workouts||[horse.workout].filter(Boolean)).filter(w=>w.dateISO&&w.dateISO<date&&(new Date(`${date}T12:00:00Z`)-new Date(`${w.dateISO}T12:00:00Z`))/86400000<=90).sort((a,b)=>b.dateISO.localeCompare(a.dateISO)).slice(0,12)
    const newest=workouts[0]
    const wetHistory=past.filter(r=>r.environment?.wet&&r.surface===ground)
    const temperatureHistory=past.filter(r=>!r.environment?.missingTemperature&&r.environment&&!environment.missingTemperature&&Math.abs(r.environment.temperature-environment.temperature)<=5)
    const workout400s=workouts.map(w=>workoutTime(w.splits?.['400'],400)).filter(v=>v!=null)
    const split=d=>workouts.map(w=>workoutTime(w.splits?.[d],Number(d))).find(v=>v!=null)
    const ageDays=w=>(new Date(`${date}T12:00:00Z`)-new Date(`${w.dateISO}T12:00:00Z`))/86400000
    const daysOff=recent.length?(new Date(`${date}T12:00:00Z`)-new Date(`${recent.at(-1).date}T12:00:00Z`))/86400000:number(horse.daysSinceRace)
    const weight=parseWeight(horse.weight)
    const values=[race.horses.length,distance,+(ground==='turf'),+(ground==='synthetic'),+/ARAP/i.test(race.conditions||race.type||''),+/MAIDEN/i.test(race.type||''),number(horse.handicapRating??horse.sourceData?.values?.[horse.sourceData?.headers?.findIndex(h=>h==='H'||h==='HP')]),number(horse.age),weight??averageWeight,(weight??averageWeight)-averageWeight,number(horse.start)/Math.max(1,race.horses.length),daysOff,
      mean((String(horse.lastSix||'').match(/\d/g)||[]).map(v=>v==='0'?0:Math.max(0,1-(Number(v)-1)/10)),0.5),past.length,rate(past),places(past),mean(normalizedFinish,0.5),mean(speeds,0.9),speeds.length>=3?mean(speeds.slice(-2))-mean(speeds.slice(0,-2)):0,rate(sameGround),rate(sameDistance),rate(sameTrack),recent.length?distance-recent.at(-1).distance:0,
      rate(by(history.jockey,jockeyKey(horse.jockey)).filter(r=>r.date<date).slice(-200)),rate(by(history.trainer,key(horse.trainer)).filter(r=>r.date<date).slice(-200)),rate(by(history.partnership,`${horseKey(horse.name)}:${jockeyKey(horse.jockey)}`).filter(r=>r.date<date)),mean(headToHead,0.5),mean(recent.map(r=>r.rivalStrength)),workouts.length,newest?ageDays(newest):999,split('400')??0,split('1000')??0,+(weight==null),+(past.length===0),+(workouts.length===0),
      environment.temperature,environment.humidity,environment.rain,environment.wet,environment.going,+environment.missing,environment.missingTemperature,environment.missingHumidity,wetHistory.length,rate(wetHistory),mean(wetHistory.map(r=>(r.fieldSize-r.finish)/Math.max(1,r.fieldSize-1)),.5),temperatureHistory.length,mean(temperatureHistory.map(r=>(r.fieldSize-r.finish)/Math.max(1,r.fieldSize-1)),.5),workouts.filter(w=>ageDays(w)<=30).length,workouts.filter(w=>ageDays(w)<=14).length,split('800')??0,mean(workout400s),workout400s.length>=3?mean(workout400s.slice(0,2))-mean(workout400s.slice(2)):0,+!!newest&&+(surface(newest.surface)===ground),+!!newest&&+(key(newest.hippodrome)===track),+(split('400')!=null),+(split('800')!=null),+(split('1000')!=null)]
    return values.map(v=>Number.isFinite(v)?v:0)
  })
}

export function addRaceToHistory(history,race,date){
  const horseKey=history.identityVersion===2?horseIdentityV2:key,jockeyKey=history.identityVersion===2?jockeyIdentityV2:key
  const field=Object.fromEntries(race.horses.map(h=>[horseKey(h.name),race.results.get(h.no)?.finishPosition]).filter(([,finish])=>finish>0))
  const winnerTimes=[...race.results.values()].filter(r=>r.finishPosition===1&&r.timeSeconds>0).map(r=>r.timeSeconds)
  const winnerTime=winnerTimes.length?Math.min(...winnerTimes):null
  const rivalStrength=mean(race.horses.map(h=>number(h.handicapRating??h.sourceData?.values?.[h.sourceData?.headers?.findIndex(x=>x==='H'||x==='HP')])).filter(n=>n>0))
  for(const horse of race.horses){
    const result=race.results.get(horse.no)
    if(!result?.finishPosition)continue
    const run={date,finish:result.finishPosition,distance:number(race.distance),track:key(race.city),surface:surface(race.surface),environment:raceEnvironment(race,date),fieldSize:race.horses.length,field,rivalStrength,relativeSpeed:winnerTime&&result.timeSeconds?Math.min(1.05,winnerTime/result.timeSeconds):null}
    for(const [map,id] of [[history.horse,horseKey(horse.name)],[history.jockey,jockeyKey(horse.jockey)],[history.trainer,key(horse.trainer)],[history.partnership,`${horseKey(horse.name)}:${jockeyKey(horse.jockey)}`]]){
      if(!id||id==='BILINMIYOR')continue
      if(!map.has(id))map.set(id,[])
      map.get(id).push(run)
    }
  }
}

export function evaluateTreeModel(model,values){
  const featureMap=new Map(model.features_info.float_features.map(f=>[f.feature_index,f.flat_feature_index]))
  let score=0
  for(const tree of model.oblivious_trees){
    let leaf=0
    for(const [bit,split] of (tree.splits||[]).entries()){
      if(split.split_type!=='FloatFeature')throw new Error('Only numeric model features are supported')
      if(values[featureMap.get(split.float_feature_index)]>split.border)leaf|=1<<bit
    }
    score+=tree.leaf_values[leaf]
  }
  return score*(model.scale_and_bias?.[0]??1)+(model.scale_and_bias?.[1]?.[0]??0)
}

function dailyBundle(country, active = false) {
  try {
    const pointer = JSON.parse(readFileSync(`data/daily-models/${active ? 'active' : 'latest'}-${country}.json`, 'utf8'))
    const report = JSON.parse(readFileSync(pointer.reportPath, 'utf8'))
    if (active ? !report.enabled : !report.shadowEnabled) return null
    let charts = []
    if (country === 'US') charts = JSON.parse(readFileSync(report.externalChartsPath || 'data/external/equibase/parsed.json','utf8')).races
    return { metadata: { ...report, country: country === 'TR' ? undefined : country }, model: JSON.parse(readFileSync(pointer.modelPath,'utf8')), externalHistory: externalChartHistory(charts), paceHistory: paceHistory(charts) }
  } catch { return null }
}
export function loadDailyShadowModel(country) { return dailyBundle(country) }
export function loadRankingModel(){
  const daily = dailyBundle('TR', true)
  if (daily) return daily
  try{
    const metadata=JSON.parse(readFileSync('data/ranking-report.json','utf8'))
    if(!metadata.promoted&&!metadata.enabled)return null
    return {metadata,model:JSON.parse(readFileSync('data/ranking-live.json','utf8'))}
  }catch{return null}
}

export function loadForeignRankingModel(country){
  if(!/^[A-Z]{2}$/.test(country||''))return null
  const daily = dailyBundle(country, true)
  if (daily) return daily
  try{
    const metadata=JSON.parse(readFileSync(`data/foreign-models/${country}-report.json`,'utf8'))
    if(!metadata.enabled||metadata.country!==country)return null
    let charts=[];try{charts=JSON.parse(readFileSync(metadata.externalChartsPath||'data/external/equibase/parsed.json','utf8')).races}catch{}
    return {metadata,model:JSON.parse(readFileSync(`data/foreign-models/${country}-live.json`,'utf8')),externalHistory:externalChartHistory(charts),paceHistory:paceHistory(charts)}
  }catch{return null}
}

export function loadPerformanceShadowModel(){
  try{const metadata=JSON.parse(readFileSync('data/foreign-models-performance/TR-report.json','utf8'));if(!metadata.shadowEnabled)return null;return {metadata:{...metadata,country:undefined},model:JSON.parse(readFileSync('data/foreign-models-performance/TR-live.json','utf8'))}}catch{return null}
}

export function loadNextShadowModel(country){
  if(!['TR','US'].includes(country))return null
  try{
    const metadata=JSON.parse(readFileSync(`data/foreign-models-next/${country}-report.json`,'utf8'))
    if(metadata.enabled||!metadata.shadowEnabled)return null
    let charts=[];if(country==='US')charts=JSON.parse(readFileSync(metadata.externalChartsPath||'data/external/equibase/parsed.json','utf8')).races
    return {metadata:{...metadata,country:country==='TR'?undefined:country},model:JSON.parse(readFileSync(`data/foreign-models-next/${country}-live.json`,'utf8')),externalHistory:externalChartHistory(charts),paceHistory:paceHistory(charts)}
  }catch{return null}
}

export function rankRaceLocally(race,date,history,bundle){
  if(!bundle||bundle.metadata.trainedThrough>=date)return race
  const domestic=['İstanbul','Ankara','İzmir','Bursa','Adana','Kocaeli','Antalya','Diyarbakır','Elazığ','Şanlıurfa'].map(key)
  if(bundle.metadata.country ? racingCountry(race.city)!==bundle.metadata.country : race.foreign||!domestic.includes(key(race.city)))return race
  const features=raceFeatures(race,date,history)
  const country=bundle.metadata.country
  const advanced=['performance_v1','performance_v2'].includes(bundle.metadata.featurePipeline)?performanceFeatures(race,date,history.performance):null
  const pace=country==='US'&&bundle.metadata.featurePipeline==='performance_v2'?paceFeatures(race,date,bundle.paceHistory,equibaseTracks[race.city]?.name):null
  const vectors=features.map((values,i)=>[...values,...(country?externalChartFeatures(race.horses[i],date,country,bundle.externalHistory):[]),...(advanced?advanced[i]:[]),...(pace?pace[i]:[])])
  const scores=vectors.map(values=>evaluateTreeModel(bundle.model,bundle.metadata.featureIndexes?bundle.metadata.featureIndexes.map(i=>values[i]):values)/bundle.metadata.temperature)
  const maximum=Math.max(...scores),exp=scores.map(v=>Math.exp(v-maximum)),total=exp.reduce((a,b)=>a+b,0)
  const extended=bundle.metadata.inputs?.includes('workouts')&&bundle.metadata.inputs?.includes('official_weather')
  return {...race,rankingSource:'local_trained_model',rankingCountry:country||'TR',rankingMethod:bundle.metadata.method,rankingEvidence:country?{country,workoutsUsed:false,weatherUsed:false,speedClassUsed:Boolean(advanced),speedEvidenceRunners:advanced?.filter(f=>f[0]>0).length||0,workoutRunners:features.filter(f=>!f[featureNames.indexOf('missingWorkout')]).length,externalChartRunners:vectors.filter(f=>f[featureNames.length]>0).length,runners:race.horses.length}:extended?{workoutsUsed:true,weatherUsed:true,weatherAvailable:!raceEnvironment(race,date).missing,workoutRunners:features.filter(f=>!f[featureNames.indexOf('missingWorkout')]).length,runners:race.horses.length}:null,horses:race.horses.map((horse,i)=>({...horse,baselineProbability:horse.probability,probability:Number((100*exp[i]/total).toFixed(2)),rankingScore:scores[i]})).sort((a,b)=>b.rankingScore-a.rankingScore)}
}
