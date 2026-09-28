import { createServer } from 'node:http'
import { URL } from 'node:url'
import { TjkApi } from 'tjk-api'
import { databaseHealth, findHorseHistory, listRecentAnalyses, saveProgram } from './database.mjs'

const port = Number(process.env.PORT || 8787)
const defaultCity = process.env.TJK_CITY || 'Tümü'
const domesticProgramCities = (process.env.TJK_CITIES || 'İstanbul,Ankara,İzmir,Bursa,Adana,Kocaeli,Antalya,Diyarbakır,Elazığ,Şanlıurfa').split(',').map((value) => value.trim()).filter(Boolean)
const foreignProgramCities = (process.env.TJK_FOREIGN_CITIES || 'Yurtdışı').split(',').map((value) => value.trim()).filter(Boolean)
const allProgramCities = [...new Set([...domesticProgramCities, ...foreignProgramCities])]
const tjkApi = new TjkApi({ authKey: process.env.TJK_AUTH_KEY || '' })

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

function normalizeDateToken(value) {
  const match = String(value || '').match(/(\d{2})[./-](\d{2})[./-](\d{4})/)
  if (!match) return null
  return `${match[3]}-${match[2]}-${match[1]}`
}

function extractMeetingDate(cells) {
  for (const cell of cells) {
    const normalized = normalizeDateToken(cell)
    if (normalized) return normalized
  }
  return null
}

function extractRaceHeader(cells) {
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index]
    const match = String(cell || '').match(/(?:^|.*\s)(\d+)\.\s*Ko[sş]u\s*:\s*(\d{1,2}[.:]\d{2})/i)
    if (!match) continue
    return {
      no: Number(match[1]),
      time: match[2].replace(':', '.'),
      detailsIndex: index,
    }
  }
  return null
}

function extractDistance(cells, startIndex = 0) {
  return cells.slice(startIndex).find((cell) => /\b\d{3,4}\s*m\b/i.test(cell)) || ''
}

function extractSurface(cells, startIndex = 0) {
  return cells.slice(startIndex).find((cell) => /^(Çim|Kum|Sentetik)$/i.test(cell)) || ''
}

function normalizeText(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function isAllCitySelection(value) {
  return ['tumu', 'tum', 'hepsi', 'all'].includes(normalizeText(value))
}

function isForeignCitySelection(value) {
  const normalized = normalizeText(value)
  return foreignProgramCities.some((item) => normalizeText(item) === normalized)
}

function isLikelyHtmlDocument(text, contentType = '') {
  const preview = String(text || '').slice(0, 500).toLocaleLowerCase('tr-TR')
  return contentType.includes('text/html') || preview.includes('<html') || preview.includes('<!doctype html') || preview.includes('<body')
}

function matchesVenueSelection(target, ...candidates) {
  const normalizedTarget = normalizeText(target)
  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeText(candidate)
    return normalizedCandidate && (normalizedCandidate === normalizedTarget || normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate))
  })
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
  let meetingDate = null
  let horseHeaderSeen = false

  for (const line of lines) {
    const cells = line.split(';').map((cell) => cell.trim())
    meetingDate ||= extractMeetingDate(cells)
    const raceHeader = extractRaceHeader(cells)
    if (raceHeader) {
      if (current) races.push(scoreRace(current))
      const metadataCells = cells.slice(raceHeader.detailsIndex + 1).filter(Boolean)
      current = {
        no: raceHeader.no,
        time: raceHeader.time,
        venue: raceHeader.detailsIndex > 0 ? cells[0] || '' : '',
        type: metadataCells[0] || '',
        conditions: metadataCells.slice(0, 6).join(' · '),
        distance: extractDistance(metadataCells) || metadataCells[3] || '',
        surface: extractSurface(metadataCells) || metadataCells[4] || '',
        horses: [],
      }
      readingHorses = false
      continue
    }
    if (!current) continue
    if (cells[0] === 'At No') { readingHorses = true; horseHeaderSeen = true; continue }
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
  return { meetingDate, races, horseHeaderSeen }
}

