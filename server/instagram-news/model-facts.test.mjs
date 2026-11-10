import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCityModelFacts } from './model-facts.mjs'

const date = '2026-10-29'
const now = '2026-10-29T08:05:00Z'
const active = { enabled: true, method: 'active-model', trainedThrough: '2026-10-04' }
const fixture = () => ({
  source: 'tjk_csv', date, fetchedAt: '2026-10-29T08:00:00Z',
  providerUrls: ['https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirAdi=Istanbul'],
  races: [1, 2].map(no => ({
    city: 'İstanbul', no, time: `${14 + no}.00`, distance: '1400m', surface: 'Çim',
    rankingSource: 'local_trained_model', rankingCountry: 'TR', rankingMethod: 'active-model',
    rankingEvidence: { workoutRunners: 2 },
    horses: [
      { no: 1, name: `A${no}`, rankingScore: 2, rankingComparison: { rivalName: `B${no}`, supportingGroups: [{ label: 'idman', scoreEffect: 0.3 }] }, horseId: 101, horsePerformance: { pastRuns: [] } },
      { no: 2, name: `B${no}`, rankingScore: 1, horseId: 102, horsePerformance: { pastRuns: [] } },
      { no: 3, name: `C${no}`, rankingScore: 3, outOfRace: true, horseId: 103, horsePerformance: { pastRuns: [] } },
    ],
  })),
})

test('only the active, prior-trained local model supplies pre-race ranks', () => {
  const report = buildCityModelFacts(fixture(), 'İstanbul', active, { now })
  assert.equal(report.rankedRaces, 2)
  assert.equal(report.races[0].first.name, 'A1')
  assert.equal(report.races[0].second.name, 'B1')
  assert.equal(report.races[0].sensitivity, 'idman')
  assert.equal(report.races[0].workoutCoverage, 2)
  assert.equal(JSON.stringify(report).includes('probability'), false)
})

test('shadow, same-day training and stale programs cannot supply ranks', () => {
  const program = fixture()
  assert.equal(buildCityModelFacts(program, 'İstanbul', { ...active, method: 'shadow-model' }, { now }), null)
  assert.equal(buildCityModelFacts(program, 'İstanbul', { ...active, trainedThrough: date }, { now }), null)
  assert.equal(buildCityModelFacts(program, 'İstanbul', active, { now: '2026-10-29T10:30:00Z' }), null)
})

test('ranking disappears if fewer than two races have verified active model data', () => {
  const program = fixture()
  program.races[1].rankingSource = 'program_baseline'
  assert.equal(buildCityModelFacts(program, 'İstanbul', active, { now }), null)
})

test('last-run evidence uses only a verified race before the program day', () => {
  const program = fixture()
  program.races[0].horses[0].horsePerformance.pastRuns = [
    { date: '2026-10-29', city: 'İstanbul', distance: '1400m', surface: 'Kum', finishPosition: 1 },
    { date: '2026-10-20', city: 'Ankara', distance: '1200m', surface: 'Çim', finishPosition: 3 },
    { date: '2026-10-10', city: 'İzmir', distance: '1600m', surface: 'Kum', finishPosition: 2 },
  ]
  const report = buildCityModelFacts(program, 'İstanbul', active, { now })
  assert.deepEqual(report.races[0].lastRun, {
    date: '2026-10-20', city: 'Ankara', distance: 1200, surface: 'Çim', finishPosition: 3,
  })
  assert.equal(report.races[0].distance, 1400)
  assert.equal(report.races[0].surface, 'Çim')
})

test('foreign ranking requires the matching country model and prior workout', () => {
  const program = fixture()
  program.providerUrls = ['https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirAdi=Laurel%20Park%20ABD']
  for (const race of program.races) {
    race.city = 'Laurel Park ABD'
    race.rankingCountry = 'US'
    race.horses[0].lastSix = '25136'
    race.horses[0].workouts = [
      { dateISO: '2026-10-29', distanceMeters: 805, timeSeconds: 50, provider: 'Equibase' },
      { dateISO: '2026-10-20', distanceMeters: 804.672, timeSeconds: 51.2, groupRank: '4/12', provider: 'Equibase' },
    ]
  }
  const usModel = { ...active, country: 'US' }
  assert.equal(buildCityModelFacts(program, 'Laurel Park ABD', active, { now }), null)
  const report = buildCityModelFacts(program, 'Laurel Park ABD', usModel, { now })
  assert.equal(report.rankedRaces, 2)
  assert.equal(report.country, 'US')
  assert.equal(report.races[0].recentForm, '25136')
  assert.deepEqual(report.races[0].recentWorkout, { date: '2026-10-20', distanceMeters: 805, timeSeconds: 51.2, groupRank: '4/12', provider: 'Equibase' })
})
