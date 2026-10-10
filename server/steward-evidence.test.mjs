import test from 'node:test'
import assert from 'node:assert/strict'
import {matchStewardEvents} from './steward-evidence.mjs'
test('steward events require the exact date, meeting, race, official number and horse identity',()=>{
 const r={date:'2026-10-04',city:'Bursa',no:1},h={no:3,name:'İZOTOP KG'}
 const e={...r,raceNo:1,horseNo:3,horseName:'İZOTOP'}
 assert.equal(matchStewardEvents(r,h,[e]).length,1)
 for(const changed of [{date:'2026-10-05'},{city:'Ankara'},{raceNo:2},{horseNo:4},{horseName:'BAŞKA'}])assert.equal(matchStewardEvents(r,h,[{...e,...changed}]).length,0)
})
