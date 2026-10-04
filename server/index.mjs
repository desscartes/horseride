import { createServer } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { URL } from 'node:url'
import { load as loadHtml } from 'cheerio'
import { TjkApi } from 'tjk-api'
import { clearWalkForwardEntries, databaseHealth, findDailyAiAnalysis, findFreshSourceSnapshot, findHorseHistory, findLatestWalkForwardModel, getProgramForAnalysis, listBacktestEntries, listRecentAnalyses, saveBacktestRace, saveDailyAiAnalysis, saveProgram, saveWalkForwardModel } from './database.mjs'

const port = Number(process.env.PORT || 8787)
const defaultCity = process.env.TJK_CITY || 'Tümü'
const walkForwardModelVersion = 'walk-forward-v0.3-surface-breed'
const domesticProgramCities = (process.env.TJK_CITIES || 'İstanbul,Ankara,İzmir,Bursa,Adana,Kocaeli,Antalya,Diyarbakır,Elazığ,Şanlıurfa').split(',').map((value) => value.trim()).filter(Boolean)
const foreignProgramCities = (process.env.TJK_FOREIGN_CITIES || '').split(',').map((value) => value.trim()).filter(Boolean)
const csvRequestTimeoutMs = Math.max(1_000, Number(process.env.TJK_CSV_TIMEOUT_MS) || 12_000)
const tjkApi = new TjkApi({ authKey: process.env.TJK_AUTH_KEY || '' })
const meetingPageUrlsByDate = new Map()
const meetingOptionsByDate = new Map()
const dailyAnalysisRequests = new Map()
const performanceJobs = new Map()
const baselineModelVersion = 'baseline-v0.1-form-time-weighted'

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
  const minutes = Number(match[1]) * 60 + Number(match[2])
  return minutes < 5 * 60 ? minutes + 24 * 60 : minutes
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
    const match = String(cell || '').match(/(?:^|.*\s)(\d+)\.\s*Ko[sş]u\b[^;]*?(\d{1,2}[.:]\d{2})/i)
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

function findCsvColumn(cells, label) {
  const normalizeHeader = (value) => normalizeText(value).replace(/ı/g, 'i').replace(/[^a-z0-9]/g, '')
  const target = normalizeHeader(label)
  return cells.findIndex((cell) => normalizeHeader(cell) === target)
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

function isAllForeignSelection(value) {
  return [normalizeText('Yurtdışı'), normalizeText('Yabancı')].includes(normalizeText(value))
}

function isForeignCitySelection(value) {
  const normalized = normalizeText(value)
  return isAllForeignSelection(value)
    || foreignProgramCities.some((item) => normalizeText(item) === normalized)
    || [...meetingOptionsByDate.values()].some((meetings) => meetings.some((meeting) => meeting.foreign && normalizeText(meeting.city) === normalized))
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

function foreignCitySlug(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0].toLocaleUpperCase('en-US') + word.slice(1))
    .join('')
}

async function fetchForeignProgramCities(date) {
  const queryDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
  const url = `https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgrami?QueryParameter_Tarih=${encodeURIComponent(queryDate)}`
  let html
  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(csvRequestTimeoutMs),
      })
      if (!response.ok) throw new Error(`TJK toplantı listesi ${response.status} döndürdü.`)
      html = await response.text()
      break
    } catch (error) {
      lastError = error
    }
  }
  if (!html) throw lastError || new Error('TJK toplantı listesi alınamadı.')

  const $ = loadHtml(html)
  const meetings = $('a[data-sehir-id]')
    .map((_, element) => {
      const href = $(element).attr('href')
      const id = $(element).attr('id')
      const label = $(element).text().replace(/\s*\(YD\s+\d+\)\s*$/i, '')
      const city = href ? new URL(href, 'https://www.tjk.org').searchParams.get('SehirAdi') : null
      return {
        city: String(city || id || label).trim(),
        url: href ? new URL(href, 'https://www.tjk.org').toString() : null,
        foreign: /\(YD\s+\d+\)/i.test($(element).text()),
      }
    })
    .get()

  const availableMeetings = meetings.filter((meeting) => meeting.foreign || domesticProgramCities.some((city) => normalizeText(city) === normalizeText(meeting.city)))
  meetingPageUrlsByDate.set(formatDate(date).iso, new Map(availableMeetings.filter((meeting) => meeting.url).map((meeting) => [normalizeText(meeting.city), meeting.url])))
  meetingOptionsByDate.set(formatDate(date).iso, availableMeetings)
  const discoveredForeignCities = availableMeetings.filter((meeting) => meeting.foreign).map((meeting) => meeting.city)
  return [...new Set(discoveredForeignCities.length ? discoveredForeignCities : foreignProgramCities)]
}

function parseMeetingRunnerDetails(html, baseUrl) {
  const $ = loadHtml(html)

  return $('table.tablesorter').toArray().map((table) => {
    const rows = $(table).find('tr').toArray()
    const headers = $(rows[0]).children().map((_, cell) => $(cell).text().trim()).get()
    const numberColumn = findCsvColumn(headers, 'N')
    const nameColumn = findCsvColumn(headers, 'At İsmi')
    const jockeyColumn = findCsvColumn(headers, 'Jokey')
    const raceCode = String($(table).parent().attr('id') || '').match(/kosubilgisi-(\d+)/i)?.[1] || null
    const runners = rows.slice(1).map((row) => {
      const cells = $(row).children()
      const number = Number(cells.eq(numberColumn).text().trim())
      if (!Number.isInteger(number) || number < 1) return null

      const horseHref = cells.eq(nameColumn).find('a[href*="AtKosuBilgileri"]').attr('href')
      const jockeyHref = cells.eq(jockeyColumn).find('a[href*="JokeyIstatistikleri"]').attr('href')
      const workoutHref = $(row).find('a[href*="idmanpisti/Kosu"]').attr('href')
      const horseUrl = horseHref ? new URL(horseHref, baseUrl) : null
      const jockeyUrl = jockeyHref ? new URL(jockeyHref, baseUrl) : null

      return {
        number,
        horseId: horseUrl?.searchParams.get('QueryParameter_AtId') || null,
        jockeyId: jockeyUrl?.searchParams.get('QueryParameter_JokeyId') || null,
        jockeyStatsUrl: jockeyUrl?.toString() || null,
        workoutUrl: workoutHref ? new URL(workoutHref, baseUrl).toString() : null,
      }
    }).filter(Boolean)

    return { raceCode, runners }
  })
}

function parseWorkoutDetails(html) {
  const $ = loadHtml(html)
  const table = $('table').toArray().find((candidate) => {
    const headers = $(candidate).find('tr').first().children().map((_, cell) => $(cell).text().trim()).get()
    return findCsvColumn(headers, 'At No') >= 0 && findCsvColumn(headers, 'İ. Tarihi') >= 0
  })
  if (!table) return []

  const headers = $(table).find('tr').first().children().map((_, cell) => $(cell).text().trim()).get()
  const columns = Object.fromEntries(headers.map((header, index) => [header, index]))
  const columnIndex = (label) => findCsvColumn(headers, label)
  const splitColumns = headers.map((header, index) => /^\d+$/.test(header) ? [header, index] : null).filter(Boolean)

  return $(table).find('tr').slice(1).toArray().map((row) => {
    const cells = $(row).children()
    const read = (label) => {
      const index = columnIndex(label)
      return index >= 0 ? cells.eq(index).text().trim() : ''
    }
    const number = Number(read('At No'))
    if (!Number.isInteger(number) || number < 1) return null
    return {
      number,
      horseName: read('At Adı'),
      splits: Object.fromEntries(splitColumns.map(([distance, index]) => [distance, cells.eq(index).text().trim()])),
      date: read('İ. Tarihi'),
      surface: read('Pist'),
      type: read('İ. Türü'),
      hippodrome: read('İdman Hipodromu'),
    }
  }).filter(Boolean)
}

async function fetchWorkoutDetails(url, referer) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
      Referer: referer,
    },
    signal: AbortSignal.timeout(csvRequestTimeoutMs),
  })
  if (!response.ok) throw new Error(`İdman verisi ${response.status} döndürdü.`)
  const entries = parseWorkoutDetails(await response.text())
  if (!entries.length) throw new Error('İdman tablosunda kayıt bulunamadı.')
  return entries
}

