import { StrictMode, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { loadHorseHistory, loadPerformance, loadPerformanceJob, loadProgramMeetings, loadRaceDebug, loadRaceProgram, loadRecentAnalyses, runDailyAnalysis, startPerformanceBacktest } from './data/raceData'
import { buildBudgetTicket, budgetBetTypes, getBudgetUnitPrice } from './data/ticketData'
import './styles.css'

const factorLabels = { form: 'Son form', time: 'Derece', weight: 'Kilo', recency: 'Dinlenme', gate: 'Start', horseWin: 'Atın kazanma geçmişi', horseTopThree: 'Atın ilk üç geçmişi', jockeyWin: 'Jokeyin kazanma geçmişi', jockeyTopThree: 'Jokeyin ilk üç geçmişi', surfaceWin: 'Pist yüzeyi geçmişi', surfaceTopThree: 'Pist yüzeyi ilk üç geçmişi', breedWin: 'At kategorisi geçmişi', breedTopThree: 'At kategorisi ilk üç geçmişi' }
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

function raceMinutes(time) {
  const match = String(time || '').match(/(\d{1,2})[.:](\d{2})/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
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

function normalizeBudget(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 20
  return Math.min(12_000, Math.max(20, Math.round(parsed / 10) * 10))
}

function formatLira(value) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(value)
}

function TicketLab({ races, predictions, selectedRace, analysisStatus, onRequestAnalysis }) {
  const [budgetInput, setBudgetInput] = useState('20')
  const [selectedMarketId, setSelectedMarketId] = useState('6li-ganyan')
  const budget = normalizeBudget(budgetInput)
  const ticket = useMemo(() => buildBudgetTicket(races, predictions, selectedRace, selectedMarketId, budget), [races, predictions, selectedRace, selectedMarketId, budget])
  const selectedMarket = budgetBetTypes.find((market) => market.id === selectedMarketId)

  return (
    <section className="ticket-market-panel" id="selected-ticket-lab">
      <div className="ticket-market-heading">
        <div>
          <p className="eyebrow">BÜTÇEYE GÖRE KUPON</p>
          <h2>{selectedRace.city} · {selectedRace.no}. koşu</h2>
        </div>
        <span>{analysisStatus === 'ready' ? 'AI analizi hazır' : analysisStatus === 'loading' ? 'AI analiz ediyor' : 'AI analizi gerekli'}</span>
      </div>
      <div className="budget-ticket-controls">
        <label><span>BÜTÇE</span><div className="budget-input-wrap"><input type="number" inputMode="numeric" min="20" max="12000" step="10" value={budgetInput} onChange={(event) => setBudgetInput(event.target.value)} onBlur={() => setBudgetInput(String(normalizeBudget(budgetInput)))} /><small>TL · 20’den başlayan 10 TL adımları</small></div></label>
        <label><span>BAHİS TÜRÜ</span><select value={selectedMarketId} onChange={(event) => setSelectedMarketId(event.target.value)}>{budgetBetTypes.map((market) => <option key={market.id} value={market.id}>{market.label} · {formatLira(getBudgetUnitPrice(market, selectedRace.city))} / kombinasyon</option>)}</select></label>
      </div>
      {analysisStatus !== 'ready'
        ? <div className="ticket-market-empty"><p>{analysisStatus === 'error' ? 'AI analizi alınamadı.' : 'Seçili koşunun idman, jokey ve geçmiş verilerine dayalı adayları gerekli.'}</p><button className="secondary-action" onClick={onRequestAnalysis} disabled={analysisStatus === 'loading'}>{analysisStatus === 'loading' ? 'Analiz ediliyor' : analysisStatus === 'error' ? 'Tekrar dene' : 'AI analizini al'}</button></div>
        : !ticket.available
          ? <div className="ticket-market-empty"><strong>{ticket.reason}</strong><p>{selectedMarket?.label} için bütçeyi artır veya uygun sayıda ardışık koşu bulunan başka bir başlangıç koşusu seç.</p></div>
          : <>
            <div className="ticket-market-summary"><div><strong>{ticket.marketLabel} · 2 alternatif</strong><small>{ticket.coupons[0]?.legs.map((leg) => `${leg.raceNo}. koşu`).join(' → ')}</small></div><b>Kupon başı en çok {formatLira(ticket.budget)}</b></div>
            <div className="ticket-budget-meta"><span>{ticket.couponCount} alternatif</span><span>Tek misli · birim {formatLira(ticket.unitPrice)}</span><span>Her kupon bütçe tavanı ≤ {formatLira(ticket.budget)}</span></div>
            <div className="ai-coupon-list">{ticket.coupons.map((coupon) => <article className="ai-coupon" key={`${ticket.marketId}-${coupon.number}`}><header><strong>Kupon {coupon.number}</strong><span>Tahmini ortak tutma payı</span><b>%{coupon.estimatedHitProbability.toLocaleString('tr-TR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</b><small>{formatLira(coupon.cost)} · {coupon.combinations.toLocaleString('tr-TR')} kombinasyon · misli yok</small></header><div className="coupon-slip-scroll"><div className="coupon-slip">{coupon.legs.map((leg, index) => <section className="coupon-slip-leg" key={`${coupon.number}-${leg.raceNo}`}><header><strong>{index + 1}. Ayak</strong><small>{leg.raceNo}. Koşu · {leg.raceTime || '--:--'}</small></header><div>{leg.horses.map((horse) => <div className="coupon-slip-runner" key={horse.number}><b>{horse.number}</b><span>{horse.name}</span></div>)}</div></section>)}</div></div></article>)}</div>
            <p className="ticket-market-disclaimer">İki kupon ayrı alternatiflerdir; her birinde misli 1’dir ve fiyat seçilen bütçeyi aşmaz. Tahmini ortak pay, AI/model aday ağırlıklarının ayaklar boyunca çarpımıdır; kalibre edilmiş kazanma olasılığı veya kazanç garantisi değildir.</p>
          </>}
    </section>
  )
}

function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [races, setRaces] = useState([])
  const [programMeetings, setProgramMeetings] = useState([])
  const meetingRequestVersion = useRef(0)
  const [selectedCity, setSelectedCity] = useState('Tümü')
  const [selectedRace, setSelectedRace] = useState(0)
  const [selectedDayOffset, setSelectedDayOffset] = useState(0)
  const [selectedCoupon, setSelectedCoupon] = useState(0)
  const automaticAnalysisDates = useRef(new Set())
  const [selectedHorseIndex, setSelectedHorseIndex] = useState(0)
  const [dataState, setDataState] = useState({ city: 'Tümü', source: 'loading', providerSource: 'loading', model: '', modelTrainingRaces: 0, providerUrls: [], failures: [], message: 'Canlı TJK programı alınıyor.' })
  const [debugState, setDebugState] = useState({ status: 'idle', payload: null, error: '' })
  const [dailyAnalysisState, setDailyAnalysisState] = useState({ status: 'idle', payload: null, error: '' })
  const [historyState, setHistoryState] = useState({ status: 'idle', name: '', entries: [], error: '' })
  const [archiveState, setArchiveState] = useState({ status: 'idle', analyses: [], error: '' })
  const [performanceState, setPerformanceState] = useState({ status: 'idle', performance: null, job: null, error: '' })
  const [selectedArchiveIndex, setSelectedArchiveIndex] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isRefreshingArchive, setIsRefreshingArchive] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('12:42')
  const race = races[selectedRace] || races[0] || emptyRace
  const selectedDailyPrediction = dailyAnalysisState.payload?.analysis?.races?.find((item) => item.city === (race.city || dataState.city) && Number(item.raceNo) === Number(race.no)) || null
  const generatedCoupons = (selectedDailyPrediction ? dailyAnalysisState.payload?.analysis?.coupons || [] : []).map((item) => {
    const averageFavoriteConfidence = item.legs.reduce((total, leg) => {
      const raceNo = Number(String(leg).match(/^\d+/)?.[0])
      const favorite = races.find((candidate) => candidate.city === item.city && Number(candidate.no) === raceNo)?.horses?.[0]
      return total + (favorite?.probability || 0)
    }, 0) / Math.max(1, item.legs.length)
    return { ...item, chance: Math.round(averageFavoriteConfidence) }
  })
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
  const performance = performanceState.performance
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
  const liveCities = useMemo(() => [...new Set(races.map((item) => item.city).filter(Boolean))], [races])
  const debugMeetings = debugState.payload?.official?.meetings?.filter((item) => item.included) || []
  const debugCsvAttempts = debugState.payload?.csv?.flatMap((entry) => entry.attempts || []) || []
  const debugLiveResult = debugState.payload?.liveResult || null

  function showCouponLab() {
    setActiveView('dashboard')
    window.setTimeout(() => {
      document.getElementById('selected-ticket-lab')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  async function refreshProgram(city = selectedCity, dayOffset = selectedDayOffset) {
    const safeCity = isEventLike(city) ? selectedCity : normalizeCityInput(city, selectedCity)
    const safeDayOffset = isEventLike(dayOffset) ? selectedDayOffset : normalizeDayOffset(dayOffset, selectedDayOffset)
    const nextDay = dayOptions.find((item) => item.offset === safeDayOffset) || dayOptions[1]
    const meetingRequestId = ++meetingRequestVersion.current
    setIsRefreshing(true)
    setDebugState({ status: 'idle', payload: null, error: '' })
    setDailyAnalysisState({ status: 'idle', payload: null, error: '' })
    setProgramMeetings([])
    loadProgramMeetings(nextDay.apiDate)
      .then((meetings) => {
        if (meetingRequestId === meetingRequestVersion.current) setProgramMeetings(meetings)
      })
      .catch(() => {
        if (meetingRequestId === meetingRequestVersion.current) setProgramMeetings([])
      })
    try {
      const result = await loadRaceProgram(safeCity, nextDay.apiDate)
      setRaces(result.races)
      if (result.meetings.length) setProgramMeetings(result.meetings)
      setDataState({
        city: normalizeCityInput(result.city, safeCity),
        source: result.source,
        providerSource: result.providerSource,
        model: result.model,
        modelTrainingRaces: result.modelTrainingRaces,
        providerUrls: result.providerUrls,
        failures: result.failures,
        message: result.message,
      })
      setSelectedRace(0)
      setSelectedCoupon(0)
      setLastUpdated(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }))
    } catch (error) {
      if (meetingRequestId === meetingRequestVersion.current) setProgramMeetings([])
      setDataState({ city: safeCity, source: 'error', providerSource: 'error', model: '', modelTrainingRaces: 0, providerUrls: [], failures: [], message: error.message })
      setDebugState({ status: 'error', payload: null, error: error.message })
    } finally {
      setIsRefreshing(false)
    }
  }

  async function refreshDiagnostics() {
    setDebugState({ status: 'loading', payload: null, error: '' })
    try {
      const diagnostics = await loadRaceDebug(selectedCity, selectedDay.apiDate)
      setDebugState({ status: 'ready', payload: diagnostics, error: '' })
    } catch (error) {
      setDebugState({ status: 'error', payload: null, error: error.message })
    }
  }

  async function requestDailyAnalysis(cityOverride) {
    const requestedCity = !isEventLike(cityOverride) && typeof cityOverride === 'string' && cityOverride.trim()
      ? cityOverride
      : race.city || selectedCity
    setDailyAnalysisState({ status: 'loading', payload: null, error: '' })
    try {
      const result = await runDailyAnalysis(requestedCity, selectedDay.apiDate)
      setDailyAnalysisState({ status: 'ready', payload: result, error: '' })
    } catch (error) {
      setDailyAnalysisState({ status: 'error', payload: null, error: error.message })
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

  async function refreshPerformance() {
    setPerformanceState((current) => ({ ...current, status: current.job?.status === 'running' ? 'running' : 'loading', error: '' }))
    try {
      const result = await loadPerformance(90)
      setPerformanceState((current) => ({ ...current, status: current.job?.status === 'running' ? 'running' : 'ready', performance: result, error: '' }))
    } catch (error) {
      setPerformanceState((current) => ({ ...current, status: 'error', error: error.message }))
    }
  }

  async function runPerformanceBacktest() {
    setPerformanceState((current) => ({ ...current, status: 'running', error: '' }))
    try {
      const job = await startPerformanceBacktest(90)
      setPerformanceState((current) => ({ ...current, status: job.status, job, error: '' }))
      const pollJob = async () => {
        try {
          const updatedJob = await loadPerformanceJob(job.id)
          setPerformanceState((current) => ({ ...current, status: updatedJob.status, job: updatedJob, error: '' }))
          if (updatedJob.status === 'running') window.setTimeout(pollJob, 1800)
          else await refreshPerformance()
        } catch (error) {
          setPerformanceState((current) => ({ ...current, status: 'error', error: error.message }))
        }
      }
      if (job.status === 'running') window.setTimeout(pollJob, 900)
      else await refreshPerformance()
    } catch (error) {
      setPerformanceState((current) => ({ ...current, status: 'error', error: error.message }))
    }
  }

  function changeCity(event) {
    const city = event.target.value
    setSelectedCity(city)
    window.setTimeout(() => refreshProgram(city, selectedDayOffset), 0)
  }

  function selectRace(index) {
    const selected = races[index]
    setSelectedRace(index)
    if (!selected || dataState.source !== 'live' || dailyAnalysisState.status === 'loading') return

    const city = selected.city || dataState.city
    const hasPrediction = dailyAnalysisState.payload?.analysis?.races?.some((item) => item.city === city && Number(item.raceNo) === Number(selected.no))
    if (!hasPrediction) requestDailyAnalysis(city)
  }

  useEffect(() => { refreshProgram(selectedCity, selectedDayOffset) }, [])
  useEffect(() => { setSelectedHorseIndex(0) }, [selectedRace, races])
  useEffect(() => {
    if (selectedCoupon >= generatedCoupons.length) setSelectedCoupon(0)
  }, [generatedCoupons.length, selectedCoupon])
  useEffect(() => {
    if (activeView === 'history' && archiveState.status === 'idle') refreshArchive()
    if (activeView === 'history' && performanceState.status === 'idle') refreshPerformance()
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
  useEffect(() => {
    if (selectedDayOffset !== 0 || dataState.source !== 'live' || !races.length || ['loading', 'ready'].includes(dailyAnalysisState.status)) return

    const analysisDate = selectedDay.apiDate
    if (automaticAnalysisDates.current.has(analysisDate)) return

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
    const nextRace = races
      .map((item) => ({ race: item, minutes: raceMinutes(item.time) }))
      .filter((item) => item.minutes !== null && item.minutes >= currentMinutes)
      .sort((left, right) => left.minutes - right.minutes)[0]
    if (!nextRace) return

    const runAnalysis = () => {
      if (automaticAnalysisDates.current.has(analysisDate)) return
      automaticAnalysisDates.current.add(analysisDate)
      requestDailyAnalysis(nextRace.race.city || selectedCity)
    }
    const delay = Math.max(0, (nextRace.minutes - currentMinutes - 60) * 60_000)
    if (delay === 0) {
      runAnalysis()
      return
    }

    const timer = window.setTimeout(runAnalysis, delay)
    return () => window.clearTimeout(timer)
  }, [races, selectedDay.apiDate, selectedDayOffset, selectedCity, dataState.source, dailyAnalysisState.status])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark animated-mark" aria-hidden="true">♞</span><span className="brand-wordmark">Ganyan<span>Zekası</span></span></div>
        <div className="workspace-label">ANALİZ MERKEZİ</div>
        <nav>
          <button className={activeView === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('dashboard')}><span>◈</span> Yarış panosu</button>
          <button className={activeView === 'dashboard' && hasLiveRaces ? 'nav-item active' : 'nav-item'} onClick={showCouponLab}><span>⌁</span> Bütçeli kupon</button>
          <button className={activeView === 'history' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('history')}><span>◷</span> Geçmiş analizler</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="model-status"><span className="status-dot" /><div><strong>Model hazır</strong><small>Son güncelleme 12:42</small></div></div>
          <button className="settings"><span>⚙</span> Ayarlar</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark animated-mark" aria-hidden="true">♞</span><span className="brand-wordmark">Ganyan<span>Zekası</span></span></div>
          <div className="location"><span className="pin">⌖</span><div><small>{activeView === 'history' ? 'ARŞİV MODU' : 'AKTİF PROGRAM'}</small><strong>{activeView === 'history' ? 'Geçmiş analiz arşivi' : `${dataState.city} · ${selectedDay.longDate}`}</strong></div></div>
          <div className={`data-state ${activeView === 'history' ? 'live' : dataState.source}`}><span className="data-state-dot" /><div><strong>{activeView === 'history' ? 'Arşiv görünümü' : dataState.source === 'live' ? 'Canlı veri akıyor' : dataState.source === 'loading' ? 'Program yükleniyor' : 'Canlı veri bekleniyor'}</strong><small>{lastUpdated} güncellendi</small></div></div>
          <div className="header-actions"><button className="icon-button" title="Bildirimler">♢<i /></button><button className="profile">CA</button></div>
        </header>

        <section className="intro-row">
          <div><p className="eyebrow">{activeView === 'history' ? 'ARŞİV / YEREL VERİTABANI' : `YARIŞ GÜNÜ / ${selectedDay.label.toLocaleUpperCase('tr-TR')}`}</p><h1>{activeView === 'history' ? 'Geçmiş analizler' : 'Yarış zekası'}</h1><p className="subhead">{activeView === 'history' ? 'Kaydedilen yarışları, model favorilerini ve öne çıkan atları geriye dönük izle.' : 'Veriyi oku, tempoyu gör, kuponunu bilinçle kur.'}</p></div>
          {activeView === 'history'
            ? <button className="refresh-button" onClick={() => refreshArchive()} disabled={isRefreshingArchive}>{isRefreshingArchive ? '…' : '↻'} <span>{isRefreshingArchive ? 'Yükleniyor' : 'Arşivi yenile'}</span></button>
            : <button className="refresh-button" onClick={() => refreshProgram()} disabled={isRefreshing}>{isRefreshing ? '…' : '↻'} <span>{isRefreshing ? 'Yükleniyor' : 'Verileri yenile'}</span></button>}
        </section>

        {activeView !== 'history' && <div className="meeting-filter-row"><label className="city-picker"><span>TOPLANTI / ŞEHİR</span><select value={selectedCity} onChange={changeCity}><option value="Tümü">Tüm program</option>{programMeetings.some((meeting) => !meeting.foreign) && <optgroup label="Yerli">{programMeetings.filter((meeting) => !meeting.foreign).map((meeting) => <option key={meeting.city} value={meeting.city}>{meeting.city}</option>)}</optgroup>}<optgroup label="Yurtdışı"><option value="Yurtdışı">Yurtdışı · tüm toplantılar</option>{programMeetings.filter((meeting) => meeting.foreign).map((meeting) => <option key={meeting.city} value={meeting.city}>{meeting.city}</option>)}</optgroup></select></label><label className="race-picker"><span>KOŞUYA GİT</span><select value={selectedRace} onChange={(event) => selectRace(Number(event.target.value))}>{races.map((item, index) => <option value={index} key={`${item.city || dataState.city}-${item.no}-${item.time}`}>{item.city ? `${item.city} · ` : ''}{item.no}. koşu · {item.time}</option>)}</select></label><span>{programMeetings.filter((meeting) => meeting.foreign).length} yabancı toplantı</span></div>}
        <div className="day-tabs">{activeView === 'history' ? <><button className="day-tab active">Arşiv<small>Kaydedilen koşular</small></button><button className="day-tab" onClick={() => setActiveView('dashboard')}>Pano<small>Canlı görünüme dön</small></button></> : dayOptions.map((day) => <button key={day.offset} className={selectedDayOffset === day.offset ? 'day-tab active' : 'day-tab'} onClick={() => { setSelectedDayOffset(day.offset); refreshProgram(selectedCity, day.offset) }}>{day.label}<small>{day.shortDate}</small></button>)}</div>

        {activeView === 'history'
          ? <>
            <section className="stats-strip">
              <div><span>Kayıtlı analiz</span><strong>{archiveState.analyses.length}</strong><small>koşu</small></div>
              <div><span>Hipodrom</span><strong>{archiveCities}</strong><small>benzersiz şehir</small></div>
              <div><span>Son favori model payı</span><strong className="green-text">%{selectedArchive?.confidence || 0}</strong><small>yarış içi göreli skor</small></div>
              <div className="track-note"><span>Arşiv notu</span><strong>{selectedArchive ? `${selectedArchive.date} · ${selectedArchive.city} ${selectedArchive.raceNo}. koşu` : 'Henüz kaydedilmiş analiz yok.'}</strong><small>· SQLite geçmişinden okunuyor</small></div>
            </section>

            <section className="panel performance-panel">
              <div className="panel-heading"><div><p className="eyebrow">YÜRÜYEN TARİHSEL TEST</p><h2>Son 90 gün performansı</h2></div><button className="secondary-action performance-run-button" onClick={runPerformanceBacktest} disabled={performanceState.status === 'running'}>{performanceState.status === 'running' ? `Taranıyor ${performanceState.job?.progress || 0}%` : 'TJK arşivini tara'}</button></div>
              <div className="performance-metrics">
                <div><span>Model birinciliği</span><strong>{performance?.topOne.rate == null ? '—' : `%${performance.topOne.rate}`}</strong><small>{performance ? `${performance.topOne.hits}/${performance.topOne.races} koşu` : 'Sonuç bekleniyor'}</small></div>
                <div><span>Model ilk 3 seçimi</span><strong>{performance?.topThree.precision == null ? '—' : `%${performance.topThree.precision}`}</strong><small>{performance ? `İlk 3 kapsama: %${performance.topThree.raceCoverage ?? 0}` : 'Sonuç bekleniyor'}</small></div>
                <div><span>Kapanış favorisi</span><strong>{performance?.closingFavorite.rate == null ? '—' : `%${performance.closingFavorite.rate}`}</strong><small>{performance ? `${performance.closingFavorite.hits}/${performance.closingFavorite.races} koşu` : 'TJK ganyan oranına göre'}</small></div>
                <div><span>Brier skoru</span><strong>{performance?.brierScore == null ? '—' : performance.brierScore.toFixed(3)}</strong><small>daha düşük daha iyi</small></div>
              </div>
              {performance?.walkForward?.races > 0 && <div className="walkforward-result"><div><strong>Walk-forward challenger</strong><small>Her test günü yalnız önceki 60 günle eğitildi · {performance.walkForward.races} test koşusu</small></div><b>%{performance.walkForward.topOne.rate ?? '—'} birincilik</b><b className={performance.walkForward.improvementVsBaseline >= 0 ? 'positive' : 'negative'}>{performance.walkForward.improvementVsBaseline > 0 ? '+' : ''}{performance.walkForward.improvementVsBaseline} puan / baseline</b></div>}
              {performance && performance.walkForward?.races === 0 && <p className="performance-progress">Walk-forward kıyası için önceki dönemde en az 100 tamamlanmış eğitim koşusu gerekli.</p>}
              {performanceState.status === 'running' && <p className="performance-progress">{performanceState.job?.currentDate || 'Başlatılıyor'} · {performanceState.job?.processedDays || 0}/{performanceState.job?.days || 90} gün · {performanceState.job?.savedRaces || 0} eşleşen koşu</p>}
              {performanceState.error && <p className="performance-progress error">{performanceState.error}</p>}
              {performance && <div className="performance-footnote"><span>{performance.evaluatedRaces} doğrulanmış koşu · {performance.evaluatedRunners} at · {performance.sinceDate} – {performance.throughDate}</span><span>{performance.reliability === 'sample_sufficient' ? 'Örneklem yeterli' : 'Ön veri; 100 koşudan az'}</span></div>}
              {performance?.calibration?.length > 0 && <div className="calibration-list"><strong>Model liderinin tahmini / gerçekleşen birinciliği</strong>{performance.calibration.map((bin) => <div key={bin.range}><span>{bin.range}</span><span>{bin.count} seçim</span><b>%{bin.predicted} / %{bin.observed}</b></div>)}</div>}
              <p className="performance-disclaimer">Şimdilik yalnız yerli hipodromlar ölçülür. TJK’nın yarış öncesi arşiv programı, resmi bitiriş sırası ve kapanış ganyanı kullanılır. Eksik at eşleşen koşular ölçüme alınmaz. Kapanış favorisi karşılaştırma ölçütüdür; geçmiş sonuçlar gelecek başarı garantisi vermez.</p>
            </section>

            <div className="archive-grid">
              <section className="panel archive-list-panel">
                <div className="panel-heading"><div><p className="eyebrow">ARŞİV LİSTESİ</p><h2>Son kaydedilen koşular</h2></div><span className="analysis-icon">⎘</span></div>
                {archiveState.status === 'loading' && <p className="archive-message">Arşiv verisi yükleniyor.</p>}
                {archiveState.status === 'error' && <p className="archive-message error">{archiveState.error}</p>}
                {archiveState.status === 'ready' && archiveState.analyses.length === 0 && <p className="archive-message">Henüz geçmiş analiz bulunmuyor. Canlı veri çekildikçe bu ekran dolacak.</p>}
                {archiveState.status === 'ready' && archiveState.analyses.length > 0 && <div className="archive-list">{archiveState.analyses.map((analysis, index) => <button type="button" key={analysis.id} onClick={() => setSelectedArchiveIndex(index)} className={selectedArchiveIndex === index ? 'archive-row selected' : 'archive-row'}><div><strong>{analysis.date}</strong><small>{analysis.city} · {analysis.raceNo}. koşu · {analysis.time || 'Saat yok'}</small></div><div><b>{analysis.favorite || 'Model lideri yok'}</b><small>%{analysis.confidence} göreli pay</small></div></button>)}</div>}
              </section>

              <section className="panel archive-detail-panel">
                <div className="panel-heading"><div><p className="eyebrow">ARŞİV DETAYI</p><h2>{selectedArchive ? `${selectedArchive.city} ${selectedArchive.raceNo}. koşu` : 'Kayıt seçin'}</h2></div><span className="analysis-icon">✦</span></div>
                {!selectedArchive && <p className="archive-message">Detay görmek için soldan bir kayıt seçin.</p>}
                {selectedArchive && <><div className="analysis-hero archive-hero"><div className="horse-silhouette">♞</div><div><small>MODEL LİDERİ</small><h3>{selectedArchive.favorite || 'Belirlenemedi'}</h3><p>{selectedArchive.type || 'Yarış tipi yok'} · {selectedArchive.distance || 'Mesafe yok'} · {selectedArchive.surface || 'Pist yok'}</p></div><strong className="big-confidence">%{selectedArchive.confidence}<small>yarış içi<br />model payı</small></strong></div><div className="archive-meta-grid"><div><span>Tarih</span><strong>{selectedArchive.date}</strong></div><div><span>Hipodrom</span><strong>{selectedArchive.city}</strong></div><div><span>At sayısı</span><strong>{selectedArchive.horseCount}</strong></div></div><div className="field-card archive-field-card"><div className="field-card-head"><div><small>ÖNE ÇIKANLAR</small><h3>İlk 3 model adayı</h3></div><span>{selectedArchive.horses.length} at</span></div><div className="field-list">{selectedArchive.horses.map((horse) => <div className="field-row archive-static-row" key={horse.name}><div className="field-rank"><b>{horse.rank}</b><small>sıra</small></div><div className="field-main"><strong>{horse.name}</strong><small>{horse.jockey || 'Jokey bilgisi yok'} · {horse.lastSix || 'Form verisi yok'}</small></div><div className="field-meta"><span>Skor <b>%{Math.round((horse.independentScore || 0) * 100)}</b></span><span>Göreli pay <b>%{Math.round(horse.probability || 0)}</b></span></div></div>)}</div></div></>}
              </section>
            </div>
          </>
          : <>
            <section className="stats-strip modern">
              <div><span>Toplam koşu</span><strong>{races.length}</strong><small>programda</small></div>
              <div><span>Analiz tamamlandı</span><strong>{analyzedCount}<span className="muted">/{Math.max(races.length, 1)}</span></strong><small>koşu</small></div>
              <div><span>Ortalama göreli pay</span><strong className="green-text">{averageConfidence}%</strong><small>kalibre edilmemiş model skoru</small></div>
              <div className="track-note"><span>Günün en net koşusu</span><strong>{topRace ? `${topRace.city ? `${topRace.city} · ` : ''}${topRace.no}. koşu · ${topRace.favorite}` : 'Canlı program bekleniyor'}</strong><small>· İlk iki at arasında %{strongestEdge} fark · Kaynak: {dataState.providerSource} · Model: {dataState.model || 'yükleniyor'}{dataState.modelTrainingRaces ? ` (${dataState.modelTrainingRaces} eğitim koşusu)` : ''}</small></div>
            </section>

            <div className="content-grid">
              <section className="panel races-panel">
                <div className="panel-heading"><div><p className="eyebrow">PROGRAM</p><h2>{dataState.city} yarış akışı</h2></div><div className="panel-heading-meta"><span className="race-count">{String(Math.min(selectedRace + 1, Math.max(races.length, 1))).padStart(2, '0')} / {String(Math.max(races.length, 1)).padStart(2, '0')}</span><span className={`live-badge ${dataState.source}`}><i /> {dataState.source === 'live' ? 'CANLI AKIŞ' : dataState.source === 'loading' ? 'YÜKLENİYOR' : 'VERİ BEKLENİYOR'}</span></div></div>
                {debugState.payload?.requested && <div className="panel-inline-note">Filtre: {debugState.payload.requested.city} · CSV denenen merkezler: {(debugState.payload.requested.csvCities || []).join(', ')}</div>}
                {hasLiveRaces
                  ? <div className="race-list">{races.map((item, index) => <button key={`${item.city || dataState.city}-${item.no}-${item.time}`} onClick={() => selectRace(index)} className={selectedRace === index ? 'race-row selected' : 'race-row'}><span className="race-number">{String(item.no).padStart(2, '0')}</span><span className="race-time">{item.time}</span><span className="race-info"><strong>{item.type}</strong><small>{item.city ? `${item.city} · ` : ''}{item.distance} · {item.horseCount || item.favorites.length + 7} at</small></span><span className="race-favorite"><small>MODEL LİDERİ</small><strong>{item.favorite}</strong></span><span className="confidence"><b>{item.confidence}%</b><small>pay</small></span><span className="chevron">›</span></button>)}</div>
                  : <div className="empty-panel"><strong>Canlı program henüz alınamadı.</strong><p>{dataState.message} Uygulama artık mock veri göstermiyor; gerçek program gelince tüm koşular otomatik dolacak.</p><button className="secondary-action" onClick={() => refreshProgram()}>Tekrar dene</button></div>}
                <button className="all-races" onClick={showCouponLab}>Kupon laboratuvarına geç <span>→</span></button>
              </section>

              <section className="panel analysis-panel">
                <div className="panel-heading"><div><p className="eyebrow">YAPAY ZEKA ANALİZİ</p><h2>{race.city ? `${race.city} · ` : ''}{race.no}. koşu detayı</h2></div><button className="secondary-action" onClick={() => requestDailyAnalysis(race.city || selectedCity)} disabled={dailyAnalysisState.status === 'loading' || dataState.source !== 'live'}>{dailyAnalysisState.status === 'loading' ? 'Gün analiz ediliyor' : selectedDailyPrediction ? 'Günlük analiz hazır' : 'Günün AI tahminini al'}</button></div>
                {dailyAnalysisState.status === 'error' && <p className="debug-message error">{dailyAnalysisState.error}</p>}
                {dailyAnalysisState.status === 'ready' && <>
                  <div className="panel-inline-note"><strong>Günlük analiz {dailyAnalysisState.payload.cached ? 'önbellekten getirildi' : 'oluşturuldu'}.</strong> {dailyAnalysisState.payload.analysis.summary}</div>
                  {selectedDailyPrediction && <div className="debug-list"><strong>AI adayları · {selectedDailyPrediction.confidence === 'low' ? 'düşük' : selectedDailyPrediction.confidence === 'medium' ? 'orta' : 'yüksek'} güven</strong>{selectedDailyPrediction.picks.map((pick) => <span key={pick.horseName}>{pick.horseName}: {pick.reason}</span>)}{selectedDailyPrediction.risks.map((risk, index) => <span key={`risk-${index}`}>Risk: {risk}</span>)}<small>Bu nitel değerlendirme kalibre edilmiş kazanma olasılığı değildir.</small></div>}
                </>}
                {!hasLiveRaces && <div className="empty-analysis"><strong>Canlı veri gelmeden model çıktısı üretilmiyor.</strong><p>Hedefimiz günlük TJK programını geçmiş sonuçlar ve genişletilecek jokey/idman verileriyle birleştirip her koşu için ölçülmüş başarı oranı ve yarış içi göreli model payı sunmak. Şu an bağlantı tekrar denendiğinde veri otomatik gelecektir.</p></div>}
                {hasLiveRaces && <>
                <div className="analysis-hero"><div className="horse-silhouette">♞</div><div><small>SEÇİLİ AT</small><h3>{activeHorse?.name || race.favorite}</h3><p>{displayedNote}</p></div><strong className="big-confidence">{displayedConfidence}%<small>göreli model<br />payı</small></strong></div>
                <div className="probability"><div className="prob-head"><span>Yarış içi model payı</span><small>Göreli puan · gerçek başarı oranı değildir</small></div><div className="bar"><span style={{width: `${displayedConfidence}%`}} /></div><div className="prob-labels">{visibleFavorites.map((horse, index) => <span key={horse.name}><i className={`dot ${index === 0 ? 'green' : index === 1 ? 'orange' : 'gray'}`} /> {horse.name} <b>%{Math.round(horse.probability || 0)}</b></span>)}<span><i className="dot gray" /> Diğerleri <b>%{Math.max(0, 100 - visibleFavorites.reduce((total, horse) => total + Math.round(horse.probability || 0), 0))}</b></span></div></div>
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
                    {raceHorses.map((horse, index) => <button type="button" key={`${horse.name}-${index}`} onClick={() => setSelectedHorseIndex(index)} className={selectedHorseIndex === index ? 'field-row selected' : 'field-row'}><div className="field-rank"><b>{horse.rank || index + 1}</b><small>sıra</small></div><div className="field-main"><strong>{horse.name}</strong><small>{horse.jockey || 'Jokey bilgisi yok'} · {horse.lastSix || 'Form verisi yok'}</small></div><div className="field-meta"><span>Skor <b>%{Math.round((horse.independentScore || 0) * 100)}</b></span><span>Göreli pay <b>%{Math.round(horse.probability || 0)}</b></span></div></button>)}
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

            <TicketLab races={races} predictions={dailyAnalysisState.payload?.analysis?.races || []} selectedRace={race} analysisStatus={dailyAnalysisState.status === 'ready' && !selectedDailyPrediction ? 'idle' : dailyAnalysisState.status} onRequestAnalysis={() => requestDailyAnalysis(race.city || selectedCity)} />

            <section className="panel live-debug-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">CANLI VERİ TEŞHİSİ</p>
                  <h2>Kaynak ve filtre özeti</h2>
                </div>
                <button className="secondary-action" onClick={refreshDiagnostics} disabled={debugState.status === 'loading'}>{debugState.status === 'loading' ? 'Kontrol ediliyor' : 'Kaynakları denetle'}</button>
              </div>
              <div className="debug-grid">
                <div className="debug-card">
                  <span>Aktif kaynak</span>
                  <strong>{dataState.providerSource}</strong>
                  <small>{dataState.providerUrls[0] || 'provider bilgisi yok'}</small>
                </div>
                <div className="debug-card">
                  <span>Gelen şehirler</span>
                  <strong>{liveCities.length}</strong>
                  <small>{liveCities.slice(0, 4).join(', ') || 'henüz şehir yok'}</small>
                </div>
                <div className="debug-card">
                  <span>Official eşleşme</span>
                  <strong>{debugState.status === 'ready' ? debugMeetings.length : '—'}</strong>
                  <small>{debugState.status === 'ready' ? (debugState.payload?.official?.ok ? 'meeting eşleşti' : 'official kaynak hata verdi') : 'Henüz sorgulanmadı'}</small>
                </div>
                <div className="debug-card">
                  <span>CSV deneme</span>
                  <strong>{debugState.status === 'ready' ? debugCsvAttempts.length : '—'}</strong>
                  <small>{debugState.status === 'ready' ? (dataState.failures.length ? `${dataState.failures.length} merkez sorunlu` : 'ek hata raporu yok') : 'Henüz sorgulanmadı'}</small>
                </div>
              </div>
              {dataState.failures.length > 0 && <div className="debug-list"><strong>Eksik / düşen merkezler</strong>{dataState.failures.map((item) => <span key={`${item.city}-${item.error}`}>{item.city}: {item.error}</span>)}</div>}
              {debugState.status === 'error' && <p className="debug-message error">{debugState.error}</p>}
              {debugState.status === 'ready' && debugState.payload && <>
                <div className="debug-list">
                  <strong>Official filtre sonucu</strong>
                  {(debugState.payload.official?.meetings || []).slice(0, 6).map((meeting) => <span key={`${meeting.location}-${meeting.date}-${meeting.hippodrome}`}>{meeting.included ? '✓' : '–'} {meeting.location || meeting.hippodrome} · {meeting.date} · {meeting.abroad ? 'yabancı' : 'yerli'}{meeting.reasons?.length ? ` · ${meeting.reasons.join(', ')}` : ''}</span>)}
                </div>
                <div className="debug-list">
                  <strong>CSV kaynak özeti</strong>
                  {debugCsvAttempts.slice(0, 6).map((attempt) => <span key={`${attempt.label}-${attempt.url}`}>{attempt.label}: {attempt.ok ? `${attempt.status} · ${attempt.parsedMeetingDate || 'tarih yok'} · ${attempt.firstVenue || 'venue yok'}` : attempt.error || 'başarısız'}</span>)}
                </div>
              </>}
            </section>

            <section className="coupon-section" id="coupon-lab"><div className="section-title"><div><p className="eyebrow">AKILLI KUPONLAR</p><h2>Canlı veriden üretilen kombinasyonlar</h2></div><p>Bugünkü analiz güvenlerine göre otomatik oluşturulmuş öneriler</p></div>{generatedCoupons.length > 0 ? <><div className="coupon-grid">{generatedCoupons.map((item, index) => <button key={item.name} onClick={() => setSelectedCoupon(index)} className={selectedCoupon === index ? 'coupon-card selected modern-coupon' : 'coupon-card modern-coupon'}><div className="coupon-top"><span className="coupon-tag">{item.tag}</span><span className="coupon-arrow">↗</span></div><h3>{item.name}</h3><p>{item.game} <span>·</span> {item.bankerCount} bankolu yapı</p><div className="coupon-bottom"><div><strong>{item.chance}%</strong><small>ortalama favori<br />güveni</small></div><span className="cost">{item.cost}</span></div></button>)}</div><div className="coupon-summary live-summary"><span className="summary-icon">✓</span><div><strong>{coupon?.name} seçildi</strong><small>{coupon?.game} · Tahmini güven %{coupon?.chance} · {coupon?.cost}</small></div><button onClick={showCouponLab}>Kuponu incele <span>→</span></button></div>{coupon && <div className="ticket-lab"><div className="ticket-lab-head"><strong>Kupon laboratuvarı</strong><small>Her ayak için modelin seçtiği atlar</small></div><div className="ticket-legs">{coupon.legs.map((leg) => <div className="ticket-leg" key={leg}><span>{leg.split(':')[0]}</span><strong>{leg.split(': ')[1]}</strong></div>)}</div></div>}</> : <div className="empty-panel coupon-empty"><strong>Kupon üretmek için canlı yarış programı gerekli.</strong><p>Gerçek veri geldiğinde sistem tüm koşular için olasılıkları hesaplayıp bankolu ve korunaklı kuponları otomatik çıkaracak.</p></div>}<div className="disclaimer"><span>ⓘ</span><p>{dataState.message} Bugünkü hedef, canlı TJK programını geçmiş yarışlar, jokey/idman/veri genişlemeleri ve model tahminleriyle tek ekranda birleştirmek.</p><button>Model metodolojisi →</button></div></section>
          </>}
        <footer><span>GanyanZekası · Yarış verisi analiz aracı</span><span>Veri kaynağı: {activeView === 'history' ? 'yerel analiz arşivi' : dataState.source === 'live' ? 'otomatik TJK çekimi' : 'canlı veri bekleniyor'} · Sorumlu oyun</span></footer>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
