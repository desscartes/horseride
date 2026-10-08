import test from 'node:test'
import assert from 'node:assert/strict'
import {summarizeWorkoutHistory} from './workout-history.mjs'
test('workouts require exact horse identity and dates strictly before the race',()=>{
  const tables=[{headers:['At Adı','İdman Tarihi','400','1000','Pist','İ. Türü'],rows:[['A KG','03.10.2026','28.5','70.0','Kum','Galop'],['B','02.10.2026','26.5','65','Çim','Galop'],['A','04.10.2026','25','64','Kum','Galop'],['A','05.10.2026','26','66','Kum','Galop']]}]
  const workouts=summarizeWorkoutHistory(tables,'A DB','2026-10-04')
  assert.equal(workouts.length,1)
  assert.equal(workouts[0].dateISO,'2026-10-03')
  assert.equal(workouts[0].splits['400'],'28.5')
})
test('v2 workout identity recovers official equipment suffixes without prefix matching',()=>{
 const tables=[{headers:['At Adı','İdman Tarihi','400'],rows:[['A KG SK SGKR','03.10.2026','28.5'],['AB DB YP','03.10.2026','27.5']]}]
 assert.equal(summarizeWorkoutHistory(tables,'A DB YP BB','2026-10-04',{identityVersion:2}).length,1)
 assert.equal(summarizeWorkoutHistory(tables,'A DB YP BB','2026-10-04').length,0)
})
