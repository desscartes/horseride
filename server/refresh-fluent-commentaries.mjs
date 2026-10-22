process.env.HORSERIDE_NO_LISTEN='1'
import {mkdir,writeFile} from 'node:fs/promises'
import {readServedProgram} from './served-program.mjs'
import {findDailyAiAnalysis,saveDailyAiAnalysis} from './database.mjs'
import {fluentHorseReason,commentaryModelCaution} from './commentary-evidence.mjs'
import {localDay} from './maintenance-policy.mjs'
const {buildHistoricalAnalysisContext}=await import('./index.mjs')
const date=localDay(),program=readServedProgram(date),now=new Date(),directory=`data/maintenance/commentary-backups/${date}`
if(!program?.races?.length)throw Error('No current program')
await mkdir(directory,{recursive:true})
const races=buildHistoricalAnalysisContext(program.races,date)
await writeFile(`data/maintenance/jockey-evidence-${date}.json`,JSON.stringify({date,createdAt:new Date().toISOString(),archiveThrough:null,records:races.flatMap(r=>r.horses.map(h=>({city:r.city,raceNo:r.no,horseName:h.name,jockey:h.jockey,evidence:h.jockeyPerformance})))}))
const report={date,updatedAt:now.toISOString(),races:0,picks:0,skippedStartedOrUnknown:0}
for(const city of new Set(races.map(r=>r.city))){
 const record=findDailyAiAnalysis(date,city);if(!record?.analysis?.races?.length)continue
 let changed=0
 const predictions=record.analysis.races.map(p=>{
  const r=races.find(r=>r.city===city&&Number(r.no)===Number(p.raceNo)),time=String(r?.time||'').replace('.',':')
  const start=/^\d{1,2}:\d{2}$/.test(time)?Date.parse(`${r.scheduledDate||date}T${time.padStart(5,'0')}:00+03:00`):NaN
  if(!Number.isFinite(start)||start<=now.getTime()){report.skippedStartedOrUnknown++;return p}
  const picks=p.picks.map(pick=>{const horse=r.horses.find(h=>h.name===pick.horseName);if(!horse)return pick;const rival=p.picks.map(p=>r.horses.find(h=>h.name===p.horseName)).find(h=>h&&!h.outOfRace&&h.name!==horse.name);report.picks++;return {...pick,reason:fluentHorseReason(r,horse,date,rival)}})
  changed++;report.races++;return {...p,...commentaryModelCaution(r,p),picks,explanationRevision:'evidence-v3-fluent',explanationUpdatedAt:now.toISOString()}
 })
 if(changed){try{await writeFile(`${directory}/${Buffer.from(city).toString('hex')}.json`,JSON.stringify(record),{flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e}saveDailyAiAnalysis({...record,analysis:{...record.analysis,races:predictions}})}
}
await writeFile('data/maintenance/fluent-commentary-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
