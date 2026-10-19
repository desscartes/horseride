import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
process.env.HORSERIDE_DB=join(mkdtempSync(join(tmpdir(),'ganyan-forecast-')),'fixture.sqlite')
const {scheduledRaceStart,saveForecastSnapshots,listForecastSnapshots,saveProgram,getProgramForAnalysis}=await import('./database.mjs')

test('only completed analysis before scheduled start becomes a prospective forecast',()=>{
  const date='2026-10-05',race={city:'Bursa',no:1,time:'14.30',horses:[{no:1,name:'A'}]}
  assert.equal(scheduledRaceStart(date,'14.30'),'2026-10-05T11:30:00.000Z')
  assert.equal(saveForecastSnapshots({date,races:[race],source:'daily_ai',modelVersion:'test',inputHash:'early',capturedAt:'2026-10-05T11:29:00.000Z'}),1)
  assert.equal(saveForecastSnapshots({date,races:[race],source:'daily_ai',modelVersion:'test',inputHash:'late',capturedAt:'2026-10-05T11:30:00.000Z'}),0)
  assert.equal(listForecastSnapshots(date).length,1)
})
test('a foreign race after midnight is captured against the next calendar day',()=>{
  const race={city:'Horseshoe Indianapolis ABD',no:8,time:'00.47',scheduledDate:'2026-10-06',horses:[{no:1,name:'X'}]}
  assert.equal(saveForecastSnapshots({date:'2026-10-05',races:[race],source:'numeric',modelVersion:'country_US',inputHash:'midnight',capturedAt:'2026-10-05T20:00:00.000Z'}),1)
  assert.equal(listForecastSnapshots('2026-10-05').find(r=>r.city===race.city).scheduled_start,'2026-10-05T21:47:00.000Z')
})
test('program replacement removes withdrawn horses and preserves updated weight',()=>{
  const a={no:1,name:'A',weight:55,independentScore:.5,probability:50,sourceData:{}}
  const b={no:2,name:'B',weight:57,independentScore:.5,probability:50,sourceData:{}}
  const save=horses=>saveProgram({city:'Bursa',date:'2026-10-05',fetchedAt:'2026-10-05T10:00:00Z',providerUrl:'fixture',races:[{city:'Bursa',no:1,time:'14.30',horses}]})
  save([a,b]);save([{...a,weight:55.2}])
  const program=getProgramForAnalysis('2026-10-05','Bursa')
  assert.equal(program[0].horses.length,1)
  assert.equal(program[0].horses[0].weight,55.2)
})
