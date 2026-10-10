import { Capacitor } from '@capacitor/core'
import {normalizeServerAddress,serverAddressKey} from './serverAddress'
import {createDailyAnalysisCache,analysisCacheSignature} from './dailyAnalysisCache.js'
let analysisStorage
try{analysisStorage=globalThis.localStorage}catch{}
const dailyCache=createDailyAnalysisCache({storage:analysisStorage})
export function getCachedDailyAnalysis(city,date,program){return dailyCache.get(currentApiUrl(),city,date,analysisCacheSignature(program,city))}

const apiUrl = import.meta.env.VITE_RACE_API_URL || '/api/races'
const nativeApiUrl = 'http://10.0.2.2:8788/api/races'
const resolvedApiUrl = import.meta.env.VITE_RACE_API_URL || (Capacitor.isNativePlatform() ? nativeApiUrl : apiUrl)
function currentApiUrl(){if(Capacitor.isNativePlatform())return resolvedApiUrl;try{return localStorage.getItem(serverAddressKey)||resolvedApiUrl}catch{return resolvedApiUrl}}
export function getServerAddress(){return new URL(currentApiUrl(),window.location.origin).origin}
export async function connectServerAddress(address){
  const normalized=normalizeServerAddress(address),url=new URL(normalized);url.pathname='/api/health'
  const response=await fetch(url,{signal:AbortSignal.timeout(8000)})
  const data=await response.json()
  if(!response.ok||data.service!=='horseride-data'||!data.ok)throw Error('Bu adreste Ganyan Zekası servisi yanıt vermedi.')
  localStorage.setItem(serverAddressKey,normalized)
  return data
}
const pendingPrograms = new Map()
const programCacheKey = (city, date) => `ganyan-program-v2:${currentApiUrl()}:${date}:${city}`

export function getCachedRaceProgram(city, date) {
  try {
    const cached = JSON.parse(localStorage.getItem(programCacheKey(city, date)))
    if (!cached || Date.now() - cached.savedAt > 24 * 60 * 60_000 || !cached.result?.races?.length) return null
    return { ...cached.result, source: 'cached', message: 'Kaydedilmiş program gösteriliyor; güncel veriler kontrol ediliyor.' }
  } catch { return null }
}

function buildApiUrl(pathname) {
  const url = new URL(currentApiUrl(), window.location.origin)
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
        ? race.rankingEvidence
          ? 'At ve jokey geçmişi; rakip, mesafe ve pist uyumu; tarihli idmanlar ve resmî hava/pist verileri birlikte değerlendirildi. Eksik veriler ayrıca belirtilir.'
          : usesWalkForwardModel
          ? 'Geçmiş at ve jokey sonuçları; form, derece, kilo, dinlenme ve start verileriyle birlikte değerlendirildi. Ayrıntılı gerekçe için AI analizini açın.'
          : 'Form, derece, kilo, dinlenme ve start verilerine göre öne çıkıyor. Ayrıntılı gerekçe için AI analizini açın.'
        : 'Koşu için yeterli veri bulunamadı.',
    }
  })
}

export async function loadRaceProgram(city = 'Tümü', date = null) {
  const key = programCacheKey(city, date)
  if (!pendingPrograms.has(key)) pendingPrograms.set(key, fetchRaceProgram(city, date).finally(() => pendingPrograms.delete(key)))
  return pendingPrograms.get(key)
}

async function fetchRaceProgram(city, date) {
  try {
    const url = buildApiUrl('/api/races')
    url.searchParams.set('city', city)
    if (date) url.searchParams.set('date', date)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)
    let payload
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`Yarış servisi ${response.status} döndürdü.`)
      payload = await response.json()
    } finally { clearTimeout(timeout) }
    if(payload.source==='preparing'){const cached=getCachedRaceProgram(city,date);return cached||{races:[],city,source:'loading',providerSource:'preparing',providerUrls:[],failures:[],meetings:[],message:'Program hazırlanıyor; bağlantı otomatik yenileniyor.'}}
    if (!Array.isArray(payload.races)) throw new Error('Yarış servisi beklenen formatta veri döndürmedi.')

    const warning = Array.isArray(payload.failures) && payload.failures.length
      ? ` Bazı merkezler şu an yanıt vermiyor: ${payload.failures.slice(0, 3).map((item) => item.city).join(', ')}.`
      : ''
    const cachedMessage = payload.source === 'program_snapshot'
      ? (payload.refreshing ? 'Son alınan gerçek program gösteriliyor; güncelleme arka planda sürüyor.' : 'Yarış programı hazır.')
      : payload.source === 'sqlite_cache'
      ? `TJK geçici olarak yanıt vermedi; ${date || 'seçili gün'} için kaydedilmiş gerçek program gösteriliyor.`
      : String(payload.model || '').startsWith('walk-forward-')
        ? `TJK programı otomatik alındı.${warning} Walk-forward modeli, önceki yarışlardan at/jokey formunu kullanıyor; eğitim örneği: ${payload.modelTrainingRaces || 0}.`
        : `TJK programı otomatik alındı.${warning} Başlangıç modeli aktif; walk-forward modeli için yeterli geçmiş eğitim verisi bekleniyor.`
    const result = {
      races: normalizeLiveRaces(payload),
      fetchedAt:payload.fetchedAt,
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
    for(const analysis of payload.dailyAnalyses||[])dailyCache.save(currentApiUrl(),analysis.city,payload.date,analysisCacheSignature(result.races,analysis.city),analysis)
    if (result.races.length) {
      try { localStorage.setItem(programCacheKey(city, date), JSON.stringify({ savedAt: Date.now(), result })) } catch { /* Storage may be unavailable. */ }
    }
    return result
  } catch (error) {
    const cached = getCachedRaceProgram(city, date)
    if (cached) return { ...cached, source: 'cached', message: `Canlı bağlantı kurulamadı; kaydedilmiş program gösteriliyor: ${error.message}` }
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

async function analysisRequest(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || `AI analiz servisi ${response.status} döndürdü.`)
    return { response, payload }
  } finally { clearTimeout(timer) }
}

