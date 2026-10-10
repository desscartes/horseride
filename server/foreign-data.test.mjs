import test from 'node:test'
import assert from 'node:assert/strict'
import {racingCountry,foreignCoverage,matchingEquibaseChart,externalChartHistory,externalChartFeatures,scheduledMeetingDates} from './foreign-data.mjs'
test('country boundaries preserve overseas identity and reject unknown countries',()=>{
  assert.equal(racingCountry('Pontefract Birleşik Krallık'),'GB');assert.equal(racingCountry('Greyville Guney Afrika'),'ZA');assert.equal(racingCountry('Sha Tin Hong Kong'),'HK');assert.equal(racingCountry('Bursa'),null)
})
test('midnight rollover follows each meeting separately and preserves the program date',()=>{
  const races=[{city:'Horseshoe Indianapolis ABD',no:2,time:'00.47'},{city:'Bursa',no:1,time:'14.30'},{city:'Horseshoe Indianapolis ABD',no:1,time:'23.55'}]
  const mapped=scheduledMeetingDates(races,'2026-10-05')
  assert.equal(mapped[0].scheduledDate,'2026-10-06');assert.equal(mapped[1].scheduledDate,'2026-10-05');assert.equal(mapped[2].scheduledDate,'2026-10-05')
})
test('a result chart is unavailable to its own or an earlier race and stays country specific',()=>{
  const chart={date:'2026-10-01',temperatureC:22,going:'Fast',conditions:'Purse: $25,000',runners:[{name:'A',runningPositionsRaw:'1 2 3',comment:'bumped start'}]}
  const history=externalChartHistory([chart,{...chart,date:'2026-10-06'}]),horse={name:'A (USA) KG'}
  assert.equal(externalChartFeatures(horse,'2026-10-01','US',history)[0],0)
  assert.equal(externalChartFeatures(horse,'2026-10-05','US',history)[0],1)
  assert.equal(externalChartFeatures(horse,'2026-10-05','FR',history)[0],0)
})
test('missing foreign weather and workouts never become positive coverage',()=>{
  const row=foreignCoverage([{foreign:true,date:'2026-10-04',city:'Gulfstream Park ABD',surface:'Kum',horses:[{name:'A',weight:55}],results:new Map([[1,{finishPosition:1}]])}])[0]
  assert.equal(row.coverage.weatherRaces,0);assert.equal(row.coverage.workoutRunners,0);assert.equal(row.coverage.resultTime,0);assert.equal(row.canAttemptTraining,false)
})
test('external chart matches exact date, complete field and winner; ambiguous matches rejected',()=>{
  const race={date:'2026-10-01',city:'Gulfstream Park ABD',horses:['A (USA) KG','B','C','D'].map((name,i)=>({name,no:i+1})),results:new Map([[1,{finishPosition:1}]])}
  const chart={date:race.date,track:'GULFSTREAMPARK',runners:['A','B','C','D'].map(name=>({name}))}
  assert.equal(matchingEquibaseChart(race,[chart]),chart)
  const parx={...race,city:'Philadelphia ABD'},parxChart={...chart,track:'PARXRACING'}
  assert.equal(matchingEquibaseChart(parx,[parxChart]),parxChart)
  assert.equal(matchingEquibaseChart(parx,[chart]),null)
  assert.equal(matchingEquibaseChart(race,[{...chart,track:'GULFSTREAM/PARK'}])?.track,'GULFSTREAM/PARK')
  assert.equal(matchingEquibaseChart(race,[chart,chart]),null);assert.equal(matchingEquibaseChart({...race,date:'2026-10-02'},[chart]),null);assert.equal(matchingEquibaseChart(race,[{...chart,runners:[{name:'X'},...chart.runners.slice(1)]}]),null)
})
