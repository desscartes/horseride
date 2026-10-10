import test from 'node:test'
import assert from 'node:assert/strict'
import {forecastAtStart} from './race-forecast.mjs'
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
