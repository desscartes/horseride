import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { coupons, demoRaces, loadHorseHistory, loadRaceProgram } from './data/raceData'
import './styles.css'

const factorLabels = { form: 'Son form', time: 'Derece', weight: 'Kilo', recency: 'Dinlenme', gate: 'Start' }

function App() {
  const [races, setRaces] = useState(demoRaces)
  const [selectedCity, setSelectedCity] = useState('Bursa')
  const [selectedRace, setSelectedRace] = useState(0)
  const [activeDay, setActiveDay] = useState('Bugün')
  const [selectedCoupon, setSelectedCoupon] = useState(0)
  const [selectedHorseIndex, setSelectedHorseIndex] = useState(0)
  const [dataState, setDataState] = useState({ city: 'Bursa', source: 'demo', message: 'Canlı API bağlı değil. Arayüz demo veriyle çalışıyor.' })
  const [historyState, setHistoryState] = useState({ status: 'idle', name: '', entries: [], error: '' })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('12:42')
  const race = races[selectedRace] || races[0] || { no: '-', favorite: 'Belirlenemedi', favorites: [], horses: [], confidence: 0, note: 'Veri bekleniyor.' }
  const coupon = coupons[selectedCoupon]
  const analyzedCount = races.filter((item) => item.confidence > 0).length
  const averageConfidence = races.length ? Math.round(races.reduce((total, item) => total + item.confidence, 0) / races.length) : 0
  const availableHorses = useMemo(() => {
    if (Array.isArray(race.horses) && race.horses.length) return race.horses.slice(0, 3)
    return (race.favorites || []).slice(0, 3).map((name, index) => ({ name, rank: index + 1, probability: index === 0 ? race.confidence : null, factors: index === 0 ? race.factors : null }))
  }, [race])
  const activeHorse = availableHorses[selectedHorseIndex] || availableHorses[0] || null
  const recentHistory = historyState.entries.slice(0, 4)
  const averageHistoryProbability = recentHistory.length ? Math.round(recentHistory.reduce((sum, entry) => sum + (entry.probability || 0), 0) / recentHistory.length) : 0

  async function refreshProgram(city = selectedCity) {
    setIsRefreshing(true)
    try {
      const result = await loadRaceProgram(city)
      setRaces(result.races)
      setDataState({ city: result.city || selectedCity, source: result.source, message: result.message })
      setSelectedRace(0)
      setLastUpdated(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }))
    } catch (error) {
      setDataState({ source: 'error', message: error.message })
    } finally {
      setIsRefreshing(false)
    }
  }

  function changeCity(event) {
    const city = event.target.value
    setSelectedCity(city)
    window.setTimeout(() => refreshProgram(city), 0)
  }

  useEffect(() => { refreshProgram() }, [])
  useEffect(() => { setSelectedHorseIndex(0) }, [selectedRace, races])
  useEffect(() => {
    let cancelled = false

    async function refreshHorseHistory() {
      if (!activeHorse?.name) {
        setHistoryState({ status: 'idle', name: '', entries: [], error: '' })
        return
      }
      if (dataState.source !== 'live') {
        setHistoryState({ status: 'unavailable', name: activeHorse.name, entries: [], error: '' })
        return
      }

      setHistoryState({ status: 'loading', name: activeHorse.name, entries: [], error: '' })
      try {
        const result = await loadHorseHistory(activeHorse.name)
        if (!cancelled) setHistoryState({ status: 'ready', name: result.name, entries: result.entries, error: '' })
      } catch (error) {
        if (!cancelled) setHistoryState({ status: 'error', name: activeHorse.name, entries: [], error: error.message })
      }
    }

    refreshHorseHistory()
    return () => { cancelled = true }
  }, [activeHorse?.name, dataState.source])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">H</span><span>Horse<span>Ride</span></span></div>
        <div className="workspace-label">ANALİZ MERKEZİ</div>
        <nav>
          <button className="nav-item active"><span>◈</span> Yarış panosu</button>
          <button className="nav-item"><span>⌁</span> Kupon laboratuvarı</button>
          <button className="nav-item"><span>◷</span> Geçmiş analizler</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="model-status"><span className="status-dot" /><div><strong>Model hazır</strong><small>Son güncelleme 12:42</small></div></div>
          <button className="settings"><span>⚙</span> Ayarlar</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">H</span> HorseRide</div>
          <div className="location"><span className="pin">⌖</span><div><small>AKTİF PROGRAM</small><strong>{dataState.city} · 25 Eylül 2026</strong></div></div>
          <div className={`data-state ${dataState.source}`}><span className="data-state-dot" /><div><strong>{dataState.source === 'live' ? 'Canlı veri' : dataState.source === 'error' ? 'Veri hatası' : 'Demo veri'}</strong><small>{lastUpdated} güncellendi</small></div></div>
          <div className="header-actions"><button className="icon-button" title="Bildirimler">♢<i /></button><button className="profile">CA</button></div>
        </header>

        <section className="intro-row">
          <div><p className="eyebrow">YARIŞ GÜNÜ / CUMA</p><h1>Bugünün yarış zekası</h1><p className="subhead">Veriyi oku, tempoyu gör, kuponunu bilinçle kur.</p></div>
          <div className="context-pickers"><label className="city-picker"><span>HİPODROM</span><select value={selectedCity} onChange={changeCity}><option>Bursa</option><option>İstanbul</option><option>Ankara</option><option>İzmir</option><option>Adana</option></select></label><label className="race-picker"><span>KOŞUYA GİT</span><select value={selectedRace} onChange={(event) => setSelectedRace(Number(event.target.value))}>{races.map((item, index) => <option value={index} key={item.no}>{item.no}. koşu · {item.time}</option>)}</select></label></div>
          <button className="refresh-button" onClick={refreshProgram} disabled={isRefreshing}>{isRefreshing ? '…' : '↻'} <span>{isRefreshing ? 'Yükleniyor' : 'Verileri yenile'}</span></button>
        </section>

        <div className="day-tabs">{['Dün', 'Bugün', 'Yarın'].map(day => <button key={day} className={activeDay === day ? 'day-tab active' : 'day-tab'} onClick={() => setActiveDay(day)}>{day}<small>{day === 'Dün' ? '24 Eyl' : day === 'Bugün' ? '25 Eyl' : '26 Eyl'}</small></button>)}</div>

        <section className="stats-strip">
          <div><span>Toplam koşu</span><strong>{races.length}</strong><small>programda</small></div>
          <div><span>Analiz tamamlandı</span><strong>{analyzedCount}<span className="muted">/{races.length}</span></strong><small>koşu</small></div>
          <div><span>Ortalama güven</span><strong className="green-text">{averageConfidence}%</strong><small>model skoru</small></div>
          <div className="track-note"><span>Bugünün notu</span><strong>Sentetik pistte tempo yüksek.</strong><small>· Model bunu hesaba kattı</small></div>
        </section>

        <div className="content-grid">
          <section className="panel races-panel">
            <div className="panel-heading"><div><p className="eyebrow">PROGRAM</p><h2>{dataState.city} koşuları</h2></div><div className="panel-heading-meta"><span className="race-count">{String(selectedRace + 1).padStart(2, '0')} / {String(races.length).padStart(2, '0')}</span><span className={`live-badge ${dataState.source}`}><i /> {dataState.source === 'live' ? 'CANLI API' : 'DEMO PROGRAM'}</span></div></div>
            <div className="race-list">{races.map((item, index) => <button key={item.no} onClick={() => setSelectedRace(index)} className={selectedRace === index ? 'race-row selected' : 'race-row'}><span className="race-number">{String(item.no).padStart(2, '0')}</span><span className="race-time">{item.time}</span><span className="race-info"><strong>{item.type}</strong><small>{item.distance} ·  {item.horseCount || item.favorites.length + 7} at</small></span><span className="race-favorite"><small>MODEL FAVORİSİ</small><strong>{item.favorite}</strong></span><span className="confidence"><b>{item.confidence}%</b><small>güven</small></span><span className="chevron">›</span></button>)}</div>
            <button className="all-races">Tüm koşu programını gör <span>→</span></button>
          </section>

          <section className="panel analysis-panel">
            <div className="panel-heading"><div><p className="eyebrow">YAPAY ZEKA ANALİZİ</p><h2>{race.no}. koşu detayı</h2></div><span className="analysis-icon">✦</span></div>
            <div className="analysis-hero"><div className="horse-silhouette">♞</div><div><small>MODELİN ÖNE ÇIKARDIĞI</small><h3>{race.favorite}</h3><p>{race.note}</p></div><strong className="big-confidence">{race.confidence}%<small>kazanma<br />olasılığı</small></strong></div>
            <div className="probability"><div className="prob-head"><span>Olasılık dağılımı</span><small>Son form + derece + kilo · AGF hariç</small></div><div className="bar"><span style={{width: `${race.confidence}%`}} /></div><div className="prob-labels"><span><i className="dot green" /> {race.favorite} <b>{race.confidence}%</b></span><span><i className="dot orange" /> {race.favorites[1]} <b>{Math.max(9, race.confidence - 57)}%</b></span><span><i className="dot gray" /> Diğerleri <b>{Math.max(13, 100 - race.confidence - Math.max(9, race.confidence - 57))}%</b></span></div></div>
            <div className="horse-tags">{availableHorses.map((horse, i) => <button type="button" key={horse.name} onClick={() => setSelectedHorseIndex(i)} className={selectedHorseIndex === i ? 'horse-tag preferred' : 'horse-tag'}><b>{horse.rank || i + 1}</b>{horse.name}</button>)}</div>
            {race.factors && <div className="factor-grid"><div className="factor-heading"><span>Skorun dayanakları</span><small>AGF kullanılmadı</small></div>{Object.entries(race.factors).map(([key, value]) => <div className="factor-row" key={key}><span>{factorLabels[key]}</span><div className="factor-track"><i style={{ width: `${value * 100}%` }} /></div><b>{Math.round(value * 100)}</b></div>)}</div>}
            <div className="history-card">
              <div className="history-card-head">
                <div>
                  <small>AT GEÇMİŞİ</small>
                  <h3>{activeHorse?.name || 'At seçilmedi'}</h3>
                </div>
                <span>{historyState.status === 'ready' ? `${historyState.entries.length} kayıt` : historyState.status === 'loading' ? 'aranıyor' : 'hazırlanıyor'}</span>
              </div>
              {historyState.status === 'loading' && <p className="history-message">Yerel veritabanındaki önceki yarış kayıtları taranıyor.</p>}
              {historyState.status === 'error' && <p className="history-message error">{historyState.error}</p>}
              {historyState.status === 'unavailable' && <p className="history-message">Canlı veri açık olmadığında geçmiş sorgusu yapılmıyor.</p>}
              {historyState.status === 'ready' && historyState.entries.length === 0 && <p className="history-message">Bu at için henüz kayıtlı geçmiş yarış bulunamadı. Farklı günlerden canlı program çekildikçe arşiv dolacak.</p>}
              {historyState.status === 'ready' && historyState.entries.length > 0 && <><div className="history-stats"><div><span>Son kayıt</span><strong>{historyState.entries[0].date}</strong></div><div><span>Ortalama model</span><strong>%{averageHistoryProbability}</strong></div><div><span>İncelenen yarış</span><strong>{recentHistory.length}</strong></div></div><div className="history-list">{recentHistory.map((entry) => <div className="history-row" key={`${entry.date}-${entry.city}-${entry.raceNo}`}><div><strong>{entry.date}</strong><small>{entry.city} · {entry.raceNo}. koşu · {entry.distance || 'Mesafe yok'}</small></div><div><b>%{Math.round(entry.probability || 0)}</b><small>{entry.jockey || 'Jokey yok'}</small></div></div>)}</div></>}
            </div>
            <button className="detail-button">Detaylı analizi aç <span>↗</span></button>
          </section>
        </div>

        <section className="coupon-section"><div className="section-title"><div><p className="eyebrow">AKILLI KUPONLAR</p><h2>Bugün için hazır kombinasyonlar</h2></div><p>Modelin risk ve bütçe dengesine göre oluşturduğu seçenekler</p></div><div className="coupon-grid">{coupons.map((item, index) => <button key={item.name} onClick={() => setSelectedCoupon(index)} className={selectedCoupon === index ? 'coupon-card selected' : 'coupon-card'}><div className="coupon-top"><span className="coupon-tag">{item.tag}</span><span className="coupon-arrow">↗</span></div><h3>{item.name}</h3><p>{item.game} <span>·</span> {item.legs}</p><div className="coupon-bottom"><div><strong>{item.chance}%</strong><small>modelin tutma<br />olasılığı</small></div><span className="cost">{item.cost}</span></div></button>)}</div><div className="coupon-summary"><span className="summary-icon">✓</span><div><strong>{coupon.name} seçildi</strong><small>{coupon.game} · Tahmini kupon tutma olasılığı %{coupon.chance} · {coupon.cost}</small></div><button>Kuponu incele <span>→</span></button></div><div className="disclaimer"><span>ⓘ</span><p>{dataState.message} Bu oranlar geçmiş performans ve model tahminidir; kesin sonuç veya kazanç garantisi değildir.</p><button>Model metodolojisi →</button></div></section>
        <footer><span>HorseRide Intelligence v0.1</span><span>Veri kaynağı: {dataState.source === 'live' ? 'bağlı API' : 'demo veri'} · Sorumlu oyun</span></footer>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
