import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {registerCollectionWaiter} from './collection-queue.mjs'
test('readiness has priority, old research is not starved, and dead waiters are removed',()=>{
 const directory=mkdtempSync(join(tmpdir(),'horse-queue-'));let time=100,dead=new Set();const options={directory,now:()=>time,alive:p=>!dead.has(p)}
 try{const research=registerCollectionWaiter({...options,pid:1,command:'run-load-research'});time=200;const ready=registerCollectionWaiter({...options,pid:2,command:'run-prestart-readiness'});assert.equal(research.isNext(),false);assert.equal(ready.isNext(),true);time=1800101;assert.equal(research.isNext(),true);dead.add(1);assert.equal(ready.isNext(),true);research.release();ready.release()}finally{rmSync(directory,{recursive:true,force:true})}
})
