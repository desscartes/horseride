import {readFileSync,writeFileSync,renameSync} from 'node:fs'
import assert from 'node:assert/strict'
import {evaluateTreeModel,raceFeatures,createRankingHistory,addRankingDayToHistory} from './ranking.mjs'
import {externalChartHistory,externalChartFeatures,racingCountry,equibaseTracks} from './foreign-data.mjs'
import {performanceFeatures} from './performance-features.mjs'
import {paceHistory,paceFeatures} from './pace-features.mjs'
import {matchEquibaseWorkouts} from './equibase-workouts.mjs'
import {listHistoricalRaces} from './database.mjs'
const root=process.argv[2],read=p=>JSON.parse(readFileSync(p,'utf8')),summary=read(`${root}/training-report.json`)
const charts=read(`${root}/charts.json`).races,external=externalChartHistory(charts),paces=paceHistory(charts),archive=listHistoricalRaces(),workouts=read('data/external/equibase-workouts/records.json').records
const verified=[]
for(const report of summary.countries){
 if(!report.shadowEnabled)continue
 const folder=`${root}/${report.country}`,ref=read(`${folder}/reference.json`),model=read(`${folder}/live.json`)
 const delta=Math.max(...ref.features.map((f,i)=>Math.abs(evaluateTreeModel(model,report.featureIndexes.map(j=>f[j]))-ref.scores[i])))
 assert.ok(delta<1e-6,'Python / Node scoring mismatch')
 const history=createRankingHistory({identityVersion:report.identityVersion}),groups=new Map()
 for(const r of archive.filter(r=>r.date<ref.date&&racingCountry(r.city)===report.country)){if(!groups.has(r.date))groups.set(r.date,[]);groups.get(r.date).push(r)}
 for(const [day,rows]of [...groups].sort(([a],[b])=>a.localeCompare(b)))addRankingDayToHistory(history,rows,day)
 const original=archive.find(r=>r.date===ref.date&&r.city===ref.city&&Number(r.no)===Number(ref.raceNo))
 assert.ok(original,'Reference race missing')
 const race={...original,horses:original.horses.map(h=>report.country==='US'?{...h,workouts:matchEquibaseWorkouts(workouts,h,ref.date)}:h)}
 const base=raceFeatures(race,ref.date,history),extra=performanceFeatures(race,ref.date,history.performance),pace=report.country==='US'?paceFeatures(race,ref.date,paces,equibaseTracks[race.city]?.name):null
 const vectors=base.map((f,i)=>[...f,...externalChartFeatures(race.horses[i],ref.date,report.country,external),...extra[i],...(pace?pace[i]:[])])
 for(const [i,name]of ref.horses.entries())assert.deepEqual(vectors[race.horses.findIndex(h=>h.name===name)],ref.features[i],'Runtime / export feature mismatch')
 report.runtimeParityMaxDifference=delta;report.fullRuntimeFeatureParity=true
 writeFileSync(`${folder}/report.json`,JSON.stringify(report,null,2))
 verified.push({country:report.country,delta,featureCount:vectors[0].length})
}
// Publish shadow pointers only after every trained country passed runtime verification.
for(const row of verified){const folder=`${root}/${row.country}`,path=`data/overseas-expansion/latest-${row.country}.json`;writeFileSync(`${path}.tmp`,JSON.stringify({reportPath:`${folder}/report.json`,modelPath:`${folder}/live.json`}));renameSync(`${path}.tmp`,path)}
writeFileSync(`${root}/verification.json`,JSON.stringify({verified,activeModelChanged:false},null,2));console.log(JSON.stringify({verified,activeModelChanged:false}))
