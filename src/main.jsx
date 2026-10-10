import { StrictMode, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { loadHorseHistory, loadPerformance, loadPerformanceJob, loadProgramMeetings, loadPublicCommentary, loadRaceDebug, loadRaceProgram, loadRecentAnalyses, runDailyAnalysis, startPerformanceBacktest } from './data/raceData'
import { buildBudgetTicket, budgetBetTypes, getBudgetUnitPrice } from './data/ticketData'
import './styles.css'
import { orderAnalysisHorses, findRacePrediction } from './data/analysisView'
import {validSurprise} from './data/surprisePolicy.js'
import { getCachedRaceProgram, loadCachedDailyAnalysis, getCachedDailyAnalysis, isDailyAnalysisPending,prepareProgramAnalyses } from './data/raceData'
import {analysisCacheSignature} from './data/dailyAnalysisCache.js'
import { orderMeetings } from './data/meetingOrder'

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

function HorseMark() {
  return <img className="racing-brand-image" src="/brand/ganyan-icon.png" alt="" />
}

function TicketLab({ races, predictions, selectedRace, analysisStatus, commentary, commentaryStatus, commentaryError, onRequestAnalysis }) {
  const [budgetInput, setBudgetInput] = useState('20')
  const [selectedMarketId, setSelectedMarketId] = useState('6li-ganyan')
  const budget = normalizeBudget(budgetInput)
  const ticket = useMemo(() => buildBudgetTicket(races, predictions, selectedRace, selectedMarketId, budget, commentaryStatus === 'ready' ? commentary : null), [races, predictions, selectedRace, selectedMarketId, budget, commentary, commentaryStatus])
  const selectedMarket = budgetBetTypes.find((market) => market.id === selectedMarketId)
  const ticketRaceNumbers = new Set(ticket.coupons?.find((coupon) => coupon.source === 'commentary')?.legs.map((leg) => Number(leg.raceNo)) || [])
  const evidenceComments = (commentary?.comments || []).filter((comment) => ticketRaceNumbers.has(Number(comment.raceNo)))

  return (
    <section className="ticket-market-panel" id="selected-ticket-lab">
      <div className="ticket-market-heading">
        <div>
          <p className="eyebrow">BÜTÇEYE GÖRE KUPON</p>
          <h2>{selectedRace.city} · {selectedRace.no}. koşu</h2>
        </div>
        <span>{analysisStatus === 'ready' ? 'AI analizi hazır' : analysisStatus === 'loading' ? 'AI analiz ediyor' : ticket.coupons?.some((coupon) => coupon.source === 'commentary') ? 'Yorum kuponu hazır · AI bekleniyor' : 'AI analizi gerekli'}</span>
      </div>
      <div className="budget-ticket-controls">
        <label><span>BÜTÇE</span><div className="budget-input-wrap"><input type="number" inputMode="numeric" min="20" max="12000" step="10" value={budgetInput} onChange={(event) => setBudgetInput(event.target.value)} onBlur={() => setBudgetInput(String(normalizeBudget(budgetInput)))} /><small>TL · 20’den başlayan 10 TL adımları</small></div></label>
        <label><span>BAHİS TÜRÜ</span><select value={selectedMarketId} onChange={(event) => setSelectedMarketId(event.target.value)}>{budgetBetTypes.map((market) => <option key={market.id} value={market.id}>{market.label} · {formatLira(getBudgetUnitPrice(market, selectedRace.city))} / kombinasyon</option>)}</select></label>
      </div>
      <div className="commentary-source-status">
        <span className={`source-indicator ${commentaryStatus === 'ready' && commentary?.comments?.length ? 'connected' : ''}`} />
        <span>{commentaryStatus === 'loading' ? 'At Yarışı editör yorumları getiriliyor' : commentaryStatus === 'error' ? 'Yorum kaynağına ulaşılamadı' : `${commentary?.comments?.length || 0} eşleşen editör yorumu`}</span>
        <a href={ticket.commentarySourceUrl} target="_blank" rel="noreferrer">atyarisi.com</a>
      </div>
      {!ticket.available
        ? <div className="ticket-market-empty"><strong>{ticket.reason}</strong><p>{analysisStatus !== 'ready' ? 'AI kuponu için günlük analiz, yorum kuponu için her ayakta numaralı editör sıralaması gerekir.' : `${selectedMarket?.label} için bütçeyi artır veya uygun sayıda ardışık koşu bulunan başka bir başlangıç koşusu seç.`}</p>{analysisStatus !== 'ready' && <button className="secondary-action" onClick={onRequestAnalysis} disabled={analysisStatus === 'loading'}>{analysisStatus === 'loading' ? 'Analiz ediliyor' : analysisStatus === 'error' ? 'AI analizini tekrar dene' : 'AI analizini al'}</button>}</div>
          : <>
            {analysisStatus !== 'ready' && !ticket.coupons.some(coupon=>coupon.source==='ai') && <div className="ticket-ai-pending"><span>{analysisStatus === 'error' ? 'AI analizi alınamadı.' : 'AI kuponu için günlük analiz gerekli.'}</span><button className="secondary-action" onClick={onRequestAnalysis} disabled={analysisStatus === 'loading'}>{analysisStatus === 'loading' ? 'Analiz ediliyor' : analysisStatus === 'error' ? 'Tekrar dene' : 'AI analizini al'}</button></div>}
            <div className="ticket-market-summary"><div><strong>{ticket.marketLabel} · {ticket.couponCount} alternatif</strong><small>{ticket.coupons[0]?.legs.map((leg) => `${leg.raceNo}. koşu`).join(' → ')}</small></div><b>Kupon başı en çok {formatLira(ticket.budget)}</b></div>
            <div className="ticket-budget-meta"><span>{ticket.couponCount} alternatif</span><span>Tek misli · birim {formatLira(ticket.unitPrice)}</span><span>Her kupon bütçe tavanı ≤ {formatLira(ticket.budget)}</span></div>
            <div className="ai-coupon-list">{ticket.coupons.map((coupon) => <article className="ai-coupon" key={`${ticket.marketId}-${coupon.number}`}>
              <header>
                <div><strong>Kupon {coupon.number} · {coupon.sourceLabel}</strong><span>{coupon.source === 'commentary' ? `Editör seçimi · ${coupon.authorCount} sıralama` : 'AI adaylarından oluşturuldu'}</span></div>
                <div><b>{formatLira(coupon.cost)}</b><small>{coupon.combinations.toLocaleString('tr-TR')} kombinasyon · tek misli</small></div>
              </header>
              <div className="coupon-slip-scroll"><div className="coupon-slip compact-slip" style={{ '--leg-count': coupon.legs.length }}>{coupon.legs.map((leg, index) => <section className="coupon-slip-leg" key={`${coupon.number}-${leg.raceNo}`}>
                <header><strong>{index + 1}. Ayak</strong><small>{leg.raceTime || '--:--'}</small></header>
                <div>{leg.horses.map((horse) => <div className="coupon-slip-runner" key={horse.number} title={horse.name}><b aria-label={`${horse.number} ${horse.name}${horse.isSurprise ? ', AI sürpriz adayı' : ''}`}>{horse.number}{horse.isSurprise && <span className="surprise-star" aria-hidden="true">★</span>}</b></div>)}</div>
              </section>)}</div></div>
              <details className="coupon-runner-names"><summary>At adları ve koşu detayları</summary>{coupon.legs.map((leg,index) => <div key={leg.raceNo}><strong>{index+1}. Ayak · {leg.raceNo}. koşu</strong><span>{leg.horses.map((horse) => `${horse.number}${horse.isSurprise ? ' ★' : ''} ${horse.name}`).join(' / ')}</span></div>)}</details>
              {coupon.legs.some((leg) => leg.horses.some((horse) => horse.isSurprise)) && <p className="coupon-star-note">★ AI’nın bu koşu için gerekçeli sürpriz adayı. Yıldız, kazanma garantisi veya piyasa oranı göstergesi değildir.</p>}
            </article>)}</div>
            {commentaryStatus === 'error' && <p className="ticket-market-disclaimer">{commentaryError}</p>}
            {commentaryStatus === 'ready' && ticket.commentaryUnavailableReason && <p className="ticket-market-disclaimer">Yorum kuponu oluşturulmadı: {ticket.commentaryUnavailableReason}</p>}
            {evidenceComments.length > 0 && <details className="commentary-evidence">
              <summary>Yorum dayanağını gör · {evidenceComments.length} koşu yorumu</summary>
              {evidenceComments.map((comment) => <article key={`${comment.raceNo}-${comment.editorId}`}>
                <strong>{comment.raceNo}. Koşu · {comment.author}</strong>
                <p>{comment.comment}</p>
                <small>Sıralama: {comment.horses.map((horse) => horse.number).join(' - ')}</small>
              </article>)}
            </details>}
            <p className="ticket-market-disclaimer">Üç AI seçeneği geçmiş sonuçlarla desteklenen aday sıralamasından oluşturulur. Editör kuponu atyarisi.com yorumlarını kullanır; yorum bulunmayan ayak doldurulmaz. ★ işareti AI analizindeki sürpriz adayı gösterir. Her kupon tek mislidir ve belirtilen bütçe sınırı kupon başına uygulanır.</p>
          </>}
    </section>
  )
}

function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [races, setRaces] = useState([])
  const [programMeetings, setProgramMeetings] = useState([])
  const meetingRequestVersion = useRef(0)
  const meetingsDate = useRef(null)
  const analysisRequestVersion = useRef(0)
  const [selectedCity, setSelectedCity] = useState(() => {
    const city = localStorage.getItem('ganyan-city') || 'Tümü'
    return city === 'Yurtdışı' ? 'Tümü' : city
  })
  const [selectedRace, setSelectedRace] = useState(0)
  const [selectedDayOffset, setSelectedDayOffset] = useState(0)
  const [selectedCoupon, setSelectedCoupon] = useState(0)
  const automaticAnalysisDates = useRef(new Set())
  const [selectedHorseIndex, setSelectedHorseIndex] = useState(0)
  const [dataState, setDataState] = useState({ city: 'Tümü', source: 'loading', providerSource: 'loading', model: '', modelTrainingRaces: 0, providerUrls: [], failures: [], message: 'Canlı TJK programı alınıyor.' })
  const [debugState, setDebugState] = useState({ status: 'idle', payload: null, error: '' })
  const [dailyAnalysisState, setDailyAnalysisState] = useState({ status: 'idle', payload: null, error: '' })
  const automaticAnalysisAttempts=useRef(new Set())
  const preparationDate=useRef(null)
  const [commentaryState, setCommentaryState] = useState({ status: 'idle', payload: null, error: '' })
  const [historyState, setHistoryState] = useState({ status: 'idle', name: '', entries: [], error: '' })
  const [archiveState, setArchiveState] = useState({ status: 'idle', analyses: [], error: '' })
  const [performanceState, setPerformanceState] = useState({ status: 'idle', performance: null, job: null, error: '' })
  const [selectedArchiveIndex, setSelectedArchiveIndex] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isRefreshingArchive, setIsRefreshingArchive] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('—')
  const race = races[selectedRace] || races[0] || emptyRace
  const rawDailyPrediction = dailyAnalysisState.payload?.analysis?.races?.find((item) => item.city === (race.city || dataState.city) && Number(item.raceNo) === Number(race.no)) || null
  const selectedDailyPrediction = useMemo(()=>rawDailyPrediction ? {...rawDailyPrediction,surprise:validSurprise(race,rawDailyPrediction)} : null,[race,rawDailyPrediction])
  const analysisProgressText = dailyAnalysisState.progress?.phase === 'analyzing'
    ? `${dailyAnalysisState.progress.completed}/${dailyAnalysisState.progress.total} koşu tamamlandı`
    : 'Analiz verileri hazırlanıyor'
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
    if (Array.isArray(race.horses) && race.horses.length) return orderAnalysisHorses(race.horses, selectedDailyPrediction)
    return buildFallbackHorses(race)
  }, [race, selectedDailyPrediction])
  const visibleFavorites = raceHorses.slice(0, 3)
  const activeHorse = raceHorses[selectedHorseIndex] || raceHorses[0] || null
  const recentHistory = historyState.entries.slice(0, 4)
  const averageHistoryProbability = recentHistory.length ? Math.round(recentHistory.reduce((sum, entry) => sum + (entry.probability || 0), 0) / recentHistory.length) : 0
  const displayedConfidence = Math.round(activeHorse?.probability || race.confidence || 0)
  const displayedNote = selectedDailyPrediction?.picks.find((pick) => pick.horseName === activeHorse?.name)?.reason || (race.rankingEvidence?.country ? 'Sıralama, bu ülkenin at/jokey geçmişi ve pist-mesafe verileriyle ayrı eğitilen modelden geliyor. Önceki yarışların erişilebilen resmî çizelgeleri de kullanılıyor; idman ve yarış öncesi hava verisi henüz yeterli değil.' : race.rankingEvidence ? 'Sıralama; at ve jokey geçmişi, rakip ve mesafe/pist uyumu, tarihli idmanlar ve mevcut hava/pist verileriyle eğitilen modelden geliyor. At bazındaki ayrıntılı gerekçe için günlük AI yorumunu alın.' : horseAnalysisNote(activeHorse, race.note))
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
  const commentaryCity = race.city || selectedCity
  preparationDate.current=selectedDay.apiDate
  const analysisContextKey=analysisCacheSignature(races,commentaryCity)
  const hasLiveRaces = races.length > 0
  const sortedMeetings = useMemo(() => orderMeetings(programMeetings, races), [programMeetings, races])
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

  async function refreshProgram(city = selectedCity, dayOffset = selectedDayOffset, {silent=false} = {}) {
    const safeCity = isEventLike(city) ? selectedCity : normalizeCityInput(city, selectedCity)
    const safeDayOffset = isEventLike(dayOffset) ? selectedDayOffset : normalizeDayOffset(dayOffset, selectedDayOffset)
    const nextDay = dayOptions.find((item) => item.offset === safeDayOffset) || dayOptions[1]
    const meetingRequestId = silent ? meetingRequestVersion.current : ++meetingRequestVersion.current
    setIsRefreshing(true)
    const cached = getCachedRaceProgram(safeCity, nextDay.apiDate)
    if(!silent){
    setRaces(cached?.races || [])
    setSelectedRace(0)
    setDataState(cached || { city: safeCity, source: 'loading', providerSource: 'loading', model: '', modelTrainingRaces: 0, providerUrls: [], failures: [], message: 'Canlı TJK programı alınıyor.' })
    setDebugState({ status: 'idle', payload: null, error: '' })
    setDailyAnalysisState({ status: 'idle', payload: null, error: '' })
    }
    if (meetingsDate.current !== nextDay.apiDate) {
      setProgramMeetings(cached?.meetings || [])
      meetingsDate.current = nextDay.apiDate
    }
    loadProgramMeetings(nextDay.apiDate)
      .then((meetings) => {
        if (meetingRequestId === meetingRequestVersion.current) setProgramMeetings(meetings)
      })
      .catch(() => {
        // Preserve the same day's known meetings when discovery is unavailable.
      })
    try {
      const result = await loadRaceProgram(safeCity, nextDay.apiDate)
      if (meetingRequestId !== meetingRequestVersion.current) return
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
      if(!silent){setSelectedRace(0);setSelectedCoupon(0)}
      setLastUpdated(new Date(result.fetchedAt||Date.now()).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }))
    } catch (error) {
      if (meetingRequestId !== meetingRequestVersion.current) return
      if (meetingRequestId === meetingRequestVersion.current) setProgramMeetings([])
      setDataState({ city: safeCity, source: 'error', providerSource: 'error', model: '', modelTrainingRaces: 0, providerUrls: [], failures: [], message: error.message })
      setDebugState({ status: 'error', payload: null, error: error.message })
    } finally {
      if (meetingRequestId === meetingRequestVersion.current) setIsRefreshing(false)
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

  async function requestDailyAnalysis(cityOverride, raceNoOverride = Number(race.no)) {
    const contextVersion = meetingRequestVersion.current
    const requestVersion = ++analysisRequestVersion.current
    const requestedCity = !isEventLike(cityOverride) && typeof cityOverride === 'string' && cityOverride.trim()
      ? cityOverride
      : race.city || selectedCity
    const ready=getCachedDailyAnalysis(requestedCity,selectedDay.apiDate,races)
    if(ready){setDailyAnalysisState({status:'ready',payload:ready,error:'',city:requestedCity});return}
    setDailyAnalysisState({ status: 'loading', payload: null, error: '',city:requestedCity })
    try {
      const result = await runDailyAnalysis(requestedCity, selectedDay.apiDate, {
        program:races,
        raceNo: raceNoOverride,
        onProgress: progress => {
          if (contextVersion === meetingRequestVersion.current && requestVersion === analysisRequestVersion.current) {
            setDailyAnalysisState(current => ({ ...current, progress, payload:progress?.analysis ? {analysis:progress.analysis} : current.payload }))
          }
        },
      })
      if (contextVersion !== meetingRequestVersion.current || requestVersion !== analysisRequestVersion.current) return
      setDailyAnalysisState({ status: 'ready', payload: result, error: '' })
    } catch (error) {
      if (contextVersion === meetingRequestVersion.current && requestVersion === analysisRequestVersion.current) setDailyAnalysisState(current=>({...current,status:'error',error:error.message}))
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
    localStorage.setItem('ganyan-city', city)
    window.setTimeout(() => refreshProgram(city, selectedDayOffset), 0)
  }

  function selectRace(index) {
    const selected = races[index]
    setSelectedRace(index)
    if (!selected || dataState.source !== 'live' || dailyAnalysisState.status === 'loading') return

    const city = selected.city || dataState.city
    const hasPrediction = dailyAnalysisState.payload?.analysis?.races?.some((item) => item.city === city && Number(item.raceNo) === Number(selected.no))
    if (!hasPrediction) requestDailyAnalysis(city, Number(selected.no))
  }

  useEffect(()=>{
    const reconnect=()=>{if(document.visibilityState==='visible')void refreshProgram(selectedCity,selectedDayOffset,{silent:true})}
    const timer=setInterval(reconnect,dataState.source==='unavailable'||dataState.source==='loading'?10000:60000)
    window.addEventListener('online',reconnect);document.addEventListener('visibilitychange',reconnect)
    return()=>{clearInterval(timer);window.removeEventListener('online',reconnect);document.removeEventListener('visibilitychange',reconnect)}
  },[selectedCity,selectedDayOffset,dataState.source])
  useEffect(() => { refreshProgram(selectedCity, selectedDayOffset) }, [])
  useEffect(()=>{
    if(dataState.source!=='live'||selectedDay.offset!==0||!races.length)return
    const date=selectedDay.apiDate
    void prepareProgramAnalyses(races,date,{priorityCity:commentaryCity,shouldContinue:()=>preparationDate.current===date})
  },[dataState.source,selectedDay.apiDate,analysisContextKey])
  useEffect(() => {
    if (dataState.source !== 'live' || !commentaryCity || !races.length) return
    if(dailyAnalysisState.status==='loading'&&dailyAnalysisState.city===commentaryCity)return
    const ready=getCachedDailyAnalysis(commentaryCity,selectedDay.apiDate,races)
    if(ready){setDailyAnalysisState({status:'ready',payload:ready,error:'',city:commentaryCity});return}
    const attemptKey=`${selectedDay.apiDate}:${commentaryCity}:${analysisContextKey}`
    if(automaticAnalysisAttempts.current.has(attemptKey)&&!isDailyAnalysisPending(commentaryCity,selectedDay.apiDate))return
    let cancelled = false
    const version = analysisRequestVersion.current
    const prepare=()=>{
      if(cancelled||version!==analysisRequestVersion.current)return
      automaticAnalysisAttempts.current.add(attemptKey)
      void requestDailyAnalysis(commentaryCity,Number(race.no))
    }
    loadCachedDailyAnalysis(commentaryCity, selectedDay.apiDate,{program:races}).then(payload => {
      if(cancelled||version!==analysisRequestVersion.current)return
      if(payload)setDailyAnalysisState({status:'ready',payload,error:'',city:commentaryCity})
      else prepare()
    }).catch(prepare)
    return () => { cancelled = true }
  }, [commentaryCity, selectedDay.apiDate, dataState.source, analysisContextKey])
  useEffect(() => {
    if (dataState.source !== 'live' || !commentaryCity || commentaryCity === 'Tümü') {
      setCommentaryState({ status: 'idle', payload: null, error: '' })
      return
    }

    let cancelled = false
    setCommentaryState({ status: 'loading', payload: null, error: '' })
    loadPublicCommentary(commentaryCity, selectedDay.apiDate)
      .then((payload) => { if (!cancelled) setCommentaryState({ status: 'ready', payload, error: '' }) })
      .catch((error) => { if (!cancelled) setCommentaryState({ status: 'error', payload: null, error: error.message }) })
    return () => { cancelled = true }
  }, [commentaryCity, selectedDay.apiDate, dataState.source])
  useEffect(() => { setSelectedHorseIndex(0) }, [selectedRace, races, selectedDailyPrediction])
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

    const analysisDate = `${selectedDay.apiDate}:${race.city || selectedCity}`
    if (automaticAnalysisDates.current.has(analysisDate)) return

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
    const nextRace = races
      .map((item) => ({ race: item, minutes: raceMinutes(item.time) }))
      .filter((item) => item.race.city === race.city && item.minutes !== null && item.minutes >= currentMinutes)
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
        <div className="brand"><span className="brand-mark animated-mark"><HorseMark /></span><span className="brand-wordmark">Ganyan<span>Zekası</span></span></div>
        <div className="workspace-label">ANALİZ MERKEZİ</div>
        <nav>
          <button className={activeView === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('dashboard')}><span>◈</span> Yarış panosu</button>
          <button className={activeView === 'dashboard' && hasLiveRaces ? 'nav-item active' : 'nav-item'} onClick={showCouponLab}><span>⌁</span> Bütçeli kupon</button>
          <button className={activeView === 'history' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('history')}><span>◷</span> Geçmiş analizler</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="model-status"><span className="status-dot" /><div><strong>{dataState.source === 'live' ? 'Program hazır' : 'Veri bekleniyor'}</strong><small>{lastUpdated} güncellendi</small></div></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark animated-mark"><HorseMark /></span><span className="brand-wordmark">Ganyan<span>Zekası</span></span></div>
          <div className="location"><span className="pin">⌖</span><div><small>{activeView === 'history' ? 'ARŞİV MODU' : 'AKTİF PROGRAM'}</small><strong>{activeView === 'history' ? 'Geçmiş analiz arşivi' : `${dataState.city} · ${selectedDay.longDate}`}</strong></div></div>
          <div className={`data-state ${activeView === 'history' ? 'live' : dataState.source}`}><span className="data-state-dot" /><div><strong>{activeView === 'history' ? 'Arşiv görünümü' : dataState.source === 'live' ? 'Canlı veri akıyor' : dataState.source === 'loading' ? 'Program yükleniyor' : 'Canlı veri bekleniyor'}</strong><small>{lastUpdated} güncellendi</small></div></div>
        </header>

        <section className="intro-row">
          <div><p className="eyebrow">{activeView === 'history' ? 'ARŞİV / YEREL VERİTABANI' : `YARIŞ GÜNÜ / ${selectedDay.label.toLocaleUpperCase('tr-TR')}`}</p><h1>{activeView === 'history' ? 'Geçmiş analizler' : 'Yarış zekası'}</h1><p className="subhead">{activeView === 'history' ? 'Kaydedilen yarışları, model favorilerini ve öne çıkan atları geriye dönük izle.' : 'Pistin dilini çöz, kararını veriye dayandır.'}</p></div>
          {activeView === 'history'
            ? <button className="refresh-button" onClick={() => { refreshArchive(); refreshPerformance() }} disabled={isRefreshingArchive}>{isRefreshingArchive ? '…' : '↻'} <span>{isRefreshingArchive ? 'Yükleniyor' : 'Arşivi yenile'}</span></button>
            : <button className="refresh-button" onClick={() => refreshProgram()} disabled={isRefreshing}>{isRefreshing ? '…' : '↻'} <span>{isRefreshing ? 'Yükleniyor' : 'Verileri yenile'}</span></button>}
        </section>

        {activeView !== 'history' && <div className="meeting-filter-row"><label className="city-picker"><span>TOPLANTI / ŞEHİR</span><select value={selectedCity} onChange={changeCity}><option value="Tümü">Tüm program</option>{sortedMeetings.map((meeting) => <option key={meeting.city} value={meeting.city}>{meeting.firstRaceTime ? `${meeting.firstRaceTime} · ` : ""}{meeting.city}</option>)}</select></label><label className="race-picker"><span>KOŞUYA GİT</span><select value={selectedRace} onChange={(event) => selectRace(Number(event.target.value))}>{races.map((item, index) => <option value={index} key={`${item.city || dataState.city}-${item.no}-${item.time}`}>{item.city ? `${item.city} · ` : ''}{item.no}. koşu · {item.time}</option>)}</select></label></div>}
        <div className="day-tabs">{activeView === 'history' ? <><button className="day-tab active">Arşiv<small>Kaydedilen koşular</small></button><button className="day-tab" onClick={() => setActiveView('dashboard')}>Pano<small>Canlı görünüme dön</small></button></> : dayOptions.map((day) => <button key={day.offset} className={selectedDayOffset === day.offset ? 'day-tab active' : 'day-tab'} onClick={() => { setSelectedDayOffset(day.offset); refreshProgram(selectedCity, day.offset) }}>{day.label}<small>{day.shortDate}</small></button>)}</div>
        {activeView === 'dashboard' && races.length > 0 && <div className="race-switcher" aria-label="Koşu seçimi">{races.filter((item) => item.city === race.city).map((item) => <button key={`${item.city}-${item.no}`} className={item.no === race.no ? 'active' : ''} onClick={() => selectRace(races.indexOf(item))}><strong>{item.no}. Koşu</strong><small>{item.time}</small></button>)}</div>}

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
                <div><span>Temel model · kazanan ilk aday</span><strong>{performance?.topOne.rate == null ? '—' : `%${performance.topOne.rate}`}</strong><small>{performance ? `${performance.topOne.hits}/${performance.topOne.races} koşu` : 'Sonuç bekleniyor'}</small></div>
                <div><span>Kazanan ilk 3 adayda</span><strong>{performance?.topThree.winnerCoverage == null ? '—' : `%${performance.topThree.winnerCoverage}`}</strong><small>Kazanan atın üç aday arasında bulunması</small></div>
                <div><span>Kapanış favorisi</span><strong>{performance?.closingFavorite.rate == null ? '—' : `%${performance.closingFavorite.rate}`}</strong><small>{performance ? `${performance.closingFavorite.hits}/${performance.closingFavorite.races} koşu` : 'TJK ganyan oranına göre'}</small></div>
                <div><span>Brier skoru</span><strong>{performance?.brierScore == null ? '—' : performance.brierScore.toFixed(3)}</strong><small>daha düşük daha iyi</small></div>
              </div>
              {performance?.walkForward?.races > 0 && <div className="walkforward-result"><div><strong>Geçmiş verilerle desteklenen sıralama</strong><small>Her test günü yalnız önceki 60 günle eğitildi · {performance.walkForward.races} test koşusu</small></div><b>%{performance.walkForward.topOne.rate ?? '—'} birincilik</b><b className={performance.walkForward.improvementVsBaseline >= 0 ? 'positive' : 'negative'}>{performance.walkForward.improvementVsBaseline > 0 ? '+' : ''}{performance.walkForward.improvementVsBaseline} puan / temel sıralama</b></div>}
              {performance && performance.walkForward?.races === 0 && <p className="performance-progress">Geçmiş verilerle kıyas için önceki dönemde en az 100 tamamlanmış eğitim koşusu gerekli.</p>}
              {performance?.prospective?.map(item=><div className="walkforward-result" key={item.key||item.source}><div><strong>{item.label||(item.source==='daily_ai'?'Günlük AI · yarış öncesi kayıt':'Sayısal model · yarış öncesi kayıt')}</strong><small>{item.recorded} kayıt · {item.evaluated} sonuçlanan koşu</small></div><b>{item.topOneRate==null?'Sonuç bekleniyor':`%${item.topOneRate} kazanan ilk aday`}</b><b>{item.topFourRate==null?'—':`%${item.topFourRate} kazanan ilk 4 adayda`}</b></div>)}
              {performance?.localRanking?.test&&<div className="walkforward-result"><div><strong>Öğrenen model · tarihsel karşılaştırma</strong><small>{performance.localRanking.test.from} – {performance.localRanking.test.through} · {performance.localRanking.test.candidate.races} koşu · eğitim dışında</small></div><b>%{performance.localRanking.test.candidate.topOne} kazanan ilk aday</b><b>%{performance.localRanking.test.candidate.winnerInTopThree} kazanan ilk 3 adayda</b><small>Aynı testte temel model: %{performance.localRanking.test.baseline.topOne} · fark: +{performance.localRanking.test.improvementPoints} puan. Canlı başarı oranı ayrıca ölçülür.</small>{performance.localRanking.inputs?.includes('workouts')&&<small>İdman ve hava eğitime dahil · Önceki sürüme göre {performance.localRanking.test.improvementVsPrevious > 0 ? '+' : ''}{performance.localRanking.test.improvementVsPrevious} puan. Bu dönem önceki sürümde de incelendi; yeni canlı doğrulama ayrıca yapılır.</small>}</div>}
              {performance?.localRanking?.deploymentStatus==='prospective_trial'&&<p className="performance-progress">İdman/hava destekli sürüm canlı denemede. Önceki sürüme göre birincilik isabetindeki küçük artış henüz istatistiksel olarak kesinleşmedi.</p>}
              {performance?.foreignRanking?.length>0&&<><h3>Yurtdışı · her ülke ayrı ölçülür</h3>{performance.foreignRanking.map(item=><div className="walkforward-result" key={item.country}><div><strong>{{US:'ABD',GB:'İngiltere',FR:'Fransa',ZA:'Güney Afrika'}[item.country]||item.country} · {item.enabled?'canlı deneme':'uygulamaya alınmadı'}</strong><small>{item.test.candidate.races} eğitim dışı koşu · {item.test.from} – {item.test.through}</small></div><b>%{item.test.candidate.topOne} kazanan ilk aday</b><b>%{item.test.candidate.winnerInTopThree} kazanan ilk 3 adayda</b><small>Temel modelin ilk aday isabeti: %{item.test.baseline.topOne} · İdman ve yarış öncesi hava kapsamı eksik. {item.test.candidate.races<300?'Test örneği küçük. ':''}Bu oranlar tarihsel testtir; canlı başarı ayrıca ölçülür.</small></div>)}</>}
              {performance?.foreignProspective?.map(item=><div className="walkforward-result" key={item.key}><div><strong>{item.label} · yarış öncesi kayıt</strong><small>{item.recorded} kayıt · {item.evaluated} sonuçlanan koşu</small></div><b>{item.topOneRate==null?'Sonuç bekleniyor':`%${item.topOneRate} kazanan ilk aday`}</b><b>{item.topFourRate==null?'—':`%${item.topFourRate} kazanan ilk 4 adayda`}</b></div>)}
              {performanceState.status === 'running' && <p className="performance-progress">{performanceState.job?.currentDate || 'Başlatılıyor'} · {performanceState.job?.processedDays || 0}/{performanceState.job?.days ||90} gün · {performanceState.job?.savedRaces ||0} eşleşen koşu</p>}
              {performanceState.error && <p className="performance-progress error">{performanceState.error}</p>}
              {performance && <div className="performance-footnote"><span>{performance.evaluatedRaces} doğrulanmış koşu · {performance.evaluatedRunners} at · {performance.sinceDate} – {performance.throughDate}</span><span>{performance.reliability === 'sample_sufficient' ? 'Örneklem yeterli' : 'Ön veri; 100 koşudan az'}</span></div>}
              {performance?.calibration?.length > 0 && <div className="calibration-list"><strong>Model liderinin tahmini / gerçekleşen birinciliği</strong>{performance.calibration.map((bin) => <div key={bin.range}><span>{bin.range}</span><span>{bin.count} seçim</span><b>%{bin.predicted} / %{bin.observed}</b></div>)}</div>}
              <p className="performance-disclaimer">Tarihsel test günlük AI yorumunun başarı oranı değildir. Yarış öncesi kaydedilen günlük AI tahminleri ayrıca ölçülür. Üstteki 90 günlük özet yerli hipodromları kapsar; yurtdışı ülke panelleri ayrı test dönemleriyle ölçülür. Yalnız tam eşleşen sonuçlar değerlendirilir. Kapanış favorisi kıyas ölçütüdür. Veri ayrıştırma değiştiğinde eski test yeni sürüme taşınmaz; yeni testle yeniden hesaplanır.</p>
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
                {selectedArchive && <><div className="analysis-hero archive-hero"><div className="horse-silhouette">♞</div><div><small>MODEL LİDERİ</small><h3>{selectedArchive.favorite || 'Belirlenemedi'}</h3><p>{selectedArchive.type || 'Yarış tipi yok'} · {selectedArchive.distance || 'Mesafe yok'} · {selectedArchive.surface || 'Pist yok'}</p></div><strong className="big-confidence">%{selectedArchive.confidence}<small>yarış içi<br />model payı</small></strong></div><div className="archive-meta-grid"><div><span>Tarih</span><strong>{selectedArchive.date}</strong></div><div><span>Hipodrom</span><strong>{selectedArchive.city}</strong></div><div><span>At sayısı</span><strong>{selectedArchive.horseCount}</strong></div></div><div className="field-card archive-field-card"><div className="field-card-head"><div><small>ÖNE ÇIKANLAR</small><h3>İlk 3 model adayı</h3></div><span>{selectedArchive.horses.length} at</span></div><div className="field-list">{selectedArchive.horses.map((horse) => <div className="field-row archive-static-row" key={horse.name}><div className="field-rank"><b>{horse.rank}</b><small>sıra</small></div><div className="field-main"><strong>{horse.name}</strong><small>{horse.jockey || 'Jokey bilgisi yok'} · {horse.lastSix || 'Form verisi yok'}</small></div><div className="field-meta"><span>Temel skor <b>%{Math.round((horse.independentScore || 0) * 100)}</b></span><span>Temel pay <b>%{Math.round(horse.probability || 0)}</b></span></div></div>)}</div></div></>}
              </section>
            </div>
          </>
          : <>
            <section className="stats-strip modern">
              <div><span>Toplam koşu</span><strong>{races.length}</strong><small>programda</small></div>
              <div><span>AI analizi</span><strong>{dailyAnalysisState.payload?.analysis?.races?.filter((item) => item.city === race.city).length || 0}<span className="muted">/{races.filter((item) => item.city === race.city).length}</span></strong><small>seçili hipodrom</small></div>
              <div><span>Ortalama göreli pay</span><strong className="green-text">{averageConfidence}%</strong><small>kalibre edilmemiş model skoru</small></div>
              <div className="track-note"><span>Günün en net koşusu</span><strong>{topRace ? `${topRace.city ? `${topRace.city} · ` : ''}${topRace.no}. koşu · ${topRace.favorite}` : 'Canlı program bekleniyor'}</strong><small>· İlk iki aday arasında %{strongestEdge} göreli puan farkı · {dataState.modelTrainingRaces ? `${dataState.modelTrainingRaces} geçmiş koşu ile desteklenen sıralama` : 'Temel yarış verileriyle oluşturulan sıralama'}</small></div>
            </section>

            <div className="content-grid">
              <div className="race-column"><section className="panel races-panel">
                <div className="panel-heading"><div><p className="eyebrow">PROGRAM</p><h2>{dataState.city} yarış akışı</h2></div><div className="panel-heading-meta"><span className="race-count">{String(Math.min(selectedRace + 1, Math.max(races.length, 1))).padStart(2, '0')} / {String(Math.max(races.length, 1)).padStart(2, '0')}</span><span className={`live-badge ${dataState.source}`}><i /> {dataState.source === 'live' ? 'CANLI AKIŞ' : dataState.source === 'loading' ? 'YÜKLENİYOR' : 'VERİ BEKLENİYOR'}</span></div></div>
                {debugState.payload?.requested && <div className="panel-inline-note">Filtre: {debugState.payload.requested.city} · CSV denenen merkezler: {(debugState.payload.requested.csvCities || []).join(', ')}</div>}
                {hasLiveRaces
                  ? <div className="race-list">{races.map((item, index) => <button key={`${item.city || dataState.city}-${item.no}-${item.time}`} onClick={() => selectRace(index)} className={selectedRace === index ? 'race-row selected' : 'race-row'}><span className="race-number">{String(item.no).padStart(2, '0')}</span><span className="race-time">{item.time}</span><span className="race-info"><strong>{item.type}</strong><small>{item.city ? `${item.city} · ` : ''}{item.distance} · {item.horseCount || item.favorites.length + 7} at</small></span><span className="race-favorite"><small>{findRacePrediction(dailyAnalysisState.payload?.analysis?.races, item) ? 'AI LİDERİ' : 'VERİ LİDERİ'}</small><strong>{orderAnalysisHorses(item.horses || [], findRacePrediction(dailyAnalysisState.payload?.analysis?.races, item))[0]?.name || item.favorite}</strong></span><span className="confidence"><b>{item.confidence}%</b><small>pay</small></span><span className="chevron">›</span></button>)}</div>
                  : <div className="empty-panel"><strong>Canlı program henüz alınamadı.</strong><p>{dataState.message} Uygulama artık mock veri göstermiyor; gerçek program gelince tüm koşular otomatik dolacak.</p><button className="secondary-action" onClick={() => refreshProgram()}>Tekrar dene</button></div>}
                <button className="all-races" onClick={showCouponLab}>Kupon laboratuvarına geç <span>→</span></button>
              </section>
              <section className="panel surprise-panel"><div className="panel-heading"><div><p className="eyebrow">SEÇİLİ KOŞU · {race.no}. KOŞU</p><h2>★ Sürpriz aday</h2></div></div>{selectedDailyPrediction?.surprise && raceHorses.some((horse) => horse.name === selectedDailyPrediction.surprise.horseName) ? <div className="surprise-body"><button className="surprise-horse" onClick={() => setSelectedHorseIndex(raceHorses.findIndex((horse) => horse.name === selectedDailyPrediction.surprise.horseName))}>{selectedDailyPrediction.surprise.horseName} <span>İncele →</span></button><p>{selectedDailyPrediction.surprise.reason}</p><small>AGF ve AI sıralamasında ilk iki adayın dışında. Kupona alınırsa ★ ile gösterilir.</small></div> : <div className="surprise-body"><p>{selectedDailyPrediction ? 'AGF favorileri dışında yeterli kanıtla desteklenen sürpriz aday bulunamadı. AGF verisi eksikse sürpriz etiketi verilmez.' : 'Sürpriz aday ve gerekçesi, günlük AI analizi tamamlandığında burada görünür.'}</p></div>}</section></div>

              <section className="panel analysis-panel">
                <div className="panel-heading"><div><p className="eyebrow">YAPAY ZEKA ANALİZİ</p><h2>{race.city ? `${race.city} · ` : ''}{race.no}. koşu detayı</h2></div><button className="secondary-action" onClick={() => requestDailyAnalysis(race.city || selectedCity)} disabled={dailyAnalysisState.status === 'loading' || dataState.source !== 'live'}>{dailyAnalysisState.status === 'loading' ? analysisProgressText : selectedDailyPrediction ? 'Günlük analiz hazır' : 'Günün AI tahminini al'}</button></div>
                {dailyAnalysisState.status === 'loading' && <p className="panel-inline-note" role="status">{analysisProgressText}. Bu sayfayı açık bırakabilirsiniz; hazır sonuçlar otomatik gösterilecek.</p>}
                {dailyAnalysisState.status === 'error' && <p className="debug-message error">{dailyAnalysisState.error}</p>}
                {selectedDailyPrediction && <>
                  <div className="panel-inline-note"><strong>Günlük analiz {dailyAnalysisState.payload.cached ? 'önbellekten getirildi' : 'oluşturuldu'}.</strong> {dailyAnalysisState.payload.analysis.summary}</div>
                  {selectedDailyPrediction && <section className="ai-rationale-panel">
                    <header className="ai-rationale-heading">
                      <div className="ai-rationale-avatar"><HorseMark /></div>
                      <div><small>MODELİN YARIŞ YORUMU</small><strong>İlk dört adayın sıralama nedeni</strong></div>
                      <span className={`ai-confidence-chip ${selectedDailyPrediction.confidence}`}>{selectedDailyPrediction.confidence === 'low' ? 'Düşük güven' : selectedDailyPrediction.confidence === 'medium' ? 'Orta güven' : 'Yüksek güven'}</span>
                    </header>
                    {selectedDailyPrediction.evidence && <div className="analysis-evidence"><strong>Analizde kullanılan veriler</strong><span>At geçmişi {selectedDailyPrediction.evidence.withHistory}/{selectedDailyPrediction.evidence.runners} · Mesafe ve pist {selectedDailyPrediction.evidence.withDistanceAndSurface}/{selectedDailyPrediction.evidence.runners} · Rakip alanı {selectedDailyPrediction.evidence.withRivalFields}/{selectedDailyPrediction.evidence.runners}</span><span>Jokey geçmişi {selectedDailyPrediction.evidence.withJockeyHistory}/{selectedDailyPrediction.evidence.runners} · İdman {selectedDailyPrediction.evidence.withWorkout}/{selectedDailyPrediction.evidence.runners}</span><span>Hava: {selectedDailyPrediction.evidence.weather || 'Doğrulanmış veri yok'}{selectedDailyPrediction.evidence.trackConditions?.length ? ` · ${selectedDailyPrediction.evidence.trackConditions.map((track) => `${track.surface}: ${track.condition}`).join(' / ')}` : ''}</span></div>}
                    <div className="ai-rationale-list">{selectedDailyPrediction.picks.slice(0, 4).map((pick, index) => <article className={index === 0 ? 'lead' : ''} key={pick.horseName}>
                      <span className="ai-rationale-rank">{String(index + 1).padStart(2, '0')}</span>
                      <div><div className="ai-rationale-name"><strong>{pick.horseName}</strong>{index === 0 && <em>Öne çıkan aday</em>}</div><p>{pick.reason}</p></div>
                    </article>)}</div>
                    {selectedDailyPrediction.risks.length > 0 && <div className="ai-risk-note"><strong>Belirsizlikler</strong><span>{selectedDailyPrediction.risks.join(' ')}</span></div>}
                    <small className="ai-rationale-footnote">Sıralama, sağlanan yarış öncesi veriler içindeki göreli model puanına dayanır; kalibre edilmiş kazanma olasılığı değildir.</small>
                  </section>}
                </>}
                {!hasLiveRaces && <div className="empty-analysis"><strong>Canlı veri gelmeden model çıktısı üretilmiyor.</strong><p>Hedefimiz günlük TJK programını geçmiş sonuçlar ve genişletilecek jokey/idman verileriyle birleştirip her koşu için ölçülmüş başarı oranı ve yarış içi göreli model payı sunmak. Şu an bağlantı tekrar denendiğinde veri otomatik gelecektir.</p></div>}
                {hasLiveRaces && <>
                <div className="analysis-hero"><div className="horse-silhouette"><HorseMark /></div><div><small>İNCELENEN AT</small><h3>{activeHorse?.name || race.favorite}</h3><p>{displayedNote}</p></div><strong className="big-confidence">{selectedDailyPrediction ? (activeHorse?.aiRank ? `#${activeHorse.aiRank}` : '—') : `${displayedConfidence}%`}<small>{selectedDailyPrediction ? 'AI sırası' : 'temel veri payı'}</small></strong></div>
                {!selectedDailyPrediction && <div className="probability"><div className="prob-head"><span>Yarış içi model payı</span><small>Göreli puan · gerçek başarı oranı değildir</small></div><div className="bar"><span style={{width: `${displayedConfidence}%`}} /></div><div className="prob-labels">{visibleFavorites.map((horse, index) => <span key={horse.name}><i className={`dot ${index === 0 ? 'green' : index === 1 ? 'orange' : 'gray'}`} /> {horse.name} <b>%{Math.round(horse.probability || 0)}</b></span>)}<span><i className="dot gray" /> Diğerleri <b>%{Math.max(0, 100 - visibleFavorites.reduce((total, horse) => total + Math.round(horse.probability || 0), 0))}</b></span></div></div>}
                <div className="horse-tags">{visibleFavorites.map((horse, i) => <button type="button" key={horse.name} onClick={() => setSelectedHorseIndex(i)} className={selectedHorseIndex === i ? 'horse-tag preferred' : 'horse-tag'}><b>{horse.rank || i + 1}</b>{horse.name}</button>)}</div>
                {race?.rankingEvidence?.workoutsUsed&&<div className="analysis-evidence"><strong>İdman ve hava destekli sıralama</strong><span>Son 90 günde idman kaydı: {race.rankingEvidence.workoutRunners}/{race.rankingEvidence.runners} at · Resmî hava ve pist verisi: {race.rankingEvidence.weatherAvailable?'mevcut':'eksik'}</span><span>Eksik bilgiler tahminle doldurulmaz. Başarı yarış sonuçlarıyla ayrıca izlenir.</span></div>}
                {race?.rankingEvidence?.country&&<div className="analysis-evidence"><strong>ABD verileriyle ayrı eğitilen sıralama · canlı deneme</strong><span>Önceki resmî yarış çizelgesi: {race.rankingEvidence.externalChartRunners}/{race.rankingEvidence.runners} at. {race.rankingEvidence.speedClassUsed&&<>Karşılaştırılabilir geçmiş hız verisi: {race.rankingEvidence.speedEvidenceRunners}/{race.rankingEvidence.runners} at. </>}Yakın tarihli idman: {race.rankingEvidence.workoutRunners||0}/{race.rankingEvidence.runners} at; sayısal modele katkısı henüz doğrulanmadı.</span><span>Tam kariyer ve hava kapsamı eksik. Tarihsel iyileşme canlı başarı garantisi değildir.</span></div>}
                {race?.weatherForecast&&<div className="analysis-evidence"><strong>Yarış saati için bölgesel hava tahmini</strong><span>{race.weatherForecast.temperatureC??'—'} °C · Yağış olasılığı %{race.weatherForecast.rainProbabilityPercent??'—'} · Rüzgâr {race.weatherForecast.windKmh??'—'} km/sa</span><span>Resmi pist durumu değildir. Analiz yorumu için kullanılır; sıralamaya katkısı henüz doğrulanmadı.</span></div>}
                {race?.paceCoverage?.withPastCallPositions>0&&<div className="analysis-evidence"><strong>Yarış içindeki konum geçmişi</strong><span>{race.paceCoverage.withPastCallPositions}/{race.paceCoverage.runners} at için resmi ara konum kayıtları bulundu. Önde gitme alışkanlığı, son bölümde yükselme ve rakiplerin temposu analiz yorumuna eklenir.</span><span>{race.paceCoverage.numericModelUsed?'Tempo verisi sayısal sıralamada da kullanılıyor.':'Yeni tempo modeli paralel ölçümde; ana sıralamaya henüz uygulanmıyor.'}</span></div>}
                {activeHorse?.factors && <div className="factor-grid"><div className="factor-heading"><span>Temel veri göstergeleri</span><small>AI sırasından bağımsız</small></div>{Object.entries(activeHorse.factors).map(([key, value]) => <div className="factor-row" key={key}><span>{factorLabels[key]}</span><div className="factor-track"><i style={{ width: `${value * 100}%` }} /></div><b>{Math.round(value * 100)}</b></div>)}</div>}
                <div className="field-card">
                  <div className="field-card-head">
                    <div>
                      <small>KOŞU SAHASI</small>
                      <h3>Tüm atlar ve skorları</h3>
                    </div>
                    <span>{raceHorses.length} at</span>
                  </div>
                  <div className="field-list">
                    {raceHorses.map((horse, index) => <button type="button" key={`${horse.name}-${index}`} onClick={() => setSelectedHorseIndex(index)} className={selectedHorseIndex === index ? 'field-row selected' : 'field-row'}><div className="field-rank"><b>{selectedDailyPrediction ? (horse.aiRank || '—') : (horse.rank || index + 1)}</b><small>{selectedDailyPrediction ? 'AI' : 'sıra'}</small></div><div className="field-main"><strong>{horse.name}</strong><small>{horse.jockey || 'Jokey bilgisi yok'} · {horse.lastSix || 'Form verisi yok'}</small></div><div className="field-meta"><span>Temel skor <b>%{Math.round((horse.independentScore || 0) * 100)}</b></span><span>Temel pay <b>%{Math.round(horse.probability || 0)}</b></span></div></button>)}
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
                </>}
              </section>
            </div>

            <TicketLab races={races} predictions={dailyAnalysisState.payload?.analysis?.races || []} selectedRace={race} analysisStatus={dailyAnalysisState.status === 'ready' && !selectedDailyPrediction ? 'idle' : dailyAnalysisState.status} commentary={commentaryState.payload} commentaryStatus={commentaryState.status} commentaryError={commentaryState.error} onRequestAnalysis={() => requestDailyAnalysis(race.city || selectedCity)} />

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
      <nav className="mobile-bottom-nav" aria-label="Ana menü">
        <button className={activeView === 'dashboard' ? 'active' : ''} onClick={() => { setActiveView('dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><span>◉</span>Yarışlar</button>
        <button onClick={showCouponLab}><span>▤</span>Kuponlar</button>
        <button className={activeView === 'history' ? 'active' : ''} onClick={() => { setActiveView('history'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><span>◷</span>Geçmiş</button>
      </nav>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