export async function loadCachedDailyAnalysis(city, date, {program=[]}={}) {
  const cached=getCachedDailyAnalysis(city,date,program)
  if(cached)return cached
  const url = buildApiUrl('/api/analysis/daily')
  url.search = new URLSearchParams({ city, date }).toString()
  const { payload } = await analysisRequest(url)
  if(payload.analysis?.races){dailyCache.save(currentApiUrl(),city,date,analysisCacheSignature(program,city),payload);return payload}
  return null
}

const pendingAnalyses = new Map()
const preparationPlans=new Map()
export function prepareProgramAnalyses(program,date,{priorityCity,shouldContinue=()=>true}={}){
  const cities=[...new Set(program.map(r=>r.city).filter(Boolean))].sort((a,b)=>Number(b===priorityCity)-Number(a===priorityCity))
  const key=`${currentApiUrl()}:${date}:${cities.map(city=>analysisCacheSignature(program,city)).join('|')}`
  if(preparationPlans.has(key))return preparationPlans.get(key)
  const task=(async()=>{
    for(const city of cities){
      if(!shouldContinue())break
      try{
        if(getCachedDailyAnalysis(city,date,program))continue
        const cached=await loadCachedDailyAnalysis(city,date,{program})
        if(!shouldContinue())break
        if(!cached)await runDailyAnalysis(city,date,{program,raceNo:program.find(r=>r.city===city)?.no})
      }catch{ /* One unavailable meeting must not block the other preparations. */ }
    }
  })()
  preparationPlans.set(key,task)
  while(preparationPlans.size>5)preparationPlans.delete(preparationPlans.keys().next().value)
  return task
}
export function isDailyAnalysisPending(city,date){return pendingAnalyses.has(programCacheKey(city,date))}
export async function runDailyAnalysis(city, date, { onProgress = () => {}, raceNo,program=[] } = {}) {
  const signature=analysisCacheSignature(program,city),cached=getCachedDailyAnalysis(city,date,program)
  if(cached)return cached
  const key = programCacheKey(city, date)
  let pending = pendingAnalyses.get(key)
  if (!pending) {
    pending = { listeners: new Set(), progress: null }
    const report = progress => {
      pending.progress = progress
      for (const listener of pending.listeners) listener(progress)
    }
    pending.promise = fetchDailyAnalysis(city, date, raceNo, report).then(result=>{dailyCache.save(currentApiUrl(),city,date,signature,result);return result}).finally(() => pendingAnalyses.delete(key))
    pendingAnalyses.set(key, pending)
  }
  pending.listeners.add(onProgress)
  if (pending.progress) onProgress(pending.progress)
  try { return await pending.promise } finally { pending.listeners.delete(onProgress) }
}

async function fetchDailyAnalysis(city, date, raceNo, onProgress) {
  const url = buildApiUrl('/api/analysis/daily')
  const { response, payload } = await analysisRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city, date, raceNo, async: true }),
  })
  if (response.status === 202 && payload.job?.id) {
    let job = payload.job
    const deadline = Date.now() + 4 * 60_000
    while (job.status === 'running') {
      onProgress(job.progress)
      if (Date.now() > deadline) throw new Error('Analiz sunucuda sürüyor; biraz sonra tekrar kontrol edin.')
      await new Promise(resolve => setTimeout(resolve, 1500))
      const { payload: statusPayload } = await analysisRequest(buildApiUrl(`/api/analysis/jobs/${encodeURIComponent(job.id)}`))
      if (!statusPayload.job) throw new Error('Analiz durumu alınamadı. Tekrar deneyebilirsiniz.')
      job = statusPayload.job
    }
    if (job.status === 'error') throw new Error(job.error || 'Analiz tamamlanamadı.')
    if (!job.result?.analysis?.races) throw new Error('Analiz sonucu alınamadı.')
    return job.result
  }
  if (!payload.analysis || !Array.isArray(payload.analysis.races)) throw new Error('AI analiz servisi beklenen formatta veri döndürmedi.')
  return payload
}

export async function loadPublicCommentary(city, date) {
  const url = buildApiUrl('/api/commentary')
  url.searchParams.set('city', city)
  url.searchParams.set('date', date)
  const response = await fetch(url)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Yorum servisi ${response.status} döndürdü.`)
  if (!Array.isArray(payload.comments)) throw new Error('Yorum servisi beklenen formatta veri döndürmedi.')
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
