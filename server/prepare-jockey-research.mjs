import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {jockeyEvidence,jockeyResearchFeatures,jockeyResearchFeatureNames} from './jockey-evidence.mjs'
import {jockeyIdentityV2,horseIdentityV2} from './racing-identity.mjs'
import {racingCountry} from './foreign-data.mjs'
const [root,out]=process.argv.slice(2),countries=['TR','US'],sha=t=>createHash('sha256').update(t).digest('hex'),read=async p=>JSON.parse(await readFile(p,'utf8'))
if(!root?.startsWith('data/intelligence-models/')||!out?.startsWith('data/experiments/jockey-'))throw Error('Versioned frozen experiment required')
const archiveText=await readFile(root+'/archive.json','utf8'),archive=JSON.parse(archiveText),hist=new Map(),targets=new Map(),datasets=new Map(),outputs=new Map(),manifest={archiveIndexSha256:sha(archiveText),days:[],role:'retrospective_frozen_archive_research_not_prospective_proof'}
for(const c of countries){const text=await readFile(`${root}/${c}/${c}-training.json`,'utf8'),data=JSON.parse(text);datasets.set(c,{data,hash:sha(text)});outputs.set(c,new Map());for(const r of data.races){if(!targets.has(r.date))targets.set(r.date,[]);targets.get(r.date).push({...r,country:c})}}
let completedDays=0
for(const day of archive.days.toSorted()){
 if(++completedDays%100===0)console.log(JSON.stringify({phase:'archive_features',day,completedDays,totalDays:archive.days.length}))
 const text=await readFile(`${root}/archive-days/${day}.json`,'utf8'),races=JSON.parse(text);manifest.days.push({day,sha256:sha(text)})
 for(const target of targets.get(day)||[]){const race=races.find(r=>r.city===target.city&&Number(r.no)===Number(target.no));if(!race)throw Error('Frozen program missing');const features=target.horses.map(name=>{const horse=race.horses.find(h=>horseIdentityV2(h.name)===horseIdentityV2(name));if(!horse)throw Error('Frozen horse missing');return jockeyResearchFeatures(jockeyEvidence(race,horse,day,hist.get(`${target.country}:${jockeyIdentityV2(horse.jockey)}`)||[]))});outputs.get(target.country).set(JSON.stringify([day,target.city,target.no]),{date:day,city:target.city,no:target.no,horses:target.horses,features})}
 // All target features are emitted BEFORE adding any result from this date.
 for(const race of races){const c=racingCountry(race.city)||'TR';if(!countries.includes(c))continue;const results=new Map(race.results);for(const horse of race.horses){const result=results.get(horse.no)||results.get(Number(horse.no));if(!(result?.finishPosition>0))continue;const k=`${c}:${jockeyIdentityV2(horse.jockey)}`;if(!hist.has(k))hist.set(k,[]);hist.get(k).push({date:day,city:race.city,raceNo:race.no,horseName:horse.name,jockey:horse.jockey,finishPosition:result.finishPosition,surface:race.surface,distance:race.distance})}}
}
for(const c of countries){const dir=`${out}/${c}`;await mkdir(dir,{recursive:true});const manifestText=JSON.stringify(manifest);await writeFile(dir+'/source-manifest.json',manifestText);const {data,hash}=datasets.get(c),rows=data.races.map(r=>outputs.get(c).get(JSON.stringify([r.date,r.city,r.no])));if(rows.some(r=>!r))throw Error('Missing training identity');await writeFile(dir+'/jockey-features-v1.json',JSON.stringify({featureNames:jockeyResearchFeatureNames,trainingSha256:hash,sourceSha256:sha(manifestText),races:rows}));console.log(JSON.stringify({country:c,races:rows.length,addedFeatures:jockeyResearchFeatureNames.length}))}

// Read-only frozen evidence for today's explanations; names and rider changes are checked again at serving.
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date())
if(process.env.EXPORT_FROZEN_JOCKEY_COMMENTARY==='1')try{const program=await read(`data/program-cache/${date}.json`),records=[];for(const race of program.races)for(const horse of race.horses){const c=racingCountry(race.city)||'TR';if(!countries.includes(c))continue;records.push({city:race.city,raceNo:race.no,horseName:horse.name,jockey:horse.jockey,evidence:jockeyEvidence(race,horse,date,hist.get(`${c}:${jockeyIdentityV2(horse.jockey)}`)||[])})}await writeFile(`data/maintenance/jockey-evidence-${date}.json`,JSON.stringify({date,createdAt:new Date().toISOString(),archiveThrough:archive.days.at(-1),records}));console.log(JSON.stringify({currentEvidenceRecords:records.length,archiveThrough:archive.days.at(-1)}))}catch(e){if(e.code!=='ENOENT')throw e}
