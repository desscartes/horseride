import test from 'node:test'
import assert from 'node:assert/strict'
import {createPublicGateway} from './public-gateway.mjs'
import {localDay} from './maintenance-policy.mjs'
test('public gateway never triggers paid AI or training and rejects arbitrary dates and private files',async()=>{
 const requests=[]
 const server=createPublicGateway({fetcher:async(url,options)=>{requests.push({url:String(url),method:options.method});return Response.json({analysis:{races:[{raceNo:1}]}})}})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const base=`http://127.0.0.1:${server.address().port}`
 try{
  const ready=await fetch(base+'/api/analysis/daily',{method:'POST',body:JSON.stringify({date:localDay(),city:'Bursa',async:true})})
  assert.equal(ready.status,200);assert.equal(requests[0].method,'GET')
  assert.equal((await fetch(base+'/api/performance/backtest',{method:'POST'})).status,404)
  assert.equal((await fetch(base+'/api/races?date=2000-01-01')).status,400)
  assert.equal((await fetch(base+'/.env')).status,404)
  assert.equal((await fetch(base+'/server/index.mjs')).status,404)
  assert.equal(requests.length,1)
 }finally{await new Promise(resolve=>server.close(resolve))}
})

test('public history preserves horse names and only allows bounded read queries',async()=>{
 const requests=[]
 const server=createPublicGateway({fetcher:async(url,options)=>{requests.push({url:new URL(url),method:options.method});return Response.json({entries:[]})}})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const base=`http://127.0.0.1:${server.address().port}`
 try{
  assert.equal((await fetch(base+'/api/history/horse?'+new URLSearchParams({name:'ŞAH KG',secret:'ignored'}))).status,200)
  assert.equal(requests[0].url.searchParams.get('name'),'ŞAH KG')
  assert.equal(requests[0].url.searchParams.has('secret'),false)
  assert.equal(requests[0].method,'GET')
  assert.equal((await fetch(base+'/api/history/races')).status,200)
  assert.equal((await fetch(base+'/api/performance?days=90')).status,200)
  assert.equal(requests[2].url.searchParams.get('days'),'90')
  for(const path of ['/api/history/horse','/api/performance?days=99999','/api/history/health'])assert.ok((await fetch(base+path)).status>=400)
  assert.equal((await fetch(base+'/api/history/races',{method:'POST',body:'{}'})).status,405)
  assert.equal(requests.length,3)
 }finally{await new Promise(resolve=>server.close(resolve))}
})

test('program survives upstream outage using same-day city cache without exposing private fields',async()=>{
 const day=localDay(),server=createPublicGateway({fetcher:async()=>{throw Error('offline')},programReader:async()=>({date:day,races:[{city:'Keeneland ABD',no:1},{city:'Bursa',no:1}],secret:'private'})})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`
 try{const r=await fetch(base+'/api/races?'+new URLSearchParams({date:day,city:'Keeneland ABD'})),v=await r.json();assert.equal(r.status,200);assert.equal(v.races.length,1);assert.equal(v.races[0].city,'Keeneland ABD');assert.equal(v.cachedProgram,true);assert.equal(v.stale,true);assert.equal(v.secret,undefined);assert.equal((await fetch(base+'/api/races?'+new URLSearchParams({date:day,city:'Unknown'}))).status,502)}finally{await new Promise(r=>server.close(r))}
})
test('program cache from another date cannot satisfy request',async()=>{
 const server=createPublicGateway({fetcher:async()=>new Response('unavailable',{status:503}),programReader:async()=>({date:'2000-01-01',races:[{city:'Bursa'}]})});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/api/races?date=${localDay()}`)).status,502)}finally{await new Promise(r=>server.close(r))}
})

test('commentary survives upstream outage and running jobs with explicit data summary',async()=>{
 const date=new Date(Date.now()+86400000).toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'}),city='Geraldton Avustralya',program={date,races:[{city,no:5,time:'23:59',distance:'1113m',surface:'Çim',horses:[{no:1,name:'A',jockey:'J',weight:55,start:1},{no:2,name:'B',jockey:'K',weight:56,start:2}]}]}
 for(const mode of ['offline','running']){const server=createPublicGateway({fetcher:async()=>{if(mode==='offline')throw Error('offline');return Response.json({date,city,job:{status:'running'}})},programReader:async()=>program});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/analysis/daily`,{method:'POST',body:JSON.stringify({date,city,raceNo:5,async:true})}),v=await response.json();assert.equal(response.status,200);assert.equal(v.analysis.races[0].raceNo,5);assert.equal(v.source,'automatic_verified_data_summary');assert.equal(v.job,undefined)}finally{await new Promise(r=>server.close(r))}}
})
