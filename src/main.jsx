import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { loadHorseHistory, loadRaceProgram, loadRecentAnalyses } from './data/raceData'
import './styles.css'

const factorLabels = { form: 'Son form', time: 'Derece', weight: 'Kilo', recency: 'Dinlenme', gate: 'Start' }
const emptyRace = { no: '-', time: '--:--', favorite: 'Veri bekleniyor', favorites: [], horses: [], confidence: 0, note: 'Canlı program alındığında detaylar burada görünecek.', type: 'Program bekleniyor', distance: '—' }

function addDays(date, days) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function formatApiDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short' }).format(date)
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

function isEventLike(value) {
  return value && typeof value === 'object' && 'target' in value && 'nativeEvent' in value
}

function normalizeCityInput(value, fallback) {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function normalizeDayOffset(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function buildFallbackHorses(race) {
  const baseConfidence = Math.max(12, Math.min(88, race.confidence || 0))
  const secondProbability = Math.max(7, Math.round((100 - baseConfidence) * 0.52))
  const thirdProbability = Math.max(5, Math.round((100 - baseConfidence - secondProbability) * 0.75))

  return (race.favorites || []).map((name, index) => ({
    name,
    rank: index + 1,
    probability: index === 0 ? baseConfidence : index === 1 ? secondProbability : thirdProbability,
    independentScore: index === 0 ? baseConfidence / 100 : index === 1 ? Math.max(0.2, secondProbability / 100) : Math.max(0.16, thirdProbability / 100),
    factors: index === 0 ? race.factors || null : null,
    jockey: null,
    weight: null,
    lastSix: null,
  }))
}

function horseAnalysisNote(horse, fallbackNote) {
  if (!horse?.factors) return fallbackNote

  const bestFactor = Object.entries(horse.factors).sort(([, left], [, right]) => right - left)[0]
  if (!bestFactor) return fallbackNote

  const [factorKey, factorValue] = bestFactor
  return `${horse.name}, ${factorLabels[factorKey].toLocaleLowerCase('tr-TR')} tarafında %${Math.round(factorValue * 100)} ile öne çıkıyor. Bağımsız skor %${Math.round((horse.independentScore || 0) * 100)} seviyesinde.`
}

function formatCurrency(value) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value)
}

function generateCoupons(races) {
  if (!races.length) return []

  const legs = races.slice(0, 6)
  const balancedSelections = legs.map((race) => {
    const confidence = Math.round(race.horses?.[0]?.probability || race.confidence || 0)
    return confidence >= 56 ? race.horses.slice(0, 1) : race.horses.slice(0, 2)
  })
  const aggressiveSelections = legs.map((race) => race.horses.slice(0, Math.round(race.horses?.[0]?.probability || 0) >= 63 ? 1 : 2))
  const coverageSelections = legs.map((race) => race.horses.slice(0, Math.round(race.horses?.[0]?.probability || 0) >= 50 ? 2 : 3))

  const buildCoupon = (name, game, selections, tag, multiplier) => {
    const legsSummary = selections.map((selection, index) => `${legs[index]?.no}. ayak: ${selection.map((horse) => horse.name).join(' / ')}`)
    const bankerCount = selections.filter((selection) => selection.length === 1).length
    const confidence = Math.round(selections.reduce((total, selection) => total + (selection[0]?.probability || 0), 0) / selections.length)
    return {
      name,
      game,
      tag,
      legs: legsSummary,
      bankerCount,
      chance: confidence,
      cost: formatCurrency(Math.max(legs.length * multiplier * 3, selections.reduce((total, selection) => total * selection.length, 1) * multiplier)),
    }
  }

  return [
    buildCoupon('Korunaklı 6’lı', '6’lı Ganyan', coverageSelections, 'Daha geniş kapsama', 2),
    buildCoupon('Dengeli 6’lı', '6’lı Ganyan', balancedSelections, 'Model dengesi', 1.5),
    buildCoupon('Agresif Sprint', '5’li / Tek odak', aggressiveSelections.slice(0, 5), 'Yüksek getiri denemesi', 1),
  ]
}

