import test from 'node:test'
import assert from 'node:assert/strict'
import {mergeOfficialCharts} from './overseas-chart-input.mjs'
const chart={date:'2026-10-01',track:'GULFSTREAM PARK',raceNo:1,sourceUrl:'https://tvg.equibase.com/static/chart/pdf/GP100126USA.pdf',conditions:'Thoroughbred Distance: One Mile On The Dirt',runners:[{name:'A (USA)'},{name:'B (USA)'}]}
test('merged official sources deduplicate charts and retain verified positional parsing',()=>{
 const newer={...chart,runners:chart.runners.map((h,i)=>({...h,calls:{Fin:i+1}}))}
 const merged=mergeOfficialCharts([{races:[chart]},{races:[newer]}],'2026-10-02')
 assert.equal(merged.races.length,1);assert.equal(merged.races[0].runners[0].calls.Fin,1)
})
test('conflicting fields and unverified source, date or breed are excluded',()=>{
 const wrong={...chart,runners:[{name:'A'},{name:'OTHER'}]}
 assert.equal(mergeOfficialCharts([{races:[chart,wrong]}],'2026-10-02').races.length,0)
 for(const bad of [{...chart,date:'2026-10-03'},{...chart,date:'2026-02-30'},{...chart,sourceUrl:'https://example.com/chart.pdf'},{...chart,conditions:'Quarter Horse'}])assert.equal(mergeOfficialCharts([{races:[bad]}],'2026-10-02').races.length,0)
})
