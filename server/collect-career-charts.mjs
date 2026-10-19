import {mkdir,readFile,writeFile,rename,access} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {fileURLToPath} from 'node:url'

const base='https://tvg.equibase.com/static/chart/pdf/'
export function officialChartLinks(text,through,from='2000-01-01') {
  const links=new Map()
  for(const match of text.matchAll(/\b([A-Z]{2,5})(\d{2})(\d{2})(\d{2})USA\.(?:html|pdf)\b/g)) {
    const [,code,month,day,year]=match,date=`20${year}-${month}-${day}`
    const actual=new Date(`${date}T12:00:00Z`)
    if(!Number.isFinite(+actual)||actual.toISOString().slice(0,10)!==date||date>through||date<from)continue
    const name=`${code}${month}${day}${year}USA.pdf`
    links.set(name,{code,date,name,url:base+name})
  }
  return [...links.values()]
}
export async function collectCareerCharts({output,through,from,existingDirectory,maxDownloads=120,request=fetch}) {
  await mkdir(output,{recursive:true})
  const report={provider:'Equibase official free charts',from,through,startedAt:new Date().toISOString(),discoveredTracks:[],discoveredCharts:0,alreadyInOriginal:0,cached:0,saved:0,failures:[],completeCareer:false}
  const get=async url=>{const r=await request(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return r}
  const index=await (await get(base)).text()
  if(/Pardon Our Interruption/i.test(index))throw Error('Source access blocked')
  const discovered=officialChartLinks(index,through,from)
  const codes=[...new Set(discovered.map(l=>l.code))].sort()
  // The official index embeds its meeting links in JSON; no script evaluation.
  const all=new Map(discovered.map(l=>[l.name,l]))
  for(let offset=0;offset<codes.length;offset+=2)await Promise.all(codes.slice(offset,offset+2).map(async code=>{
    try{const text=await(await get(`${base}${code}-calendar.html`)).text();if(/Pardon Our Interruption/i.test(text))throw Error('Source access blocked');report.discoveredTracks.push(code);for(const link of officialChartLinks(text,through,from))if(link.code===code)all.set(link.name,link)}
    catch(e){report.failures.push({code,phase:'calendar',error:e.message})}
  }))
  report.discoveredCharts=all.size
  const candidates=[]
  for(const link of [...all.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name))) {
    try{if(existingDirectory){await access(join(existingDirectory,link.name));await access(join(existingDirectory,link.name.replace('.pdf','.source.json')));report.alreadyInOriginal++;continue}}catch{}
    try{await access(join(output,link.name));await access(join(output,link.name.replace('.pdf','.source.json')));report.cached++;continue}catch{}
    candidates.push(link)
  }
  report.pendingBeforeRun=candidates.length
  for(let offset=0;offset<Math.min(candidates.length,maxDownloads);offset+=2) {
    await Promise.all(candidates.slice(offset,Math.min(offset+2,maxDownloads)).map(async link=>{
      try{
        const bytes=Buffer.from(await(await get(link.url)).arrayBuffer());if(bytes.subarray(0,4).toString()!=='%PDF')throw Error('Response is not a PDF')
        const file=join(output,link.name);await writeFile(file+'.tmp',bytes);await rename(file+'.tmp',file)
        await writeFile(file.replace('.pdf','.source.json'),JSON.stringify({url:link.url,date:link.date,retrievedAt:new Date().toISOString(),availability:'post_race',scope:'expanded_official_track_calendar'}))
        report.saved++
      }catch(e){report.failures.push({name:link.name,phase:'pdf',error:e.message})}
    }))
    await writeFile(join(output,'collection-report.json'),JSON.stringify(report,null,2))
  }
  report.pendingAfterRun=report.pendingBeforeRun-report.saved
  report.finishedAt=new Date().toISOString()
  report.note='Additional US charts outside TJK meetings; calendar window only, not verified full careers. Result evidence usable only for later race dates. Registry identity still requires verification.'
  await writeFile(join(output,'collection-report.json'),JSON.stringify(report,null,2));return report
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [output,through,from,existingDirectory]=process.argv.slice(2)
  if(!output||!/^\d{4}-\d{2}-\d{2}$/.test(through)||!/^\d{4}-\d{2}-\d{2}$/.test(from))throw Error('Usage: output throughDate fromDate [existingDirectory]')
  console.log(JSON.stringify(await collectCareerCharts({output,through,from,existingDirectory})))
}
