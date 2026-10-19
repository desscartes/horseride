import {mkdir,readFile,writeFile,rename} from 'node:fs/promises'
import {parseAustralianForm} from './australian-form.mjs'
const venues={'Cranbourne Avustralya':['VIC','Southside Cranbourne']}
export async function collectAustralianForm(date,city){
 const venue=venues[city];if(!venue)return {skipped:true,reason:'official_venue_not_mapped'}
 const path='data/external/racing-australia/registry.json',directory='data/external/racing-australia'
 let registry={snapshots:[]};try{registry=JSON.parse(await readFile(path,'utf8'))}catch{}
 const found=registry.snapshots.find(s=>s.date===date&&s.city===city)
 if(found)return {cached:true,profiles:found.runners.length}
 let sourceState;try{sourceState=JSON.parse(await readFile('data/external/racing-australia/history/collection-report.json','utf8'))}catch{}
 if(sourceState?.status==='blocked_by_source_verification')throw Error('Racing Australia source verification is required; cached data remains available and no automatic request was sent')
 const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],key=date.slice(0,4)+months[Number(date.slice(5,7))-1]+date.slice(8)+','+venue.join(','),url='https://www.racingaustralia.horse/FreeFields/AllForm.aspx?Key='+encodeURIComponent(key)+'&recentForm=N'
 const response=await fetch(url,{signal:AbortSignal.timeout(40000)});if(!response.ok)throw Error('Racing Australia HTTP '+response.status)
 const html=await response.text(),snapshot=parseAustralianForm(html,{date,city,sourceUrl:url})
 await mkdir(directory,{recursive:true});await writeFile(`${directory}/${date}-cranbourne.html`,html)
 // Read again before merging so another completed meeting is retained.
 try{registry=JSON.parse(await readFile(path,'utf8'))}catch{}
 registry.snapshots=registry.snapshots.filter(s=>s.date!==date||s.city!==city);registry.snapshots.push(snapshot)
 await writeFile(path+'.tmp',JSON.stringify(registry));await rename(path+'.tmp',path)
 return {date,city,profiles:snapshot.runners.length,runs:snapshot.runners.reduce((n,p)=>n+p.pastRuns.length,0)}
}