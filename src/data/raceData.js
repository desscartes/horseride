import { Capacitor } from '@capacitor/core'

const apiUrl = import.meta.env.VITE_RACE_API_URL || '/api/races'
const nativeApiUrl = 'http://10.0.2.2:8787/api/races'
const resolvedApiUrl = import.meta.env.VITE_RACE_API_URL || (Capacitor.isNativePlatform() ? nativeApiUrl : apiUrl)

function buildApiUrl(pathname) {
  const url = new URL(resolvedApiUrl, window.location.origin)
  url.pathname = pathname
  url.search = ''
  return url
}

function normalizeLiveRaces(payload) {
  const usesWalkForwardModel = String(payload.model || '').startsWith('walk-forward-')
  return payload.races.map((race) => {
    const favorite = race.horses[0]
    return {
      ...race,
      distance: race.distance || race.conditions?.split(' · ')[2] || '',
      horses: race.horses.map((horse, index) => ({ ...horse, rank: index + 1 })),
      favorites: race.horses.slice(0, 3).map((horse) => horse.name),
      horseCount: race.horses.length,
      favorite: favorite?.name || 'Belirlenemedi',
      confidence: Math.round(favorite?.probability || 0),
      factors: favorite?.factors || null,
      note: favorite
        ? usesWalkForwardModel
          ? `Walk-forward skor ${Math.round(favorite.independentScore * 100)}%. Son form, derece, kilo, dinlenme, start ve önceki 60 günlük at/jokey sonuçları kullanıldı.`
          : `Başlangıç model skoru ${Math.round(favorite.independentScore * 100)}%. Son form, derece, kilo, dinlenme ve start faktörleri kullanıldı.`
        : 'Koşu için yeterli veri bulunamadı.',
    }
  })
}

export async function loadRaceProgram(city = 'Tümü', date = null) {
  try {
    const url = buildApiUrl('/api/races')
    url.searchParams.set('city', city)
    if (date) url.searchParams.set('date', date)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Yarış servisi ${response.status} döndürdü.`)

    const payload = await response.json()
    if (!Array.isArray(payload.races)) throw new Error('Yarış servisi beklenen formatta veri döndürmedi.')

    const warning = Array.isArray(payload.failures) && payload.failures.length
      ? ` Bazı merkezler şu an yanıt vermiyor: ${payload.failures.slice(0, 3).map((item) => item.city).join(', ')}.`
      : ''
    const cachedMessage = payload.source === 'sqlite_cache'
      ? `TJK geçici olarak yanıt vermedi; ${date || 'seçili gün'} için kaydedilmiş gerçek program gösteriliyor.`
      : String(payload.model || '').startsWith('walk-forward-')
        ? `TJK programı otomatik alındı.${warning} Walk-forward modeli, önceki yarışlardan at/jokey formunu kullanıyor; eğitim örneği: ${payload.modelTrainingRaces || 0}.`
        : `TJK programı otomatik alındı.${warning} Başlangıç modeli aktif; walk-forward modeli için yeterli geçmiş eğitim verisi bekleniyor.`
    return {
      races: normalizeLiveRaces(payload),
      city: payload.city || city,
      source: 'live',
      providerSource: payload.source || 'unknown',
      model: payload.model || 'baseline-v0.1-form-time-weighted',
      modelTrainingRaces: payload.modelTrainingRaces || 0,
      providerUrls: payload.providerUrls || [],
      failures: payload.failures || [],
      meetings: payload.meetings || [],
      message: cachedMessage,
    }
  } catch (error) {
    return { races: [], city, source: 'unavailable', providerSource: 'unavailable', providerUrls: [], failures: [], meetings: [], message: `Canlı TJK verisi alınamadı: ${error.message}` }
  }
}

export async function loadProgramMeetings(date = null) {
  const url = buildApiUrl('/api/meetings')
  if (date) url.searchParams.set('date', date)
  const response = await fetch(url)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Toplantı servisi ${response.status} döndürdü.`)
  if (!Array.isArray(payload.meetings)) throw new Error('Toplantı servisi beklenen formatta veri döndürmedi.')
  return payload.meetings
}

export async function loadRaceDebug(city = 'Tümü', date = null) {
  const url = buildApiUrl('/api/debug/races')
  url.searchParams.set('city', city)
  if (date) url.searchParams.set('date', date)

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Debug servis ${response.status} döndürdü.`)

  const payload = await response.json()
  if (!payload || typeof payload !== 'object') throw new Error('Debug servis beklenen formatta veri döndürmedi.')

  return payload
}

export async function runDailyAnalysis(city, date) {
  const url = buildApiUrl('/api/analysis/daily')
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city, date }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `AI analiz servisi ${response.status} döndürdü.`)
  if (!payload.analysis || !Array.isArray(payload.analysis.races)) throw new Error('AI analiz servisi beklenen formatta veri döndürmedi.')
  return payload
}

export async function loadHorseHistory(name) {
  const url = buildApiUrl('/api/history/horse')
  url.searchParams.set('name', name)

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Geçmiş servis ${response.status} döndürdü.`)

  const payload = await response.json()
  if (!Array.isArray(payload.entries)) throw new Error('Geçmiş servis beklenen formatta veri döndürmedi.')

  return { name: payload.name || name, entries: payload.entries }
}

export async function loadRecentAnalyses() {
  const url = buildApiUrl('/api/history/races')
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Arşiv servis ${response.status} döndürdü.`)

  const payload = await response.json()
  if (!Array.isArray(payload.analyses)) throw new Error('Arşiv servis beklenen formatta veri döndürmedi.')

  return payload.analyses
}

export async function loadPerformance(days = 90) {
  const url = buildApiUrl('/api/performance')
  url.searchParams.set('days', String(days))
  const response = await fetch(url)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Performans servisi ${response.status} döndürdü.`)
  if (!payload.performance) throw new Error('Performans servisi beklenen formatta veri döndürmedi.')
  return payload.performance
}

export async function startPerformanceBacktest(days = 90) {
  const url = buildApiUrl('/api/performance/backtest')
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Geri test servisi ${response.status} döndürdü.`)
  if (!payload.job?.id) throw new Error('Geri test işi başlatılamadı.')
  return payload.job
}

export async function loadPerformanceJob(jobId) {
  const url = buildApiUrl(`/api/performance/backtest/${encodeURIComponent(jobId)}`)
  const response = await fetch(url)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Geri test durumu ${response.status} döndürdü.`)
  if (!payload.job) throw new Error('Geri test durumu beklenen formatta veri döndürmedi.')
  return payload.job
}
