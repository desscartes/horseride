import test from 'node:test'
import assert from 'node:assert/strict'
import {workoutEvidence,workoutComment} from './workout-evidence.mjs'
import {fluentHorseReason} from './commentary-evidence.mjs'
const date='2026-10-23',race={city:'İstanbul',surface:'Çim'},row={horseName:'A KG',dateISO:'2026-10-20',hippodrome:'Ankara',surface:'Kum',splits:{400:'0.26.20',800:'0.52.30'}}
test('workout commentary uses prior matching records, rejects future, duplicate, wrong horse and invalid dates',()=>{
 const h={name:'A DB',workouts:[row,row,{...row,dateISO:date},{...row,dateISO:'2026-10-24'},{...row,dateISO:'2026-09-31'},{...row,horseName:'OTHER'}]};const e=workoutEvidence(h,date);assert.equal(e.rows.length,1);const text=workoutComment(race,h,date);assert.match(text,/400 metre 26,2 saniye/);assert.match(text,/800 metre 52,3 saniye/);assert.match(text,/bugünkü Çim/)
})
test('US full workout distance and time are not fabricated 400 or 1000 metre splits',()=>{
 const h={name:'Soccer Socks (USA)',workouts:[{horseName:'Soccer Socks (KY)',registryId:'1',provider:'Equibase',dateISO:'2026-10-20',distanceMeters:804.672,timeSeconds:49.8,groupRank:'11/14',splits:{}}]};const text=workoutComment(race,h,date);assert.match(text,/804,7 metrelik.*49,8 saniye/);assert.match(text,/11\/14/);assert.doesNotMatch(text,/400 metre|1000 metre/)
 h.workouts.push({...h.workouts[0],registryId:'2'});assert.equal(workoutEvidence(h,date).ambiguousIdentity,true)
})
test('normal runners receive workout evidence; missing evidence never becomes bad preparation',()=>{
 const h={name:'A KG',workouts:[row],horsePerformance:{recentRuns:[{date:'2026-10-01',finishPosition:2}]}};assert.match(fluentHorseReason(race,h,date),/Kayıtlı ara dereceler/)
 assert.match(workoutComment(race,{name:'A'},date),/idman yapmadığı anlamına gelmez/)
})
