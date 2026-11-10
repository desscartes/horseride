import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRaceCardFacts } from './race-card-facts.mjs'

test('four ranked horses receive only facts dated before the target race', () => {
  const date = '2026-10-30', city = 'İzmir'
  const horses = [1, 2, 3, 4, 5].map(no => ({
    no, name: `AT ${no} KG DB`, rankingScore: 6 - no, horseId: 100 + no,
    lastSix: 'K3K2K4K1',
    horsePerformance: { pastRuns: [
      { date, city, distance: 1400, surface: 'Kum', finishPosition: 1 },
      { date: '2026-10-20', city, distance: 1400, surface: 'Kum', finishPosition: no },
    ] },
    workouts: [
      { dateISO: date, source: 'tjk_horse_workout_history', type: 'Galop', splits: { 400: '0.22.00' } },
      { dateISO: '2026-10-23', source: 'tjk_horse_workout_history', type: 'Galop', splits: { 400: '0.27.50' } },
    ],
  }))
  horses[0].rankingComparison = { rivalName: horses[1].name, supportingGroups: [
    { label: 'önceki yarış performansı', scoreEffect: 0.24 },
    { label: 'soy', scoreEffect: -0.1 },
  ] }
  horses[4].outOfRace = true
  const races = [1, 2].map(no => ({ city, no, time: `${14 + no}.00`, scheduledDate: date, distance: 1400, surface: 'Kum',
    rankingSource: 'local_trained_model', rankingCountry: 'TR', rankingMethod: 'active-model', horses }))
  const program = { source: 'tjk_csv', date, fetchedAt: '2026-10-30T08:00:00Z', races,
    providerUrls: ['https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirAdi=Izmir'] }
  const model = { enabled: true, country: 'TR', method: 'active-model', trainedThrough: '2026-10-04' }
  const result = buildRaceCardFacts(program, city, model, { now: '2026-10-30T08:05:00Z' })
  assert.equal(result.races.length, 2)
  assert.deepEqual(result.races[0].horses.map(horse => horse.no), [1, 2, 3, 4])
  assert.equal(result.races[0].horses[0].name, 'AT 1')
  assert.equal(result.races[0].leadSignal, 'önceki yarış performansı')
  assert.match(result.races[0].horses[0].lastRun, /20\.10/)
  assert.match(result.races[0].horses[0].workout, /23\.10/)
  assert.doesNotMatch(JSON.stringify(result), /0:22,00/)
  assert.equal(buildRaceCardFacts(program, city, model, { now: '2026-10-30T12:05:00Z' }), null)
})
