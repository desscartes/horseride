import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {evaluateTreeModel,createRankingHistory,addRankingDayToHistory} from './ranking.mjs'
import {performanceFeatures} from './performance-features.mjs'
import {listHistoricalRaces} from './database.mjs'
import {racingCountry} from './foreign-data.mjs'
for(const country of ['TR','US']){
 const root='data/foreign-models-performance',meta=JSON.parse(readFileSync(`${root}/${country}-report.json`)),ref=JSON.parse(readFileSync(`${root}/${country}-reference.json`)),model=JSON.parse(readFileSync(`${root}/${country}-test.json`))
 const differences=ref.features.map((f,i)=>Math.abs(evaluateTreeModel(model,meta.featureIndexes.map(j=>f[j]))-ref.scores[i]))
 assert.ok(Math.max(...differences)<1e-9)
 const data=JSON.parse(readFileSync(`${root}/${country}-training.json`)),target=data.races.find(r=>r.date>=meta.test.from)
 const archive=listHistoricalRaces().filter(r=>(r.foreign?racingCountry(r.city):'TR')===country),history=createRankingHistory(),days=new Map()
 for(const r of archive.filter(r=>r.date<target.date)){if(!days.has(r.date))days.set(r.date,[]);days.get(r.date).push(r)}
 for(const [date,races] of days)addRankingDayToHistory(history,races,date)
 const race=archive.find(r=>r.date===target.date&&r.city===target.city&&r.no===target.no),vectors=performanceFeatures(race,target.date,history.performance)
 const offset=country==='TR'?58:65
 for(const [i,name] of target.horses.entries()){
  const index=race.horses.findIndex(h=>h.name===name);assert.ok(index>=0)
  assert.deepEqual(vectors[index],target.features[i].slice(offset))
 }
 console.log(JSON.stringify({country,pythonNodeMaxDifference:Math.max(...differences),liveTrainingFeatureParity:true,date:target.date}))
}
