import test from 'node:test'
import assert from 'node:assert/strict'
import {paceHistory,paceFeatures} from './pace-features.mjs'
const chart={date:'2026-01-01',track:'GULFSTREAM/PARK',conditions:'Distance: Six Furlongs On The Dirt Current Track Record:',runners:[{name:'A',calls:{Start:4,'1/4':1,Str:2,Fin:3}},{name:'B',calls:{Start:1,'1/4':3,Str:3,Fin:1}},{name:'C',calls:{Start:2,'1/4':2,Str:1,Fin:2}}]}
const race={city:'Gulfstream Park ABD',surface:'Kum',horses:[{name:'A (USA) KG'},{name:'B'}]}
test('verified first call is pace; gate break is not pace and lengths are not positions',()=>{
 const history=paceHistory([chart]);const values=paceFeatures(race,'2026-01-02',history,'GULFSTREAMPARK')
 assert.equal(values[0][1],1);assert.equal(values[1][1],0)
 assert.equal(values[0][3],-1);assert.equal(values[1][3],1)
 assert.equal(values[0][6],1);assert.equal(values[0][7],1)
})
test('target/future chart and other countries never become pre-race pace evidence',()=>{
 const history=paceHistory([chart,{...chart,date:'2026-01-03'}])
 assert.equal(paceFeatures(race,'2026-01-01',history)[0][0],0)
 assert.equal(paceFeatures(race,'2026-01-02',history)[0][0],1)
 assert.equal(paceFeatures({...race,city:'Bursa'},'2026-01-02',history)[0][0],0)
 assert.equal(paceFeatures({...race,horses:[{name:'Unknown'}]},'2026-01-02',history)[0][8],1)
})
