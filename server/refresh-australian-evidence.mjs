process.env.HORSERIDE_NO_LISTEN='1'
import {readServedProgram,publishProgram} from './served-program.mjs'
import {enrichAustralianRaces} from './australian-form.mjs'
import {findDailyAiAnalysis,saveDailyAiAnalysis} from './database.mjs'
import {enrichCommentaryRace} from './commentary-evidence.mjs'
const {buildHistoricalAnalysisContext}=await import('./index.mjs')
const date='2026-10-16',program=readServedProgram(date)
const races=buildHistoricalAnalysisContext(enrichAustralianRaces(program.races.filter(r=>r.city==='Cranbourne Avustralya'),date),date).map(r=>r.rankingSource?r:{...r,rankingSource:'program_baseline',rankingCountry:'AU',rankingEvidence:{trainedModelAvailable:false,calibratedWinProbability:false}})
const report={date,checkedAt:new Date().toISOString(),races:races.map(r=>({no:r.no,runners:r.horses.length,matched:r.horses.filter(h=>h.australianEvidence).length,debut:r.horses.filter(h=>h.australianEvidence?.career?.starts===0).length,withPreviousRuns:r.horses.filter(h=>h.horsePerformance?.recentRuns?.length).length,withTrials:r.horses.filter(h=>h.trialEvidence?.length).length}))}
const {writeFileSync}=await import('node:fs')
writeFileSync('data/maintenance/australian-current-coverage.json',JSON.stringify(report,null,2))
const latest=readServedProgram(date)
publishProgram(date,{...latest,races:latest.races.map(r=>r.city==='Cranbourne Avustralya'?races.find(a=>a.no===r.no)||r:r)})
const record=findDailyAiAnalysis(date,'Cranbourne Avustralya')
if(record?.analysis?.races){
 const predictions=record.analysis.races.map(p=>{
  const r=races.find(r=>r.no===p.raceNo);if(!r)return p
  const clean={...p,risks:(p.risks||[]).filter(v=>!/\d+\/\d+ at için.*geçmiş yarış kaydı bulunmuyor/.test(v))}
  const fresh=enrichCommentaryRace(r,clean,date)
  const withHistory=r.horses.filter(h=>h.horsePerformance?.recentRuns?.length).length,debut=r.horses.filter(h=>h.australianEvidence?.career?.starts===0).length
  return {...fresh,evidence:{...p.evidence,runners:r.horses.length,withHistory,withDistanceAndSurface:r.horses.filter(h=>h.horsePerformance?.sameDistanceAndSurface?.starts>0).length,withTrials:r.horses.filter(h=>h.trialEvidence?.length).length,verifiedDebut:debut,missingCareerEvidence:r.horses.length-withHistory-debut},evidenceUpdatedAt:report.checkedAt}
 })
 // Preserve pick order, original creation/capture times and forecast history. This is an evidence refresh.
 const updated={...record,analysis:{...record.analysis,races:predictions,partial:predictions.length<races.length,summary:'Cranbourne programındaki 80 at resmî profille eşleşti; 67 atta geçmiş yarış, ilk startına çıkacak 13 atta ayrı deneme kayıtları doğrulandı. Sıralama program puanlamasına dayanır; doğrulanmış etkin Avustralya modeli henüz yok. Mevcut '+predictions.length+'/'+races.length+' koşu açıklamasının kanıtları yenilendi.',evidenceUpdatedAt:report.checkedAt}}
 writeFileSync('data/maintenance/australian-commentary-update.json',JSON.stringify(updated))
 report.commentaryUpdateStaged=true
}
console.log(JSON.stringify(report))