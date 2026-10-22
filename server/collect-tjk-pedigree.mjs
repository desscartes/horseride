import {acquireCollectionGate} from './collection-gate.mjs'
import {applyStagedPedigree} from './apply-staged-pedigree.mjs'
import './runtime-env.mjs'
import {historicalRaceDates,iterateHistoricalDay} from './database.mjs'
import {readServedProgram} from './served-program.mjs'
import {racingCountry} from './foreign-data.mjs'
import {localDay} from './maintenance-policy.mjs'
import {pedigreeTrainingTargets} from './pedigree-training-targets.mjs'
import {parseTjkPedigree,validatedRegistryPedigree,saveRegistryPedigree} from './pedigree-registry.mjs'
import {remoteDeployment} from './deployment-role.mjs'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
if(remoteDeployment())throw Error('Pedigree collection belongs to the home server')
await acquireCollectionGate()
await applyStagedPedigree(localDay())
const today=localDay(),horses=new Map(),limit=Math.max(1,Math.min(200,Number(process.env.PEDIGREE_BATCH_SIZE)||40))
const selectedCountries=new Set((process.env.PEDIGREE_COUNTRIES||'TR').split(',').map(c=>c.trim()).filter(Boolean))
if([...selectedCountries].some(c=>!['TR','US','GB','FR','ZA'].includes(c)))throw Error('Unsupported pedigree collection country')
let retries={};try{retries=JSON.parse(await readFile('data/external/tjk-pedigree/retries.json','utf8'))}catch{}
function add(race){const country=racingCountry(race.city)||(race.foreign?null:'TR');if(!selectedCountries.has(country))return;for(const h of race.horses){const id=h.horseId||h.sourceData?.tjk?.horseId;if(/^[1-9]\d*$/.test(String(id||''))&&h.sire&&h.dam&&!validatedRegistryPedigree(h))horses.set(String(id),h)}}
const trainingPriority=process.env.PEDIGREE_PRIORITY==='training_frequency',through=process.env.PEDIGREE_HISTORY_THROUGH||today
let selected=[]
if(trainingPriority){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(through)||through>=today)throw Error('Training pedigree targeting requires an explicit prior-day cutoff')
 const registry=JSON.parse(await readFile('data/external/tjk-pedigree/registry.json','utf8')).records||{}
 function* history(){for(const date of historicalRaceDates())if(date<=through)yield* iterateHistoricalDay(date)}
 selected=pedigreeTrainingTargets(history(),{through,countries:[...selectedCountries],registry,retries,limit})
 for(const target of selected)horses.set(target.id,target.horse)
}else{
 for(const r of readServedProgram(today)?.races||[])add(r)
 if(process.env.PEDIGREE_CURRENT_ONLY!=='1')for(const date of historicalRaceDates().reverse()){if(horses.size>=limit*3)break;for(const r of iterateHistoricalDay(date))add(r)}
}
const report={startedAt:new Date().toISOString(),countries:[...selectedCountries],priority:trainingPriority?'training_frequency':'current_program',...(trainingPriority?{through,targetArchiveStarts:selected.reduce((n,t)=>n+t.observedStarts,0),targets:selected.map(t=>({horseId:t.id,observedStarts:t.observedStarts}))}:{}),pendingObserved:horses.size,attempted:0,saved:0,failures:[]};let next=0;const tasks=[...horses.values()].filter(h=>Date.parse(retries[h.horseId||h.sourceData?.tjk?.horseId]?.after||'')<=Date.now()||!retries[h.horseId||h.sourceData?.tjk?.horseId]).slice(0,limit)
const deadline=Date.now()+4*60_000
let consecutiveTransportFailures=0
await mkdir('data/external/tjk-pedigree',{recursive:true})
await Promise.all(Array.from({length:2},async()=>{while(next<tasks.length&&Date.now()<deadline){const horse=tasks[next++],url=`https://www.tjk.org/TR/YarisSever/Query/ConnectedPage/AtKosuBilgileri?1=1&QueryParameter_AtId=${horse.horseId||horse.sourceData.tjk.horseId}&Era=today`;report.attempted++;try{
 const file=`data/external/tjk-pedigree/${horse.horseId||horse.sourceData.tjk.horseId}.html`;let html,row
 try{html=await readFile(file,'utf8');row=parseTjkPedigree(html,horse,url)}catch{}
 if(!row){const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0',Referer:'https://www.tjk.org/'},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`HTTP ${response.status}`);html=await response.text();await writeFile(file,html);row=parseTjkPedigree(html,horse,url)}
 if(!row)throw Error(`Official parents/registry not verified (${html.length} characters)`);await saveRegistryPedigree(row);delete retries[row.horseId];report.saved++;consecutiveTransportFailures=0
 }catch(e){const id=horse.horseId||horse.sourceData?.tjk?.horseId;report.failures.push({horseId:id,error:e.message});retries[id]={after:new Date(Date.now()+(/not verified/.test(e.message)?7*86400000:3600000)).toISOString(),reason:e.message};consecutiveTransportFailures=/not verified/.test(e.message)?0:consecutiveTransportFailures+1}
 if(report.saved%20===0&&report.saved)console.log(JSON.stringify({saved:report.saved,attempted:report.attempted,pending:tasks.length,failures:report.failures.length}))
 // A source-wide outage should not consume the complete daily batch.
 if(consecutiveTransportFailures>=4){report.stopReason='repeated_source_transport_failure';next=tasks.length}
}}))
report.deferredBatch=tasks.length-report.attempted;report.finishedAt=new Date().toISOString();await mkdir('data/external/tjk-pedigree',{recursive:true});await writeFile('data/external/tjk-pedigree/retries.json',JSON.stringify(retries));await writeFile(`data/external/tjk-pedigree/${trainingPriority?'training-collection-report':'collection-report'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report))
