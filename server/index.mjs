import { createServer } from 'node:http'
import { URL } from 'node:url'
import { databaseHealth, findHorseHistory, listRecentAnalyses, saveProgram } from './database.mjs'

const port = Number(process.env.PORT || 8787)
const defaultCity = process.env.TJK_CITY || 'Tümü'
const domesticProgramCities = (process.env.TJK_CITIES || 'İstanbul,Ankara,İzmir,Bursa,Adana,Kocaeli,Antalya,Diyarbakır,Elazığ,Şanlıurfa').split(',').map((value) => value.trim()).filter(Boolean)
const foreignProgramCities = (process.env.TJK_FOREIGN_CITIES || 'Yurtdışı').split(',').map((value) => value.trim()).filter(Boolean)
const allProgramCities = [...new Set([...domesticProgramCities, ...foreignProgramCities])]

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return { iso: `${year}-${month}-${day}`, display: `${day}.${month}.${year}` }
}

function parseNumber(value) {
  const cleaned = String(value || '').replace(/[^0-9,.-]/g, '').replace(',', '.')
  const number = Number.parseFloat(cleaned)
  return Number.isFinite(number) ? number : null
}

function parseTime(value) {
  const match = String(value || '').match(/(\d+)[.:](\d+)[.:](\d+)/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2]) + Number(match[3]) / 100
}

function parseClock(value) {
  const match = String(value || '').match(/(\d{1,2})\.(\d{2})/)
  if (!match) return Number.MAX_SAFE_INTEGER
  return Number(match[1]) * 60 + Number(match[2])
}

function formScore(form) {
  const values = String(form || '').match(/[0-9]/g) || []
  if (!values.length) return 0.5
  const points = values.slice(-6).map((value) => {
    const rank = Number(value)
    return rank === 0 ? 0.15 : Math.max(0.1, 1 - (rank - 1) * 0.16)
  })
  return points.reduce((sum, value) => sum + value, 0) / points.length
}

function scoreRace(race) {
  const times = race.horses.map((horse) => horse.bestTimeSeconds).filter(Boolean)
  const minTime = times.length ? Math.min(...times) : null
  const maxTime = times.length ? Math.max(...times) : null
  const starts = race.horses.map((horse) => horse.start).filter(Boolean)
  const maxStart = starts.length ? Math.max(...starts) : race.horses.length
  const minWeight = Math.min(...race.horses.map((horse) => horse.weight).filter(Boolean))

  const scored = race.horses.map((horse) => {
    const form = formScore(horse.lastSix)
    const recency = horse.daysSinceRace ? Math.max(0.2, 1 - Math.abs(horse.daysSinceRace - 21) / 80) : 0.5
    const weight = horse.weight && minWeight ? Math.max(0.2, 1 - (horse.weight - minWeight) / 15) : 0.5
    const time = horse.bestTimeSeconds && minTime && maxTime !== minTime ? 1 - (horse.bestTimeSeconds - minTime) / (maxTime - minTime) : 0.5
    const gate = horse.start && maxStart ? 1 - (horse.start - 1) / Math.max(1, maxStart) * 0.15 : 0.5
    const independentScore = form * 0.42 + time * 0.24 + weight * 0.16 + recency * 0.1 + gate * 0.08
    return {
      ...horse,
      independentScore: Number(independentScore.toFixed(4)),
      factors: { form: Number(form.toFixed(2)), time: Number(time.toFixed(2)), weight: Number(weight.toFixed(2)), recency: Number(recency.toFixed(2)), gate: Number(gate.toFixed(2)) },
      jockeyHistory: { status: 'not_connected', wins: null, starts: null, source: null },
    }
  })

  const total = scored.reduce((sum, horse) => sum + Math.exp(horse.independentScore * 4), 0)
  return { ...race, horses: scored.map((horse) => ({ ...horse, probability: Number((Math.exp(horse.independentScore * 4) / total * 100).toFixed(1)) })).sort((a, b) => b.probability - a.probability) }
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const races = []
  let current = null
  let readingHorses = false

  for (const line of lines) {
    const cells = line.split(';').map((cell) => cell.trim())
    const raceMatch = cells[0]?.match(/^(\d+)\.\s*Kosu\s*:\s*(\d{1,2}\.\d{2})/i)
    if (raceMatch) {
      if (current) races.push(scoreRace(current))
      current = { no: Number(raceMatch[1]), time: raceMatch[2], type: cells[1] || '', conditions: cells.slice(2, 7).filter(Boolean).join(' · '), distance: cells[4] || '', surface: cells[5] || '', horses: [] }
      readingHorses = false
      continue
    }
    if (!current) continue
    if (cells[0] === 'At No') { readingHorses = true; continue }
    if (!readingHorses || !/^\d+$/.test(cells[0])) continue

    current.horses.push({
      no: Number(cells[0]),
      name: cells[1] || 'Bilinmeyen at',
      age: cells[2] || '',
      sire: cells[3] || '',
      dam: cells[4] || '',
      weight: parseNumber(cells[5]),
      jockey: cells[6] || 'Bilinmiyor',
      owner: cells[7] || '',
      trainer: cells[8] || '',
      start: parseNumber(cells[9]),
      lastSix: cells[12] || '',
      daysSinceRace: parseNumber(cells[13]),
      bestTimeSeconds: parseTime(cells[15]),
    })
  }
  if (current) races.push(scoreRace(current))
  return races
}

