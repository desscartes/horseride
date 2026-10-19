import {readFile,writeFile,copyFile,mkdir,access} from 'node:fs/promises'
import assert from 'node:assert/strict'
const root='data/foreign-models-next',read=async path=>JSON.parse(await readFile(path,'utf8'))
for(const country of ['TR','US']){
 const report=await read(`${root}/${country}-report.json`)
 if(!report.enabled){
  if(country==='US'){await copyFile('data/external/equibase/parsed.json','data/external/equibase/parsed-performance-v4.json');report.externalChartsPath='data/external/equibase/parsed-performance-v4.json'}
  report.note='Held after retrospective comparison on previously inspected test dates. Added data and qualitative analysis do not establish a new live success rate. Shadow forecasts never change primary picks or coupons.'
  await writeFile(`${root}/${country}-report.json`,JSON.stringify(report,null,2))
  console.log(JSON.stringify({country,activated:false,status:'shadow_only',candidate:report.test.candidate.topOne,incumbent:report.incumbent.metrics.topOne}));continue
 }
 assert.equal(report.featurePipeline,'performance_v2');assert.equal(report.identityVersion,2)
 assert.ok(report.test.candidate.races>=300&&report.incumbent.improvementPoints>=2&&report.incumbent.dayBootstrap95[0]>0)
 assert.ok(report.test.candidate.brier<report.incumbent.metrics.brier&&report.test.candidate.winnerInTopThree>=report.incumbent.metrics.winnerInTopThree)
 report.note='Prospective trial after a retrospective comparison on previously inspected test dates, not a new blind test. Validation and test dates remain fixed. Equipment/apprentice identity and three more months of prior TR race/workout history were added. No live success guarantee.'
 report.prospective=true;report.promoted=false
 if(country==='TR'){
  const existing=await read('data/ranking-report.json'),backup='data/models/before-performance-v4'
  if(existing.method!==report.method){await mkdir(backup,{recursive:true});for(const [from,to] of [['ranking-report.json','report.json'],['ranking-live.json','live.json'],['ranking-environment-test.json','test.json'],['training-races.json','training.json']]){try{await access(`${backup}/${to}`)}catch{await copyFile(`data/${from}`,`${backup}/${to}`)}}}
  report.trainingDataPath='data/ranking-performance-training-v4.json';report.testModelPath='data/ranking-performance-test-v4.json'
  await copyFile(`${root}/TR-training.json`,report.trainingDataPath);await copyFile(`${root}/TR-test.json`,report.testModelPath);await copyFile(`${root}/TR-live.json`,'data/ranking-live.json')
  const domestic={...report};delete domestic.country
  await writeFile('data/ranking-report.json',JSON.stringify(domestic,null,2))
 }else{
  const destination='data/foreign-models'
  for(const file of ['report','live','test','reference','training'])await copyFile(`${destination}/US-${file}.json`,`${destination}/US-before-v4-${file}.json`)
  for(const file of ['live','test','reference','training'])await copyFile(`${root}/US-${file}.json`,`${destination}/US-${file}.json`)
  await copyFile('data/external/equibase/parsed.json','data/external/equibase/parsed-performance-v4.json');report.externalChartsPath='data/external/equibase/parsed-performance-v4.json'
  await writeFile(`${destination}/US-report.json`,JSON.stringify(report,null,2))
 }
 await writeFile(`${root}/${country}-report.json`,JSON.stringify(report,null,2))
 console.log(JSON.stringify({country,activated:true,method:report.method,prospective:true,candidate:report.test.candidate.topOne,improvement:report.incumbent.improvementPoints}))
}
// Correct the incumbent data pointer for future comparisons; its live weights
// and frozen external charts remain untouched when the candidate is held.
const us=await read('data/foreign-models/US-report.json')
if(us.method==='local_catboost_performance_US_v3'){us.trainingDataPath='data/foreign-models-performance/US-training.json';await writeFile('data/foreign-models/US-report.json',JSON.stringify(us,null,2))}
const summary=await read(`${root}/training-report.json`)
summary.countries=await Promise.all(summary.countries.map(r=>read(`${root}/${r.country}-report.json`)))
await writeFile(`${root}/training-report.json`,JSON.stringify(summary,null,2))
