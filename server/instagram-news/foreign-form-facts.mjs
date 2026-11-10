import { racingCountry } from '../foreign-data.mjs'
import { buildCityFacts } from './facts.mjs'

function recentPositions(value) {
  return String(value ?? '').match(/[0-9]/g)?.slice(-6).map(Number) ?? []
}

export function buildForeignFormFacts(program, city, { now = new Date().toISOString() } = {}) {
  const country = racingCountry(city)
  if (!country) return null
  const facts = buildCityFacts(program, city, { now })
  if (!facts) return null
  const races = []
  let comparableRaces = 0
  for (const fact of facts.races) {
    const sourceRace = program.races.find(race => race.city === city && Number(race.no) === fact.raceNo)
    const active = (sourceRace?.horses ?? []).filter(horse => !horse.outOfRace)
    const rows = active.map(horse => {
      const positions = recentPositions(horse.lastSix)
      const top3 = positions.filter(position => position >= 1 && position <= 3).length
      return positions.length >= 4 ? { no: Number(horse.no), name: horse.name, top3, starts: positions.length } : null
    }).filter(Boolean)
    const comparable = rows.length >= 2 && rows.length >= Math.ceil(active.length / 2)
    if (!comparable) {
      races.push({ raceNo: fact.raceNo, start: fact.start, scheduledDate: sourceRace.scheduledDate ?? program.date, distance: fact.distance, surface: fact.surface, activeRunners: active.length, comparableRunners: rows.length, medianTop3Percent: null, insufficientHistory: true, informative: false, first: null, second: null, tiedForFirst: 0 })
      continue
    }
    comparableRaces++
    rows.sort((a, b) => b.top3 / b.starts - a.top3 / a.starts || b.top3 - a.top3 || b.starts - a.starts || a.no - b.no)
    const [first, second] = rows
    const tiedForFirst = rows.filter(row => row.top3 * first.starts === first.top3 * row.starts).length
    const rates = rows.map(row => row.top3 / row.starts).sort((a, b) => a - b)
    const middle = Math.floor(rates.length / 2)
    const medianRate = rates.length % 2 ? rates[middle] : (rates[middle - 1] + rates[middle]) / 2
    races.push({ raceNo: fact.raceNo, start: fact.start, scheduledDate: sourceRace.scheduledDate ?? program.date, distance: fact.distance, surface: fact.surface, activeRunners: active.length, comparableRunners: rows.length, medianTop3Percent: Math.round(medianRate * 100), insufficientHistory: false, informative: first.top3 > 0, first, second: second.top3 > 0 ? second : null, tiedForFirst })
  }
  if (comparableRaces < Math.ceil(races.length * 2 / 3)) return null
  return { city, country, date: program.date, fetchedAt: program.fetchedAt, sourceUrl: facts.sourceUrl, firstStartAt: facts.firstStartAt, totalRaces: races.length, comparableRaces, races }
}
