import test from 'node:test'
import assert from 'node:assert/strict'
import {createPerformanceHistory,addPerformanceDay,performanceFeatures,performanceFeatureNames} from './performance-features.mjs'
const race=(city='Bursa',surface='Kum',time=90)=>({city,surface,distance:'1400m',conditions:'İNGİLİZ',type:'Maiden',horses:[{no:1,name:'A KG',weight:55,sire:'S',jockey:'J',trainer:'T'},{no:2,name:'B',weight:56,sire:'S',jockey:'K',trainer:'U'}],results:new Map([[1,{finishPosition:1,timeSeconds:time}],[2,{finishPosition:2,timeSeconds:time+1}]])})
test('speed references isolate track, surface, breed and country and never use target-day results',()=>{
 const h=createPerformanceHistory(),r=race()
 for(let day=1;day<=9;day++)addPerformanceDay(h,[r],`2026-09-${String(day).padStart(2,'0')}`)
 const before=performanceFeatures(r,'2026-09-10',h)
 assert.equal(before[0][0],1);assert.equal(before[0].length,performanceFeatureNames.length)
 addPerformanceDay(h,[race('Bursa','Kum',80)],'2026-09-10')
 assert.deepEqual(performanceFeatures(r,'2026-09-10',h),before)
 assert.equal(performanceFeatures(race('Bursa','Çim'),'2026-09-11',h)[0][0],0)
 assert.equal(performanceFeatures(race('Philadelphia ABD'),'2026-09-11',h)[0][0],0)
 assert.equal(performanceFeatures({...r,conditions:'ARAP'},'2026-09-11',h)[0][0],0)
})
test('missing runner times are not estimated from the winner or finishing position',()=>{
 const h=createPerformanceHistory(),r=race();r.results.get(2).timeSeconds=null
 for(let day=1;day<=12;day++)addPerformanceDay(h,[r],`2026-09-${String(day).padStart(2,'0')}`)
 assert.ok(performanceFeatures(r,'2026-09-13',h)[0][0]>0)
 assert.equal(performanceFeatures(r,'2026-09-13',h)[1][0],0)
})
