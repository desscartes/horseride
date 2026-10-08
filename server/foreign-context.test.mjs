import test from 'node:test'
import assert from 'node:assert/strict'
process.env.HORSERIDE_NO_LISTEN='1'
const {buildHistoricalAnalysisContext}=await import('./index.mjs')
test('foreign analysis isolates countries, excludes target and future results, and supplies rival evidence',()=>{
  const horse={no:1,name:'EXAMPLE (USA)',jockey:'SAME JOCKEY',weight:55}
  const prior={foreign:true,date:'2026-10-01',city:'Gulfstream Park ABD',no:2,distance:'1400m',surface:'Çim',type:'Maiden',horses:[horse,{no:2,name:'RIVAL (USA)',jockey:'OTHER'}],results:new Map([[1,{finishPosition:2,timeSeconds:85}],[2,{finishPosition:1,timeSeconds:84}]])}
  const archive=[prior,{...prior,city:'Deauville Fransa',date:'2026-10-02'},{...prior,date:'2026-10-05'},{...prior,date:'2026-10-06'}]
  const [result]=buildHistoricalAnalysisContext([{...prior,date:undefined,horses:[horse]}],'2026-10-05',{archive})
  const h=result.horses[0]
  assert.equal(h.evidenceCoverage.recentRuns,1);assert.equal(h.jockeyPerformance.starts,1);assert.equal(h.horsePerformance.sameDistanceAndSurface.starts,1)
  assert.equal(h.horsePerformance.recentRuns[0].competition.topRivals[0].name,'RIVAL (USA)')
})
test('domestic archive supplies missing profile history and joins equipment/apprentice variants',()=>{
 const horse={no:1,name:'CONTEXT UNIQUE A KG SK SGKR',jockey:'CONTEXT J AP',weight:55}
 const prior={foreign:false,date:'2026-10-01',city:'Bursa',no:99,distance:'1400m',surface:'Çim',type:'Maiden',horses:[horse,{no:2,name:'CONTEXT UNIQUE B',jockey:'CONTEXT OTHER'}],results:new Map([[1,{finishPosition:2,timeSeconds:85}],[2,{finishPosition:1,timeSeconds:84}]])}
 const current={...prior,horses:[{...horse,name:'CONTEXT UNIQUE A DB YP BB',jockey:'CONTEXT J'}]}
 const result=buildHistoricalAnalysisContext([current],'2026-10-05',{archive:[prior,{...prior,date:'2026-10-05'}]})[0].horses[0]
 assert.equal(result.evidenceCoverage.recentRuns,1)
 assert.equal(result.jockeyPerformance.starts,1)
 assert.equal(result.horsePerformance.recentRuns[0].source,'TJK domestic archive')
 assert.equal(result.horsePerformance.recentRuns[0].competition.topRivals[0].name,'CONTEXT UNIQUE B')
})
test('an unknown jockey never receives pooled missing-jockey statistics',()=>{
 const horse={no:1,name:'UNKNOWN JOCKEY CONTEXT HORSE',jockey:'Bilinmiyor'}
 const prior={foreign:false,date:'2026-10-01',city:'Bursa',no:98,distance:'1400m',surface:'Kum',type:'Maiden',horses:[horse],results:new Map([[1,{finishPosition:1,timeSeconds:85}]])}
 const result=buildHistoricalAnalysisContext([prior],'2026-10-05',{archive:[prior]})[0].horses[0]
 assert.equal(result.jockeyPerformance,null)
 assert.equal(result.evidenceCoverage.hasJockeyProfile,false)
})
