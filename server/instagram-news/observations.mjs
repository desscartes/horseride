import { buildCityFacts } from './facts.mjs'

const startAt = (day, clock) => Date.parse(`${day}T${String(clock).replace('.', ':')}:00+03:00`)

function jockeyArchive(race, city, day, records) {
  const active = (race.horses ?? []).filter(horse => !horse.outOfRace)
  const rows = active.map(horse => {
    const match = records.find(row => row.city === city && Number(row.raceNo) === Number(race.no) && row.horseName === horse.name && row.jockey === horse.jockey)
    const evidence = match?.evidence
    if (evidence?.source !== 'dated_verified_archive_results' || !evidence.through || evidence.through >= day || evidence.windowDays !== 90) return null
    const starts = Number(evidence.sameTrack?.starts), wins = Number(evidence.sameTrack?.wins)
    if (!Number.isInteger(starts) || starts < 20 || !Number.isInteger(wins) || wins < 0 || wins > starts) return null
    return { jockey: horse.jockey, horseName: horse.name, starts, wins, rate: wins / starts, through: evidence.through }
  }).filter(Boolean)
  rows.sort((a, b) => b.rate - a.rate || b.starts - a.starts || a.jockey.localeCompare(b.jockey, 'tr'))
  return rows.length >= 2 ? { ...rows[0], coveredJockeys: rows.length, activeRunners: active.length } : null
}

export function buildCityObservations(program, city, jockeyFile, { now = new Date().toISOString() } = {}) {
  const facts = buildCityFacts(program, city, { now })
  if (!facts) return null
  if (jockeyFile?.date !== program.date || !Array.isArray(jockeyFile.records)) return null
  if (Date.parse(jockeyFile.createdAt) > Date.parse(now) || jockeyFile.archiveThrough >= program.date) return null
  const races = program.races.filter(race => race.city === city).sort((a, b) => Number(a.no) - Number(b.no))
  return {
    city, date: facts.date, fetchedAt: facts.fetchedAt, sourceUrl: facts.sourceUrl,
    firstStartAt: startAt(facts.date, facts.firstStart),
    races: facts.races.map((fact, index) => ({ ...fact, jockeyArchive: jockeyArchive(races[index], city, facts.date, jockeyFile.records) })),
    note: 'İdman tablosu aynı hipodrom ve pist türündeki son 45 günün son galoplarını, aynı ara mesafe içinde karşılaştırır. Jokey tablosu arşivde doğrulanmış son 90 gündeki aynı hipodrom yarışlarını kapsar ve en az 20 start koşulunu uygular. İki tablo bağımsız geçmiş gözlemlerdir; bugün için sonuç öngörüsü değildir.',
  }
}

export function observationPostDue(report, now = new Date().toISOString()) {
  const clock = Date.parse(now)
  return Number.isFinite(clock) && Number.isFinite(report?.firstStartAt)
    && clock >= report.firstStartAt - 4 * 3600000
    && clock < report.firstStartAt - 45 * 60000
    && report.races.filter(race => race.workout).length >= Math.max(4, Math.ceil(report.races.length * 0.6))
    && report.races.filter(race => race.jockeyArchive).length >= 4
}
