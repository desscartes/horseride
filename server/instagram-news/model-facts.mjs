import { buildCityFacts } from './facts.mjs'
import { racingCountry } from '../foreign-data.mjs'

const asNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null

export function buildCityModelFacts(program, city, activeModel, { now = new Date().toISOString() } = {}) {
  const facts = buildCityFacts(program, city, { now })
  if (!facts || !activeModel?.enabled || !activeModel.method || !/^\d{4}-\d{2}-\d{2}$/.test(activeModel.trainedThrough ?? '') || activeModel.trainedThrough >= program.date) return null
  const country = racingCountry(city) ?? 'TR'
  if ((activeModel.country ?? 'TR') !== country) return null

  const races = facts.races.map(fact => {
    const race = program.races.find(item => item.city === city && Number(item.no) === fact.raceNo)
    if (race?.rankingSource !== 'local_trained_model' || race.rankingMethod !== activeModel.method || race.rankingCountry !== country) return { raceNo: fact.raceNo, start: fact.start, scheduledDate: race?.scheduledDate ?? program.date, distance: fact.distance, surface: fact.surface, activeRunners: fact.activeRunners, ranked: false }
    const horses = (race.horses ?? []).filter(horse => !horse.outOfRace && asNumber(horse.rankingScore) !== null)
      .sort((a, b) => Number(b.rankingScore) - Number(a.rankingScore) || Number(a.no) - Number(b.no))
    if (horses.length < 2) return { raceNo: fact.raceNo, start: fact.start, scheduledDate: race.scheduledDate ?? program.date, distance: fact.distance, surface: fact.surface, activeRunners: fact.activeRunners, ranked: false }
    const [first, second] = horses
    const lastRun = (first.horsePerformance?.pastRuns ?? [])
      .filter(run => /^\d{4}-\d{2}-\d{2}$/.test(run.date ?? '') && run.date < program.date && Number(run.finishPosition) > 0)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    const recentWorkout = (first.workouts ?? [])
      .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.dateISO ?? '') && row.dateISO < program.date && Number(row.distanceMeters) > 0 && Number(row.timeSeconds) > 0 && row.provider === 'Equibase')
      .sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0]
    const comparison = first.rankingComparison?.rivalName === second.name ? first.rankingComparison : null
    const group = comparison?.supportingGroups?.find(item => typeof item.label === 'string' && Number(item.scoreEffect) > 0)
    const workoutRunners = asNumber(race.rankingEvidence?.workoutRunners)
    return {
      raceNo: fact.raceNo, start: fact.start, scheduledDate: race.scheduledDate ?? program.date, distance: fact.distance, surface: fact.surface, activeRunners: fact.activeRunners, ranked: true,
      first: { no: Number(first.no), name: first.name },
      second: { no: Number(second.no), name: second.name },
      lastRun: lastRun ? { date: lastRun.date, city: lastRun.city, distance: Number(String(lastRun.distance ?? '').match(/\d+/)?.[0]) || null, surface: lastRun.surface, finishPosition: Number(lastRun.finishPosition) } : null,
      recentForm: /[1-9]/.test(first.lastSix ?? '') ? String(first.lastSix).slice(0, 12) : null,
      recentWorkout: recentWorkout ? { date: recentWorkout.dateISO, distanceMeters: Math.round(Number(recentWorkout.distanceMeters)), timeSeconds: Number(recentWorkout.timeSeconds), groupRank: /^\d+\/\d+$/.test(recentWorkout.groupRank ?? '') ? recentWorkout.groupRank : null, provider: recentWorkout.provider } : null,
      sensitivity: group?.label ?? null,
      workoutCoverage: workoutRunners !== null && workoutRunners >= 0 && workoutRunners <= fact.activeRunners ? workoutRunners : null,
      archiveLeader: fact.historicalFastest?.horseName ?? null,
      archiveTimeSeconds: fact.historicalFastest?.timeSeconds ?? null,
      archiveCoverage: fact.timedRunners,
      archiveDisagrees: fact.historicalFastest !== null && fact.historicalFastest.horseNo !== Number(first.no),
    }
  })
  const rankedRaces = races.filter(race => race.ranked).length
  return rankedRaces >= 2 ? {
    city, country, date: program.date, fetchedAt: facts.fetchedAt, sourceUrl: facts.sourceUrl,
    method: activeModel.method, trainedThrough: activeModel.trainedThrough,
    rankedRaces, totalRaces: facts.totalRaces, races,
  } : null
}
