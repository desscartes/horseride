import {readFile,writeFile,copyFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const root='data/foreign-models-performance',target='data/foreign-models',report=JSON.parse(await readFile(`${root}/US-report.json`,'utf8'))
assert.equal(report.enabled,true)
assert.equal(report.featurePipeline,'performance_v1')
assert.ok(report.incumbent.improvementPoints>=2&&report.incumbent.dayBootstrap95[0]>0)
assert.ok(report.test.candidate.brier<report.incumbent.metrics.brier)
assert.ok(report.test.candidate.winnerInTopThree>=report.incumbent.metrics.winnerInTopThree)
const existing=JSON.parse(await readFile(`${target}/US-report.json`,'utf8'))
if(existing.method!==report.method){
 for(const file of ['report','live','test','reference'])await copyFile(`${target}/US-${file}.json`,`${target}/US-before-performance-${file}.json`)
}
await copyFile('data/external/equibase/parsed.json','data/external/equibase/parsed-performance-v3.json')
report.externalChartsPath='data/external/equibase/parsed-performance-v3.json'
report.note='Retrospective comparison on a previously inspected test period. Prospective trial, not an independent new blind test. Normalized prior speed/class, recent connections and pedigree evidence; future/same-day results excluded. Regional forecast and HK current snapshots are qualitative evidence, not learned model inputs.'
for(const file of ['live','test','reference','training'])await copyFile(`${root}/US-${file}.json`,`${target}/US-${file}.json`)
await writeFile(`${target}/US-report.json`,JSON.stringify(report,null,2))
const summary=JSON.parse(await readFile(`${target}/training-report.json`,'utf8'));summary.countries=summary.countries.map(r=>r.country==='US'?report:r)
await writeFile(`${target}/training-report.json`,JSON.stringify(summary,null,2))
console.log(JSON.stringify({activated:report.method,trial:true,previous:existing.method}))
