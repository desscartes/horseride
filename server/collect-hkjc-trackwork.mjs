import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {load} from 'cheerio'
import {pathToFileURL} from 'node:url'
export async function collectHongKongTrackwork(){
const root='data/external/hkjc-additional';await mkdir(root,{recursive:true})
const indexResponse=await fetch('https://racing.hkjc.com/en-us/local/information/trackworksearch',{signal:AbortSignal.timeout(20000)});if(!indexResponse.ok)throw Error(`Trackwork index HTTP ${indexResponse.status}`)
const html=await indexResponse.text();await writeFile(`${root}/trackwork.html`,html);const index=load(html)
const dates=index('#oneDay option').toArray().map(e=>index(e).attr('value')).filter(Boolean).slice(0,3)
const records=[],failures=[]
await Promise.all(dates.map(async token=>{
 const [day,month,year]=token.split('/'),date=`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`
 try{
  const pageUrl=`https://racing.hkjc.com/en-us/local/information/trackworkonedayresult?OneDay=${encodeURIComponent(token)}`
  const response=await fetch(pageUrl,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`Page HTTP ${response.status}`)
  const html=await response.text(),endpoint=html.match(/url:\s*"(\/racing\/information\/json\/TrackworkOneDayRecords\/(\d{8})1E\.aspx\?PageNum=)"/)?.[1]
  if(!endpoint||!endpoint.includes(date.replaceAll('-','')))throw Error('Dated official trackwork endpoint not verified')
  let page=1
  for(let count=0;count<40;count++){
   const sourceUrl=`https://racing.hkjc.com${endpoint}${page}`,file=`${root}/trackwork-${date}-${page}.json`
   let data;try{data=JSON.parse(await readFile(file,'utf8'))}catch{const r=await fetch(sourceUrl,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`JSON HTTP ${r.status}`);data=await r.json();await writeFile(file,JSON.stringify(data))}
   if(!Array.isArray(data.Records)||!data.Records.length)break
   for(const row of data.Records)records.push({horseName:load(row.Horse||'').text().trim(),dateISO:date,type:row.Type,racecourse:row.Racecourse_Track,description:row.Workouts,gear:row.Gear,sourceUrl,provider:'HKJC',distanceMeters:null,timeSeconds:null,splits:{}})
   if(!data.next||Number(data.next)<=page)break
   page=Number(data.next)
  }
 }catch(e){failures.push({date,error:e.message})}
}))
let previous=[];try{previous=JSON.parse(await readFile(`${root}/trackwork-records.json`,'utf8')).records||[]}catch{}
const rows=[...new Map([...previous,...records].map(r=>[`${r.horseName}:${r.dateISO}:${r.type}:${r.racecourse}:${r.description}`,r])).values()]
const observedAt=new Date().toISOString(),observedDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
await writeFile(`${root}/trackwork-records.json`,JSON.stringify({observedAt,observedDate,records:rows,failures}));return {dates,records:rows.length,failures}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await collectHongKongTrackwork()))
