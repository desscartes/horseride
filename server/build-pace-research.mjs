import {readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {DatabaseSync} from 'node:sqlite'
import {matchedPace,paceEvidenceNames} from './pace-evidence.mjs'
const [project,input,chartsPath,output]=process.argv.slice(2)
const {foreignHorseIdentity,externalChartHistory,externalChartFeatures,externalFeatureNames}=await import(pathToFileURL(join(project,'server/foreign-data.mjs')))
const data=JSON.parse(await readFile(input,'utf8')),charts=JSON.parse(await readFile(chartsPath,'utf8')).races,history=externalChartHistory(charts)
const db=new DatabaseSync(join(project,'data/horseride.sqlite'),{readOnly:true})
const lookup=new Map(db.prepare('SELECT date,city,race_no,race_json FROM historical_race_data').all().filter(r=>r.city.endsWith('ABD')).map(r=>[`${r.date}:${r.city}:${r.race_no}`,JSON.parse(r.race_json)]));db.close()
const aliases=new Map(),byOfficialName=new Map()
for(const chart of charts)for(const runner of chart.runners){const id=foreignHorseIdentity(runner.name);if(!aliases.has(id))aliases.set(id,new Set());aliases.get(id).add(runner.name);if(!byOfficialName.has(runner.name))byOfficialName.set(runner.name,[]);byOfficialName.get(runner.name).push(chart)}
const start=data.featureNames.indexOf(externalFeatureNames[0]);if(start<0)throw Error('Missing external feature pipeline')
const summary={races:0,matchedPaceRunners:0,ambiguousNamesRejected:0,unknownRaceRejected:0,identityVerified:false,enabled:false}
const rows=[]
for(const r of data.races){
 const race=lookup.get(`${r.date}:${r.city}:${r.no}`);if(!race){summary.unknownRaceRejected++;continue}
 const extra=r.horses.map(name=>{
   const names=aliases.get(foreignHorseIdentity(name));if(!names||names.size!==1){if(names?.size>1)summary.ambiguousNamesRejected++;return [0,0,0,0,0,999,1]}
   const officialName=[...names][0]
   return matchedPace(officialName,race,r.date,byOfficialName.get(officialName)||[])
 })
 const features=r.features.map((f,i)=>{
   const updated=[...f],names=aliases.get(foreignHorseIdentity(r.horses[i]));
   // The inherited name match is not registry-verified; keep this dataset in research.
   if(names?.size===1){const values=externalChartFeatures({name:r.horses[i]},r.date,'US',history);values.forEach((v,j)=>updated[start+j]=v)}
   return [...updated,...extra[i]]
 })
 summary.matchedPaceRunners+=extra.filter(f=>f[0]>0).length;summary.races++
 rows.push({...r,features,surface:race.surface,distance:race.distance})
}
await writeFile(output,JSON.stringify({country:'US',featureNames:[...data.featureNames,...paceEvidenceNames],races:rows,summary,limitations:'Exact chart alias only, still not registry verified. Never deploy these features automatically. Additional charts do not imply complete career coverage.'}))
console.log(JSON.stringify(summary))
