import test from 'node:test'
import assert from 'node:assert/strict'
import {collectionPlan,nextCollectionJob} from './intraday-collection-plan.mjs'
const day='2026-10-21'
test('overnight snapshots precede 06:00 preparation and current-only evidence continues later',()=>{
 const p=collectionPlan(day)
 assert.equal(new Set(p.map(j=>j.id)).size,p.length)
 assert.deepEqual(p.filter(j=>j.script.includes('program-refresh')&&j.time<'06:00').map(j=>j.time),['02:00','04:00'])
 assert.ok(p.filter(j=>j.time<'06:00').every(j=>j.env.HORSERIDE_PROGRAM_ONLY==='1'))
 assert.ok(p.some(j=>j.time==='23:45'))
 assert.ok(p.filter(j=>j.script.includes('pedigree')).every(j=>j.env.PEDIGREE_CURRENT_ONLY==='1'))
 assert.ok(p.filter(j=>j.script.includes('program-refresh')).every(j=>j.args[0]===day))
})
test('no early jobs, no replay of completed jobs or stale backlog, bounded retries',()=>{assert.equal(nextCollectionJob(day,0),null);const j=nextCollectionJob(day,540);assert.equal(j.time,'08:20');assert.notEqual(nextCollectionJob(day,540,{[j.id]:{status:'complete'}})?.id,j.id);assert.notEqual(nextCollectionJob(day,540,{[j.id]:{status:'failed',attempts:2}})?.id,j.id);assert.notEqual(nextCollectionJob(day,545,{[j.id]:{status:'failed',attempts:1,lastAttemptAtMinute:540}})?.id,j.id);assert.ok(!nextCollectionJob(day,1439)?.time.startsWith('21'))})