function buildProgramSources(date, city) {
  const { iso, display } = formatDate(date)
  const isForeign = foreignProgramCities.includes(city)
  const sources = [{
    label: `${city} arşiv CSV`,
    url: `https://medya-cdn.tjk.org/raporftp/TJKPDF/${date.getFullYear()}/${iso}/CSV/GunlukYarisProgrami/${display}-${encodeURIComponent(city)}-GunlukYarisProgrami-TR.csv`,
  }]

  if (isForeign) {
    sources.unshift({
      label: `${city} günlük CSV`,
      url: 'https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgramiYurtDisiCSV',
    })
  }

  return sources
}

async function fetchProgram(date, city) {
  const expectedDate = formatDate(date).iso
  const sources = buildProgramSources(date, city)
  const errors = []
  const normalizedCity = normalizeText(city)
  const isForeignRequest = isForeignCitySelection(city)

  for (const source of sources) {
    try {
      const response = await fetch(source.url, { headers: { 'User-Agent': 'HorseRide/0.1 data research' } })
      if (!response.ok) throw new Error(`TJK CSV ${response.status} döndürdü.`)
      const text = Buffer.from(await response.arrayBuffer()).toString('utf8')
      if (isLikelyHtmlDocument(text, response.headers.get('content-type') || '')) {
        throw new Error('CSV yerine HTML yanıtı döndü.')
      }
      const parsed = parseCsv(text)
      if (!parsed.races.length) throw new Error('Program dosyasında koşu bulunamadı.')
      if (!parsed.horseHeaderSeen) throw new Error('Program dosyasında at tablosu bulunamadı.')
      if (!parsed.meetingDate) throw new Error('Program dosyasında yarış tarihi doğrulanamadı.')
      if (parsed.meetingDate && parsed.meetingDate !== expectedDate) {
        throw new Error(`İstenen tarih ${expectedDate}, gelen dosya ${parsed.meetingDate}.`)
      }
      if (!isForeignRequest) {
        const mismatchedRace = parsed.races.find((race) => race.venue && normalizeText(race.venue) !== normalizedCity)
        if (mismatchedRace) {
          throw new Error(`Beklenen hipodrom ${city}, gelen kayıt ${mismatchedRace.venue}.`)
        }
      }
      return { url: source.url, races: parsed.races, meetingDate: parsed.meetingDate || expectedDate }
    } catch (error) {
      errors.push(`${source.label}: ${error.message}`)
    }
  }

  throw new Error(errors.join(' | '))
}

function mapOfficialHorse(horse) {
  const totalWeight = [horse.weight, horse.extraWeight].filter((value) => Number.isFinite(value)).reduce((sum, value) => sum + value, 0)
  return {
    no: Number(horse.no),
    name: horse.name || 'Bilinmeyen at',
    age: horse.age || '',
    sire: horse.father?.name || '',
    dam: horse.mother?.name || '',
    weight: totalWeight || horse.weight || null,
    jockey: horse.jockey?.name || 'Bilinmiyor',
    owner: horse.owner?.name || '',
    trainer: horse.trainer?.name || '',
    start: Number.isFinite(horse.position) ? horse.position : null,
    lastSix: horse.last6 || '',
    daysSinceRace: parseNumber(horse.daysOff),
    bestTimeSeconds: parseTime(horse.bestGrade?.timing),
  }
}

async function fetchProgramsFromOfficialApi(date, citySelection) {
  const expectedDate = formatDate(date).iso
  const wantsAll = isAllCitySelection(citySelection)
  const wantsForeignOnly = isForeignCitySelection(citySelection)
  const response = await tjkApi.getProgram({ date })
  const meetings = Array.isArray(response?.data) ? response.data : []

  const filteredMeetings = meetings.filter((meeting) => {
    if (meeting.date !== expectedDate) return false
    if (wantsAll) return true
    if (wantsForeignOnly) return Boolean(meeting.abroad)
    return !meeting.abroad && matchesVenueSelection(citySelection, meeting.location, meeting.hippodrome)
  })

  const races = filteredMeetings.flatMap((meeting) => (meeting.runs || []).map((run) => scoreRace({
    no: Number(run.no),
    time: String(run.startTime || '').replace(':', '.'),
    venue: meeting.location || meeting.hippodrome || citySelection,
    type: run.runName || run.groupName || run.shortedName || 'Koşu',
    conditions: [run.groupName, run.condition, run.info].filter(Boolean).join(' · '),
    distance: run.runway?.distance ? `${run.runway.distance}m` : '',
    surface: run.runway?.name || '',
    horses: (run.horses || []).filter((horse) => !horse.outOfRace).map(mapOfficialHorse),
  }))).filter((race) => race.horses?.length)

  if (!races.length) throw new Error('Resmi TJK API seçilen gün ve filtre için koşu döndürmedi.')

  return {
    source: 'official_api',
    city: wantsAll ? 'Tüm program' : citySelection,
    providerUrls: ['official_tjk_api'],
    races: races.map((race) => ({ ...race, city: race.venue || citySelection, track: race.venue || citySelection })),
    failures: [],
  }
}

