import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCityObservations, observationPostDue } from './observations.mjs'

const day = '2026-10-28'
const horse = (no, name, jockey, split) => ({
  no, name, jockey, horseId: no,
  horsePerformance: { pastRuns: [] },
  workouts: [{ dateISO: '2026-10-20', hippodrome: 'Elazığ', surface: 'kum', type: 'Galop', splits: { 800: split } }],
})
const horses = [horse(1, 'A', 'J1', '0.51.00'), horse(2, 'B', 'J2', '0.50.00')]
const program = { source: 'tjk_csv', date: day, fetchedAt: '2026-10-28T08:00:00Z', providerUrls: ['https://medya-cdn.tjk.org/2026-10-28-Elazig.csv'], races: [{ city: 'Elazığ', no: 1, time: '17.45', surface: 'Kum', distance: '1200m', horses }] }
const evidence = { date: day, createdAt: '2026-10-28T08:05:00Z', archiveThrough: '2026-10-27', records: [
  { city: 'Elazığ', raceNo: 1, horseName: 'A', jockey: 'J1', evidence: { source: 'dated_verified_archive_results', through: '2026-10-27', windowDays: 90, sameTrack: { starts: 50, wins: 15 } } },
  { city: 'Elazığ', raceNo: 1, horseName: 'B', jockey: 'J2', evidence: { source: 'dated_verified_archive_results', through: '2026-10-27', windowDays: 90, sameTrack: { starts: 25, wins: 5 } } },
] }
test('idman and jockey summaries remain separate historical observations', () => {
  const result = buildCityObservations(program, 'Elazığ', evidence, { now: '2026-10-28T08:15:00Z' })
  assert.equal(result.races[0].workout.horseName, 'B')
  assert.equal(result.races[0].jockeyArchive.jockey, 'J1')
  assert.equal(result.races[0].jockeyArchive.rate, 0.3)
})
test('future archive and small jockey samples are excluded', () => {
  assert.equal(buildCityObservations(program, 'Elazığ', { ...evidence, archiveThrough: day }, { now: '2026-10-28T08:15:00Z' }), null)
  const small = structuredClone(evidence)
  small.records[1].evidence.sameTrack.starts = 10
  assert.equal(buildCityObservations(program, 'Elazığ', small, { now: '2026-10-28T08:15:00Z' }).races[0].jockeyArchive, null)
})
test('archive follow-up appears only in the four-hour prestart window with enough evidence', () => {
  const report = { firstStartAt: Date.parse('2026-10-28T17:45:00+03:00'), races: Array.from({length:8},()=>({workout:{},jockeyArchive:{}})) }
  assert.equal(observationPostDue(report,'2026-10-28T09:44:59Z'),false)
  assert.equal(observationPostDue(report,'2026-10-28T10:45:00Z'),true)
  assert.equal(observationPostDue(report,'2026-10-28T14:00:00Z'),false)
  report.races[0].workout=null;report.races[1].workout=null;report.races[2].workout=null;report.races[3].workout=null
  assert.equal(observationPostDue(report,'2026-10-28T10:45:00Z'),false)
})
