import {mkdir,readFile,writeFile,rename,readdir} from 'node:fs/promises'
import {load} from 'cheerio'
import {pathToFileURL} from 'node:url'
import {parseEquibaseWorkouts,mergeWorkoutArchive} from './equibase-workouts.mjs'
export async function collectEquibaseWorkouts({directory='data/external/equibase-workouts',fetchImpl=fetch,budgetMs=120000,maxPages=Infinity}={}){
const root='https://tvg.equibase.com';await mkdir(directory,{recursive:true})
const indexUrl=root+'/static/workout/index.html',response=await fetchImpl(indexUrl,{signal:AbortSignal.timeout(15000)})
if(!response.ok)throw Error(`Index HTTP ${response.status}`)
const html=await response.text(),$=load(html)
// Horses also train away from today's racecourse; include official training facilities.
const codes=[...new Set($('a[href]').toArray().map(e=>$(e).attr('href').match(/\/([A-Z0-9]+)-calendar\.html/)?.[1]).filter(Boolean))]
if(!codes.length)throw Error('Requested workout tracks not discovered')
const urls=[...new Set($('a[href]').toArray().map(e=>new URL($(e).attr('href'),root)).filter(u=>u.hostname==='tvg.equibase.com'&&codes.some(code=>new RegExp(`/static/workout/${code}\\d{6}USA-EQB\\.html$`).test(u.pathname))).map(u=>u.href))]
const cached=new Set(await readdir(directory));let queue={attempted:{}};try{queue=JSON.parse(await readFile(directory+'/queue.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
const now=Date.now(),blocked=urls.filter(url=>(queue.attempted[url]?.retryAfter||0)>now)
const pending=urls.filter(url=>!blocked.includes(url)).sort((a,b)=>Number(cached.has(new URL(a).pathname.split('/').at(-1)))-Number(cached.has(new URL(b).pathname.split('/').at(-1)))||(queue.attempted[a]?.at||0)-(queue.attempted[b]?.at||0)||a.localeCompare(b))
const report={tracks:codes,pages:urls.length,rows:0,failures:[],deferredBackoff:blocked.length,attemptedPages:0,completedPages:0},rows=[];let next=0
const deadline=Date.now()+budgetMs
await Promise.all(Array.from({length:2},async()=>{while(next<pending.length&&next<maxPages){if(Date.now()>deadline)break
  const url=pending[next++];report.attemptedPages++;queue.attempted[url]={at:Date.now()};const file=`${directory}/${new URL(url).pathname.split('/').at(-1)}`
  try{let text;try{text=await readFile(file,'utf8')}catch{const r=await fetchImpl(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Object.assign(Error(`HTTP ${r.status}`),{status:r.status});text=await r.text();await writeFile(file,text)}rows.push(...parseEquibaseWorkouts(text,url));report.completedPages++}catch(e){queue.attempted[url].retryAfter=Date.now()+([401,403].includes(e.status)?86400000:e.status===429?3600000:900000);report.failures.push({url,error:e.message})}
}}))
report.remainingPages=pending.length-next;report.complete=report.remainingPages===0&&blocked.length===0&&report.failures.length===0;await writeFile(directory+'/queue.json.tmp',JSON.stringify(queue));await rename(directory+'/queue.json.tmp',directory+'/queue.json')
let previous=[];try{previous=JSON.parse(await readFile(`${directory}/records.json`,'utf8')).records||[]}catch{}
const archive=mergeWorkoutArchive(previous,rows)
report.scope='all_official_index_tracks_and_training_facilities';report.fetchedRows=rows.length;report.rows=archive.length;report.from=archive[0]?.dateISO;report.through=archive.at(-1)?.dateISO;report.collectedAt=new Date().toISOString()
const temporary=`${directory}/records-${process.pid}-${Date.now()}.json.tmp`;await writeFile(temporary,JSON.stringify({report,records:archive}));await rename(temporary,`${directory}/records.json`);return report
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const {acquireCollectionGate}=await import('./collection-gate.mjs');await acquireCollectionGate();const report=await collectEquibaseWorkouts();console.log(JSON.stringify(report));if(!report.complete)process.exitCode=1}