async function fetchProgramsFromCsv(date, citySelection) {
  const wantsAll = isAllCitySelection(citySelection)
  const cities = wantsAll ? allProgramCities : [citySelection]
  const settled = await Promise.allSettled(cities.map(async (city) => {
    const result = await fetchProgram(date, city)
    return {
      city,
      providerUrl: result.url,
      races: result.races
        .filter((race) => race.horses?.length)
        .map((race) => ({ ...race, city: race.venue || city, track: race.venue || city })),
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
    .filter((race, index, items) => items.findIndex((candidate) => candidate.city === race.city && candidate.no === race.no && candidate.time === race.time) === index)
    .sort((left, right) => parseClock(left.time) - parseClock(right.time) || left.city.localeCompare(right.city, 'tr') || left.no - right.no)

  return {
    source: 'tjk_csv',
    city: wantsAll ? 'Tüm program' : citySelection,
    providerUrls: successes.map((entry) => entry.providerUrl),
    races,
    failures,
  }
}

async function fetchPrograms(date, citySelection) {
  const failures = []

  try {
    return await fetchProgramsFromOfficialApi(date, citySelection)
  } catch (error) {
    failures.push({ city: citySelection, error: `official_api: ${error.message}` })
  }

  try {
    const csvResult = await fetchProgramsFromCsv(date, citySelection)
    return { ...csvResult, failures: [...failures, ...csvResult.failures] }
  } catch (error) {
    throw new Error([...failures.map((item) => `${item.city}: ${item.error}`), error.message].join(' | '))
  }
}

function summarizeRaces(races) {
  return races.slice(0, 12).map((race) => ({
    city: race.city || race.venue || race.track || '',
    no: race.no,
    time: race.time,
    horseCount: race.horses?.length || 0,
    favorite: race.horses?.[0]?.name || null,
  }))
}

async function debugOfficialProgram(date, citySelection) {
  const expectedDate = formatDate(date).iso
  const wantsAll = isAllCitySelection(citySelection)
  const wantsForeignOnly = isForeignCitySelection(citySelection)

  try {
    const response = await tjkApi.getProgram({ date })
    const meetings = Array.isArray(response?.data) ? response.data : []
    const meetingDiagnostics = meetings.map((meeting) => {
      const reasons = []
      if (meeting.date !== expectedDate) reasons.push(`date:${meeting.date}`)
      if (!wantsAll && wantsForeignOnly && !meeting.abroad) reasons.push('not_foreign')
      if (!wantsAll && !wantsForeignOnly && meeting.abroad) reasons.push('foreign_filtered')
      if (!wantsAll && !wantsForeignOnly && !meeting.abroad && !matchesVenueSelection(citySelection, meeting.location, meeting.hippodrome)) reasons.push('venue_filtered')

      return {
        date: meeting.date,
        location: meeting.location,
        hippodrome: meeting.hippodrome,
        abroad: Boolean(meeting.abroad),
        runCount: meeting.runs?.length || 0,
        included: reasons.length === 0,
        reasons,
      }
    })

    return {
      ok: true,
      source: 'official_api',
      checksum: response.checksum || null,
      updateTime: response.updateTime || null,
      meetingsReceived: meetings.length,
      meetingsIncluded: meetingDiagnostics.filter((item) => item.included).length,
      meetings: meetingDiagnostics,
    }
  } catch (error) {
    return {
      ok: false,
      source: 'official_api',
      error: error.message,
    }
  }
}

async function debugCsvProgramForCity(date, city) {
  const expectedDate = formatDate(date).iso
  const normalizedCity = normalizeText(city)
  const isForeignRequest = isForeignCitySelection(city)
  const sources = buildProgramSources(date, city)
  const attempts = []

  for (const source of sources) {
    try {
      const response = await fetch(source.url, { headers: { 'User-Agent': 'HorseRide/0.1 data research' } })
      const text = response.ok ? Buffer.from(await response.arrayBuffer()).toString('utf8') : ''
      const parsed = response.ok ? parseCsv(text) : null
      const firstMismatchedVenue = !isForeignRequest && parsed?.races?.find((race) => race.venue && normalizeText(race.venue) !== normalizedCity)?.venue

      attempts.push({
        label: source.label,
        url: source.url,
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get('content-type') || null,
        htmlDetected: response.ok ? isLikelyHtmlDocument(text, response.headers.get('content-type') || '') : null,
        parsedMeetingDate: parsed?.meetingDate || null,
        horseHeaderSeen: parsed?.horseHeaderSeen || false,
        raceCount: parsed?.races?.length || 0,
        firstVenue: parsed?.races?.[0]?.venue || null,
        firstMismatchedVenue: firstMismatchedVenue || null,
        requestedDate: expectedDate,
      })
    } catch (error) {
      attempts.push({
        label: source.label,
        url: source.url,
        ok: false,
        error: error.message,
        requestedDate: expectedDate,
      })
    }
  }

  return { city, source: 'tjk_csv', attempts }
}

async function debugRaceSources(date, citySelection) {
  const wantsAll = isAllCitySelection(citySelection)
  const cities = wantsAll ? allProgramCities : [citySelection]
  const official = await debugOfficialProgram(date, citySelection)
  const csv = await Promise.all(cities.map((city) => debugCsvProgramForCity(date, city)))
  let liveResult = null

  try {
    const result = await fetchPrograms(date, citySelection)
    liveResult = {
      ok: true,
      source: result.source,
      city: result.city,
      providerUrls: result.providerUrls,
      failures: result.failures,
      raceCount: result.races.length,
      races: summarizeRaces(result.races),
    }
  } catch (error) {
    liveResult = {
      ok: false,
      error: error.message,
    }
  }

  return {
    requested: {
      city: citySelection,
      date: formatDate(date).iso,
      allSelection: wantsAll,
      foreignSelection: isForeignCitySelection(citySelection),
      csvCities: cities,
    },
    official,
    csv,
    liveResult,
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
  if (requestUrl.pathname === '/api/debug/races') {
    const dateParam = requestUrl.searchParams.get('date')
    const city = requestUrl.searchParams.get('city') || defaultCity
    const date = dateParam ? new Date(`${dateParam}T12:00:00`) : new Date()
    if (Number.isNaN(date.getTime())) return sendJson(response, 400, { error: 'Geçersiz tarih.' })
    const diagnostics = await debugRaceSources(date, city)
    return sendJson(response, 200, diagnostics)
  }
  if (requestUrl.pathname !== '/api/races') return sendJson(response, 404, { error: 'Not found' })

  try {
    const dateParam = requestUrl.searchParams.get('date')
    const city = requestUrl.searchParams.get('city') || defaultCity
    const date = dateParam ? new Date(`${dateParam}T12:00:00`) : new Date()
    if (Number.isNaN(date.getTime())) return sendJson(response, 400, { error: 'Geçersiz tarih.' })
    const result = await fetchPrograms(date, city)
    const fetchedAt = new Date().toISOString()
    const stored = saveProgram({ city: result.city, date: formatDate(date).iso, fetchedAt, providerUrl: result.providerUrls[0], races: result.races })
    return sendJson(response, 200, { source: result.source, city: result.city, date: formatDate(date).iso, fetchedAt, providerUrls: result.providerUrls, failures: result.failures, races: result.races, agfUsed: false, jockeyHistoryUsed: false, stored, model: 'HorseRide baseline v0.1' })
  } catch (error) {
    return sendJson(response, 502, { error: error.message, source: 'tjk_csv' })
  }
}).listen(port, () => console.log(`HorseRide data API listening on http://localhost:${port}`))
