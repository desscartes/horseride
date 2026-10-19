import {parseAustralianResultEvidence} from './australian-results.mjs'
import './runtime-env.mjs'
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {load} from 'cheerio'
const clean=v=>String(v||'').replace(/\s+/g,' ').trim()
const registry=JSON.parse(readFileSync('data/external/racing-australia/registry.json','utf8'))
const unique=new Map()
for(const s of registry.snapshots)for(const p of s.runners)for(const r of p.pastRuns){if(r.date<'2024-10-16'||r.date>='2026-10-16'||!r.sourceUrl)continue;unique.set(r.date+':'+r.city,r)}
// Spread source meetings over time instead of collecting only the latest test window.
const all=[...unique.values()].sort((a,b)=>a.date.localeCompare(b.date)),selected=all.filter((r,i)=>i%Math.max(1,Math.floor(all.length/80))===0).slice(0,80)
const directory='data/external/racing-australia/history';mkdirSync(directory,{recursive:true})
let archive={races:[]};try{archive=JSON.parse(readFileSync(directory+'/archive.json','utf8'))}catch{}
const report={startedAt:new Date().toISOString(),availableMeetings:all.length,selected:selected.length,completed:[],failures:[],purpose:'Separate official evidence staging; not imported into live database or treated as a trained model'}
for(const r of selected){
 try{
  const id=createHash('sha256').update(r.sourceUrl).digest('hex').slice(0,16),file=directory+'/'+id+'.html'
  let html;try{html=readFileSync(file,'utf8')}catch{const response=await fetch(r.sourceUrl,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('HTTP '+response.status);html=await response.text();writeFileSync(file,html)}
  if(/Are you human\?|let us know that you are not a robot/i.test(html))throw Error('official_source_human_verification_required')
  const parsed=parseAustralianResultEvidence(html,{date:r.date,sourceUrl:r.sourceUrl,observedAt:new Date().toISOString()})
  const rows=parsed.races
  if(!rows.length)throw Error('No complete numeric result fields parsed')
  for(const race of rows){const key=race.date+':'+race.venue+':'+race.no;archive.races=archive.races.filter(x=>x.date+':'+x.venue+':'+x.no!==key);archive.races.push(race)}
  report.completed.push({date:r.date,city:r.city,races:rows.length});console.log(JSON.stringify(report.completed.at(-1)))
 }catch(e){report.failures.push({date:r.date,city:r.city,error:e.message});console.log(JSON.stringify(report.failures.at(-1)));if(e.message==='official_source_human_verification_required')report.status='blocked_by_source_verification'}
 writeFileSync(directory+'/archive.json.tmp',JSON.stringify(archive));renameSync(directory+'/archive.json.tmp',directory+'/archive.json')
 writeFileSync(directory+'/collection-report.json',JSON.stringify({...report,races:archive.races.length},null,2))
 if(report.status==='blocked_by_source_verification')break
}
report.finishedAt=new Date().toISOString();writeFileSync(directory+'/collection-report.json',JSON.stringify({...report,races:archive.races.length},null,2))