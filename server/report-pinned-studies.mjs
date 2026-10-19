import {readFile,readdir,mkdir,writeFile,rename} from 'node:fs/promises'
import {DatabaseSync} from 'node:sqlite'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {intelligenceStudyPointer} from './prospective-model-pin.mjs'
import {prospectiveOutcome} from './prospective-outcomes.mjs'
import {pinnedStudyMetrics} from './pinned-study-metrics.mjs'
export async function reportPinnedStudies({directory='data/intelligence-models',databasePath='data/horseride.sqlite',output='data/maintenance/pinned-studies.json'}={}){
 const pins=[];for(const file of await readdir(directory))if(/^prospective-[A-Z]{2}(?:-(?:arabian|thoroughbred))?\.json$/.test(file))pins.push(intelligenceStudyPointer(file.slice(12,-5),{directory}))
 const groups=[]
 if(pins.length){
  const since=pins.map(p=>p.registeredAt.slice(0,10)).sort()[0],db=new DatabaseSync(databasePath,{readOnly:true}),outcomes=new Map()
  try{
   for(const row of db.prepare('SELECT date,city,race_no,race_json,results_json FROM historical_race_data WHERE date>=?').iterate(since))outcomes.set(`${row.date}:${row.city}:${row.race_no}`,prospectiveOutcome(JSON.parse(row.race_json),new Map(JSON.parse(row.results_json))))
   const numeric=db.prepare("SELECT * FROM forecast_snapshots WHERE source='numeric' AND captured_at>=? AND captured_at<scheduled_start").all(pins.map(p=>p.registeredAt).sort()[0]).map(r=>({...r,picks:JSON.parse(r.picks_json)}))
   for(const pin of pins){const rows=db.prepare("SELECT * FROM forecast_snapshots WHERE source='shadow_intelligence' AND model_version=? AND captured_at>=? AND captured_at<scheduled_start").all(pin.method,pin.registeredAt).map(r=>({...r,picks:JSON.parse(r.picks_json)}));groups.push(pinnedStudyMetrics(pin,rows,numeric,outcomes))}
  }finally{db.close()}
 }
 const report={checkedAt:new Date().toISOString(),scope:'Only predictions captured after model registration and before race start. The closest incumbent capture with the same field must be within 120 seconds. No reconstructed predictions.',groups,note:'Minimum sample is necessary, not sufficient for promotion. Confidence, calibration and all existing review gates still apply. No automatic activation.'}
 await mkdir(resolve(output,'..'),{recursive:true});const temp=`${output}.${process.pid}.tmp`;await writeFile(temp,JSON.stringify(report,null,2));await rename(temp,output);return report
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await reportPinnedStudies()))
