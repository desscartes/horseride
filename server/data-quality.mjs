import { createHash } from 'node:crypto'

export function parseWeight(value) {
  const text = String(value ?? '').trim().replace(/,/g, '.')
  const match = text.match(/^(\d{2}(?:\.\d+)?)\s*(?:\+\s*(\d(?:\.\d+)?))?\s*(?:kg)?$/i)
  if (!match) return null
  const weight = Number(match[1]) + Number(match[2] || 0)
  return weight >= 35 && weight <= 80 ? Number(weight.toFixed(2)) : null
}

export function parseRaceTime(value) {
  const text = String(value ?? '').trim()
  const match = text.match(/^(\d{1,2})[.:](\d{2})[.:](\d{1,2})$/)
  if (!match || Number(match[2]) >= 60) return null
  const seconds = Number(match[1]) * 60 + Number(match[2]) + Number(match[3].padEnd(2, '0')) / 100
  return seconds >= 30 && seconds <= 400 ? seconds : null
}

// Strip equipment codes only when they are a separate suffix. Keep the actual name.
export function horseIdentity(name) {
  return String(name || '').normalize('NFKD').replace(/\p{M}/gu, '').toUpperCase().replace(/İ/g, 'I')
    .replace(/(?:\s+(?:KG|DB|SKG|SK|K|OG|GKR|DS))+$/g, '').replace(/[^A-Z0-9]/g, '')
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
  return value
}

export function analysisFingerprint(races) {
  const clean = races.map(race => ({
    city: race.city, no: race.no, time: race.time, type: race.type, distance: race.distance,
    surface: race.surface, conditions: race.conditions,
    analysisCandidates:race.analysisCandidates,
    environment: race.environment && { weather: race.environment.weather, tracks: race.environment.tracks },
    horses: race.horses.map(({ probability, independentScore, baselineProbability, marketShare, ...horse }) => horse).sort((a,b)=>a.no-b.no),
  })).sort((a,b)=>a.city.localeCompare(b.city)||a.no-b.no)
  return createHash('sha256').update(JSON.stringify(stable(clean))).digest('hex')
}

export function programQuality(races) {
  const horses = races.flatMap(race=>race.horses)
  return {
    runners: horses.length,
    missingWeight: horses.filter(horse=>parseWeight(horse.weight)==null).length,
    missingJockey: horses.filter(horse=>!horse.jockey||horse.jockey==='Bilinmiyor').length,
    withHistory: horses.filter(horse=>horse.horsePerformance?.pastRuns?.length||horse.horsePerformance?.recentRuns?.length).length,
    withWorkout: horses.filter(horse=>horse.workout||horse.workouts?.length).length,
  }
}
