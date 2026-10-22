import {programWithJockeyEvidence} from './jockey-evidence.mjs'
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {localDay} from './maintenance-policy.mjs'
import {emergencyCommentary} from './commentary-fallback.mjs'
const day=localDay(),program=await programWithJockeyEvidence(JSON.parse(await readFile(`data/program-cache/${day}.json`,'utf8'))),directory=`data/maintenance/commentary-ready/${day}`
await mkdir(directory,{recursive:true});const results=[]
for(const city of new Set(program.races.map(r=>r.city))){const payload=emergencyCommentary(program,day,city);if(!payload)continue;const id=createHash('sha256').update(city).digest('hex'),path=`${directory}/${id}.json`;await writeFile(path+'.tmp',JSON.stringify(payload));await rename(path+'.tmp',path);results.push({city,races:payload.analysis.races.length})}
await writeFile('data/maintenance/commentary-watchdog.json',JSON.stringify({checkedAt:new Date().toISOString(),day,results,noForecastHistoryWrites:true,noPaidCalls:true},null,2));console.log(JSON.stringify({day,meetings:results.length,races:results.reduce((n,r)=>n+r.races,0)}))
