import {mkdir,readFile,writeFile,rename} from 'node:fs/promises'
import {load} from 'cheerio'
import {pathToFileURL} from 'node:url'
import {parseEquibaseWorkouts,mergeWorkoutArchive} from './equibase-workouts.mjs'
export async function collectEquibaseWorkouts(){
const root='https://tvg.equibase.com',directory='data/external/equibase-workouts';await mkdir(directory,{recursive:true})
const indexUrl=root+'/static/workout/index.html',response=await fetch(indexUrl,{signal:AbortSignal.timeout(15000)})
if(!response.ok)throw Error(`Index HTTP ${response.status}`)
const html=await response.text(),$=load(html)
// Horses also train away from today's racecourse; include official training facilities.
const codes=[...new Set($('a[href]').toArray().map(e=>$(e).attr('href').match(/\/([A-Z0-9]+)-calendar\.html/)?.[1]).filter(Boolean))]
if(!codes.length)throw Error('Requested workout tracks not discovered')
const urls=[...new Set($('a[href]').toArray().map(e=>new URL($(e).attr('href'),root)).filter(u=>u.hostname==='tvg.equibase.com'&&codes.some(code=>new RegExp(`/static/workout/${code}\\d{6}USA-EQB\\.html$`).test(u.pathname))).map(u=>u.href))]
const report={tracks:codes,pages:urls.length,rows:0,failures:[]},rows=[];let next=0
const deadline=Date.now()+10*60_000
await Promise.all(Array.from({length:2},async()=>{while(next<urls.length){if(Date.now()>deadline){report.failures.push({error:'Collection time budget reached',remainingPages:urls.length-next});break}
  const url=urls[next++],file=`${directory}/${new URL(url).pathname.split('/').at(-1)}`
  try{let text;try{text=await readFile(file,'utf8')}catch{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`HTTP ${r.status}`);text=await r.text();await writeFile(file,text)}rows.push(...parseEquibaseWorkouts(text,url))}catch(e){report.failures.push({url,error:e.message})}
}}))
let previous=[];try{previous=JSON.parse(await readFile(`${directory}/records.json`,'utf8')).records||[]}catch{}
const archive=mergeWorkoutArchive(previous,rows)
report.scope='all_official_index_tracks_and_training_facilities';report.fetchedRows=rows.length;report.rows=archive.length;report.from=archive[0]?.dateISO;report.through=archive.at(-1)?.dateISO;report.collectedAt=new Date().toISOString()
const temporary=`${directory}/records-${process.pid}-${Date.now()}.json.tmp`;await writeFile(temporary,JSON.stringify({report,records:archive}));await rename(temporary,`${directory}/records.json`);return report
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await collectEquibaseWorkouts()))
