import test from 'node:test'
import assert from 'node:assert/strict'
import { nightlyTrainingPlan } from './nightly-training-plan.mjs'

test('completed-result candidates train daily while one research country runs each weekday', () => {
  const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
  assert.deepEqual(days.map(day => nightlyTrainingPlan(day).intelligenceCountry), ['TR', 'US', 'GB', 'FR', 'ZA', 'AU'])
  assert.ok(days.every(day => nightlyTrainingPlan(day).dailyCandidates.join(',') === 'TR,US'))
})

test('Sunday schedules one optional long study and no simultaneous intelligence export', () => {
  for (const day of ['2026-11-01', '2026-11-08']) {
    const plan = nightlyTrainingPlan(day)
    assert.equal(plan.intelligenceCountry, null)
    assert.notEqual(plan.pedigreeExperiment, plan.overseasExperiment)
  }
})
