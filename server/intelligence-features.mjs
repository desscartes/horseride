import {raceClass,classTransition} from './race-class.mjs'
import {horseEquipment} from './horse-equipment.mjs'
import {horseIdentityV2,jockeyIdentityV2} from './racing-identity.mjs'
import {horseIdentity,parseWeight} from './data-quality.mjs'
import {racingCountry,foreignHorseIdentity} from './foreign-data.mjs'
import {maidenTrainingNames,maidenTrainingFeatures,winnerPrize} from './maiden-training.mjs'
export const intelligenceFeatureNames=['classKnown','classGroup','classListed','classKV','classConditional','classHandicap','classAllowance','classClaiming','classMaiden','classLevel','classLocalRank','sameNormalizedClassStarts','sameNormalizedClassWin','sameNormalizedClassFinish','lastClassTransition','missingClassTransition','lastThreeClassTransition','sameClassJockeyStarts','sameClassJockeyWin','sameClassTrainerStarts','sameClassTrainerWin','weightChangeLastStart','jockeyChanged','equipmentChanged','missingEquipmentChange','gateCohortStarts','gateCohortWin','careerDistanceStarts','careerDistanceFinish','careerAgeDays','officialChartClassStarts','officialChartGroupStarts','officialChartAllowanceStarts','officialChartClaimingStarts','officialChartBestClass','officialChartLastClassChange','missingOfficialClassChange',...maidenTrainingNames]
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0
const win=a=>(a.filter(r=>r.finish===1).length+1)/(a.length+10)
const finish=a=>mean(a.map(r=>(r.field-r.finish)/Math.max(1,r.field-1)))
const num=v=>Number(String(v??'').match(/\d+/)?.[0])||0
const country=r=>racingCountry(r.city)||'TR'
const ground=r=>horseIdentity(r.surface)
const horse=(r,h)=>`${country(r)}:${horseIdentityV2(h.name)}`
const equipment=horseEquipment
const gate=(r,h)=>Math.min(2,Math.floor(3*Math.max(0,num(h.start)-1)/Math.max(1,r.horses.length)))
const cohort=(r,h)=>[country(r),horseIdentity(r.city),ground(r),Math.round(num(r.distance)/200),gate(r,h)].join(':')
const put=(map,key,row)=>{if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(row)}
const prior=(map,key,date)=>{const since=new Date(Date.parse(`${date}T12:00:00Z`)-730*86400000).toISOString().slice(0,10);return (map.get(key)||[]).filter(r=>r.date<date&&r.date>=since)}
export const createIntelligenceHistory=()=>({horses:new Map(),jockeys:new Map(),trainers:new Map(),gates:new Map()})
export function addIntelligenceDay(history,races,date){
 for(const race of races){const klass=raceClass(race)
  for(const h of race.horses){const finish=race.results.get(h.no)?.finishPosition;if(!finish||finish>race.horses.length)continue
   const row={date,klass,finish,field:race.horses.length,distance:num(race.distance),ground:ground(race),weight:parseWeight(h.weight),jockey:jockeyIdentityV2(h.jockey),equipment:equipment(h),prize:winnerPrize(race)}
   put(history.horses,horse(race,h),row)
   if(h.jockey)put(history.jockeys,`${country(race)}:${jockeyIdentityV2(h.jockey)}`,row)
   if(h.trainer)put(history.trainers,`${country(race)}:${horseIdentity(h.trainer)}`,row)
   put(history.gates,cohort(race,h),row)
  }
 }
}
export function intelligenceFeatures(race,date,history,externalHistory=new Map(),{legacy=false}={}){
 const klass=raceClass(race)
 return race.horses.map(h=>{
  const past=prior(history.horses,horse(race,h),date),last=past.at(-1),same=past.filter(r=>klass.known&&r.klass.key===klass.key)
  const transitions=past.slice(-3).map(r=>classTransition(r.klass,klass)).filter(v=>v!=null),transition=classTransition(last?.klass,klass)
  const jockey=prior(history.jockeys,`${country(race)}:${jockeyIdentityV2(h.jockey)}`,date).filter(r=>klass.known&&r.klass.key===klass.key)
  const trainer=prior(history.trainers,`${country(race)}:${horseIdentity(h.trainer)}`,date).filter(r=>klass.known&&r.klass.key===klass.key)
  const gates=prior(history.gates,cohort(race,h),date),distance=past.filter(r=>r.ground===ground(race)&&Math.abs(r.distance-num(race.distance))<=200)
  const weight=parseWeight(h.weight),eq=equipment(h)
  const official=country(race)==='US'?(externalHistory.get(foreignHorseIdentity(h.name))||[]).filter(r=>r.chart.date<date).sort((a,b)=>a.chart.date.localeCompare(b.chart.date)).slice(-20).map(r=>raceClass({city:race.city,conditions:r.chart.conditions})).filter(c=>c.known):[],officialTransition=classTransition(official.at(-1),klass),ranked=official.map(c=>c.rank).filter(n=>n!=null)
  return [+klass.known,...['group','listed','kv','conditional','handicap','allowance','claiming','maiden'].map(f=>+(klass.family===f||klass.family.startsWith(`${f}_`))),klass.level,klass.rank??0,same.length,win(same),finish(same),transition??0,+(transition==null),mean(transitions),jockey.length,win(jockey),trainer.length,win(trainer),last?.weight!=null&&weight!=null?weight-last.weight:0,+!!last?.jockey&&+!!h.jockey&&+(last.jockey!==jockeyIdentityV2(h.jockey)),last?.equipment&&eq?+(horseIdentity(last.equipment)!==horseIdentity(eq)):0,+!(last?.equipment&&eq),gates.length,win(gates),distance.length,finish(distance),past.length?(Date.parse(`${date}T12:00:00Z`)-Date.parse(`${past[0].date}T12:00:00Z`))/86400000:0,official.length,official.filter(c=>c.family==='group').length,official.filter(c=>c.family.startsWith('allowance')).length,official.filter(c=>c.family==='claiming').length,ranked.length?Math.max(...ranked):0,officialTransition??0,+(officialTransition==null),...maidenTrainingFeatures(race,past)]
 }).map(values=>legacy?values.slice(0,values.length-maidenTrainingNames.length):values)
}
