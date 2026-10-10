import {readFile,writeFile} from 'node:fs/promises'
process.env.HORSERIDE_NO_LISTEN='1'
const {collectHistoricalDay}=await import('./index.mjs')
const days=Number(process.argv[2]||365),end=process.argv[3]||'2026-10-04'
if(!Number.isInteger(days)||days<1||days>730||!/^\d{4}-\d{2}-\d{2}$/.test(end))throw Error('Invalid date range')
const file=`data/foreign-history-progress-${days}-${end}.json`
let report={days,end,completed:{},failures:{}}
try{report=JSON.parse(await readFile(file,'utf8'))}catch{}
const dates=Array.from({length:days},(_,i)=>new Date(new Date(`${end}T12:00:00Z`).getTime()-(days-i-1)*86400000).toISOString().slice(0,10)).filter(d=>!report.completed[d])
let next=0,writes=Promise.resolve()
await Promise.all(Array.from({length:3},async()=>{while(next<dates.length){const date=dates[next++];try{const row=await collectHistoricalDay(date,{foreignOnly:true});if(row.failures.length)report.failures[date]=row;else{report.completed[date]=row;delete report.failures[date]}}catch(e){report.failures[date]={error:e.message}}
 const text=JSON.stringify(report);writes=writes.then(()=>writeFile(file,text));await writes
 console.log(JSON.stringify({date,complete:Object.keys(report.completed).length,failed:Object.keys(report.failures).length,savedIncludingPartialDays:[...Object.values(report.completed),...Object.values(report.failures)].reduce((n,r)=>n+(r.saved||0),0),errors:report.failures[date]?.failures?.map(f=>`${f.city}: ${f.error}`)}))
}}))
report.finishedAt=new Date().toISOString();await writeFile(file,JSON.stringify(report))