function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [races, setRaces] = useState([])
  const [selectedCity, setSelectedCity] = useState('Tümü')
  const [selectedRace, setSelectedRace] = useState(0)
  const [selectedDayOffset, setSelectedDayOffset] = useState(0)
  const [selectedCoupon, setSelectedCoupon] = useState(0)
  const [selectedHorseIndex, setSelectedHorseIndex] = useState(0)
  const [dataState, setDataState] = useState({ city: 'Tümü', source: 'loading', message: 'Canlı TJK programı alınıyor.' })
  const [historyState, setHistoryState] = useState({ status: 'idle', name: '', entries: [], error: '' })
  const [archiveState, setArchiveState] = useState({ status: 'idle', analyses: [], error: '' })
  const [selectedArchiveIndex, setSelectedArchiveIndex] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isRefreshingArchive, setIsRefreshingArchive] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('12:42')
  const race = races[selectedRace] || races[0] || emptyRace
  const generatedCoupons = useMemo(() => generateCoupons(races), [races])
  const coupon = generatedCoupons[selectedCoupon] || generatedCoupons[0] || null
  const analyzedCount = races.filter((item) => item.confidence > 0).length
  const averageConfidence = races.length ? Math.round(races.reduce((total, item) => total + item.confidence, 0) / races.length) : 0
  const raceHorses = useMemo(() => {
    if (Array.isArray(race.horses) && race.horses.length) return race.horses
    return buildFallbackHorses(race)
  }, [race])
  const visibleFavorites = raceHorses.slice(0, 3)
  const activeHorse = raceHorses[selectedHorseIndex] || raceHorses[0] || null
  const recentHistory = historyState.entries.slice(0, 4)
  const averageHistoryProbability = recentHistory.length ? Math.round(recentHistory.reduce((sum, entry) => sum + (entry.probability || 0), 0) / recentHistory.length) : 0
  const displayedConfidence = Math.round(activeHorse?.probability || race.confidence || 0)
  const displayedNote = horseAnalysisNote(activeHorse, race.note)
  const selectedArchive = archiveState.analyses[selectedArchiveIndex] || archiveState.analyses[0] || null
  const archiveCities = new Set(archiveState.analyses.map((item) => item.city)).size
  const topRace = races[0] || null
  const strongestEdge = topRace?.horses?.[0] ? Math.max(0, Math.round((topRace.horses[0].probability || 0) - (topRace.horses[1]?.probability || 0))) : 0
  const dayOptions = useMemo(() => {
    const today = new Date()
    return [
      { label: 'Dün', offset: -1, date: addDays(today, -1) },
      { label: 'Bugün', offset: 0, date: today },
      { label: 'Yarın', offset: 1, date: addDays(today, 1) },
    ].map((item) => ({ ...item, apiDate: formatApiDate(item.date), shortDate: formatShortDate(item.date), longDate: formatLongDate(item.date) }))
  }, [])
  const selectedDay = dayOptions.find((item) => item.offset === selectedDayOffset) || dayOptions[1]
  const hasLiveRaces = races.length > 0

  function showCouponLab() {
    setActiveView('dashboard')
    window.setTimeout(() => {
      document.getElementById('coupon-lab')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  async function refreshProgram(city = selectedCity, dayOffset = selectedDayOffset) {
    const safeCity = isEventLike(city) ? selectedCity : normalizeCityInput(city, selectedCity)
    const safeDayOffset = isEventLike(dayOffset) ? selectedDayOffset : normalizeDayOffset(dayOffset, selectedDayOffset)
    const nextDay = dayOptions.find((item) => item.offset === safeDayOffset) || dayOptions[1]
    setIsRefreshing(true)
    try {
      const result = await loadRaceProgram(safeCity, nextDay.apiDate)
      setRaces(result.races)
      setDataState({ city: normalizeCityInput(result.city, safeCity), source: result.source, message: result.message })
      setSelectedRace(0)
      setSelectedCoupon(0)
      setLastUpdated(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }))
    } catch (error) {
      setDataState({ source: 'error', message: error.message })
    } finally {
      setIsRefreshing(false)
    }
  }

  async function refreshArchive() {
    setIsRefreshingArchive(true)
    setArchiveState((current) => ({ ...current, status: 'loading', error: '' }))
    try {
      const analyses = await loadRecentAnalyses()
      setArchiveState({ status: 'ready', analyses, error: '' })
      setSelectedArchiveIndex(0)
    } catch (error) {
      setArchiveState({ status: 'error', analyses: [], error: error.message })
    } finally {
      setIsRefreshingArchive(false)
    }
  }

  function changeCity(event) {
    const city = event.target.value
    setSelectedCity(city)
    window.setTimeout(() => refreshProgram(city, selectedDayOffset), 0)
  }

  useEffect(() => { refreshProgram(selectedCity, selectedDayOffset) }, [])
  useEffect(() => { setSelectedHorseIndex(0) }, [selectedRace, races])
  useEffect(() => {
    if (selectedCoupon >= generatedCoupons.length) setSelectedCoupon(0)
  }, [generatedCoupons.length, selectedCoupon])
  useEffect(() => {
    if (activeView === 'history' && archiveState.status === 'idle') refreshArchive()
  }, [activeView])
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
          <button className={activeView === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('dashboard')}><span>◈</span> Yarış panosu</button>
          <button className={activeView === 'dashboard' && hasLiveRaces && generatedCoupons.length > 0 ? 'nav-item active' : 'nav-item'} onClick={showCouponLab}><span>⌁</span> Kupon laboratuvarı</button>
          <button className={activeView === 'history' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('history')}><span>◷</span> Geçmiş analizler</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="model-status"><span className="status-dot" /><div><strong>Model hazır</strong><small>Son güncelleme 12:42</small></div></div>
          <button className="settings"><span>⚙</span> Ayarlar</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">H</span> HorseRide</div>
          <div className="location"><span className="pin">⌖</span><div><small>{activeView === 'history' ? 'ARŞİV MODU' : 'AKTİF PROGRAM'}</small><strong>{activeView === 'history' ? 'Geçmiş analiz arşivi' : `${dataState.city} · ${selectedDay.longDate}`}</strong></div></div>
          <div className={`data-state ${activeView === 'history' ? 'live' : dataState.source}`}><span className="data-state-dot" /><div><strong>{activeView === 'history' ? 'Arşiv görünümü' : dataState.source === 'live' ? 'Canlı veri akıyor' : dataState.source === 'loading' ? 'Program yükleniyor' : 'Canlı veri bekleniyor'}</strong><small>{lastUpdated} güncellendi</small></div></div>
          <div className="header-actions"><button className="icon-button" title="Bildirimler">♢<i /></button><button className="profile">CA</button></div>
        </header>

        <section className="intro-row">
          <div><p className="eyebrow">{activeView === 'history' ? 'ARŞİV / YEREL VERİTABANI' : `YARIŞ GÜNÜ / ${selectedDay.label.toLocaleUpperCase('tr-TR')}`}</p><h1>{activeView === 'history' ? 'Geçmiş analizler' : 'Yarış zekası'}</h1><p className="subhead">{activeView === 'history' ? 'Kaydedilen yarışları, model favorilerini ve öne çıkan atları geriye dönük izle.' : 'Veriyi oku, tempoyu gör, kuponunu bilinçle kur.'}</p></div>
          {activeView === 'history'
            ? <button className="refresh-button" onClick={() => refreshArchive()} disabled={isRefreshingArchive}>{isRefreshingArchive ? '…' : '↻'} <span>{isRefreshingArchive ? 'Yükleniyor' : 'Arşivi yenile'}</span></button>
            : <><div className="context-pickers"><label className="city-picker"><span>PROGRAM</span><select value={selectedCity} onChange={changeCity}><option>Tümü</option><option>İstanbul</option><option>Ankara</option><option>İzmir</option><option>Bursa</option><option>Adana</option><option>Kocaeli</option><option>Antalya</option><option>Diyarbakır</option><option>Elazığ</option><option>Şanlıurfa</option><option>Yurtdışı</option></select></label><label className="race-picker"><span>KOŞUYA GİT</span><select value={selectedRace} onChange={(event) => setSelectedRace(Number(event.target.value))}>{races.map((item, index) => <option value={index} key={`${item.city || dataState.city}-${item.no}-${item.time}`}>{item.city ? `${item.city} · ` : ''}{item.no}. koşu · {item.time}</option>)}</select></label></div><button className="refresh-button" onClick={() => refreshProgram()} disabled={isRefreshing}>{isRefreshing ? '…' : '↻'} <span>{isRefreshing ? 'Yükleniyor' : 'Verileri yenile'}</span></button></>}
        </section>

        <div className="day-tabs">{activeView === 'history' ? <><button className="day-tab active">Arşiv<small>Kaydedilen koşular</small></button><button className="day-tab" onClick={() => setActiveView('dashboard')}>Pano<small>Canlı görünüme dön</small></button></> : dayOptions.map((day) => <button key={day.offset} className={selectedDayOffset === day.offset ? 'day-tab active' : 'day-tab'} onClick={() => { setSelectedDayOffset(day.offset); refreshProgram(selectedCity, day.offset) }}>{day.label}<small>{day.shortDate}</small></button>)}</div>

        {activeView === 'history'
          ? <>
            <section className="stats-strip">
              <div><span>Kayıtlı analiz</span><strong>{archiveState.analyses.length}</strong><small>koşu</small></div>
              <div><span>Hipodrom</span><strong>{archiveCities}</strong><small>benzersiz şehir</small></div>
              <div><span>Son favori güveni</span><strong className="green-text">%{selectedArchive?.confidence || 0}</strong><small>tepe olasılık</small></div>
              <div className="track-note"><span>Arşiv notu</span><strong>{selectedArchive ? `${selectedArchive.date} · ${selectedArchive.city} ${selectedArchive.raceNo}. koşu` : 'Henüz kaydedilmiş analiz yok.'}</strong><small>· SQLite geçmişinden okunuyor</small></div>
            </section>

            <div className="archive-grid">
              <section className="panel archive-list-panel">
                <div className="panel-heading"><div><p className="eyebrow">ARŞİV LİSTESİ</p><h2>Son kaydedilen koşular</h2></div><span className="analysis-icon">⎘</span></div>
                {archiveState.status === 'loading' && <p className="archive-message">Arşiv verisi yükleniyor.</p>}
                {archiveState.status === 'error' && <p className="archive-message error">{archiveState.error}</p>}
                {archiveState.status === 'ready' && archiveState.analyses.length === 0 && <p className="archive-message">Henüz geçmiş analiz bulunmuyor. Canlı veri çekildikçe bu ekran dolacak.</p>}
                {archiveState.status === 'ready' && archiveState.analyses.length > 0 && <div className="archive-list">{archiveState.analyses.map((analysis, index) => <button type="button" key={analysis.id} onClick={() => setSelectedArchiveIndex(index)} className={selectedArchiveIndex === index ? 'archive-row selected' : 'archive-row'}><div><strong>{analysis.date}</strong><small>{analysis.city} · {analysis.raceNo}. koşu · {analysis.time || 'Saat yok'}</small></div><div><b>{analysis.favorite || 'Favori yok'}</b><small>%{analysis.confidence} güven</small></div></button>)}</div>}
              </section>

              <section className="panel archive-detail-panel">
                <div className="panel-heading"><div><p className="eyebrow">ARŞİV DETAYI</p><h2>{selectedArchive ? `${selectedArchive.city} ${selectedArchive.raceNo}. koşu` : 'Kayıt seçin'}</h2></div><span className="analysis-icon">✦</span></div>
                {!selectedArchive && <p className="archive-message">Detay görmek için soldan bir kayıt seçin.</p>}
                {selectedArchive && <><div className="analysis-hero archive-hero"><div className="horse-silhouette">♞</div><div><small>MODEL FAVORİSİ</small><h3>{selectedArchive.favorite || 'Belirlenemedi'}</h3><p>{selectedArchive.type || 'Yarış tipi yok'} · {selectedArchive.distance || 'Mesafe yok'} · {selectedArchive.surface || 'Pist yok'}</p></div><strong className="big-confidence">%{selectedArchive.confidence}<small>zirve<br />olasılık</small></strong></div><div className="archive-meta-grid"><div><span>Tarih</span><strong>{selectedArchive.date}</strong></div><div><span>Hipodrom</span><strong>{selectedArchive.city}</strong></div><div><span>At sayısı</span><strong>{selectedArchive.horseCount}</strong></div></div><div className="field-card archive-field-card"><div className="field-card-head"><div><small>ÖNE ÇIKANLAR</small><h3>İlk 3 model adayı</h3></div><span>{selectedArchive.horses.length} at</span></div><div className="field-list">{selectedArchive.horses.map((horse) => <div className="field-row archive-static-row" key={horse.name}><div className="field-rank"><b>{horse.rank}</b><small>sıra</small></div><div className="field-main"><strong>{horse.name}</strong><small>{horse.jockey || 'Jokey bilgisi yok'} · {horse.lastSix || 'Form verisi yok'}</small></div><div className="field-meta"><span>Skor <b>%{Math.round((horse.independentScore || 0) * 100)}</b></span><span>Olasılık <b>%{Math.round(horse.probability || 0)}</b></span></div></div>)}</div></div></>}
              </section>
            </div>
          </>
          : <>
            <section className="stats-strip modern">
              <div><span>Toplam koşu</span><strong>{races.length}</strong><small>programda</small></div>
              <div><span>Analiz tamamlandı</span><strong>{analyzedCount}<span className="muted">/{Math.max(races.length, 1)}</span></strong><small>koşu</small></div>
              <div><span>Ortalama güven</span><strong className="green-text">{averageConfidence}%</strong><small>model skoru</small></div>
              <div className="track-note"><span>Günün en net koşusu</span><strong>{topRace ? `${topRace.city ? `${topRace.city} · ` : ''}${topRace.no}. koşu · ${topRace.favorite}` : 'Canlı program bekleniyor'}</strong><small>· İlk iki at arasında %{strongestEdge} fark</small></div>
            </section>

            <div className="content-grid">
              <section className="panel races-panel">
                <div className="panel-heading"><div><p className="eyebrow">PROGRAM</p><h2>{dataState.city} yarış akışı</h2></div><div className="panel-heading-meta"><span className="race-count">{String(Math.min(selectedRace + 1, Math.max(races.length, 1))).padStart(2, '0')} / {String(Math.max(races.length, 1)).padStart(2, '0')}</span><span className={`live-badge ${dataState.source}`}><i /> {dataState.source === 'live' ? 'CANLI AKIŞ' : dataState.source === 'loading' ? 'YÜKLENİYOR' : 'VERİ BEKLENİYOR'}</span></div></div>
                {hasLiveRaces
                  ? <div className="race-list">{races.map((item, index) => <button key={`${item.city || dataState.city}-${item.no}-${item.time}`} onClick={() => setSelectedRace(index)} className={selectedRace === index ? 'race-row selected' : 'race-row'}><span className="race-number">{String(item.no).padStart(2, '0')}</span><span className="race-time">{item.time}</span><span className="race-info"><strong>{item.type}</strong><small>{item.city ? `${item.city} · ` : ''}{item.distance} · {item.horseCount || item.favorites.length + 7} at</small></span><span className="race-favorite"><small>MODEL FAVORİSİ</small><strong>{item.favorite}</strong></span><span className="confidence"><b>{item.confidence}%</b><small>güven</small></span><span className="chevron">›</span></button>)}</div>
                  : <div className="empty-panel"><strong>Canlı program henüz alınamadı.</strong><p>{dataState.message} Uygulama artık mock veri göstermiyor; gerçek program gelince tüm koşular otomatik dolacak.</p><button className="secondary-action" onClick={() => refreshProgram()}>Tekrar dene</button></div>}
                <button className="all-races" onClick={showCouponLab}>Kupon laboratuvarına geç <span>→</span></button>
              </section>

              <section className="panel analysis-panel">
                <div className="panel-heading"><div><p className="eyebrow">YAPAY ZEKA ANALİZİ</p><h2>{race.city ? `${race.city} · ` : ''}{race.no}. koşu detayı</h2></div><span className="analysis-icon">✦</span></div>
                {!hasLiveRaces && <div className="empty-analysis"><strong>Canlı veri gelmeden model çıktısı üretilmiyor.</strong><p>Hedefimiz günlük TJK programını, geçmiş yarışlar ve genişletilecek jokey/idman katmanlarıyla birleştirip her koşudaki en yüksek kazanma olasılığını göstermek. Şu an bağlantı tekrar denendiğinde veri otomatik gelecektir.</p></div>}
                {hasLiveRaces && <>
                <div className="analysis-hero"><div className="horse-silhouette">♞</div><div><small>SEÇİLİ AT</small><h3>{activeHorse?.name || race.favorite}</h3><p>{displayedNote}</p></div><strong className="big-confidence">{displayedConfidence}%<small>kazanma<br />olasılığı</small></strong></div>
                <div className="probability"><div className="prob-head"><span>Olasılık dağılımı</span><small>Son form + derece + kilo · AGF hariç</small></div><div className="bar"><span style={{width: `${displayedConfidence}%`}} /></div><div className="prob-labels">{visibleFavorites.map((horse, index) => <span key={horse.name}><i className={`dot ${index === 0 ? 'green' : index === 1 ? 'orange' : 'gray'}`} /> {horse.name} <b>%{Math.round(horse.probability || 0)}</b></span>)}<span><i className="dot gray" /> Diğerleri <b>%{Math.max(0, 100 - visibleFavorites.reduce((total, horse) => total + Math.round(horse.probability || 0), 0))}</b></span></div></div>
                <div className="horse-tags">{visibleFavorites.map((horse, i) => <button type="button" key={horse.name} onClick={() => setSelectedHorseIndex(i)} className={selectedHorseIndex === i ? 'horse-tag preferred' : 'horse-tag'}><b>{horse.rank || i + 1}</b>{horse.name}</button>)}</div>
                {activeHorse?.factors && <div className="factor-grid"><div className="factor-heading"><span>Skorun dayanakları</span><small>AGF kullanılmadı</small></div>{Object.entries(activeHorse.factors).map(([key, value]) => <div className="factor-row" key={key}><span>{factorLabels[key]}</span><div className="factor-track"><i style={{ width: `${value * 100}%` }} /></div><b>{Math.round(value * 100)}</b></div>)}</div>}
                <div className="field-card">
                  <div className="field-card-head">
                    <div>
                      <small>KOŞU SAHASI</small>
                      <h3>Tüm atlar ve skorları</h3>
                    </div>
                    <span>{raceHorses.length} at</span>
                  </div>
                  <div className="field-list">
                    {raceHorses.map((horse, index) => <button type="button" key={`${horse.name}-${index}`} onClick={() => setSelectedHorseIndex(index)} className={selectedHorseIndex === index ? 'field-row selected' : 'field-row'}><div className="field-rank"><b>{horse.rank || index + 1}</b><small>sıra</small></div><div className="field-main"><strong>{horse.name}</strong><small>{horse.jockey || 'Jokey bilgisi yok'} · {horse.lastSix || 'Form verisi yok'}</small></div><div className="field-meta"><span>Skor <b>%{Math.round((horse.independentScore || 0) * 100)}</b></span><span>Olasılık <b>%{Math.round(horse.probability || 0)}</b></span></div></button>)}
                  </div>
                </div>
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
                </>}
              </section>
            </div>

            <section className="coupon-section" id="coupon-lab"><div className="section-title"><div><p className="eyebrow">AKILLI KUPONLAR</p><h2>Canlı veriden üretilen kombinasyonlar</h2></div><p>Bugünkü analiz güvenlerine göre otomatik oluşturulmuş öneriler</p></div>{generatedCoupons.length > 0 ? <><div className="coupon-grid">{generatedCoupons.map((item, index) => <button key={item.name} onClick={() => setSelectedCoupon(index)} className={selectedCoupon === index ? 'coupon-card selected modern-coupon' : 'coupon-card modern-coupon'}><div className="coupon-top"><span className="coupon-tag">{item.tag}</span><span className="coupon-arrow">↗</span></div><h3>{item.name}</h3><p>{item.game} <span>·</span> {item.bankerCount} bankolu yapı</p><div className="coupon-bottom"><div><strong>{item.chance}%</strong><small>ortalama favori<br />güveni</small></div><span className="cost">{item.cost}</span></div></button>)}</div><div className="coupon-summary live-summary"><span className="summary-icon">✓</span><div><strong>{coupon?.name} seçildi</strong><small>{coupon?.game} · Tahmini güven %{coupon?.chance} · {coupon?.cost}</small></div><button onClick={showCouponLab}>Kuponu incele <span>→</span></button></div>{coupon && <div className="ticket-lab"><div className="ticket-lab-head"><strong>Kupon laboratuvarı</strong><small>Her ayak için modelin seçtiği atlar</small></div><div className="ticket-legs">{coupon.legs.map((leg) => <div className="ticket-leg" key={leg}><span>{leg.split(':')[0]}</span><strong>{leg.split(': ')[1]}</strong></div>)}</div></div>}</> : <div className="empty-panel coupon-empty"><strong>Kupon üretmek için canlı yarış programı gerekli.</strong><p>Gerçek veri geldiğinde sistem tüm koşular için olasılıkları hesaplayıp bankolu ve korunaklı kuponları otomatik çıkaracak.</p></div>}<div className="disclaimer"><span>ⓘ</span><p>{dataState.message} Bugünkü hedef, canlı TJK programını geçmiş yarışlar, jokey/idman/veri genişlemeleri ve model tahminleriyle tek ekranda birleştirmek.</p><button>Model metodolojisi →</button></div></section>
          </>}
        <footer><span>HorseRide Intelligence v0.1</span><span>Veri kaynağı: {activeView === 'history' ? 'yerel analiz arşivi' : dataState.source === 'live' ? 'otomatik TJK çekimi' : 'canlı veri bekleniyor'} · Sorumlu oyun</span></footer>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
