import {readFile,readdir,mkdir,writeFile,rename} from 'node:fs/promises'
import {DatabaseSync} from 'node:sqlite'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {prospectiveMetrics} from './prospective-metrics.mjs'

export async function reportProspective({directory='data/external/prestart',databasePath='data/horseride.sqlite',output='data/maintenance/prospective-report.json',frozenAt='2026-10-07T15:51:08.556Z'}={}){
  const groups=new Map(),errors=[]
  let files=[];try{files=await readdir(directory)}catch(e){if(e.code!=='ENOENT')throw e}
  for(const file of files.filter(f=>f.endsWith('.json')).sort()){
    try{
      const archive=JSON.parse(await readFile(`${directory}/${file}`,'utf8'))
      for(const record of archive.records||[]){
        if(!record.country||!record.trainedThrough)continue // Unverified model metadata is not an evaluable prediction.
        const key=`${record.country}:${record.modelVersion}`
        if(!groups.has(key))groups.set(key,[]);groups.get(key).push(record)
      }
    }catch(e){errors.push({file,error:e.message})}
  }
  const db=new DatabaseSync(databasePath,{readOnly:true}),outcomes=new Map()
  try{
    for(const row of db.prepare('SELECT date,city,race_no,race_json,results_json FROM historical_race_data WHERE date>=?').all(frozenAt.slice(0,10))){
      const race=JSON.parse(row.race_json),results=new Map(JSON.parse(row.results_json))
      const finish=new Map()
      for(const horse of race.horses){const result=results.get(horse.no);if(result?.finishPosition)finish.set(horse.name,result.finishPosition)}
      outcomes.set(`${row.date}:${row.city}:${row.race_no}`,finish)
    }
  }finally{db.close()}
  const report={updatedAt:new Date().toISOString(),frozenAt,source:'Genuine pre-start captures + official completed outcomes',closingOddsUsed:false,selectionIsCalibratedProbability:false,groups:[...groups].map(([key,records])=>({key,...prospectiveMetrics(records,outcomes,{frozenAt})})),errors,limitations:'Incumbent monitoring only. Comparing a new candidate requires freezing and recording its predictions before future races. Missing identity or incomplete results are excluded.'}
  await mkdir(resolve(output,'..'),{recursive:true})
  const temporary=`${output}.${process.pid}.tmp`;await writeFile(temporary,JSON.stringify(report,null,2));await rename(temporary,output)
  return report
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await reportProspective()))
