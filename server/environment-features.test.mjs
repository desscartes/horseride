import test from 'node:test'
import assert from 'node:assert/strict'
import {raceEnvironment,workoutTime} from './environment-features.mjs'
import {raceFeatures,createRankingHistory,featureNames} from './ranking.mjs'
test('weather and going require the race date and reject missing values',()=>{
 const race={surface:'Çim',environment:{date:'2026-10-05',weather:'hava 22°C, NEM %51, Hafif Sağanak Yağışlı',tracks:[{surface:'Çim',condition:'Yumuşak 3,6'}]}}
 const values=raceEnvironment(race,'2026-10-05')
 assert.equal(values.temperature,22);assert.equal(values.humidity,51);assert.equal(values.rain,1);assert.equal(values.wet,1);assert.equal(values.going,3.6)
 assert.equal(raceEnvironment(race,'2026-10-04').missing,true)
 assert.equal(raceEnvironment({...race,environment:{...race.environment,weather:"AÇIK 23'C NEM %33"}},'2026-10-05').temperature,23)
 assert.equal(raceEnvironment({...race,environment:{...race.environment,weather:'Hava Açık Sıcaklık 20 Derece Nem %60'}},'2026-10-05').temperature,20)
 assert.equal(workoutTime('',400),null);assert.equal(workoutTime('0.29.50',400),29.5);assert.equal(workoutTime('0.02.00',400),null)
})
test('workout features discard future and stale workouts and retain valid splits',()=>{
 const race={city:'Bursa',surface:'Çim',distance:'1400m',horses:[{name:'A',workouts:[{dateISO:'2026-10-06',splits:{400:'24'}},{dateISO:'2026-01-01',splits:{400:'25'}},{dateISO:'2026-10-01',splits:{400:'0.29.50',800:'0.58.50'},surface:'Kum',hippodrome:'Bursa'}]}]}
 const f=raceFeatures(race,'2026-10-05',createRankingHistory())[0],get=n=>f[featureNames.indexOf(n)]
 assert.equal(get('workoutCount'),1);assert.equal(get('workoutDays'),4);assert.equal(get('workout400'),29.5);assert.equal(get('workout800'),58.5);assert.equal(get('workoutHas1000'),0);assert.equal(get('workoutSameSurface'),0);assert.equal(get('workoutSameTrack'),1)
})
