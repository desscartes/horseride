import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {runAnalysisWorker} from './analysis-process.mjs'
test('heavy analysis cannot block the parent event loop and progress is delivered',async()=>{
 mkdirSync('data/maintenance/tests',{recursive:true})
 const dir=mkdtempSync(resolve('data/maintenance/tests/isolation-'))
 const worker=join(dir,'worker.mjs')
 writeFileSync(worker,`process.send({progress:{started:true}});const end=Date.now()+500;while(Date.now()<end){};process.send({result:{ok:true}},()=>process.disconnect())`)
 let progressResolve
 const progress=new Promise(resolve=>progressResolve=resolve)
 const result=runAnalysisWorker('','',progressResolve,null,{worker:pathToFileURL(worker),timeoutMs:5000})
 try{
  await progress
  const start=Date.now();await new Promise(resolve=>setTimeout(resolve,25))
  assert.ok(Date.now()-start<350,'parent blocked by worker')
  assert.deepEqual(await result,{ok:true})
 }finally{rmSync(dir,{recursive:true,force:true})}
})
