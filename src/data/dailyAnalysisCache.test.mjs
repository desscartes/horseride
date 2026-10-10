import test from 'node:test'
import assert from 'node:assert/strict'
import {createDailyAnalysisCache,analysisCacheSignature} from './dailyAnalysisCache.js'
test('ready analyses survive city changes and reopening; context changes cannot reuse them',()=>{
 const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}
 let now=0
 const cache=createDailyAnalysisCache({storage,now:()=>now})
 const payload={city:'Bursa',date:'2026-10-08',analysis:{races:[{city:'Bursa',raceNo:1,picks:[]}]}}
 cache.save('api','Bursa',payload.date,'entries',payload)
 const loaded=cache.get('api','Bursa',payload.date,'entries');loaded.analysis.races=[]
 assert.equal(cache.get('api','Bursa',payload.date,'entries').analysis.races.length,1)
 assert.equal(cache.get('other-api','Bursa',payload.date,'entries'),null)
 assert.equal(cache.get('api','Bursa',payload.date,'changed'),null)
 assert.equal(createDailyAnalysisCache({storage,now:()=>now}).get('api','Bursa',payload.date,'entries').city,'Bursa')
 now=24*3600000+1;assert.equal(cache.get('api','Bursa',payload.date,'entries'),null)
})
test('AGF changes do not spend another AI request; entry and model pick changes invalidate cache',()=>{
 const race={city:'Bursa',no:1,rankingSource:'local_trained_model',horses:[{no:1,name:'A',weight:55,marketShare:60},{no:2,name:'B',weight:56,marketShare:40}]}
 const signature=analysisCacheSignature([race],'Bursa')
 assert.equal(analysisCacheSignature([{...race,horses:race.horses.map(h=>({...h,marketShare:10}))}],'Bursa'),signature)
 assert.notEqual(analysisCacheSignature([{...race,horses:[...race.horses].reverse()}],'Bursa'),signature)
 assert.notEqual(analysisCacheSignature([{...race,horses:[{...race.horses[0],weight:58},race.horses[1]]}],'Bursa'),signature)
})
