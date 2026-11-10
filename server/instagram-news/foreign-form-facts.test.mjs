import test from 'node:test'
import assert from 'node:assert/strict'
import { buildForeignFormFacts } from './foreign-form-facts.mjs'

const program = () => ({
  source: 'tjk_csv', date: '2026-10-29', fetchedAt: '2026-10-29T08:00:00Z',
  providerUrls: ['https://www.tjk.org/program?SehirAdi=Woodbine%20Kanada'],
  races: [1, 2].map(no => ({
    city: 'Woodbine Kanada', no, time: `${14 + no}.00`, scheduledDate: '2026-10-29', distance: '1400m', surface: 'Kum',
    horses: [
      { no: 1, name: 'A', lastSix: '123456' },
      { no: 2, name: 'B', lastSix: '112344' },
      { no: 3, name: 'C', lastSix: '11', outOfRace: true },
    ],
  })),
})

test('foreign archive comparison uses visible prior finish counts and excludes scratches', () => {
  const report = buildForeignFormFacts(program(), 'Woodbine Kanada', { now: '2026-10-29T08:05:00Z' })
  assert.equal(report.totalRaces, 2)
  assert.deepEqual(report.races[0].first, { no: 2, name: 'B', top3: 4, starts: 6 })
  assert.deepEqual(report.races[0].second, { no: 1, name: 'A', top3: 3, starts: 6 })
  assert.equal(report.races[0].comparableRunners, 2)
  assert.equal(report.races[0].medianTop3Percent, 58)
})

test('archive comparison requires broad coverage and a fresh pre-start source', () => {
  const sample = program()
  sample.races[0].horses[1].lastSix = '12'
  assert.equal(buildForeignFormFacts(sample, 'Woodbine Kanada', { now: '2026-10-29T08:05:00Z' }), null)
  assert.equal(buildForeignFormFacts(program(), 'Woodbine Kanada', { now: '2026-10-29T12:05:00Z' }), null)
})

test('a meeting with broad coverage marks one thin race instead of dropping the whole post', () => {
  const sample = program()
  sample.races.push({ ...sample.races[1], no: 3, time: '16.00' })
  sample.races[0].horses[1].lastSix = '12'
  const report = buildForeignFormFacts(sample, 'Woodbine Kanada', { now: '2026-10-29T08:05:00Z' })
  assert.equal(report.totalRaces, 3)
  assert.equal(report.comparableRaces, 2)
  assert.equal(report.races[0].insufficientHistory, true)
  assert.equal(report.races[0].first, null)
})

test('all-zero history is disclosed without presenting arbitrary horses as leaders', () => {
  const sample = program()
  for (const race of sample.races) for (const horse of race.horses) horse.lastSix = '445566'
  const report = buildForeignFormFacts(sample, 'Woodbine Kanada', { now: '2026-10-29T08:05:00Z' })
  assert.equal(report.races[0].informative, false)
})

test('a runner with no first-three finish is not presented as a second form leader', () => {
  const sample = program()
  for (const race of sample.races) race.horses[0].lastSix = '445566'
  const report = buildForeignFormFacts(sample, 'Woodbine Kanada', { now: '2026-10-29T08:05:00Z' })
  assert.equal(report.races[0].informative, true)
  assert.equal(report.races[0].second, null)
})
