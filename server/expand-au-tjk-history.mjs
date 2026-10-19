process.env.HORSERIDE_NO_LISTEN='1'
import './runtime-env.mjs'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync,writeFileSync} from 'node:fs'
import {racingCountry} from './foreign-data.mjs'
const limit=Number(process.argv[2]||3);if(!Number.isInteger(limit)||limit<1||limit>180)throw Error('Invalid day limit')
const db=new DatabaseSync('data/horseride.sqlite',{readOnly:true}),auDates=new Set()
for(const r of db.prepare('SELECT date,race_json FROM historical_race_data').iterate())if(racingCountry(JSON.parse(r.race_json).city)==='AU')auDates.add(r.date)
const dates=db.prepare("SELECT DISTINCT date FROM historical_race_data WHERE date>='2024-12-01' AND date<='2026-10-15' ORDER BY date").all().map(r=>r.date).filter(d=>[4,5].includes(new Date(d+'T12:00:00Z').getUTCDay()));db.close()
const path='data/maintenance/au-history-expansion.json';let state={startedAt:new Date().toISOString(),source:'TJK official archived program and results',country:'AU',knownAuDatesSkipped:auDates.size,completed:{},failures:{},newRaces:0}
try{state=JSON.parse(readFileSync(path,'utf8'))}catch{}
const chosen=dates.filter(d=>!state.completed[d]&&!state.failures[d]).slice(0,limit);state.phase='collecting';state.sampling='Thursday and Friday TJK-listed meetings; winner targets only; no complete-finishing-order claim';state.selected=chosen;writeFileSync(path,JSON.stringify(state,null,2))
const {collectHistoricalDay}=await import('./index.mjs')
for(const date of chosen){
 try{const result=await collectHistoricalDay(date,{foreignOnly:true,countries:['AU'],stageWinnerTargetsPath:'data/external/racing-australia/tjk-winner-targets.json'});state.completed[date]=result;state.newRaces+=result.saved;console.log(JSON.stringify({date,meetings:result.meetings,saved:result.saved,winnerTargets:result.reports.reduce((n,r)=>n+(r.stagedWinnerTargets||0),0),errors:result.failures}));if(result.failures.length)state.failures[date]=result.failures}catch(e){state.failures[date]=[{error:e.message}];console.log(JSON.stringify({date,error:e.message}))}
 state.updatedAt=new Date().toISOString();writeFileSync(path,JSON.stringify(state,null,2))
 const last=Object.keys(state.completed).slice(-3);if(last.length===3&&last.every(d=>state.completed[d].failures.length)){state.phase='stopped_repeated_source_failure';break}
}
if(state.phase==='collecting')state.phase='batch_complete';state.finishedAt=new Date().toISOString();writeFileSync(path,JSON.stringify(state,null,2))