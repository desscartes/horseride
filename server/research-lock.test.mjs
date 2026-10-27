import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {claimResearchLock} from './research-lock.mjs'
test('dead lock is recovered and replacement ownership survives cleanup',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'research-lock-')),path=join(dir,'lock')
 try{await writeFile(path,JSON.stringify({pid:10}));const release=await claimResearchLock(path,{pid:20},{alive:()=>false});assert.equal(JSON.parse(await readFile(path)).pid,20);await writeFile(path,JSON.stringify({pid:30}));await release();assert.equal(JSON.parse(await readFile(path)).pid,30)}finally{await rm(dir,{recursive:true,force:true})}
})
test('live and malformed ownership cannot be removed',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'research-lock-')),path=join(dir,'lock')
 try{await writeFile(path,JSON.stringify({pid:10}));await assert.rejects(claimResearchLock(path,{pid:20},{alive:()=>true}),/still active/);assert.equal(JSON.parse(await readFile(path)).pid,10);await writeFile(path,'invalid');await assert.rejects(claimResearchLock(path,{pid:20},{alive:()=>false}));assert.equal(await readFile(path,'utf8'),'invalid')}finally{await rm(dir,{recursive:true,force:true})}
})