function parseOfficialTables(html) {
  const $ = loadHtml(html)
  return $('table').toArray().map((table) => {
    const rows = $(table).find('tr').toArray()
    const headers = $(rows[0]).children().map((_, cell) => $(cell).text().trim()).get()
    return {
      headers,
      rows: rows.slice(1).map((row) => $(row).children().map((_, cell) => $(cell).text().trim()).get()),
    }
  }).filter((table) => table.headers.length && table.rows.length)
}

function parseOfficialRaceResults(html) {
  const $ = loadHtml(html)
  const races = new Map()

  $('table.tablesorter').each((_, table) => {
    const rows = $(table).find('tr').toArray()
    const headers = $(rows[0]).children().map((__, cell) => $(cell).text().trim()).get()
    const positionColumn = findCsvColumn(headers, 'S')
    const nameColumn = findCsvColumn(headers, 'At İsmi')
    const oddsColumn = findCsvColumn(headers, 'Gny')
    if (positionColumn < 0 || nameColumn < 0) return

    const raceText = $(table).closest('div[id^="kosubilgisi-"]').parent().text()
    const raceNo = Number(raceText.match(/(\d+)\.\s*Ko[sş]u\b/i)?.[1])
    if (!Number.isInteger(raceNo) || raceNo < 1) return

    const results = new Map()
    for (const row of rows.slice(1)) {
      const cells = $(row).children()
      const name = cells.eq(nameColumn).text().trim()
      const horseNo = Number(name.match(/\((\d+)\)/)?.[1])
      const finishPosition = Number.parseInt(cells.eq(positionColumn).text().trim(), 10)
      if (!Number.isInteger(horseNo) || horseNo < 1 || !Number.isInteger(finishPosition) || finishPosition < 1) continue
      results.set(horseNo, { finishPosition, closingOdds: parseNumber(cells.eq(oddsColumn).text()) })
    }
    if (results.size) races.set(raceNo, results)
  })

  return races
}

function summarizeHorsePerformance(tables) {
  const normalize = (value) => normalizeText(value).replace(/[^a-z0-9]/g, '')
  const table = tables.find((candidate) => {
    const headers = candidate.headers.map(normalize)
    return headers.includes('tarih') && headers.includes('sehir') && headers.includes('jokey')
  })
  if (!table) return null

  const headers = table.headers.map(normalize)
  const positionIndex = headers.findIndex((header) => header === 's')
  const dateIndex = headers.findIndex((header) => header === 'tarih')
  const positions = table.rows.map((row) => Number.parseInt(row[positionIndex], 10)).filter(Number.isFinite)
  return {
    starts: table.rows.length,
    wins: positions.filter((position) => position === 1).length,
    topThree: positions.filter((position) => position <= 3).length,
    recentFinishes: positions.slice(0, 6),
    latestStart: dateIndex >= 0 ? table.rows[0]?.[dateIndex] || null : null,
  }
}

function summarizeJockeyPerformance(tables) {
  const normalize = (value) => normalizeText(value).replace(/[^a-z0-9]/g, '')
  const table = tables.find((candidate) => {
    const headers = candidate.headers.map(normalize)
    return headers.includes('jokey') && headers.includes('kosu') && headers.some((header) => /^1\d*$/.test(header))
  })
  if (!table) return null

  const headers = table.headers.map(normalize)
  const row = table.rows.find((values) => values.some(Boolean)) || []
  const value = (header) => {
    const index = headers.indexOf(normalize(header))
    return index >= 0 ? parseNumber(row[index]) : null
  }
  const starts = value('Koşu')
  const wins = value('1.')
  return {
    starts,
    wins,
    seconds: value('2.'),
    thirds: value('3.'),
    fourths: value('4.'),
    fifths: value('5.'),
    winRate: starts ? Number((wins / starts).toFixed(4)) : null,
  }
}

async function fetchOfficialProfile(url, referer, city, source) {
  const maxAgeMs = 6 * 60 * 60 * 1_000
  const cachedContent = findFreshSourceSnapshot(url, maxAgeMs)
  if (cachedContent) {
    try {
      return { tables: JSON.parse(cachedContent), rawSource: null }
    } catch {
      // A malformed cached snapshot should be replaced with a fresh response.
    }
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
      Referer: referer,
    },
    signal: AbortSignal.timeout(csvRequestTimeoutMs),
  })
  if (!response.ok) throw new Error(`TJK ${source} ${response.status} döndürdü.`)
  const tables = parseOfficialTables(await response.text())
  if (!tables.length) throw new Error(`TJK ${source} tablosu bulunamadı.`)
  return {
    tables,
    rawSource: { city, source, providerUrl: url, contentType: 'application/json', content: JSON.stringify(tables) },
  }
}

async function mapWithConcurrency(items, limit, callback) {
  const results = new Array(items.length)
  let nextIndex = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await callback(items[index], index)
    }
  }))
  return results
}

async function withRetries(callback, attempts = 3) {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await callback()
    } catch (error) {
      lastError = error
      if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
    }
  }
  throw lastError
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

