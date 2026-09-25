export const demoRaces = [
  { no: 1, time: '14:00', track: 'İstanbul', distance: '1400 m', type: 'Şartlı 4', confidence: 78, favorite: 'Kuzey Rüzgarı', favorites: ['Kuzey Rüzgarı', 'Mavi Ateş', 'Lal Bahar'], note: 'Start çizgisindeki istikrarı ve sentetik pistteki son iki derecesi öne çıkıyor.' },
  { no: 2, time: '14:30', track: 'İstanbul', distance: '1600 m', type: 'Handikap 15', confidence: 65, favorite: 'Ay Işığı', favorites: ['Ay Işığı', 'Gölge Avcısı', 'Safir Kanat'], note: 'Mesafe uyumu güçlü. Jokey değişikliği olumlu sinyal veriyor.' },
  { no: 3, time: '15:00', track: 'İstanbul', distance: '1200 m', type: 'Maiden', confidence: 71, favorite: 'Lodos Kızı', favorites: ['Lodos Kızı', 'Kırmızı Hilal', 'Yelkovan'], note: 'İlk koşusundaki hızlanma verisi ve hafif kilo avantajı modeli yukarı taşıyor.' },
  { no: 4, time: '15:30', track: 'İstanbul', distance: '2000 m', type: 'Şartlı 3', confidence: 58, favorite: 'Demir Pençe', favorites: ['Demir Pençe', 'Güzel İz', 'Beyaz Bulut'], note: 'Uzun mesafede dayanıklılık dengeli; yarışın temposu sonucu belirleyebilir.' },
]

export const coupons = [
  { name: 'Dengeli 6’lı', game: '6’lı Ganyan', chance: 18, cost: '₺48', legs: '1-2-3-4-5-6', tag: 'En çok tercih edilen' },
  { name: 'Cesur 5’li', game: '5’li Ganyan', chance: 11, cost: '₺24', legs: '2-3-4-5-6', tag: 'Yüksek getiri' },
  { name: 'Tekli Sprint', game: 'Ganyan', chance: 42, cost: '₺12', legs: '1. koşu', tag: 'Düşük risk' },
]

const apiUrl = import.meta.env.VITE_RACE_API_URL || '/api/races'

function normalizeLiveRaces(payload) {
  return payload.races.map((race) => {
    const favorite = race.horses[0]
    return {
      ...race,
      distance: race.distance || race.conditions?.split(' · ')[2] || '',
      favorites: race.horses.slice(0, 3).map((horse) => horse.name),
      favorite: favorite?.name || 'Belirlenemedi',
      confidence: Math.round(favorite?.probability || 0),
      factors: favorite?.factors || null,
      note: favorite ? `Bağımsız skor ${Math.round(favorite.independentScore * 100)}%. Son form, derece, kilo, dinlenme ve start faktörleriyle hesaplandı.` : 'Koşu için yeterli veri bulunamadı.',
    }
  })
}

export async function loadRaceProgram() {
  try {
    const response = await fetch(apiUrl)
    if (!response.ok) throw new Error(`Yarış servisi ${response.status} döndürdü.`)

    const payload = await response.json()
    if (!Array.isArray(payload.races)) throw new Error('Yarış servisi beklenen formatta veri döndürmedi.')

    return { races: normalizeLiveRaces(payload), source: 'live', message: 'TJK CSV canlı verisi kullanılıyor. AGF modele dahil edilmedi; jokey geçmiş servisi henüz bağlanmadı.' }
  } catch (error) {
    return { races: demoRaces, source: 'demo', message: `Canlı veri alınamadı: ${error.message} Demo veri gösteriliyor.` }
  }
}
