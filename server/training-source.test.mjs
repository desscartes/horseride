import test from 'node:test'
import assert from 'node:assert/strict'
import {trainingSourceRows} from './training-source.mjs'
test('explicit missing/corrupt frozen input fails rather than silently dropping evidence',async()=>{
 const missing=async()=>{throw Object.assign(Error('missing frozen file'),{code:'ENOENT'})}
 await assert.rejects(trainingSourceRows({path:'frozen.json',field:'races',read:missing}),/missing/)
 await assert.rejects(trainingSourceRows({path:'frozen.json',field:'races',read:async()=>'{broken'}),SyntaxError)
 await assert.rejects(trainingSourceRows({path:'frozen.json',field:'races',read:async()=>'{}'}),/must be an array/)
 await assert.rejects(trainingSourceRows({fallbackPath:'optional.json',field:'races',read:async()=>'{broken'}),SyntaxError)
})
test('only absent optional source is empty; valid frozen data is retained',async()=>{
 assert.deepEqual(await trainingSourceRows({fallbackPath:'optional.json',field:'records',read:async()=>{throw Object.assign(Error(),{code:'ENOENT'})}}),[])
 assert.deepEqual(await trainingSourceRows({path:'frozen.json',field:'records',read:async()=>' {"records":[{"date":"2026-10-18"}]}'}),[{date:'2026-10-18'}])
})
