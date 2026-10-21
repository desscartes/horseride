import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {horseIdentity} from './data-quality.mjs'
import {racingCountry} from './foreign-data.mjs'
import {matchEquibaseWorkouts} from './equibase-workouts.mjs'
import {loadResearchFeatures,loadFeatureNames} from './load-research-features.mjs'
const [root,out]=process.argv.slice(2);if(!root?.startsWith('data/intelligence-models/')||!out?.startsWith('data/experiments/'))throw Error('Versioned frozen inputs required')
const sha=t=>createHash('sha256').update(t).digest('hex'),read=async p=>JSON.parse(await readFile(p,'utf8')),trainingText=await readFile(root+'/US/US-training.json','utf8'),data=JSON.parse(trainingText),archive=await read(root+'/archive.json'),workoutText=await readFile(root+'/workouts.json','utf8'),workouts=JSON.parse(workoutText).records||[],manifest={archiveIndexSha256:sha(await readFile(root+'/archive.json')),workoutsSha256:sha(workoutText),days:[]},history=new Map(),output=new Map(),targets=new Map()
for(const r of data.races){if(!targets.has(r.date))targets.set(r.date,[]);targets.get(r.date).push(r)}
const key=h=>horseIdentity(h.name)
for(const day of [...new Set([...archive.days,...targets.keys()])].sort()){
 for(const r of targets.get(day)||[]){const horses=r.horses.map((name,i)=>{const age=r.features[i][data.featureNames.indexOf('age')];return {name,age,horsePerformance:{recentRuns:history.get(key({name}))||[]},workouts:matchEquibaseWorkouts(workouts,{name,age},day)}});output.set(JSON.stringify([day,r.city,r.no]),{date:day,city:r.city,no:r.no,horses:r.horses,features:loadResearchFeatures({horses},day)})}
 if(!archive.days.includes(day))continue
 const text=await readFile(`${root}/archive-days/${day}.json`,'utf8');manifest.days.push({day,sha256:sha(text)})
 for(const race of JSON.parse(text).filter(r=>racingCountry(r.city)==='US')){const results=new Map(race.results);for(const h of race.horses){const result=results.get(h.no)||results.get(Number(h.no));if(!(result?.finishPosition>0))continue;const k=key(h);if(!history.has(k))history.set(k,[]);history.get(k).push({date:day,city:race.city,raceNo:race.no,finishPosition:result.finishPosition,distance:race.distance})}}
}
await mkdir(out,{recursive:true});const text=JSON.stringify(manifest);await writeFile(out+'/source-manifest.json',text)
const rows=data.races.map(r=>output.get(JSON.stringify([r.date,r.city,r.no])));if(rows.some(r=>!r))throw Error('Missing target identity')
await writeFile(out+'/load-features-v1.json',JSON.stringify({featureNames:loadFeatureNames,trainingSha256:sha(trainingText),sourceSha256:sha(text),sourceScope:'Frozen US TJK historical finishes plus frozen official workouts; observed records, not complete careers. Same-day/future outcomes excluded.',races:rows}));console.log(JSON.stringify({races:rows.length,features:loadFeatureNames,sourceDays:manifest.days.length}))
