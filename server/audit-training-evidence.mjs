import {readFile,writeFile} from 'node:fs/promises'
import {evidenceCoverageDiagnostics} from './evidence-coverage-drift.mjs'
const root=process.argv[2]||'data/intelligence-models/2026-10-17/morning'
const read=async path=>JSON.parse(await readFile(path,'utf8'))
const report={checkedAt:new Date().toISOString(),root,countries:[],note:'Frozen input coverage, not causal importance. A missing previous start may be a genuine debut or incomplete history. Post-training diagnostics must not be used to repeatedly tune on this test set.'}
for(const country of (process.argv[3]||'TR,US').split(',').filter(Boolean)){
 const metadata=await read(`${root}/${country}/report.json`),data=await read(`${root}/${country}/${country}-training.json`),names=data.featureNames
 const definitions={history:['historyStarts',v=>v>0],workout:['workoutCount',v=>v>0],ownSpeed:['speedEvidenceCount',v=>v>0],damsire:['missingDamsire',v=>v===0],datedWeather:['missingWeather',v=>v===0],prize:['missingRaceWinnerPrize',v=>v===0],previousClass:['missingClassTransition',v=>v===0],tripNotes:['trafficEvidenceCount',v=>v>0]}
 const groups={fit:r=>r.date>=metadata.train.from&&r.date<=metadata.train.through,test:r=>r.date>=metadata.evaluation.testFrom&&r.date<=metadata.evaluation.testThrough}
 const splits={}
 for(const [split,select]of Object.entries(groups)){
  const races=data.races.filter(select),coverage=Object.fromEntries(Object.keys(definitions).map(k=>[k,{known:0,missing:0,winnersKnown:0,winnersMissing:0}]));let runners=0,winners=0
  for(const race of races)for(let i=0;i<race.features.length;i++){
   runners++;const winner=race.labels[i]>0;if(winner)winners++
   for(const [key,[feature,known]]of Object.entries(definitions)){const index=names.indexOf(feature);if(index<0)throw Error(`Missing audit feature ${feature}`);const present=known(race.features[i][index]),field=present?'known':'missing';coverage[key][field]++;if(winner)coverage[key][present?'winnersKnown':'winnersMissing']++}
  }
  for(const v of Object.values(coverage))v.knownPercent=runners?Number((100*v.known/runners).toFixed(1)):null
  splits[split]={races:races.length,runners,winners,coverage}
 }
 const coverageDiagnostics=evidenceCoverageDiagnostics(splits)
 report.countries.push({country,splits,coverageDiagnostics});console.log(JSON.stringify({country,...splits,coverageDiagnostics}))
}
await writeFile(process.argv[4]||'data/maintenance/training-evidence-audit.json',JSON.stringify(report,null,2))
