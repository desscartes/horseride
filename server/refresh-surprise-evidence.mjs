import {createHash} from 'node:crypto'
import {readServedProgram,publishProgram} from './served-program.mjs'
import {findDailyAiAnalysis,saveDailyAiAnalysis,saveForecastSnapshots} from './database.mjs'
import {enrichCommentaryRace,profileEvidenceRace} from './commentary-evidence.mjs'
import {surpriseCandidates} from '../src/data/surprisePolicy.js'
export function refreshSurpriseEvidence(date,{now=new Date().toISOString()}={}){
 const program=readServedProgram(date);if(!program)return {cities:0}
 const signals=new Map();let changed=0
 for(const city of new Set(program.races.map(r=>r.city))){
  const record=findDailyAiAnalysis(date,city);if(!record?.analysis?.races?.length)continue
  const races=program.races.filter(r=>r.city===city).map(r=>profileEvidenceRace(r,date))
  const key=createHash('sha256').update(JSON.stringify(record.analysis.races.map(p=>{const r=races.find(r=>r.no===p.raceNo);return [p.raceNo,p.picks.map(h=>h.horseName),r&&surpriseCandidates(r,p.picks).sort(),r?.horses.map(h=>[h.no,h.outOfRace,h.horsePerformance?.recentRuns?.map(run=>[run.date,run.finishPosition]),h.horsePerformance?.sameDistanceAndSurface,h.horsePerformance?.sameSurface])]}))).digest('hex')
  let predictions=record.analysis.races,capturedAt=record.analysis.surpriseUpdatedAt||record.createdAt
  if(record.analysis.surpriseEvidenceKey!==key){
   predictions=predictions.map(p=>{const r=races.find(r=>r.no===p.raceNo);if(!r)return p;const fresh=enrichCommentaryRace(r,p,date);return {...p,surprise:fresh.surprise,surpriseAssessment:fresh.surpriseAssessment}})
   capturedAt=now;const inputHash=createHash('sha256').update(`surprise-evidence-v2:${record.analysis.entryFingerprint}:${key}`).digest('hex')
   saveDailyAiAnalysis({...record,inputHash,createdAt:now,analysis:{...record.analysis,races:predictions,surpriseEvidenceKey:key,surpriseUpdatedAt:now}})
   for(const r of races)saveForecastSnapshots({date,races:[r],source:'daily_ai',modelVersion:`daily-12:surprise-evidence-v2:${r.rankingMethod||'baseline'}`,inputHash,predictions,capturedAt:now})
   changed++
  }
  for(const p of predictions)signals.set(`${city}:${p.raceNo}`,{surprise:p.surprise,assessment:p.surpriseAssessment,leaders:p.picks.slice(0,2).map(h=>h.horseName),capturedAt})
 }
 const latest=readServedProgram(date)
 publishProgram(date,{...latest,races:latest.races.map(r=>({...r,surpriseSignal:signals.get(`${r.city}:${r.no}`)||r.surpriseSignal}))})
 return {cities:changed,signals:signals.size}
}
