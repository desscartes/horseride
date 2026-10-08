import { readFile,writeFile,mkdir } from 'node:fs/promises'
process.env.HORSERIDE_NO_LISTEN='1'
const {collectHistoricalDay}=await import('./index.mjs')
const days=Number(process.argv[2]||365)
if(!Number.isInteger(days)||days<1||days>730)throw new Error('days must be 1..730')
const end=process.argv[3]||new Date(Date.now()-86400000).toISOString().slice(0,10)
const file=`data/history-progress-${days}-${end}.json`
await mkdir('data',{recursive:true})
let progress={days,end,completed:{},failures:{},startedAt:new Date().toISOString()}
try{progress=JSON.parse(await readFile(file,'utf8'))}catch{}
const dates=Array.from({length:days},(_,i)=>new Date(new Date(`${end}T12:00:00Z`).getTime()-(days-i-1)*86400000).toISOString().slice(0,10)).filter(date=>!progress.completed[date])
let index=0
let writes=Promise.resolve()
const persist=()=>{const json=JSON.stringify(progress);writes=writes.then(()=>writeFile(file,json));return writes}
await Promise.all(Array.from({length:2},async()=>{
  while(index<dates.length){
    const date=dates[index++]
    try{
      const report=await collectHistoricalDay(date)
      if(report.failures.length){progress.failures[date]=report;console.log(JSON.stringify({date,error:report.failures}))}
      else {progress.completed[date]=report;delete progress.failures[date]}
    }catch(error){progress.failures[date]={error:error.message};console.log(JSON.stringify({date,error:error.message}))}
    await persist()
    const count=Object.keys(progress.completed).length
    if(count%5===0)console.log(JSON.stringify({completedDays:count,days,races:Object.values(progress.completed).reduce((sum,r)=>sum+r.saved,0),current:date}))
  }
}))
progress.finishedAt=new Date().toISOString()
await persist()
console.log(JSON.stringify({completedDays:Object.keys(progress.completed).length,failedDays:Object.keys(progress.failures).length,days}))
