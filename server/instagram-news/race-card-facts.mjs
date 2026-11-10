import { buildCityModelFacts } from './model-facts.mjs'

const dateText = day => day ? `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(2, 4)}` : ''
const distance = value => Number(String(value ?? '').match(/\d+/)?.[0]) || null
const normalize = value => String(value ?? '').toLocaleLowerCase('tr-TR').trim()
const surfaceLabel = value => normalize(value) === 'cim' ? 'çim' : String(value ?? '').trim()

export function cleanHorseName(name) {
  const words = String(name ?? '')
    .replace(/\s+\((?:USA|GB|IRE|FR|GER|AUS|NZ|SAF|JPN|CAN|ARG|BRZ|CHI|UK)\)(?=\s|$)/gi, '')
    .trim().split(/\s+/)
  const gear = new Set(['KG', 'K', 'DB', 'SK', 'SKG', 'GKR', 'ÖG', 'TG', 'YP', 'BB', 'DS', 'AP', 'HKG', 'M'])
  while (words.length > 1 && gear.has(words.at(-1))) words.pop()
  return words.join(' ')
}

function horseEvidence(horse, race, day) {
  const positions = String(horse.lastSix ?? '').match(/[0-9]/g)?.slice(-6).map(Number) ?? []
  const topThree = positions.filter(value => value >= 1 && value <= 3).length
  const prior = (horse.horsePerformance?.pastRuns ?? [])
    .filter(run => /^\d{4}-\d{2}-\d{2}$/.test(run.date ?? '') && run.date < day && Number(run.finishPosition) > 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
  const sameCourse = prior && normalize(prior.city) === normalize(race.city)
    && normalize(prior.surface) === normalize(race.surface)
    && distance(prior.distance) === distance(race.distance)
  const form = positions.length
    ? `Son ${positions.length} görünür sonuçta ${topThree} kez ilk üçte.`
    : 'Sonuç dizisi kaydı yok.'
  const lastRun = prior
    ? sameCourse
      ? `${dateText(prior.date)}’da aynı pist ve mesafede ${prior.finishPosition}. oldu.`
      : `${dateText(prior.date)}’da ${prior.city}, ${distance(prior.distance) ?? '—'} m ${surfaceLabel(prior.surface)} pistte ${prior.finishPosition}. oldu.`
    : null
  const workout = (horse.workouts ?? [])
    .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.dateISO ?? '') && row.dateISO < day)
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO))
    .map(row => {
      if (row.provider === 'Equibase' && Number(row.distanceMeters) > 0 && Number(row.timeSeconds) > 0)
        return `${dateText(row.dateISO)} idmanı: ${Math.round(row.distanceMeters)} m / ${Number(row.timeSeconds).toFixed(2).replace('.', ',')} sn${/^\d+\/\d+$/.test(row.groupRank ?? '') ? ` (grup sırası ${row.groupRank})` : ''}.`
      if (row.source === 'tjk_horse_workout_history' && normalize(row.type) === 'galop') {
        const split = [1000, 800, 600, 400].map(metres => [metres, row.splits?.[metres]]).find(([, value]) => /^\d+[.:]\d{2}[.:]\d{2}$/.test(value ?? ''))
        return split ? `${dateText(row.dateISO)} galobu: ${split[0]} m / ${String(split[1]).replace(/^(\d+)[.:](\d{2})[.:](\d{2})$/, '$1:$2,$3')}.` : null
      }
      return null
    }).find(Boolean) ?? null
  return { form, lastRun, workout, source: prior ? 'verified_prior_run' : positions.length ? 'tjk_recent_results' : workout ? 'dated_workout' : 'limited' }
}

export function buildRaceCardFacts(program, city, activeModel, options = {}) {
  const model = buildCityModelFacts(program, city, activeModel, options)
  if (!model || model.rankedRaces !== model.totalRaces) return null
  const races = model.races.map(item => {
    const race = program.races.find(row => row.city === city && Number(row.no) === item.raceNo)
    if (!race || race.rankingSource !== 'local_trained_model' || race.rankingMethod !== model.method || race.rankingCountry !== model.country) return null
    const horses = race.horses.filter(horse => !horse.outOfRace && Number.isFinite(Number(horse.rankingScore)))
      .sort((a, b) => Number(b.rankingScore) - Number(a.rankingScore) || Number(a.no) - Number(b.no))
      .slice(0, 4)
    if (horses.length < 2) return null
    const comparison = horses[0].rankingComparison?.rivalName === horses[1].name ? horses[0].rankingComparison : null
    const leadSignal = comparison?.supportingGroups?.filter(group => typeof group.label === 'string' && Number(group.scoreEffect) > 0)
      .sort((a, b) => Number(b.scoreEffect) - Number(a.scoreEffect))[0]?.label ?? null
    const leadMargin = Number(horses[0].rankingScore) - Number(horses[1].rankingScore)
    return { raceNo: item.raceNo, start: item.start, scheduledDate: item.scheduledDate, distance: item.distance, surface: item.surface, type: race.type ?? '', activeRunners: item.activeRunners,
      leadSignal, leadMargin: Number.isFinite(leadMargin) ? Math.max(0, leadMargin) : 0,
      horses: horses.map((horse, index) => ({ rank: index + 1, no: Number(horse.no), name: cleanHorseName(horse.name), ...horseEvidence(horse, race, program.date) })) }
  })
  if (races.some(item => !item)) return null
  return { city, country: model.country, date: model.date, fetchedAt: model.fetchedAt, sourceUrl: model.sourceUrl, trainedThrough: model.trainedThrough, method: model.method, totalRaces: races.length, races }
}