function scoreRace(race, options = {}) {
  const times = race.horses.map((horse) => horse.bestTimeSeconds).filter(Boolean)
  const minTime = times.length ? Math.min(...times) : null
  const maxTime = times.length ? Math.max(...times) : null
  const starts = race.horses.map((horse) => horse.start).filter(Boolean)
  const maxStart = starts.length ? Math.max(...starts) : race.horses.length
  const minWeight = Math.min(...race.horses.map((horse) => horse.weight).filter(Boolean))

  const baselineScored = race.horses.map((horse) => {
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

  const featureScored = options.weights
    ? addRecentPerformanceFeatures(baselineScored, options.history || { horseStats: new Map(), jockeyStats: new Map(), surfaceStats: new Map(), breedStats: new Map() }, { surface: race.surface, breed: classifyRaceBreed(race) })
    : baselineScored
  const scored = featureScored.map((horse) => {
    const independentScore = options.weights
      ? Object.entries(options.weights).reduce((sum, [factor, weight]) => sum + weight * (horse.factors[factor] ?? 0.5), 0)
      : horse.independentScore
    return { ...horse, independentScore: Number(independentScore.toFixed(4)) }
  })

  const total = scored.reduce((sum, horse) => sum + Math.exp(horse.independentScore * 4), 0)
  return { ...race, horses: scored.map((horse) => ({ ...horse, probability: Number((Math.exp(horse.independentScore * 4) / total * 100).toFixed(1)) })).sort((a, b) => b.probability - a.probability) }
}

function finishCsvRace(race) {
  return scoreRace({ ...race, horses: race.horses.filter((horse) => !horse.outOfRace) })
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const races = []
  let current = null
  let readingHorses = false
  let meetingDate = null
  let horseHeaderSeen = false
  let horseColumns = null

  for (const line of lines) {
    const cells = line.split(';').map((cell) => cell.trim())
    meetingDate ||= extractMeetingDate(cells)
    const raceHeader = extractRaceHeader(cells)
    if (raceHeader) {
      if (current) races.push(finishCsvRace(current))
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
      horseColumns = null
      continue
    }
    if (!current) continue
    if (cells[0] === 'At No') {
      readingHorses = true
      horseHeaderSeen = true
      horseColumns = {
        headers: cells.map((value, index) => value || `column_${index + 1}`),
        no: findCsvColumn(cells, 'At No'),
        name: findCsvColumn(cells, 'At İsmi'),
        age: findCsvColumn(cells, 'Yaş'),
        sire: findCsvColumn(cells, 'Orijin(Baba)'),
        dam: findCsvColumn(cells, 'Orijin(Anne)'),
        weight: findCsvColumn(cells, 'Kilo'),
        jockey: findCsvColumn(cells, 'Jokey Adı'),
        owner: findCsvColumn(cells, 'Sahip Adı'),
        trainer: findCsvColumn(cells, 'Antrenör Adı'),
        start: findCsvColumn(cells, 'St'),
        lastSix: findCsvColumn(cells, 'Son 6 Yarış'),
        daysSinceRace: findCsvColumn(cells, 'KGS'),
        bestTime: findCsvColumn(cells, 'EnİyiDerece'),
      }
      continue
    }
    if (!readingHorses || !/^\d+$/.test(cells[0])) continue

    const read = (column) => horseColumns[column] >= 0 ? cells[horseColumns[column]] || '' : ''
    const name = read('name') || 'Bilinmeyen at'

    current.horses.push({
      no: Number(read('no')),
      name,
      age: read('age'),
      sire: read('sire'),
      dam: read('dam'),
      weight: parseNumber(read('weight')),
      jockey: read('jockey') || 'Bilinmiyor',
      owner: read('owner'),
      trainer: read('trainer'),
      start: parseNumber(read('start')),
      lastSix: read('lastSix'),
      daysSinceRace: parseNumber(read('daysSinceRace')),
      bestTimeSeconds: parseTime(read('bestTime')),
      outOfRace: /\(\s*koşmaz\s*\)/i.test(name),
      sourceData: { headers: horseColumns.headers, values: cells },
    })
  }
  if (current) races.push(finishCsvRace(current))
  return { meetingDate, races, horseHeaderSeen }
}

function buildProgramSources(date, city, { isForeign = isForeignCitySelection(city) } = {}) {
  const { iso, display } = formatDate(date)
  const cityFileName = isForeign ? foreignCitySlug(city) : encodeURIComponent(city.trim())
  const sources = [{
    label: `${city} arşiv CSV`,
    url: `https://medya-cdn.tjk.org/raporftp/TJKPDF/${date.getFullYear()}/${iso}/CSV/GunlukYarisProgrami/${display}-${cityFileName}-GunlukYarisProgrami-TR.csv`,
  }]

  if (isForeign) {
    sources.push({
      label: `${city} genel Yurtdışı CSV`,
      url: 'https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgramiYurtDisiCSV',
    })
  }

  return sources
}

function enrichRacesWithMeetingDetails(races, meetingRaces, meetingUrl) {
  return races.map((race, index) => {
    const meetingRace = meetingRaces[index]
    if (!meetingRace) return race
    const runners = new Map(meetingRace.runners.map((runner) => [runner.number, runner]))
    return {
      ...race,
      raceCode: meetingRace.raceCode,
      meetingPageUrl: meetingUrl,
      horses: race.horses.map((horse) => {
        const details = runners.get(horse.no)
        if (!details) return horse
        return {
          ...horse,
          horseId: details.horseId,
          jockeyId: details.jockeyId,
          jockeyStatsUrl: details.jockeyStatsUrl,
          workoutUrl: details.workoutUrl,
          sourceData: { ...horse.sourceData, tjk: details },
        }
      }),
    }
  })
}

async function fetchProgram(date, city, { isForeign = isForeignCitySelection(city), meetingUrl = null } = {}) {
  const expectedDate = formatDate(date).iso
  const sources = buildProgramSources(date, city, { isForeign })
  const errors = []
  const normalizedCity = normalizeText(city)

  for (const source of sources) {
    try {
      const response = await fetch(source.url, { headers: { 'User-Agent': 'HorseRide/0.1 data research' }, signal: AbortSignal.timeout(csvRequestTimeoutMs) })
      if (!response.ok) throw new Error(`TJK CSV ${response.status} döndürdü.`)
      const text = Buffer.from(await response.arrayBuffer()).toString('utf8')
      if (isLikelyHtmlDocument(text, response.headers.get('content-type') || '')) {
        throw new Error('CSV yerine HTML yanıtı döndü.')
      }
      const parsed = parseCsv(text)
      if (!parsed.races.length) throw new Error('Program dosyasında koşu bulunamadı.')
      if (!parsed.horseHeaderSeen) throw new Error('Program dosyasında at tablosu bulunamadı.')
      const emptyHorseRace = parsed.races.find((race) => !race.horses.length)
      if (emptyHorseRace) throw new Error(`${emptyHorseRace.no}. koşu için at kaydı bulunamadı.`)
      if (!parsed.meetingDate) throw new Error('Program dosyasında yarış tarihi doğrulanamadı.')
      if (parsed.meetingDate && parsed.meetingDate !== expectedDate) {
        throw new Error(`İstenen tarih ${expectedDate}, gelen dosya ${parsed.meetingDate}.`)
      }
      if (!isForeign) {
        const mismatchedRace = parsed.races.find((race) => race.venue && normalizeText(race.venue) !== normalizedCity)
        if (mismatchedRace) {
          throw new Error(`Beklenen hipodrom ${city}, gelen kayıt ${mismatchedRace.venue}.`)
        }
      }
      let races = parsed.races
      let meetingSource = null
      let meetingDetailsFailure = ''
      if (meetingUrl) {
        try {
          const meetingResponse = await fetch(meetingUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36' },
            signal: AbortSignal.timeout(csvRequestTimeoutMs),
          })
          if (!meetingResponse.ok) throw new Error(`Toplantı sayfası ${meetingResponse.status} döndürdü.`)
          const details = parseMeetingRunnerDetails(await meetingResponse.text(), meetingUrl)
          if (!details.length) throw new Error('Toplantı sayfasında koşu tabloları bulunamadı.')
          races = enrichRacesWithMeetingDetails(races, details, meetingUrl)
          meetingSource = {
            city,
            source: 'tjk_meeting_runner_ids',
            providerUrl: meetingUrl,
            contentType: 'application/json',
            content: JSON.stringify(details),
          }
        } catch (error) {
          meetingDetailsFailure = `meeting_details: ${error.message}`
        }
      }
      return {
        url: source.url,
        contentType: response.headers.get('content-type') || 'text/csv',
        content: text,
        races,
        rawSources: [
          { city, source: 'tjk_csv', providerUrl: source.url, contentType: response.headers.get('content-type') || 'text/csv', content: text },
          ...(meetingSource ? [meetingSource] : []),
        ],
        meetingDetailsFailure,
        meetingDate: parsed.meetingDate || expectedDate,
      }
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
    sourceData: horse,
  }
}

async function fetchProgramsFromOfficialApi(date, citySelection) {
  const expectedDate = formatDate(date).iso
  const wantsAll = isAllCitySelection(citySelection)
  const wantsForeignOnly = isAllForeignSelection(citySelection)
  const wantsForeignCity = isForeignCitySelection(citySelection) && !wantsForeignOnly
  const response = await tjkApi.getProgram({ date })
  const meetings = Array.isArray(response?.data) ? response.data : []
  if (!meetingOptionsByDate.has(expectedDate)) {
    meetingOptionsByDate.set(expectedDate, meetings
      .filter((meeting) => meeting.date === expectedDate)
      .map((meeting) => ({
        city: String(meeting.location || meeting.hippodrome || '').trim(),
        foreign: Boolean(meeting.abroad),
        url: null,
      }))
      .filter((meeting) => meeting.city))
  }

  const filteredMeetings = meetings.filter((meeting) => {
    if (meeting.date !== expectedDate) return false
    if (wantsAll) return true
    if (wantsForeignOnly) return Boolean(meeting.abroad)
    if (wantsForeignCity) return Boolean(meeting.abroad) && matchesVenueSelection(citySelection, meeting.location, meeting.hippodrome)
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
    rawSources: [{ city: wantsAll ? 'Tüm program' : citySelection, source: 'official_api', providerUrl: 'official_tjk_api', contentType: 'application/json', content: JSON.stringify(response) }],
    races: races.map((race) => ({ ...race, city: race.venue || citySelection, track: race.venue || citySelection })),
    failures: [],
    meetings: meetingOptionsByDate.get(expectedDate) || [],
  }
}

async function resolveCsvCities(date, citySelection) {
  const wantsAll = isAllCitySelection(citySelection)
  const wantsForeignOnly = isAllForeignSelection(citySelection)
  const wantsForeignCity = isForeignCitySelection(citySelection) && !wantsForeignOnly
  let foreignCities = foreignProgramCities
  const discoveryFailures = []
  const dateKey = formatDate(date).iso
  if (wantsAll || wantsForeignOnly || wantsForeignCity || !meetingPageUrlsByDate.has(dateKey)) {
    try {
      foreignCities = await fetchForeignProgramCities(date)
    } catch (error) {
      discoveryFailures.push({ city: 'Yurtdışı', error: `meeting_discovery: ${error.message}` })
    }
  }
  const currentDomesticCities = (meetingOptionsByDate.get(dateKey) || [])
    .filter((meeting) => !meeting.foreign)
    .map((meeting) => meeting.city)
  const cities = wantsAll
    ? [...new Set([...(currentDomesticCities.length ? currentDomesticCities : domesticProgramCities), ...foreignCities])]
    : wantsForeignOnly
      ? foreignCities
      : wantsForeignCity
        ? [citySelection]
      : [citySelection]
  return {
    cities,
    foreignCities,
    discoveryFailures,
    meetingPageUrls: meetingPageUrlsByDate.get(dateKey) || new Map(),
    meetings: meetingOptionsByDate.get(dateKey) || [],
  }
}

async function fetchProgramsFromCsv(date, citySelection) {
  const wantsAll = isAllCitySelection(citySelection)
  const { cities, foreignCities, discoveryFailures, meetingPageUrls, meetings } = await resolveCsvCities(date, citySelection)
  const settled = await Promise.allSettled(cities.map(async (city) => {
    const result = await fetchProgram(date, city, { isForeign: foreignCities.includes(city), meetingUrl: meetingPageUrls.get(normalizeText(city)) })
    return {
      city,
      providerUrl: result.url,
      rawSources: result.rawSources,
      meetingDetailsFailure: result.meetingDetailsFailure,
      races: result.races
        .filter((race) => race.horses?.length)
        .map((race) => ({ ...race, city: race.venue || city, track: race.venue || city, foreign: foreignCities.includes(city) })),
    }
  }))

  const successes = settled.filter((entry) => entry.status === 'fulfilled').map((entry) => entry.value)
  const failures = [...discoveryFailures, ...settled
    .map((entry, index) => entry.status === 'rejected' ? { city: cities[index], error: entry.reason?.message || 'fetch failed' } : null)
    .filter(Boolean)]
  failures.push(...successes.filter((entry) => entry.meetingDetailsFailure).map((entry) => ({ city: entry.city, error: entry.meetingDetailsFailure })))

  if (!successes.length) {
    throw new Error(failures.map((item) => `${item.city}: ${item.error}`).slice(0, 4).join(' | '))
  }

  const races = successes
    .flatMap((entry) => entry.races)
    .filter((race, index, items) => items.findIndex((candidate) => candidate.city === race.city && candidate.no === race.no && candidate.time === race.time) === index)
    .sort((left, right) => parseClock(left.time) - parseClock(right.time) || left.city.localeCompare(right.city, 'tr') || left.no - right.no)

  const workoutTasks = races.flatMap((race) => {
    if (race.foreign) return []
    const workoutUrl = race.horses.find((horse) => horse.workoutUrl)?.workoutUrl
    return workoutUrl ? [{ race, workoutUrl }] : []
  })
  const workoutResults = await mapWithConcurrency(workoutTasks, 1, async ({ race, workoutUrl }) => {
    try {
      const workouts = await fetchWorkoutDetails(workoutUrl, race.meetingPageUrl)
      const workoutsByNumber = new Map(workouts.map((workout) => [workout.number, workout]))
      for (const horse of race.horses) horse.workout = workoutsByNumber.get(horse.no) || null
      return {
        city: race.city,
        rawSource: { city: race.city, source: 'tjk_workout', providerUrl: workoutUrl, contentType: 'application/json', content: JSON.stringify(workouts) },
      }
    } catch (error) {
      return { city: race.city, error: `workout ${race.no}. koşu: ${error.message}` }
    }
  })
  const workoutFailures = workoutResults.filter((result) => result.error).map(({ city, error }) => ({ city, error }))
  failures.push(...workoutFailures)

  const profileTasksByKey = new Map()
  for (const race of races) {
    for (const horse of race.horses) {
      if (!race.foreign && horse.horseId) {
        const url = `https://www.tjk.org/TR/YarisSever/Query/ConnectedPage/AtKosuBilgileri?1=1&QueryParameter_AtId=${encodeURIComponent(horse.horseId)}&Era=today`
        profileTasksByKey.set(`horse:${horse.horseId}`, { key: `horse:${horse.horseId}`, type: 'horse', url, city: race.city, referer: race.meetingPageUrl })
      }
      if (!race.foreign && horse.jockeyId && horse.jockeyStatsUrl) {
        profileTasksByKey.set(`jockey:${horse.jockeyId}`, { key: `jockey:${horse.jockeyId}`, type: 'jockey', url: horse.jockeyStatsUrl, city: race.city, referer: race.meetingPageUrl })
      }
    }
  }

  const profileResults = await mapWithConcurrency([...profileTasksByKey.values()], 2, async (task) => {
    try {
      const profile = await fetchOfficialProfile(task.url, task.referer, task.city, task.type === 'horse' ? 'tjk_horse_history' : 'tjk_jockey_stats')
      return {
        key: task.key,
        summary: task.type === 'horse' ? summarizeHorsePerformance(profile.tables) : summarizeJockeyPerformance(profile.tables),
        rawSource: profile.rawSource,
      }
    } catch (error) {
      return { key: task.key, error: `${task.type}_profile: ${error.message}`, city: task.city }
    }
  })
  const profilesByKey = new Map(profileResults.map((result) => [result.key, result.summary]))
  const profileFailures = profileResults.filter((result) => result.error).map(({ city, error }) => ({ city, error }))
  failures.push(...profileFailures)
  for (const race of races) {
    for (const horse of race.horses) {
      const horsePerformance = horse.horseId ? profilesByKey.get(`horse:${horse.horseId}`) : null
      const jockeyPerformance = horse.jockeyId ? profilesByKey.get(`jockey:${horse.jockeyId}`) : null
      if (horsePerformance) horse.horsePerformance = horsePerformance
      if (jockeyPerformance) horse.jockeyPerformance = jockeyPerformance
      if (horse.sourceData?.tjk) {
        horse.sourceData.tjk.horsePerformance = horsePerformance
        horse.sourceData.tjk.jockeyPerformance = jockeyPerformance
      }
    }
  }

  return {
    source: 'tjk_csv',
    city: wantsAll ? 'Tüm program' : citySelection,
    providerUrls: successes.map((entry) => entry.providerUrl),
    rawSources: [
      ...successes.flatMap((entry) => entry.rawSources),
      ...workoutResults.map((result) => result.rawSource).filter(Boolean),
      ...profileResults.map((result) => result.rawSource).filter(Boolean),
    ],
    races,
    failures,
    meetings,
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
  const wantsForeignOnly = isAllForeignSelection(citySelection)
  const wantsForeignCity = isForeignCitySelection(citySelection) && !wantsForeignOnly

  try {
    const response = await tjkApi.getProgram({ date })
    const meetings = Array.isArray(response?.data) ? response.data : []
    const meetingDiagnostics = meetings.map((meeting) => {
      const reasons = []
      if (meeting.date !== expectedDate) reasons.push(`date:${meeting.date}`)
      if (!wantsAll && wantsForeignOnly && !meeting.abroad) reasons.push('not_foreign')
      if (!wantsAll && !wantsForeignOnly && !wantsForeignCity && meeting.abroad) reasons.push('foreign_filtered')
      if (wantsForeignCity && (!meeting.abroad || !matchesVenueSelection(citySelection, meeting.location, meeting.hippodrome))) reasons.push('foreign_venue_filtered')
      if (!wantsAll && !wantsForeignOnly && !wantsForeignCity && !meeting.abroad && !matchesVenueSelection(citySelection, meeting.location, meeting.hippodrome)) reasons.push('venue_filtered')

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

async function debugCsvProgramForCity(date, city, { isForeign = isForeignCitySelection(city) } = {}) {
  const expectedDate = formatDate(date).iso
  const normalizedCity = normalizeText(city)
  const sources = buildProgramSources(date, city, { isForeign })
  const attempts = []

  for (const source of sources) {
    try {
      const response = await fetch(source.url, { headers: { 'User-Agent': 'HorseRide/0.1 data research' }, signal: AbortSignal.timeout(csvRequestTimeoutMs) })
      const text = response.ok ? Buffer.from(await response.arrayBuffer()).toString('utf8') : ''
      const parsed = response.ok ? parseCsv(text) : null
      const firstMismatchedVenue = !isForeign && parsed?.races?.find((race) => race.venue && normalizeText(race.venue) !== normalizedCity)?.venue

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
        emptyHorseRaceNumbers: parsed?.races?.filter((race) => !race.horses.length).map((race) => race.no) || [],
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
  const { cities, foreignCities, discoveryFailures } = await resolveCsvCities(date, citySelection)
  const official = await debugOfficialProgram(date, citySelection)
  const csv = await Promise.all(cities.map((city) => debugCsvProgramForCity(date, city, { isForeign: foreignCities.includes(city) })))
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
      foreignCities,
      csvDiscoveryFailures: discoveryFailures,
    },
    official,
    csv,
    liveResult,
  }
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  response.end(JSON.stringify(data))
}

function loadStoredProgram(date, city) {
  const selection = isAllCitySelection(city) ? 'Tümü' : city
  return getProgramForAnalysis(date, selection).map((race) => ({
    ...race,
    horses: race.horses.map((horse) => ({
      ...horse,
      probability: horse.probability ?? horse.baselineProbability ?? 0,
    })),
  }))
}

async function readJsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 64 * 1024) throw Object.assign(new Error('İstek gövdesi çok büyük.'), { status: 413 })
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('Geçersiz JSON isteği.'), { status: 400 })
  }
}

function parseAnalysisOutput(text, races) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('OpenAI geçerli JSON tahmini döndürmedi.')
  }
  if (typeof parsed.summary !== 'string' || !Array.isArray(parsed.races)) {
    throw new Error('OpenAI tahmin yanıtı beklenen alanları içermiyor.')
  }

  const analyzedRaces = parsed.races.map((prediction) => {
    const race = races.find((item) => item.city === prediction.city && item.no === Number(prediction.raceNo))
    if (!race || !Array.isArray(prediction.picks)) throw new Error('OpenAI yarış eşlemesi geçersiz.')
    const validNames = new Set(race.horses.map((horse) => horse.name.toLocaleLowerCase('tr-TR')))
    const picks = prediction.picks.slice(0, 5).map((pick) => {
      if (!pick || typeof pick.horseName !== 'string' || !validNames.has(pick.horseName.toLocaleLowerCase('tr-TR'))) {
        throw new Error(`${race.city} ${race.no}. koşu için listede olmayan at döndü.`)
      }
      return { horseName: pick.horseName, reason: String(pick.reason || '').slice(0, 500) }
    })
    if (!picks.length) throw new Error(`${race.city} ${race.no}. koşu için aday üretilmedi.`)
    const confidence = ['low', 'medium', 'high'].includes(prediction.confidence) ? prediction.confidence : 'low'
    return {
      city: race.city,
      raceNo: race.no,
      picks,
      confidence,
      risks: Array.isArray(prediction.risks) ? prediction.risks.slice(0, 4).map((item) => String(item).slice(0, 240)) : [],
    }
  })
  if (analyzedRaces.length !== races.length) throw new Error(`OpenAI ${analyzedRaces.length}/${races.length} koşu için tahmin üretti; analiz kaydedilmedi.`)

  return { version: 3, summary: parsed.summary.slice(0, 1_200), races: analyzedRaces }
}

async function createDailyAnalysis(date, city) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw Object.assign(new Error('Günlük AI analizi için sunucuda OPENAI_API_KEY tanımlanmalı.'), { status: 503 })

  const races = getProgramForAnalysis(date, city)
  if (!races.length) throw Object.assign(new Error('Önce bu günün yarış programını çekip SQLite’a kaydetmelisiniz.'), { status: 409 })
  const model = process.env.OPENAI_MODEL || 'gpt-6-luna'
  const input = `Analyze the race data below and return the result as JSON only.\n${JSON.stringify({ date, city, races })}`
  if (Buffer.byteLength(input, 'utf8') > 750_000) {
    throw Object.assign(new Error('Günlük analiz girdisi çok büyük; maliyeti sınırlamak için tek şehir seçin.'), { status: 413 })
  }
  const inputHash = createHash('sha256').update(input).digest('hex')
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: Math.min(75_000, Math.max(10_000, races.length * 900)),
      instructions: 'Türkiye at yarışlarını yalnızca verilen program, geçmiş performans, jokey ve idman alanlarına dayanarak analiz et. Kaynakta olmayan bilgi, oran veya sonuç uydurma; eksik alanı belirsizlik say. At isimlerini listedeki adlarıyla aynen kullan. Her koşu için en fazla 5 aday, kısa veri dayanaklı gerekçe, low/medium/high belirsizlik seviyesi ve en çok 4 risk yaz. Kupon oluşturma; kupon kombinasyonları bütçe ve her ayaktaki aday ağırlıklarına göre uygulama içinde hesaplanıyor. Kazanma olasılığı yüzdesi veya kesin kupon garantisi verme. Yalnız JSON döndür: {"summary":"...","races":[{"city":"...","raceNo":1,"picks":[{"horseName":"...","reason":"..."}],"confidence":"low|medium|high","risks":["..."]}]} .',
      input,
      text: { format: { type: 'json_object' } },
    }),
  })
  const responsePayload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = responsePayload.error?.message || `OpenAI API ${response.status} döndürdü.`
    throw Object.assign(new Error(message), { status: response.status === 429 ? 429 : 502 })
  }
  if (responsePayload.status === 'incomplete') {
    throw new Error(`OpenAI yanıtı tamamlanmadı: ${responsePayload.incomplete_details?.reason || 'sebep belirtilmedi'}.`)
  }
  const outputText = responsePayload.output_text || responsePayload.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text
  if (!outputText) throw new Error('OpenAI yanıtında analiz metni bulunamadı.')

  const analysis = parseAnalysisOutput(outputText, races)
  return saveDailyAiAnalysis({ date, city, model, inputHash, analysis, createdAt: new Date().toISOString() })
}

