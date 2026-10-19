import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
process.env.HORSERIDE_NO_LISTEN='1'
process.env.HORSERIDE_DB=join(mkdtempSync(join(tmpdir(),'program-db-')),'fixture.sqlite')
mkdirSync('data/maintenance/tests',{recursive:true})
process.env.HORSERIDE_PROGRAM_CACHE=mkdtempSync(join('data/maintenance/tests','served-program-'))
const {publishProgram,readServedProgram}=await import('./served-program.mjs')
const {server}=await import('./index.mjs')
test('saved program serves immediately without waiting for a source or model calculation',async()=>{
 const date='2026-10-08'
 const races=[{city:'Bursa',no:1,horses:[{no:1,name:'A'}]},{city:'Horseshoe Indianapolis ABD',no:2,horses:[{no:2,name:'B'}]}]
 publishProgram(date,{date,fetchedAt:new Date().toISOString(),races,meetings:[],model:'fixture'})
 assert.equal(JSON.parse(readFileSync(join(process.env.HORSERIDE_PROGRAM_CACHE,`${date}.json`))).races.length,2)
 assert.equal(readServedProgram('2026-10-07'),null)
 assert.equal(readServedProgram('../../secret'),null)
 assert.throws(()=>publishProgram(date,{date:'2026-10-07',races}))
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 try{
  const origin=`http://127.0.0.1:${server.address().port}`
  const response=await fetch(`${origin}/api/races?date=${date}&city=Bursa`,{signal:AbortSignal.timeout(1500)})
  const payload=await response.json()
  assert.equal(response.status,200);assert.equal(payload.source,'program_snapshot')
  assert.deepEqual(payload.races.map(r=>r.city),['Bursa'])
  assert.equal((await fetch(`${origin}/api/health`)).status,200)
 }finally{await new Promise(r=>server.close(r))}
})
