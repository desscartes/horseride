import {horseIdentity} from './data-quality.mjs'
import {horseIdentityV2} from './racing-identity.mjs'
import {racingCountry} from './foreign-data.mjs'
import {raceEnvironment} from './environment-features.mjs'
import {validatedRegistryPedigree} from './pedigree-registry.mjs'

const groups=['sire','dam','damsire']
const contexts=['All','Surface','Distance','Going','Temperature']
export const pedigreeFeatureNames=['missingSire','missingDam','missingDamsire','missingPedigreeGoing',...groups.flatMap(g=>contexts.flatMap(c=>[`${g}${c}Starts`,`${g}${c}Offspring`,`${g}${c}Win`,`${g}${c}Finish`,`${g}${c}WinLift`]))]
const number=v=>Number(String(v??'').match(/\d+/)?.[0])||0
const ground=r=>{const s=horseIdentity(r.surface);return /SENTETIK|SYNTHETIC|ALLWEATHER|TAPETA|POLYTRACK/.test(s)?'synthetic':/CIM|TURF/.test(s)?'turf':/KUM|DIRT/.test(s)?'dirt':null}
const breed=r=>/ARAP|ARAB/i.test(r.conditions||r.type||'')?'arabian':/QUARTER/i.test(r.conditions||r.type||'')?'quarter':'thoroughbred'
const country=r=>racingCountry(r.city)||'TR'
// TJK's Anne column can contain "dam - maternal grandsire". Never guess an
// ancestor from a horse name or from an undated performance summary.
export function horsePedigree(h){
  const parts=String(h.dam||'').split(/\s+[-–—/]\s+/)
  const clean=v=>{const s=horseIdentity(v);return !s||/^(BILINMIYOR|UNKNOWN|N A|NONE|NULL|0|-)$/.test(s)?null:s}
  return {sire:clean(h.sire),dam:clean(parts[0]),damsire:clean(h.damsire||h.damSire||h.maternalGrandsire||parts[1]||validatedRegistryPedigree(h)?.damsire)}
}
export function pedigreeGoing(r,date){
  const e=r.environment||r.horses?.map(h=>h.sourceData?.tjk?.raceEnvironment).find(e=>e?.date===date)
  if(e?.date!==date)return null
  const condition=horseIdentity(e.tracks?.find(t=>ground({surface:t.surface})===ground(r))?.condition)
  if(/ISLAK|AGIR|YUMUSAK|SULU|WET|HEAVY|SOFT|SLOPPY|MUDDY|YIELDING/.test(condition))return 'wet'
  if(/NORMAL|KURU|SERT|DRY|FAST|FIRM|GOOD/.test(condition))return 'dry'
  return null // rain alone does not establish the actual track condition
}
export const createPedigreeHistory=()=>new Map()
export function historicalPedigreeGoing(r,date){
 const observed=r.historicalObservedEnvironment
 return pedigreeGoing(r,date)||(observed?.date===date&&observed.availability==='post_race_chart'?pedigreeGoing({...r,environment:observed},date):null)
}
const lineageKey=(r,g,id)=>id?`${country(r)}:${breed(r)}:${g}:${id}`:null
export function addPedigreeDay(history,races,date){
  for(const r of races){
    const environment=raceEnvironment(r,date)
    for(const h of r.horses){
      const finish=r.results.get(h.no)?.finishPosition
      if(!finish||finish<1||finish>r.horses.length)continue
      const observed=r.historicalObservedEnvironment
      const pastTemperature=observed?.date===date&&observed.availability==='post_race_chart'&&Number.isFinite(observed.temperatureC)&&observed.temperatureC>=-30&&observed.temperatureC<=60?observed.temperatureC:null
      const run={date,horse:horseIdentityV2(h.name),finish,fieldSize:r.horses.length,surface:ground(r),distance:number(r.distance),going:historicalPedigreeGoing(r,date),temperature:environment.missingTemperature?pastTemperature:environment.temperature}
      for(const [g,id] of Object.entries(horsePedigree(h))){const k=lineageKey(r,g,id);if(!k)continue;if(!history.has(k))history.set(k,[]);history.get(k).push(run)}
    }
  }
}
function summary(rows){
  const n=rows.length,wins=rows.filter(r=>r.finish===1).length
  const expected=rows.reduce((sum,r)=>sum+1/r.fieldSize,0)
  return [n,new Set(rows.map(r=>r.horse)).size,(wins+1)/(n+10),(rows.reduce((sum,r)=>sum+(r.fieldSize-r.finish)/Math.max(1,r.fieldSize-1),0)+5)/(n+10),(wins+2)/(expected+2)]
}
export function pedigreeFeatures(race,date,history){
  const since=new Date(Date.parse(`${date}T12:00:00Z`)-730*86400000).toISOString().slice(0,10)
  const surface=ground(race),distance=number(race.distance),going=pedigreeGoing(race,date),e=raceEnvironment(race,date)
  return race.horses.map(h=>{
    const ids=horsePedigree(h),self=horseIdentityV2(h.name)
    return [...groups.map(g=>+!ids[g]),+!going,...groups.flatMap(g=>{
      const rows=(history.get(lineageKey(race,g,ids[g]))||[]).filter(r=>r.date<date&&r.date>=since&&r.horse!==self)
      const same=rows.filter(r=>surface&&r.surface===surface)
      return [rows,same,same.filter(r=>distance&&Math.abs(r.distance-distance)<=200),same.filter(r=>going&&r.going===going),same.filter(r=>!e.missingTemperature&&r.temperature!=null&&Math.abs(r.temperature-e.temperature)<=5)].flatMap(summary)
    })]
  })
}
