import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCityFacts, parseWorkoutSplit } from './facts.mjs'

const date = '2026-10-28'
const horse = (no, name, run, workout) => ({
  no, name, horseId: 100 + no,
  horsePerformance: { pastRuns: [run] },
  workouts: workout ? [workout] : [],
})
const run = (dateValue, surface, timeSeconds, distance = 1400) => ({
  date: dateValue, city: 'İstanbul', surface, distance,
  timeSeconds, finishPosition: 2, raceNo: 3,
})
const workout = (dateValue, surface, split) => ({
  dateISO: dateValue, hippodrome: 'İstanbul', surface, type: 'Galop',
  splits: { 800: split },
})
const program = horses => ({
  source: 'tjk_csv', date, fetchedAt: '2026-10-28T08:00:00Z',
  providerUrls: ['https://medya-cdn.tjk.org/2026-10-28-Istanbul-GunlukYarisProgrami.csv'],
  races: [{ city: 'İstanbul', no: 3, time: '15.00', distance: '1400m', surface: 'Çim', horses }],
})

test('reported record uses only earlier runs on the same track, surface and distance', () => {
  const horses = [
    horse(1, 'A', run('2026-10-01', 'Çim', 84.3), workout('2026-10-20', 'Çim', '0.50.20')),
    horse(2, 'B', run('2026-09-01', 'Çim', 84.8), workout('2026-10-21', 'Çim', '0.49.80')),
    horse(3, 'C', run('2026-10-29', 'Çim', 70.1)),
    horse(4, 'D', run('2026-09-01', 'Sentetik', 71.3)),
    horse(5, 'E', run('2026-09-01', 'Çim', 72.1, 1200)),
  ]
  const facts = buildCityFacts(program(horses), 'İstanbul', { now: '2026-10-28T08:15:00Z' })
  assert.equal(facts.races[0].coveredRunners, 2)
  assert.equal(facts.races[0].timedRunners, 2)
  assert.equal(facts.races[0].historicalFastest.horseName, 'A')
  assert.equal(facts.races[0].workout.horseName, 'B')
  assert.equal(facts.races[0].workout.coveredRunners, 2)
})

test('insufficient history is disclosed instead of inventing a leader', () => {
  const facts = buildCityFacts(program([horse(1, 'A', run('2026-10-01', 'Çim', 84.3))]), 'İstanbul', { now: '2026-10-28T08:15:00Z' })
  assert.equal(facts.races[0].coveredRunners, 1)
  assert.equal(facts.races[0].timedRunners, 1)
  assert.equal(facts.races[0].historicalFastest, null)
})

test('stale or already-started programs are not eligible', () => {
  const sample = program([horse(1, 'A', run('2026-10-01', 'Çim', 84.3))])
  assert.equal(buildCityFacts(sample, 'İstanbul', { now: '2026-10-28T10:30:00Z' }), null)
  assert.equal(buildCityFacts(sample, 'İstanbul', { now: '2026-10-28T11:51:00Z', maximumSourceAgeMinutes: 300 }), null)
})

test('official split syntax is parsed without treating distance as time', () => {
  assert.equal(parseWorkoutSplit('0.49.80'), 49.8)
  assert.equal(parseWorkoutSplit('1.03.00'), 63)
  assert.equal(parseWorkoutSplit('0.75.00'), null)
})

test('an overseas meeting crossing midnight keeps the next-day race in order', () => {
  const sample = {
    source: 'tjk_csv', date, fetchedAt: '2026-10-28T20:00:00Z',
    providerUrls: ['https://www.tjk.org/program?SehirAdi=Horseshoe%20Indianapolis%20ABD'],
    races: [
      { city: 'Horseshoe Indianapolis ABD', no: 1, time: '23.35', scheduledDate: date, distance: '1400m', surface: 'Kum', horses: [{ no: 1, name: 'A' }] },
      { city: 'Horseshoe Indianapolis ABD', no: 2, time: '00.07', scheduledDate: '2026-10-29', distance: '1400m', surface: 'Kum', horses: [{ no: 1, name: 'B' }] },
    ],
  }
  const facts = buildCityFacts(sample, 'Horseshoe Indianapolis ABD', { now: '2026-10-28T20:01:00Z' })
  assert.equal(facts.totalRaces, 2)
  assert.equal(facts.firstStartAt, '2026-10-28T20:35:00.000Z')
})

test('refreshing one city never restamps a different city or a started meeting', () => {
 const p=program([horse(1,'A',run('2026-10-01','Çim',84.3))]);
 p.fetchedAt='2026-10-27T08:00:00Z';
 p.cityFetchedAt={'İstanbul':'2026-10-28T08:00:00Z'};
 assert.equal(buildCityFacts(p,'İstanbul',{now:'2026-10-28T08:15:00Z'}).fetchedAt,p.cityFetchedAt['İstanbul']);
 assert.equal(buildCityFacts({...p,cityFetchedAt:{Kocaeli:'2026-10-28T08:00:00Z'}},'İstanbul',{now:'2026-10-28T08:15:00Z'}),null);
 assert.equal(buildCityFacts(p,'İstanbul',{now:'2026-10-28T12:00:00Z'}),null);
});
