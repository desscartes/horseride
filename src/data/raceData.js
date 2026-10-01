const apiUrl = import.meta.env.VITE_RACE_API_URL || '/api/races'

function buildApiUrl(pathname) {
  const url = new URL(apiUrl, window.location.origin)
  url.pathname = pathname
  url.search = ''
  return url
}

function normalizeLiveRaces(payload) {
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
      note: favorite ? `Bağımsız skor ${Math.round(favorite.independentScore * 100)}%. Son form, derece, kilo, dinlenme ve start faktörleriyle hesaplandı.` : 'Koşu için yeterli veri bulunamadı.',
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
    return {
      races: normalizeLiveRaces(payload),
      city: payload.city || city,
      source: 'live',
      providerSource: payload.source || 'unknown',
      providerUrls: payload.providerUrls || [],
      failures: payload.failures || [],
      message: `TJK programı otomatik alındı.${warning} AGF hariç ilk model aktif; jokey, idman ve daha derin geçmiş katmanları sıradaki veri genişlemesi olarak bekliyor.`,
    }
  } catch (error) {
    return { races: [], city, source: 'unavailable', providerSource: 'unavailable', providerUrls: [], failures: [], message: `Canlı TJK verisi alınamadı: ${error.message}` }
  }
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