async function fetchProgram(date, city) {
  const { display } = formatDate(date)
  const url = `https://medya-cdn.tjk.org/raporftp/TJKPDF/${date.getFullYear()}/${formatDate(date).iso}/CSV/GunlukYarisProgrami/${display}-${encodeURIComponent(city)}-GunlukYarisProgrami-TR.csv`
  const response = await fetch(url, { headers: { 'User-Agent': 'HorseRide/0.1 data research' } })
  if (!response.ok) throw new Error(`TJK CSV ${response.status} döndürdü.`)
  const text = Buffer.from(await response.arrayBuffer()).toString('utf8')
  return { url, races: parseCsv(text) }
}

async function fetchPrograms(date, citySelection) {
  const wantsAll = ['Tümü', 'Tum', 'Hepsi', 'all'].includes(citySelection)
  const cities = wantsAll ? allProgramCities : [citySelection]
  const settled = await Promise.allSettled(cities.map(async (city) => {
    const result = await fetchProgram(date, city)
    return {
      city,
      providerUrl: result.url,
      races: result.races
        .filter((race) => race.horses?.length)
        .map((race) => ({ ...race, city, track: city })),
    }
  }))

  const successes = settled.filter((entry) => entry.status === 'fulfilled').map((entry) => entry.value)
  const failures = settled
    .map((entry, index) => entry.status === 'rejected' ? { city: cities[index], error: entry.reason?.message || 'fetch failed' } : null)
    .filter(Boolean)

  if (!successes.length) {
    throw new Error(failures.map((item) => `${item.city}: ${item.error}`).slice(0, 4).join(' | '))
  }

  const races = successes
    .flatMap((entry) => entry.races)
    .sort((left, right) => parseClock(left.time) - parseClock(right.time) || left.city.localeCompare(right.city, 'tr') || left.no - right.no)

  return {
    city: wantsAll ? 'Tüm program' : citySelection,
    providerUrls: successes.map((entry) => entry.providerUrl),
    races,
    failures,
  }
}

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
  response.end(JSON.stringify(data))
}

createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`)
  if (requestUrl.pathname === '/api/health') return sendJson(response, 200, { ok: true, service: 'horseride-data' })
  if (requestUrl.pathname === '/api/history/horse') {
    const name = requestUrl.searchParams.get('name')
    if (!name) return sendJson(response, 400, { error: 'name parametresi gerekli.' })
    return sendJson(response, 200, { name, entries: findHorseHistory(name) })
  }
  if (requestUrl.pathname === '/api/history/races') return sendJson(response, 200, { analyses: listRecentAnalyses() })
  if (requestUrl.pathname === '/api/history/health') return sendJson(response, 200, databaseHealth())
  if (requestUrl.pathname !== '/api/races') return sendJson(response, 404, { error: 'Not found' })

  try {
    const dateParam = requestUrl.searchParams.get('date')
    const city = requestUrl.searchParams.get('city') || defaultCity
    const date = dateParam ? new Date(`${dateParam}T12:00:00`) : new Date()
    if (Number.isNaN(date.getTime())) return sendJson(response, 400, { error: 'Geçersiz tarih.' })
    const result = await fetchPrograms(date, city)
    const fetchedAt = new Date().toISOString()
    const stored = saveProgram({ city: result.city, date: formatDate(date).iso, fetchedAt, providerUrl: result.providerUrls[0], races: result.races })
    return sendJson(response, 200, { source: 'tjk_csv', city: result.city, date: formatDate(date).iso, fetchedAt, providerUrls: result.providerUrls, failures: result.failures, races: result.races, agfUsed: false, jockeyHistoryUsed: false, stored, model: 'HorseRide baseline v0.1' })
  } catch (error) {
    return sendJson(response, 502, { error: error.message, source: 'tjk_csv' })
  }
}).listen(port, () => console.log(`HorseRide data API listening on http://localhost:${port}`))
