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
