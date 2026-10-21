import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {tryCollectionGate} from './collection-gate.mjs'
test('exclusive roots, inherited child never releases parent, next root proceeds after release',()=>{const directory=mkdtempSync(join(tmpdir(),'horse-gate-'));try{const a=tryCollectionGate({directory,pid:101,alive:()=>true});assert.equal(a.acquired,true);assert.equal(tryCollectionGate({directory,pid:102,alive:()=>true}).acquired,false);const child=tryCollectionGate({directory,pid:103,inheritedOwner:'101',alive:()=>true});assert.equal(child.inherited,true);child.release();assert.equal(tryCollectionGate({directory,pid:102,alive:()=>true}).acquired,false);a.release();const b=tryCollectionGate({directory,pid:102,alive:()=>true});assert.equal(b.acquired,true);b.release()}finally{rmSync(directory,{recursive:true,force:true})}})
test('legacy owner defers acquisition without creating gate',()=>{const directory=mkdtempSync(join(tmpdir(),'horse-gate-'));try{writeFileSync(join(directory,'daily.lock'),JSON.stringify({pid:101}));assert.equal(tryCollectionGate({directory,pid:102,alive:()=>true}).acquired,false)}finally{rmSync(directory,{recursive:true,force:true})}})
test('all entry points acquire common gate before their own lock, preventing lock inversion',()=>{for(const file of ['daily-maintenance.mjs','run-morning-preparation.mjs','run-intelligence-training.mjs','run-intraday-collection.mjs']){const s=readFileSync(new URL(file,import.meta.url),'utf8');assert.ok(s.indexOf('await acquireCollectionGate()')>=0);assert.ok(s.indexOf('await acquireCollectionGate()')<s.indexOf('await writeFile(lock,'),file)}})
