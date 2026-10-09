import test from 'node:test'
import assert from 'node:assert/strict'
import { createAnalysisJobs } from './analysis-jobs.mjs'

const tick = () => new Promise(resolve => setImmediate(resolve))

test('duplicate requests share one paid job and publish progress before completion', async () => {
  const jobs = createAnalysisJobs()
  let finish, calls = 0
  const task = async report => {
    calls++
    report({ phase: 'analyzing', completed: 3, total: 9 })
    return new Promise(resolve => { finish = resolve })
  }
  const first = jobs.start('date:city', task)
  const duplicate = jobs.start('date:city', task)
  assert.equal(first.id, duplicate.id)
  await tick()
  assert.equal(calls, 1)
  assert.equal(jobs.get(first.id).progress.completed, 3)
  assert.equal(jobs.get(first.id).status, 'running')
  finish({ analysis: { races: [1,2,3] } })
  await tick()
  assert.equal(jobs.get(first.id).status, 'ready')
  assert.equal(jobs.get(first.id).result.analysis.races.length, 3)
})

test('failed jobs can retry, cities stay isolated and old finished jobs expire', async () => {
  let time = 0
  const jobs = createAnalysisJobs({ now: () => time, retentionMs: 100 })
  const failed = jobs.start('a', async () => { throw Error('upstream offline') })
  const other = jobs.start('b', async () => 'ok')
  await tick()
  assert.equal(jobs.get(failed.id).error, 'upstream offline')
  assert.equal(jobs.get(other.id).result, 'ok')
  const retry = jobs.start('a', async () => 'recovered')
  assert.notEqual(retry.id, failed.id)
  await tick()
  assert.equal(jobs.get(retry.id).result, 'recovered')
  time = 101
  assert.equal(jobs.get(failed.id), undefined)
})

test('completed race explanations are published while the rest of the day is running',async()=>{
 const jobs=createAnalysisJobs();let finish
 const job=jobs.start('partial',async report=>{
  report({phase:'analyzing',completed:3,total:9,analysis:{races:[{raceNo:1},{raceNo:2},{raceNo:3}]}})
  return new Promise(r=>{finish=r})
 })
 await tick()
 assert.equal(jobs.get(job.id).status,'running')
 assert.equal(jobs.get(job.id).progress.analysis.races.length,3)
 finish({analysis:{races:[]}});await tick()
})
