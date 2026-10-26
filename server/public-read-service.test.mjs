import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createPublicReader} from './public-read-service.mjs'
test('concurrent public reads coalesce and persisted success survives worker outage',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'horse-read-'));let calls=0
 class Fake extends EventEmitter{ref(){}unref(){}terminate(){return Promise.resolve()}postMessage({id}){calls++;setTimeout(()=>this.emit('message',{id,value:{total:17}}),5)}}
 try{const read=createPublicReader({directory,workerFactory:()=>new Fake()}),result=await Promise.all([read('report'),read('report')]);assert.equal(calls,1);assert.equal(result[0].total,17);assert.equal(result[1]._delivery.stale,false);const offline=createPublicReader({directory,workerFactory:()=>{throw Error('offline')}});assert.equal((await offline('report')).total,17)}finally{await rm(directory,{recursive:true,force:true})}
})
test('a stalled worker fails within a bounded timeout',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'horse-read-'))
 class Stalled extends EventEmitter{ref(){}unref(){}terminate(){return Promise.resolve()}postMessage(){}}
 try{const read=createPublicReader({directory,timeoutMs:20,workerFactory:()=>new Stalled()});await assert.rejects(read('simulation'),/timeout/)}finally{await rm(directory,{recursive:true,force:true})}
})

test('real Node worker starts with supported flags and reads an isolated database',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'horse-read-real-'))
 try{const read=createPublicReader({directory});const result=await read('horse',{name:'NONEXISTENT TEST HORSE'});assert.deepEqual(result.entries,[]);assert.equal(result.historyKind,'saved_program_predictions')}finally{await rm(directory,{recursive:true,force:true})}
})
