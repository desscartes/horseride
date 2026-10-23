import test from 'node:test';import assert from 'node:assert/strict';import {raceStartISO,preparationReadiness} from './preparation-readiness.mjs'
const date='2026-10-22',h={name:'A',sire:'S',dam:'D',jockey:'J',trainer:'T',weight:55,start:1,probability:60},race={city:'Bursa',no:1,time:'12:00',rankingSource:'local_trained_model',rankingMethod:'m',horses:[h,{...h,name:'B',probability:40}]},program={date,fetchedAt:'2026-10-22T08:00:00Z',races:[race]}
test('first race deadline and missing coverage are explicit, no predictive success claim',()=>{const r=preparationReadiness(program,{date,now:new Date('2026-10-22T08:10:00Z'),metadata:new Map([['m',{trainedThrough:'2026-10-21'}]])});assert.equal(r.firstUpcomingDeadline,'2026-10-22T08:30:00.000Z');assert.equal(r.races[0].predictionAvailable,true);assert.equal(r.races[0].servingReady,false);assert.equal(r.races[0].dataComplete,false);assert.equal(r.predictiveSuperiorityEstablished,false)})
test('stale program and target-day trained model cannot be ready; after-midnight schedule stays correct',()=>{assert.equal(preparationReadiness(program,{date,now:new Date('2026-10-22T09:01:00Z'),metadata:new Map([['m',{trainedThrough:date}]])}).races[0].servingReady,false);assert.equal(raceStartISO({...race,time:'02:00'},date),'2026-10-22T23:00:00.000Z')})

test('jockey coverage must match the current rider; a name alone cannot establish readiness',()=>{
 const args={date,now:new Date('2026-10-22T08:10:00Z'),metadata:new Map([['m',{trainedThrough:'2026-10-21'}]]),coverage:{date,rows:race.horses.map(h=>({city:race.city,raceNo:1,name:h.name,missing:[]}))},jockeyCoverage:{date,rows:race.horses.map(h=>({city:race.city,raceNo:1,horseName:h.name,jockey:h.jockey,missingPerformance:false}))}}
 assert.equal(preparationReadiness(program,args).races[0].servingReady,true)
 args.jockeyCoverage.rows[0].jockey='OLD';assert.equal(preparationReadiness(program,args).races[0].servingReady,false)
 args.jockeyCoverage.rows[0].jockey=h.jockey;args.jockeyCoverage.rows[0].missingPerformance=true;assert.equal(preparationReadiness(program,args).races[0].servingReady,false)
})
