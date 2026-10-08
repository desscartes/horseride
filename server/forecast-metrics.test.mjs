import test from 'node:test'
import assert from 'node:assert/strict'
import {summarizeForecasts} from './forecast-metrics.mjs'
test('old and enriched forecasts stay separate and each uses its latest pre-start snapshot',()=>{
 const row={date:'2026-10-05',city:'Bursa',race_no:1,source:'numeric'}
 const old={...row,model_version:'local_catboost_numeric_ranking_v1',picks:[{horseName:'A KG'}]}
 const updated={...row,model_version:'local_catboost_workout_weather_v2',picks:[{horseName:'B DB'}]}
 const results=new Map([['2026-10-05:Bursa:1',new Map([['A',1],['B',2]])]])
 const stats=summarizeForecasts([old,updated,{...updated,picks:[{horseName:'A K'}]},{...updated,city:'Philadelphia ABD'}],results,true)
 assert.equal(stats.find(s=>s.key==='numeric:previous').topOneRate,100)
 assert.equal(stats.find(s=>s.key==='numeric:extended').recorded,1)
 assert.equal(stats.find(s=>s.key==='numeric:extended').topOneRate,100)
 assert.equal(stats.find(s=>s.source==='daily_ai').topOneRate,null)
})
test('overseas results remain separate by country and by model family',()=>{
 const row={date:'2026-10-05',city:'Gulfstream Park ABD',race_no:1,source:'numeric',picks:[{horseName:'A'}]}
 const results=new Map([['2026-10-05:Gulfstream Park ABD:1',new Map([['A',1]])]])
 const stats=summarizeForecasts([{...row,model_version:'baseline'},{...row,model_version:'local_catboost_country_US_v1'},{...row,city:'Bursa',model_version:'local_catboost_country_US_v1'}],results,false,'US')
 assert.equal(stats.length,2);assert.equal(stats.find(s=>s.key==='US:numeric:foreign_learned').recorded,1);assert.equal(stats.find(s=>s.key==='US:numeric:foreign_learned').topOneRate,100)
})
test('expanded primary and held shadow forecasts never overwrite older live models',()=>{
 const row={date:'2026-10-05',city:'Bursa',race_no:1,source:'numeric',picks:[{horseName:'A'}]}
 const outcomes=new Map([['2026-10-05:Bursa:1',new Map([['A',1],['B',2]])]])
 const rows=[{...row,model_version:'local_catboost_workout_weather_v2',picks:[{horseName:'B'}]},{...row,model_version:'local_catboost_performance_TR_v4'},{...row,source:'shadow_data',model_version:'local_catboost_performance_TR_v4',picks:[{horseName:'B'}]}]
 const stats=summarizeForecasts(rows,outcomes,true,'TR','local_catboost_performance_TR_v4')
 assert.equal(stats.find(s=>s.key==='numeric:expanded').topOneRate,100)
 assert.equal(stats.find(s=>s.key==='numeric:extended').topOneRate,0)
 assert.equal(stats.find(s=>s.source==='shadow_data').topOneRate,0)
 assert.match(stats.find(s=>s.source==='shadow_data').label,/kuponlara uygulanmaz/)
})
