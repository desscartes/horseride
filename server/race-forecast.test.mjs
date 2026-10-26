import test from 'node:test'
import assert from 'node:assert/strict'
import {forecastAtStart,forecastLocation} from './race-forecast.mjs'

test('published foreign venue aliases resolve to verified regional locations without guessing',()=>{
 assert.deepEqual(forecastLocation('Longchamp Fransa'),forecastLocation('ParisLongchamp Fransa'))
 assert.equal(forecastLocation('Fairview Guney Afrika').country,'ZA')
 assert.equal(forecastLocation('Fairview Güney Afrika').name,'Port Elizabeth')
 assert.equal(forecastLocation('Leopardstown İrlanda').country,'IE')
 assert.equal(forecastLocation('Woodbine Kanada').region,'Ontario')
 assert.equal(forecastLocation('Perak Malezya').name,'Ipoh')
 assert.equal(forecastLocation('Perak ABD'),null)
 assert.equal(forecastLocation('Unknown Kanada'),null)
 assert.equal(forecastLocation('Redcar Birleşik Krallık').name,'Redcar')
 assert.equal(forecastLocation('Leicester Birleşik Krallık').name,'Oadby')
 assert.equal(forecastLocation('Finger Lakes ABD').coordinateScope,'official_address_geocode')
 assert.equal(forecastLocation('Mahoning Valley ABD').region,'Ohio')
 assert.equal(forecastLocation('Gowran Park İrlanda').name,'Gowran')
 assert.equal(forecastLocation('Wolverhampton Birleşik Krallık').country,'GB')
 assert.equal(forecastLocation('ClubHipico Santiago Şili').country,'CL')
 assert.equal(forecastLocation('ClubHipico Santiago ABD'),null)
})
test('weather forecasts must be recorded before the actual scheduled start and cannot backfill past races',()=>{
 const s={collectedAt:'2026-10-06T10:00:00Z',hourly:{time:['2026-10-06T11:00','2026-10-06T21:00'],temperature_2m:[20,19],precipitation_probability:[0,50]}}
 const r={time:'14.30'}
 assert.equal(forecastAtStart(s,r,'2026-10-06',new Date('2026-10-06T10:30Z')).temperatureC,20)
 assert.equal(forecastAtStart(s,r,'2026-10-05',new Date('2026-10-06T10:30Z')),null)
 assert.equal(forecastAtStart(s,r,'2026-10-06',new Date('2026-10-06T12:00Z')),null)
 assert.equal(forecastAtStart({...s,collectedAt:'2026-10-06T12:00Z'},r,'2026-10-06',new Date('2026-10-06T10:30Z')),null)
 const next={...s,collectedAt:'2026-10-06T20:00Z'}
 assert.equal(forecastAtStart(next,{time:'00.30',scheduledDate:'2026-10-07'},'2026-10-06',new Date('2026-10-06T20:30Z')).temperatureC,19)
})
