import './runtime-env.mjs'
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises'
import {trainingArchiveDates,trainingArchiveDay} from './training-archive.mjs'
import {readServedProgram} from './served-program.mjs'
import {jockeyEvidence,jockeyResearchFeatures,jockeyResearchFeatureNames} from './jockey-evidence.mjs'
import {jockeyIdentityV2} from './racing-identity.mjs'
import {racingCountry} from './foreign-data.mjs'
import {localDay} from './maintenance-policy.mjs'
const date=process.argv[2]||localDay();if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid date')
const program=readServedProgram(date);if(!program?.races?.length)throw Error('No current program')
const dir='data/maintenance',path=`${dir}/jockey-history-${date}.json`,countries=new Set(program.races.map(r=>racingCountry(r.city)||'TR')),since=new Date(Date.parse(date+'T12:00:00Z')-730*86400000).toISOString().slice(0,10)
let history,index=new Map(),archiveThrough=null
try{history=JSON.parse(await readFile(path,'utf8'));if(history.date!==date||![...countries].every(c=>history.countries.includes(c)))history=null}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e}
if(!history){
 const rows=[]
 for(const day of trainingArchiveDates().filter(d=>d<date&&d>=since).sort()){archiveThrough=day;for(const race of trainingArchiveDay(day)){const country=racingCountry(race.city)||'TR';if(!countries.has(country))continue;for(const h of race.horses){const result=race.results.get(h.no)||race.results.get(Number(h.no));if(!(result?.finishPosition>0))continue;rows.push({date:day,city:race.city,raceNo:race.no,horseName:h.name,jockey:h.jockey,finishPosition:result.finishPosition,surface:race.surface,distance:race.distance})}}}
 history={date,archiveThrough,countries:[...countries],rows};await mkdir(dir,{recursive:true});await writeFile(path+'.tmp',JSON.stringify(history));await rename(path+'.tmp',path)
}
for(const row of history.rows){const key=`${racingCountry(row.city)||'TR'}:${jockeyIdentityV2(row.jockey)}`;if(!index.has(key))index.set(key,[]);index.get(key).push(row)}
const records=[],gaps=[]
for(const race of program.races)for(const horse of race.horses){if(horse.outOfRace)continue;const evidence=jockeyEvidence(race,horse,date,index.get(`${racingCountry(race.city)||'TR'}:${jockeyIdentityV2(horse.jockey)}`)||[]);records.push({city:race.city,raceNo:race.no,horseName:horse.name,jockey:horse.jockey,evidence});gaps.push({city:race.city,raceNo:race.no,horseName:horse.name,jockey:horse.jockey,observed90Starts:evidence?.starts||0,observed30Starts:evidence?.recent30?.starts||0,missingPerformance:!evidence?.starts,smallSample:!!evidence?.starts&&evidence.starts<10,researchFeatures:Object.fromEntries(jockeyResearchFeatureNames.map((n,i)=>[n,jockeyResearchFeatures(evidence)[i]]))})}
const snapshot={date,createdAt:new Date().toISOString(),archiveThrough:history.archiveThrough,records},audit={date,checkedAt:snapshot.createdAt,archiveThrough:history.archiveThrough,runners:gaps.length,missingPerformance:gaps.filter(r=>r.missingPerformance).length,smallSample:gaps.filter(r=>r.smallSample).length,scope:'Verified local archive only; complete career coverage is not established. Previous days only. No model or historical forecast changed.',rows:gaps}
for(const [name,data] of [[`jockey-evidence-${date}`,snapshot],[`jockey-coverage-${date}`,audit]]){await writeFile(`${dir}/${name}.json.tmp`,JSON.stringify(data));await rename(`${dir}/${name}.json.tmp`,`${dir}/${name}.json`)}
console.log(JSON.stringify({date,runners:audit.runners,missingPerformance:audit.missingPerformance,smallSample:audit.smallSample,archiveThrough:audit.archiveThrough}))
