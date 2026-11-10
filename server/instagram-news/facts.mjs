const DAY_MS = 86_400_000

function key(value) {
  return String(value ?? '')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '')
}

function distance(value) {
  return Number(String(value ?? '').match(/\d+/)?.[0]) || 0
}

function runDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? String(value) : null
}

function startAt(date, clock) {
  const match = String(clock ?? '').match(/^(\d{1,2})[.:](\d{2})$/)
  return match ? Date.parse(date + 'T' + match[1].padStart(2, '0') + ':' + match[2] + ':00+03:00') : NaN
}

function seconds(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 && n < 600 ? n : null
}

export function parseWorkoutSplit(value) {
  const match = String(value ?? '').trim().match(/^(\d+)[.:](\d{2})[.:](\d{2})$/)
  if (!match || Number(match[2]) >= 60) return null
  return Number(match[1]) * 60 + Number(match[2]) + Number(match[3]) / 100
}

export function formatSeconds(value) {
  const n = seconds(value)
  if (n === null) return '—'
  const minutes = Math.floor(n / 60)
  const rest = (n - minutes * 60).toFixed(2).replace('.', ',').padStart(5, '0')
  return minutes + ':' + rest
}

function historyFor(horse, race, date) {
  if (!(Number(horse.horseId) > 0)) return []
  const cutoff = new Date(Date.parse(date + 'T12:00:00Z') - 730 * DAY_MS).toISOString().slice(0, 10)
  const seen = new Set()
  return (horse.horsePerformance?.pastRuns ?? []).filter(run => {
    const day = runDate(run.date)
    if (!day || day >= date || day < cutoff) return false
    if (key(run.city) !== key(race.city) || key(run.surface) !== key(race.surface)) return false
    if (distance(run.distance) !== distance(race.distance)) return false
    if (!(Number(run.finishPosition) > 0)) return false
    const identity = [day, run.raceNo, key(run.city), run.distance, key(run.surface)].join('|')
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

function workoutFor(horse, race, date, splitDistance) {
  const cutoff = new Date(Date.parse(date + 'T12:00:00Z') - 45 * DAY_MS).toISOString().slice(0, 10)
  return (horse.workouts ?? [])
    .filter(row => runDate(row.dateISO) && row.dateISO < date && row.dateISO >= cutoff)
    .filter(row => key(row.hippodrome) === key(race.city) && key(row.surface) === key(race.surface) && key(row.type) === 'galop')
    .map(row => ({ date: row.dateISO, timeSeconds: parseWorkoutSplit(row.splits?.[splitDistance]) }))
    .filter(row => row.timeSeconds !== null)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
}

function workoutFact(race, horses, date) {
  const candidates = [800, 600, 400].map(splitDistance => {
    const rows = horses.map(horse => {
      const workout = workoutFor(horse, race, date, splitDistance)
      return workout ? { horseName: horse.name, horseNo: Number(horse.no), ...workout } : null
    }).filter(Boolean)
    return { splitDistance, rows }
  }).sort((a, b) => b.rows.length - a.rows.length || b.splitDistance - a.splitDistance)
  const chosen = candidates[0]
  if (!chosen || chosen.rows.length < 2) return null
  chosen.rows.sort((a, b) => a.timeSeconds - b.timeSeconds || a.horseNo - b.horseNo)
  return {
    splitDistance: chosen.splitDistance,
    horseName: chosen.rows[0].horseName,
    horseNo: chosen.rows[0].horseNo,
    timeSeconds: chosen.rows[0].timeSeconds,
    workoutDate: chosen.rows[0].date,
    coveredRunners: chosen.rows.length,
    activeRunners: horses.length,
  }
}

function raceFact(race, date) {
  const horses = (race.horses ?? []).filter(horse => !horse.outOfRace)
  const histories = horses.map(horse => ({
    horseName: horse.name, horseNo: Number(horse.no), runs: historyFor(horse, race, date),
  }))
  const comparisons = histories.map(row => {
    const timed = row.runs.filter(run => seconds(run.timeSeconds) !== null)
      .sort((a, b) => a.timeSeconds - b.timeSeconds || b.date.localeCompare(a.date))
    return timed.length ? { ...row, best: timed[0] } : null
  }).filter(Boolean).sort((a, b) => a.best.timeSeconds - b.best.timeSeconds || a.horseNo - b.horseNo)
  const leader = comparisons.length >= 2 ? comparisons[0] : null
  const recorded = histories.filter(row => row.runs.length)
  const priorWinners = recorded.filter(row => row.runs.some(run => Number(run.finishPosition) === 1))
    .map(row => ({ horseName: row.horseName, horseNo: row.horseNo }))
  return {
    raceNo: Number(race.no), start: race.time, surface: race.surface, distance: distance(race.distance),
    activeRunners: horses.length, coveredRunners: recorded.length, timedRunners: comparisons.length,
    observedRuns: recorded.reduce((sum, row) => sum + row.runs.length, 0),
    priorWinners,
    historicalFastest: leader ? {
      horseName: leader.horseName, horseNo: leader.horseNo, timeSeconds: leader.best.timeSeconds,
      runDate: leader.best.date, finishPosition: Number(leader.best.finishPosition),
      sameTrack: true, sameSurface: true, sameDistance: true,
    } : null,
    workout: workoutFact(race, horses, date),
  }
}

function sourceFor(program, city) {
  return (program.providerUrls ?? []).find(url => {
    try { return key(decodeURIComponent(url)).includes(key(city)) }
    catch { return false }
  }) ?? null
}

export function buildCityFacts(program, city, { now = new Date().toISOString(), maximumSourceAgeMinutes = 120 } = {}) {
  if (program?.source !== 'tjk_csv' || !/^\d{4}-\d{2}-\d{2}$/.test(String(program.date ?? ''))) return null
  const fetchedAt = program.cityFetchedAt?.[city] ?? program.fetchedAt
  const clock = Date.parse(now), fetched = Date.parse(fetchedAt)
  if (!Number.isFinite(clock) || !Number.isFinite(fetched) || fetched > clock || (clock - fetched) / 60000 > maximumSourceAgeMinutes) return null
  const races = (program.races ?? []).filter(race => race.city === city).sort((a, b) => Number(a.no) - Number(b.no))
  if (!races.length || races.some(race => !Number.isFinite(startAt(race.scheduledDate ?? program.date, race.time)))) return null
  const firstStartAt = Math.min(...races.map(race => startAt(race.scheduledDate ?? program.date, race.time)))
  if (clock >= firstStartAt - 10 * 60000) return null
  const sourceUrl = sourceFor(program, city)
  if (!sourceUrl) return null
  return {
    city, date: program.date, fetchedAt, checkedAt: now, sourceUrl,
    firstStart: races[0].time, firstStartAt: new Date(firstStartAt).toISOString(), totalRaces: races.length,
    races: races.map(race => raceFact(race, program.date)),
    note: 'Geçmiş dereceler aynı hipodrom, pist türü ve mesafedeki son 730 günün doğrulanmış kayıtlarıdır. Farklı tarihlerdeki pist koşulları değişebilir. İdman notları son 45 gündeki aynı hipodrom, pist türü ve idman tipinin son kayıtlarından oluşur. Bunlar bugünkü sonuç için öngörü değildir.',
  }
}