async function getOrCreateDailyAnalysis(date, city) {
  const cached = findDailyAiAnalysis(date, city)
  if ([2, 3].includes(cached?.analysis?.version) && Array.isArray(cached.analysis.races)) return { record: cached, cached: true }

  const key = `${date}:${city}`
  let pending = dailyAnalysisRequests.get(key)
  if (!pending) {
    pending = createDailyAnalysis(date, city)
    dailyAnalysisRequests.set(key, pending)
  }
  try {
    return { record: await pending, cached: false }
  } finally {
    if (dailyAnalysisRequests.get(key) === pending) dailyAnalysisRequests.delete(key)
  }
}

function performanceSummary(days = 90) {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - days + 1)
  const sinceDate = formatDate(start).iso
  const throughDate = formatDate(today).iso
  const grouped = new Map()

  for (const entry of listBacktestEntries(sinceDate)) {
    if (entry.modelVersion !== baselineModelVersion) continue
    const key = `${entry.date}:${entry.city}:${entry.raceNo}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(entry)
  }

  let topOneHits = 0
  let topThreeHits = 0
  let topThreeCoverage = 0
  let marketFavoriteHits = 0
  let marketFavoriteRaces = 0
  let brierTotal = 0
  let expectedTopOneTotal = 0
  let walkForwardRaces = 0
  let walkForwardTopOneHits = 0
  let walkForwardBaselineHits = 0
  let walkForwardTopThreeHits = 0
  let walkForwardTopThreeCoverage = 0
  let walkForwardBrierTotal = 0
  const calibrationBins = Array.from({ length: 5 }, (_, index) => ({ min: index * 20, max: (index + 1) * 20, count: 0, wins: 0, predictedTotal: 0 }))
  let evaluatedRaces = 0
  let evaluatedRunners = 0

  for (const rows of grouped.values()) {
    rows.sort((left, right) => left.modelRank - right.modelRank)
    const winnerRows = rows.filter((row) => row.finishPosition === 1)
    const predicted = rows.find((row) => row.modelRank === 1)
    if (!winnerRows.length || !predicted) continue
    evaluatedRaces += 1
    evaluatedRunners += rows.length
    if (winnerRows.some((row) => row.horseNo === predicted.horseNo)) topOneHits += 1
    const selectedTopThree = rows.filter((row) => row.modelRank <= 3)
    const topThreeRaceHit = selectedTopThree.some((row) => row.finishPosition <= 3)
    if (topThreeRaceHit) topThreeCoverage += 1
    topThreeHits += selectedTopThree.filter((row) => row.finishPosition <= 3).length

    const walkForwardRows = rows.filter((row) => Number.isInteger(row.walkForwardRank))
    if (walkForwardRows.length === rows.length) {
      walkForwardRaces += 1
      const walkForwardPredicted = walkForwardRows.find((row) => row.walkForwardRank === 1)
      const walkForwardWinnerHit = walkForwardRows.some((row) => row.finishPosition === 1 && row.horseNo === walkForwardPredicted?.horseNo)
      if (walkForwardWinnerHit) walkForwardTopOneHits += 1
      const baselinePredicted = rows.find((row) => row.modelRank === 1)
      if (winnerRows.some((row) => row.horseNo === baselinePredicted?.horseNo)) walkForwardBaselineHits += 1
      const walkForwardTopThree = walkForwardRows.filter((row) => row.walkForwardRank <= 3)
      if (walkForwardTopThree.some((row) => row.finishPosition <= 3)) walkForwardTopThreeCoverage += 1
      walkForwardTopThreeHits += walkForwardTopThree.filter((row) => row.finishPosition <= 3).length
      const candidateProbabilityTotal = walkForwardRows.reduce((sum, row) => sum + Math.max(0, row.walkForwardProbability || 0), 0) || 100
      for (const row of walkForwardRows) {
        const probability = Math.max(0, row.walkForwardProbability || 0) / candidateProbabilityTotal
        walkForwardBrierTotal += (probability - (row.finishPosition === 1 ? 1 : 0)) ** 2
      }
    }

    const marketOdds = rows.filter((row) => Number.isFinite(row.closingOdds) && row.closingOdds > 0)
    if (marketOdds.length) {
      const minimumOdds = Math.min(...marketOdds.map((row) => row.closingOdds))
      const marketFavorites = marketOdds.filter((row) => row.closingOdds === minimumOdds)
      marketFavoriteRaces += 1
      if (marketFavorites.some((row) => row.finishPosition === 1)) marketFavoriteHits += 1
    }

    const normalizedProbabilityTotal = rows.reduce((sum, row) => sum + Math.max(0, row.probability), 0) || 100
    for (const row of rows) {
      const probability = Math.max(0, row.probability) / normalizedProbabilityTotal
      const outcome = row.finishPosition === 1 ? 1 : 0
      brierTotal += (probability - outcome) ** 2
    }
    const predictedProbability = Math.max(0, predicted.probability) / normalizedProbabilityTotal
    expectedTopOneTotal += predictedProbability
    const bin = calibrationBins[Math.min(4, Math.floor(predictedProbability * 5))]
    bin.count += 1
    bin.predictedTotal += predictedProbability
    if (winnerRows.some((row) => row.horseNo === predicted.horseNo)) bin.wins += 1
  }

  const percentage = (hits, total) => total ? Number((hits / total * 100).toFixed(1)) : null
  return {
    days,
    sinceDate,
    throughDate,
    modelVersion: baselineModelVersion,
    source: 'TJK tarihsel program CSV + resmi sonuç tabloları',
    evaluatedRaces,
    evaluatedRunners,
    reliability: evaluatedRaces >= 100 ? 'sample_sufficient' : 'preliminary',
    topOne: { hits: topOneHits, races: evaluatedRaces, rate: percentage(topOneHits, evaluatedRaces) },
    topThree: { hits: topThreeHits, picks: evaluatedRaces * 3, precision: percentage(topThreeHits, evaluatedRaces * 3), raceCoverage: percentage(topThreeCoverage, evaluatedRaces) },
    walkForward: {
      races: walkForwardRaces,
      topOne: { hits: walkForwardTopOneHits, races: walkForwardRaces, rate: percentage(walkForwardTopOneHits, walkForwardRaces) },
      topThree: { hits: walkForwardTopThreeHits, picks: walkForwardRaces * 3, precision: percentage(walkForwardTopThreeHits, walkForwardRaces * 3), raceCoverage: percentage(walkForwardTopThreeCoverage, walkForwardRaces) },
      brierScore: walkForwardRaces ? Number((walkForwardBrierTotal / walkForwardRaces).toFixed(4)) : null,
      improvementVsBaseline: walkForwardRaces ? Number((walkForwardTopOneHits / walkForwardRaces * 100 - walkForwardBaselineHits / walkForwardRaces * 100).toFixed(1)) : null,
    },
    closingFavorite: { hits: marketFavoriteHits, races: marketFavoriteRaces, rate: percentage(marketFavoriteHits, marketFavoriteRaces) },
    brierScore: evaluatedRaces ? Number((brierTotal / evaluatedRaces).toFixed(4)) : null,
    averagePredictedTopOne: evaluatedRaces ? Number((expectedTopOneTotal / evaluatedRaces * 100).toFixed(1)) : null,
    calibration: calibrationBins.filter((bin) => bin.count).map((bin) => ({
      range: `${bin.min}-${bin.max}%`,
      count: bin.count,
      predicted: Number((bin.predictedTotal / bin.count * 100).toFixed(1)),
      observed: Number((bin.wins / bin.count * 100).toFixed(1)),
    })),
  }
}

async function fetchOfficialRaceResults(date, meeting) {
  const url = new URL(meeting.url)
  url.pathname = url.pathname.replace('GunlukYarisProgrami', 'GunlukYarisSonuclari')
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36' },
    signal: AbortSignal.timeout(csvRequestTimeoutMs),
  })
  if (!response.ok) throw new Error(`TJK sonuç sayfası ${response.status} döndürdü.`)
  const races = parseOfficialRaceResults(await response.text())
  if (!races.size) throw new Error('TJK sonuç sayfasında bitmiş koşu bulunamadı.')
  return { races, url: url.toString(), date }
}

const scoringFactors = ['form', 'time', 'weight', 'recency', 'gate', 'horseWin', 'horseTopThree', 'jockeyWin', 'jockeyTopThree', 'surfaceWin', 'surfaceTopThree', 'breedWin', 'breedTopThree']
const challengerPriorWeights = { form: 0.3, time: 0.18, weight: 0.1, recency: 0.07, gate: 0.04, horseWin: 0.04, horseTopThree: 0.05, jockeyWin: 0.03, jockeyTopThree: 0.04, surfaceWin: 0.04, surfaceTopThree: 0.05, breedWin: 0.02, breedTopThree: 0.04 }

function performanceKey(value) {
  return normalizeText(value).replace(/[^a-z0-9]/g, '')
}

function normalizeSurface(value) {
  const surface = performanceKey(value)
  if (surface.includes('sentetik')) return 'sentetik'
  if (surface.includes('cim')) return 'cim'
  if (surface.includes('kum')) return 'kum'
  return 'unknown'
}

function classifyRaceBreed(race) {
  const details = performanceKey(`${race.type || ''} ${race.conditions || ''}`)
  if (details.includes('arap')) return 'arap'
  if (details.includes('ingiliz')) return 'ingiliz'
  return 'unknown'
}

function buildRecentPerformance(races) {
  const horseStats = new Map()
  const jockeyStats = new Map()
  const surfaceStats = new Map()
  const breedStats = new Map()
  const addStart = (stats, key, finishPosition) => {
    if (!key) return
    const current = stats.get(key) || { starts: 0, wins: 0, topThree: 0 }
    current.starts += 1
    if (finishPosition === 1) current.wins += 1
    if (finishPosition <= 3) current.topThree += 1
    stats.set(key, current)
  }

  for (const race of races) {
    const surface = normalizeSurface(race.surface)
    const breed = race.breed || 'unknown'
    for (const horse of race.horses) {
      addStart(horseStats, performanceKey(horse.name), horse.finishPosition)
      const jockeyKey = performanceKey(horse.jockey)
      if (jockeyKey !== performanceKey('Bilinmiyor')) addStart(jockeyStats, jockeyKey, horse.finishPosition)
      if (surface !== 'unknown') addStart(surfaceStats, `${performanceKey(horse.name)}:${surface}`, horse.finishPosition)
      if (breed !== 'unknown') addStart(breedStats, `${performanceKey(horse.name)}:${breed}`, horse.finishPosition)
    }
  }
  return { horseStats, jockeyStats, surfaceStats, breedStats }
}

function recentPerformanceForDate(targetDate) {
  const start = new Date(`${targetDate}T12:00:00`)
  start.setDate(start.getDate() - 60)
  const historyRows = listBacktestEntries(formatDate(start).iso, targetDate)
  const racesById = new Map()
  for (const row of historyRows) {
    const key = `${row.date}:${row.city}:${row.raceNo}`
    if (!racesById.has(key)) racesById.set(key, { date: row.date, surface: row.surface, breed: row.breed, horses: [] })
    racesById.get(key).horses.push({ name: row.horseName, jockey: row.jockey, finishPosition: row.finishPosition })
  }
  return buildRecentPerformance([...racesById.values()])
}

function getWalkForwardModelForDate(targetDate) {
  const model = findLatestWalkForwardModel(targetDate)
  if (!model || model.modelVersion !== walkForwardModelVersion) return null
  return { ...model, history: recentPerformanceForDate(targetDate) }
}

function addRecentPerformanceFeatures(horses, history, raceContext = {}) {
  const getRates = (stats, key, strength, baselineTopThree) => {
    const current = stats.get(key) || { starts: 0, wins: 0, topThree: 0 }
    const denominator = current.starts + strength
    return {
      win: (current.wins + strength * 0.1) / denominator,
      topThree: (current.topThree + strength * baselineTopThree) / denominator,
    }
  }

  return horses.map((horse) => {
    const horseRates = getRates(history.horseStats, performanceKey(horse.name), 10, 0.3)
    const jockeyKey = performanceKey(horse.jockey)
    const jockeyRates = jockeyKey === performanceKey('Bilinmiyor')
      ? { win: 0.1, topThree: 0.3 }
      : getRates(history.jockeyStats, jockeyKey, 20, 0.3)
    const surface = normalizeSurface(raceContext.surface)
    const breed = raceContext.breed || 'unknown'
    const surfaceRates = surface === 'unknown'
      ? { win: 0.1, topThree: 0.3 }
      : getRates(history.surfaceStats, `${performanceKey(horse.name)}:${surface}`, 10, 0.3)
    const breedRates = breed === 'unknown'
      ? { win: 0.1, topThree: 0.3 }
      : getRates(history.breedStats, `${performanceKey(horse.name)}:${breed}`, 10, 0.3)
    return {
      ...horse,
      factors: {
        ...horse.factors,
        horseWin: horseRates.win,
        horseTopThree: horseRates.topThree,
        jockeyWin: jockeyRates.win,
        jockeyTopThree: jockeyRates.topThree,
        surfaceWin: surfaceRates.win,
        surfaceTopThree: surfaceRates.topThree,
        breedWin: breedRates.win,
        breedTopThree: breedRates.topThree,
      },
    }
  })
}

function trainWalkForwardWeights(races) {
  const weights = scoringFactors.map((factor) => challengerPriorWeights[factor])
  const learningRate = 0.03
  const regularization = 0.08

  for (let epoch = 0; epoch < 120; epoch += 1) {
    const gradients = scoringFactors.map(() => 0)
    for (const race of races) {
      const winners = race.horses.filter((horse) => horse.finishPosition === 1)
      if (!winners.length) continue
      const logits = race.horses.map((horse) => scoringFactors.reduce((sum, factor, featureIndex) => sum + weights[featureIndex] * (horse.factors[factor] ?? 0.5), 0) * 4)
      const maximumLogit = Math.max(...logits)
      const exponentials = logits.map((logit) => Math.exp(logit - maximumLogit))
      const total = exponentials.reduce((sum, value) => sum + value, 0)
      const winnerNos = new Set(winners.map((horse) => horse.no))

      for (const [horseIndex, horse] of race.horses.entries()) {
        const actual = winnerNos.has(horse.no) ? 1 / winners.length : 0
        const error = (exponentials[horseIndex] / total - actual) * 4
        for (const [featureIndex, factor] of scoringFactors.entries()) gradients[featureIndex] += error * (horse.factors[factor] ?? 0.5)
      }
    }

    const nextWeights = weights.map((weight, featureIndex) => Math.max(0.005, weight - learningRate * (gradients[featureIndex] / races.length + regularization * (weight - challengerPriorWeights[scoringFactors[featureIndex]]))))
    const totalWeight = nextWeights.reduce((sum, weight) => sum + weight, 0)
    for (const [featureIndex, weight] of nextWeights.entries()) weights[featureIndex] = weight / totalWeight
  }

  return Object.fromEntries(scoringFactors.map((factor, index) => [factor, weights[index]]))
}

function rankWithWeights(horses, weights) {
  const scored = horses.map((horse) => ({
    horse,
    score: scoringFactors.reduce((sum, factor) => sum + weights[factor] * (horse.factors[factor] ?? 0.5), 0),
  }))
  const total = scored.reduce((sum, item) => sum + Math.exp(item.score * 4), 0)
  scored.sort((left, right) => right.score - left.score)
  return new Map(scored.map((item, index) => [Number(item.horse.no), { rank: index + 1, probability: Number((Math.exp(item.score * 4) / total * 100).toFixed(1)) }]))
}

async function runPerformanceBacktest(job) {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const firstDate = new Date(today)
  firstDate.setDate(firstDate.getDate() - job.days + 1)
  const trainingRaces = []
  clearWalkForwardEntries(formatDate(firstDate).iso, formatDate(today).iso, baselineModelVersion)

  try {
    for (let offset = 0; offset < job.days; offset += 1) {
      const date = new Date(firstDate)
      date.setDate(firstDate.getDate() + offset)
      const dateKey = formatDate(date).iso
      job.currentDate = dateKey
      try {
        await withRetries(() => fetchForeignProgramCities(date))
        const meetings = (meetingOptionsByDate.get(dateKey) || []).filter((meeting) => !meeting.foreign && meeting.url)
        const trainingStart = new Date(date)
        trainingStart.setDate(trainingStart.getDate() - 60)
        const priorRaces = trainingRaces.filter((race) => race.date >= formatDate(trainingStart).iso)
        const candidateWeights = priorRaces.length >= 100 ? trainWalkForwardWeights(priorRaces) : null
        if (candidateWeights) saveWalkForwardModel({
          targetDate: dateKey,
          trainingStartDate: formatDate(trainingStart).iso,
          trainingRaces: priorRaces.length,
          weights: candidateWeights,
          modelVersion: walkForwardModelVersion,
        })
        const historicalPerformance = buildRecentPerformance(priorRaces)
        const meetingResults = await mapWithConcurrency(meetings, 2, async (meeting) => {
          try {
            const [program, officialResults] = await Promise.all([
              withRetries(() => fetchProgram(date, meeting.city, { isForeign: false })),
              withRetries(() => fetchOfficialRaceResults(date, meeting)),
            ])
            let savedRaces = 0
            const completedRaces = []
            for (const race of program.races) {
              const results = officialResults.races.get(Number(race.no))
              if (!results || !race.horses.length || !race.horses.every((horse) => results.get(Number(horse.no))?.finishPosition)) continue
              if (!race.horses.some((horse) => results.get(Number(horse.no)).finishPosition === 1)) continue
              const raceBreed = classifyRaceBreed(race)
              const raceContext = { surface: race.surface, breed: raceBreed }
              const challengerHorses = addRecentPerformanceFeatures(race.horses, historicalPerformance, raceContext)
              const walkForward = candidateWeights ? rankWithWeights(challengerHorses, candidateWeights) : null
              saveBacktestRace({
                date: dateKey,
                city: meeting.city,
                raceNo: race.no,
                surface: race.surface,
                breed: raceBreed,
                horses: race.horses,
                results,
                sourceUrl: program.url,
                modelVersion: baselineModelVersion,
                walkForward,
              })
              savedRaces += 1
              completedRaces.push({
                date: dateKey,
                surface: race.surface,
                breed: raceBreed,
                horses: challengerHorses.map((horse) => ({ no: Number(horse.no), name: horse.name, jockey: horse.jockey, factors: horse.factors, finishPosition: results.get(Number(horse.no)).finishPosition })),
              })
            }
            return { savedRaces, completedRaces, error: null }
          } catch (error) {
            return { savedRaces: 0, completedRaces: [], error: `${meeting.city}: ${error.message}` }
          }
        })
        job.savedRaces += meetingResults.reduce((sum, item) => sum + item.savedRaces, 0)
        for (const result of meetingResults) {
          trainingRaces.push(...result.completedRaces)
          if (result.error && job.errors.length < 8) job.errors.push(`${dateKey} ${result.error}`)
        }
      } catch (error) {
        if (job.errors.length < 8) job.errors.push(`${dateKey}: ${error.message}`)
      }
      job.processedDays = offset + 1
      job.progress = Math.round(job.processedDays / job.days * 100)
    }
    job.status = 'complete'
    job.summary = performanceSummary(job.days)
  } catch (error) {
    job.status = 'error'
    job.errors.push(error.message)
  } finally {
    job.currentDate = null
    job.finishedAt = new Date().toISOString()
  }
}

createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`)
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    })
    return response.end()
  }
  if (requestUrl.pathname === '/api/health') return sendJson(response, 200, { ok: true, service: 'horseride-data' })
  if (requestUrl.pathname === '/api/performance' && request.method === 'GET') {
    const days = Number(requestUrl.searchParams.get('days') || 90)
    if (!Number.isInteger(days) || days < 1 || days > 90) return sendJson(response, 400, { error: 'Gün aralığı 1-90 arasında olmalı.' })
    return sendJson(response, 200, { performance: performanceSummary(days) })
  }
  if (requestUrl.pathname === '/api/performance/backtest' && request.method === 'POST') {
    try {
      const body = await readJsonBody(request)
      const days = Number(body.days ?? 90)
      if (!Number.isInteger(days) || days < 1 || days > 90) return sendJson(response, 400, { error: 'Gün aralığı 1-90 arasında olmalı.' })
      const activeJob = [...performanceJobs.values()].find((job) => job.status === 'running')
      if (activeJob) return sendJson(response, 202, { job: activeJob })
      const job = {
        id: randomUUID(),
        status: 'running',
        days,
        processedDays: 0,
        progress: 0,
        savedRaces: 0,
        currentDate: null,
        errors: [],
        startedAt: new Date().toISOString(),
      }
      performanceJobs.set(job.id, job)
      void runPerformanceBacktest(job)
      return sendJson(response, 202, { job })
    } catch (error) {
      return sendJson(response, error.status || 400, { error: error.message })
    }
  }
  if (requestUrl.pathname.startsWith('/api/performance/backtest/') && request.method === 'GET') {
    const jobId = requestUrl.pathname.slice('/api/performance/backtest/'.length)
    const job = performanceJobs.get(jobId)
    return job ? sendJson(response, 200, { job }) : sendJson(response, 404, { error: 'Geri test işi bulunamadı.' })
  }
  if (requestUrl.pathname === '/api/analysis/daily') {
    if (request.method !== 'POST') return sendJson(response, 405, { error: 'Bu endpoint POST bekliyor.' })
    try {
      const body = await readJsonBody(request)
      const date = String(body.date || '')
      const city = String(body.city || '').trim()
      const parsedDate = new Date(`${date}T12:00:00`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || formatDate(parsedDate).iso !== date) {
        return sendJson(response, 400, { error: 'Geçersiz tarih.' })
      }
      if (!city || city.length > 80) return sendJson(response, 400, { error: 'Geçerli şehir gerekli.' })
      const result = await getOrCreateDailyAnalysis(date, city)
      return sendJson(response, 200, { date, city, model: result.record.model, createdAt: result.record.createdAt, cached: result.cached, analysis: result.record.analysis })
    } catch (error) {
      return sendJson(response, error.status || 502, { error: error.message })
    }
  }
  if (requestUrl.pathname === '/api/history/horse') {
    const name = requestUrl.searchParams.get('name')
    if (!name) return sendJson(response, 400, { error: 'name parametresi gerekli.' })
    return sendJson(response, 200, { name, entries: findHorseHistory(name) })
  }
  if (requestUrl.pathname === '/api/history/races') return sendJson(response, 200, { analyses: listRecentAnalyses() })
  if (requestUrl.pathname === '/api/history/health') return sendJson(response, 200, databaseHealth())
  if (requestUrl.pathname === '/api/meetings') {
    const dateParam = requestUrl.searchParams.get('date')
    const date = dateParam ? new Date(`${dateParam}T12:00:00`) : new Date()
    if (Number.isNaN(date.getTime())) return sendJson(response, 400, { error: 'Geçersiz tarih.' })
    try {
      await fetchForeignProgramCities(date)
      return sendJson(response, 200, { date: formatDate(date).iso, meetings: meetingOptionsByDate.get(formatDate(date).iso) || [] })
    } catch (error) {
      return sendJson(response, 502, { error: error.message, date: formatDate(date).iso, meetings: meetingOptionsByDate.get(formatDate(date).iso) || [] })
    }
  }
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
    const walkForwardModel = getWalkForwardModelForDate(formatDate(date).iso)
    const scoredRaces = walkForwardModel
      ? result.races.map((race) => scoreRace(race, { weights: walkForwardModel.weights, history: walkForwardModel.history }))
      : result.races
    const fetchedAt = new Date().toISOString()
    const modelTrainedThroughDate = walkForwardModel ? new Date(date) : null
    if (modelTrainedThroughDate) modelTrainedThroughDate.setDate(modelTrainedThroughDate.getDate() - 1)
    const stored = saveProgram({ city: result.city, date: formatDate(date).iso, fetchedAt, providerUrl: result.providerUrls[0], races: scoredRaces, rawSources: result.rawSources || [] })
    const storedProgram = isAllCitySelection(city) ? loadStoredProgram(formatDate(date).iso, city) : []
    return sendJson(response, 200, { source: result.source, city: result.city, date: formatDate(date).iso, fetchedAt, providerUrls: result.providerUrls, failures: result.failures, meetings: result.meetings || meetingOptionsByDate.get(formatDate(date).iso) || [], races: storedProgram.length ? storedProgram : scoredRaces, agfUsed: false, jockeyHistoryUsed: Boolean(walkForwardModel), stored, model: walkForwardModel ? walkForwardModel.modelVersion : baselineModelVersion, modelTrainingStartDate: walkForwardModel?.trainingStartDate || null, modelTrainedThrough: modelTrainedThroughDate ? formatDate(modelTrainedThroughDate).iso : null, modelTrainingRaces: walkForwardModel?.trainingRaces || 0 })
  } catch (error) {
    const dateParam = requestUrl.searchParams.get('date')
    const date = dateParam ? new Date(`${dateParam}T12:00:00`) : new Date()
    const cachedProgram = loadStoredProgram(formatDate(date).iso, requestUrl.searchParams.get('city') || defaultCity)
    if (cachedProgram.length) {
      const city = requestUrl.searchParams.get('city') || defaultCity
      return sendJson(response, 200, {
        source: 'sqlite_cache',
        city: isAllCitySelection(city) ? 'Tüm program' : city,
        date: formatDate(date).iso,
        providerUrls: [],
        failures: [{ city, error: `TJK geçici olarak yanıt vermedi: ${error.message}` }],
        meetings: meetingOptionsByDate.get(formatDate(date).iso) || [],
        races: cachedProgram,
        stored: { storedRaces: cachedProgram.length, fromCache: true },
        model: 'HorseRide baseline v0.1',
      })
    }
    return sendJson(response, 502, { error: error.message, source: 'tjk_csv' })
  }
}).listen(port, () => console.log(`HorseRide data API listening on http://localhost:${port}`))
