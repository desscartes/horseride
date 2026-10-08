import test from 'node:test'
import assert from 'node:assert/strict'
import { localDay, collectionDates, promotionAllowed } from './maintenance-policy.mjs'

test('uses Istanbul day and only completed dates, with bounded catch-up and recent retries', () => {
  assert.equal(localDay(new Date('2026-10-06T21:30:00Z')), '2026-10-07')
  assert.deepEqual(collectionDates('2026-10-07','2026-10-04'), ['2026-10-04','2026-10-05','2026-10-06'])
  const days = collectionDates('2026-10-07','2026-01-01')
  assert.equal(days.length, 7)
  assert.equal(days.at(-1), '2026-10-06')
})

test('rejects leakage, small samples, uncertain gains and weaker calibration', () => {
  const e = { races: 350, days: 25, testFrom:'2026-10-05', candidateTrainedThrough:'2026-10-04', incumbentTrainedThrough:'2026-10-04', improvementPoints:2.5, dayBootstrap95:[.3,4.7], candidate:{brier:.81,winnerInTopThree:61},incumbent:{brier:.84,winnerInTopThree:59} }
  assert.equal(promotionAllowed({ evaluation:e }),true)
  for (const patch of [{races:299},{days:20},{testFrom:'2026-10-04'},{improvementPoints:1.9},{dayBootstrap95:[-.2,5]},{candidate:{brier:.85,winnerInTopThree:62}},{candidate:{brier:.80,winnerInTopThree:58}}]) assert.equal(promotionAllowed({evaluation:{...e,...patch}}),false)
  assert.equal(promotionAllowed({evaluation:null}),false)
})
