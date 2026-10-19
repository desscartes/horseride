import './runtime-env.mjs'
import {DatabaseSync} from 'node:sqlite'
import {writeFileSync} from 'node:fs'
import {collectAustralianForm} from './collect-australian-form.mjs'
const db=new DatabaseSync('data/horseride.sqlite',{readOnly:true}),dates=[]
for(const row of db.prepare('SELECT date,race_json FROM historical_race_data ORDER BY date DESC').iterate()){
 const race=JSON.parse(row.race_json);if(race.city==='Cranbourne Avustralya'&&row.date<'2026-10-16'&&!dates.includes(row.date))dates.push(row.date)
}
db.close()
const selected=dates.filter((d,i)=>i<6||i%2===0).slice(0,40),report={startedAt:new Date().toISOString(),availableDates:dates.length,selectedDates:selected,completed:[],failures:[]}
for(const date of selected){try{const r=await collectAustralianForm(date,'Cranbourne Avustralya');report.completed.push(r);console.log(JSON.stringify(r))}catch(e){report.failures.push({date,error:e.message});console.log(JSON.stringify({date,error:e.message}))}writeFileSync('data/external/racing-australia/backfill-report.json',JSON.stringify(report,null,2))}
report.finishedAt=new Date().toISOString();writeFileSync('data/external/racing-australia/backfill-report.json',JSON.stringify(report,null,2))