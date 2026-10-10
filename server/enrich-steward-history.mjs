import {readFile,writeFile} from 'node:fs/promises'
import {listHistoricalRaces,saveHistoricalRace} from './database.mjs'
import {matchStewardEvents} from './steward-evidence.mjs'
const {events}=JSON.parse(await readFile('data/external/stewards/parsed.json','utf8'))
const report={events:events.length,matchedRaces:0,matchedHorseEvents:0}
for(const race of listHistoricalRaces().filter(r=>!r.foreign)){
 let found=false
 const horses=race.horses.map(h=>{const rows=matchStewardEvents(race,h,events);if(!rows.length)return h;found=true;report.matchedHorseEvents+=rows.length;return {...h,stewardEvidence:rows}})
 if(found){saveHistoricalRace(race.date,{...race,horses},race.results);report.matchedRaces++}
}
await writeFile('data/external/stewards/matching-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
