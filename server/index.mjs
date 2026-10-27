import {publicRead} from './public-read-service.mjs'
import {retrySqliteBusy} from './sqlite-retry.mjs'
import {jockeyEvidence} from './jockey-evidence.mjs'
import {recordRankingInputs} from './ranking-input-journal.mjs'
import {streamingRankingHistories} from './streaming-ranking-history.mjs'
import {parseRacePrizes,restoreProgramPrizes} from './race-prizes.mjs'
import {parseMaternalColumn} from './program-maternal-lines.mjs'
import {recentLoadEvidence} from './recent-load-evidence.mjs'
import {readOfficialCharts} from './overseas-chart-input.mjs'
import {enrichRunnerPedigree} from './enrich-runner-pedigree.mjs'
import {buildWinnerOnlyTarget} from './winner-only-target.mjs'
import {selectHistoricalMeetings} from './historical-meeting-selection.mjs'
import {collectAustralianForm} from './collect-australian-form.mjs'
import {enrichAustralianRaces} from './australian-form.mjs'
import {compactAnalysisContext} from './analysis-context-compact.mjs'
import {recordCompletedNumericForecasts} from './completed-forecast-recording.mjs'
import {recordIntelligenceForecast} from './record-pinned-forecast.mjs'
import {historySnapshotKey,pedigreeHistoryDependency,loadHistorySnapshot,saveHistorySnapshot,historyIdentitySignature} from './history-snapshot-cache.mjs'
import {resetPedigreeRegistryCache} from './pedigree-registry.mjs'
import {officialUnplaced,resolvedRunnerResult} from './result-status.mjs'
import {readCouponShowcase} from './coupon-process.mjs'
import {attachHttpPerformance} from './http-performance.mjs'
import {attachOfficialMarketEvidence} from './official-market-evidence.mjs'
import {waitForAnalysisProgram} from './analysis-program-sync.mjs'
import {enrichCommentaryRace} from './commentary-evidence.mjs'
import {jsonTransfer} from './json-transfer.mjs'
import {analysisUsageLedger} from './analysis-usage.mjs'
import {requestAnalysis} from './analysis-provider.mjs'
import {analysisAccessStatus,assertAnalysisAccess,billingCodes} from './analysis-access.mjs'
import {localDay,shiftDay} from './maintenance-policy.mjs'
import {runAnalysisWorker} from './analysis-process.mjs'
import {analysisLog,analysisErrorCode} from './analysis-log.mjs'
import {localAnalysisEnabled,explanationModel,localAnalysisInput,localAnalysisLedger,localEvidenceAnalysis} from './local-analysis.mjs'
import {ensureLocalLlm} from './local-llm-service.mjs'
import {publicAnalysis,analysisError} from '../src/data/analysisLanguage.js'
import {sixLegOrdinals} from './six-leg-starts.mjs'
import {marketOrdinals} from '../src/data/officialMarkets.js'
import {getSocialCoupons} from './social-coupons.mjs'
import {applicationReport,dailyApplicationTicket,recordShownRecommendations} from './application-report-service.mjs'
import {remoteDeployment,forwardToHome} from './deployment-role.mjs'
import {analysisCacheSignature} from '../src/data/dailyAnalysisCache.js'
import {createAnalysisPrewarmer} from './analysis-prewarm.mjs'
import './runtime-env.mjs'
import { loadDailyShadowModel,loadPedigreeModel,loadOverseasShadowModel,loadIntelligenceShadowModel } from './ranking.mjs'
import { createProgramCache } from './program-cache.mjs'
import { createAnalysisJobs } from './analysis-jobs.mjs'
import {readServedProgram,refreshServedProgram,compactProgramRaces,publishProgram} from './served-program.mjs'
import {surpriseCandidates,validSurprise} from '../src/data/surprisePolicy.js'
import {waitForEnrichment} from './enrichment-wait.mjs'
import {analysisEntryFingerprint} from './analysis-entry-policy.mjs'
import {reusableDailyAnalysis,retainUnchangedDailyAnalysis,sameRankingModels,candidateSignature} from './daily-analysis-reuse.mjs'
import { orderMeetings } from '../src/data/meetingOrder.js'
import { createServer } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import {readFileSync,writeFileSync,unlinkSync,existsSync} from 'node:fs'
import {isProcessRunning} from './process-liveness.mjs'
import { URL } from 'node:url'
import { load as loadHtml } from 'cheerio'
import { TjkApi } from 'tjk-api'
import { clearWalkForwardEntries, databaseHealth, findDailyAiAnalysis, findFreshSourceSnapshot, findHorseHistory, findLatestWalkForwardModel, getProgramForAnalysis, listBacktestEntries, listRecentAnalyses, saveBacktestRace, saveDailyAiAnalysis, saveProgram, saveWalkForwardModel } from './database.mjs'
import { findHorseProfileTables, repairStoredWeights, saveForecastSnapshots, listForecastSnapshots, saveHistoricalRace, listHistoricalRaces } from './database.mjs'
import { schemaForRaces } from './analysis-schema.mjs'
import { findAnalysisBatch, saveAnalysisBatch } from './database.mjs'
import { parseWeight, parseRaceTime, horseIdentity, analysisFingerprint, programQuality } from './data-quality.mjs'
import { createRankingHistory, addRaceToHistory, addRankingDayToHistory, loadPerformanceShadowModel, loadNextShadowModel, loadRankingModel, loadForeignRankingModel, rankRaceLocally } from './ranking.mjs'
import { summarizeWorkoutHistory } from './workout-history.mjs'
import { saveHorseWorkouts } from './database.mjs'
import { historicalDataRevision,historicalRaceDates,iterateHistoricalDay } from './database.mjs'
import {summarizeForecasts} from './forecast-metrics.mjs'
import {foreignCoverage,racingCountry,scheduledMeetingDates} from './foreign-data.mjs'
import {matchEquibaseWorkouts} from './equibase-workouts.mjs'
import {collectEquibaseWorkouts} from './collect-equibase-workouts.mjs'
import {performanceFeatures,performanceFeatureNames} from './performance-features.mjs'
import {attachRaceForecasts} from './race-forecast.mjs'
import {currentHongKongEvidence,collectHongKongCurrentEvidence} from './hkjc-current-evidence.mjs'
import {collectHongKongTrackwork} from './collect-hkjc-trackwork.mjs'
import {horseIdentityV2,jockeyIdentityV2} from './racing-identity.mjs'
import {paceHistory,paceFeatures,paceFeatureNames} from './pace-features.mjs'
import {equibaseTracks} from './foreign-data.mjs'
function foreignWorkoutRecords(){try{return JSON.parse(readFileSync('data/external/equibase-workouts/records.json','utf8')).records}catch{return []}}

const port = Number(process.env.PORT || 8788)
const dailyAnalysisVersion = 12
const defaultCity = process.env.TJK_CITY || 'Tümü'
const walkForwardModelVersion = 'walk-forward-v0.4-valid-weight'
const domesticProgramCities = (process.env.TJK_CITIES || 'İstanbul,Ankara,İzmir,Bursa,Adana,Kocaeli,Antalya,Diyarbakır,Elazığ,Şanlıurfa').split(',').map((value) => value.trim()).filter(Boolean)
const foreignProgramCities = (process.env.TJK_FOREIGN_CITIES || '').split(',').map((value) => value.trim()).filter(Boolean)
const csvRequestTimeoutMs = Math.max(1_000, Number(process.env.TJK_CSV_TIMEOUT_MS) || 12_000)
const tjkApi = new TjkApi({ authKey: process.env.TJK_AUTH_KEY || '' })
const meetingPageUrlsByDate = new Map()
const meetingOptionsByDate = new Map()
const cachedMeetingDiscovery = createProgramCache({ ttlMs: 120_000 })
const cachedProgramSource = createProgramCache()
const dailyAnalysisRequests = new Map()
const analysisJobs = createAnalysisJobs()
const performanceJobs = new Map()
const workoutEnrichments=new Map()
let pendingProgramProfileTasks=[]
function ensureWorkouts(date,city){
  if(racingCountry(city)==='AU'){
    const key='AU:'+date+':'+city,existing=workoutEnrichments.get(key);if(existing&&Date.now()-existing.startedAt<6*3600000)return existing.promise
    const job={startedAt:Date.now(),promise:collectAustralianForm(date,city)};workoutEnrichments.set(key,job);return job.promise
  }
  if(racingCountry(city)==='HK'){
    const existing=workoutEnrichments.get('HK-current');if(existing&&Date.now()-existing.startedAt<6*3600000)return existing.promise
    const job={startedAt:Date.now(),promise:Promise.allSettled([collectHongKongCurrentEvidence(),collectHongKongTrackwork()])};workoutEnrichments.set('HK-current',job);return job.promise
  }
  const overseas=racingCountry(city)==='US'
  const key=overseas?'equibase-US':`${date}:${city}`,existing=workoutEnrichments.get(key)
  if(existing&&Date.now()-existing.startedAt<6*3600000)return existing.promise
  const job={startedAt:Date.now(),promise:overseas?collectEquibaseWorkouts().catch(error=>{
    console.error('Foreign workout refresh:',error.message)
    if(!foreignWorkoutRecords().length)throw error
    return {cached:true,refreshFailed:true}
  }):collectHorseWorkouts(date,city,1000)}
  workoutEnrichments.set(key,job)
  return job.promise
}
const baselineModelVersion = 'baseline-v0.2-valid-weight'
const weightRepair = repairStoredWeights()
if (weightRepair.repaired || weightRepair.markedMissing) console.log('Stored weight repair:', weightRepair)
let localHistoryCache=null
function locallyRankRaces(races,date){
  resetPedigreeRegistryCache()
  races=enrichRunnerPedigree(races,date)
  races=enrichAustralianRaces(scheduledMeetingDates(races,date),date)
  const bundles=new Map([['TR',loadRankingModel()],...[...new Set(races.map(r=>racingCountry(r.city)).filter(Boolean))].map(country=>[country,loadForeignRankingModel(country)])])
  const shadow=loadPerformanceShadowModel()
  const pedigreeShadow=loadPedigreeModel()
  const nextShadows=new Map([...new Set(races.map(r=>racingCountry(r.city)||'TR'))].map(country=>[country,loadNextShadowModel(country)]))
  const dailyShadows=new Map([...new Set(races.map(r=>racingCountry(r.city)||'TR'))].map(country=>[country,loadDailyShadowModel(country)]))
  const overseasShadows=new Map([...new Set(races.map(r=>racingCountry(r.city)).filter(Boolean))].map(country=>[country,loadOverseasShadowModel(country)]))
  const intelligenceShadows=new Map([...new Set(races.map(r=>racingCountry(r.city)||'TR'))].map(country=>[country,loadIntelligenceShadowModel(country)]))
  const breedShadows=['arabian','thoroughbred'].map(breed=>loadIntelligenceShadowModel('TR',breed)).filter(Boolean)
  const identitySignature=historyIdentitySignature([...bundles].map(([country,b])=>[country,b?.metadata.identityVersion||1]).concat([['TR-shadow',shadow?.metadata.identityVersion||1],['TR-pedigree',pedigreeShadow?.metadata.identityVersion||1],...[...nextShadows].map(([country,b])=>[`${country}-next`,b?.metadata.identityVersion||1]),...[...dailyShadows].map(([country,b])=>[`${country}-daily`,b?.metadata.identityVersion||1]),...[...overseasShadows].map(([country,b])=>[`${country}-overseas`,b?.metadata.identityVersion||1])]))
  const historyKey=(country,bundle)=>bundle?.metadata.identityVersion===2?`${country}:v2`:country
  const revision=historicalDataRevision(date)
  const dependencySignature=pedigreeHistoryDependency()
  resetPedigreeRegistryCache()
  const snapshotKey=historySnapshotKey({date,revision,identitySignature,dependencySignature})
  const externalWorkouts=foreignWorkoutRecords()
  if(!localHistoryCache||localHistoryCache.date!==date||localHistoryCache.revision!==revision||localHistoryCache.identitySignature!==identitySignature||localHistoryCache.snapshotKey!==snapshotKey){
    const historyStarted=Date.now(),cachedHistories=loadHistorySnapshot(snapshotKey)
    const histories=cachedHistories||new Map()
    if(!cachedHistories){
    const rebuilt=streamingRankingHistories({dates:historicalRaceDates(),readDay:iterateHistoricalDay,targetDate:date,versionsForCountry:country=>new Set([1,bundles.get(country)?.metadata.identityVersion||1,nextShadows.get(country)?.metadata.identityVersion||1,dailyShadows.get(country)?.metadata.identityVersion||1,overseasShadows.get(country)?.metadata.identityVersion||1,...(country==='TR'?[shadow?.metadata.identityVersion||1,pedigreeShadow?.metadata.identityVersion||1]:[])])})
    for(const [key,value]of rebuilt)histories.set(key,value)
    saveHistorySnapshot(snapshotKey,histories,{onEvent:details=>analysisLog('ranking_history_cache',{date,...details})})
    }
    analysisLog('ranking_history_ready',{date,cached:Boolean(cachedHistories),durationMs:Date.now()-historyStarted})
    localHistoryCache={date,revision,histories,identitySignature,snapshotKey}
  }
  const ranked=races.map(race=>rankRaceLocally({...race,horses:race.horses.map(horse=>{
    if(racingCountry(race.city)==='US'){
      const workouts=matchEquibaseWorkouts(externalWorkouts,horse,date)
      if(workouts.length)return {...horse,workouts}
    }
    if(horse.workouts)return horse
    const tables=findHorseProfileTables(horse.horseId||horse.sourceData?.tjk?.horseId,'tjk_horse_workouts')
    return tables?{...horse,workouts:summarizeWorkoutHistory(tables,horse.name,date)}:horse
  })},date,localHistoryCache.histories.get(historyKey(racingCountry(race.city)||'TR',bundles.get(racingCountry(race.city)||'TR')))||createRankingHistory({identityVersion:bundles.get(racingCountry(race.city)||'TR')?.metadata.identityVersion||1}),bundles.get(racingCountry(race.city)||'TR'),{onPrediction:input=>{try{recordRankingInputs(input)}catch(e){analysisLog('ranking_input_capture_failed',{error:e.message})}}}))
  for(const race of ranked){
    const vectors=performanceFeatures(race,date,(localHistoryCache.histories.get(historyKey(racingCountry(race.city)||'TR',bundles.get(racingCountry(race.city)||'TR')))||createRankingHistory()).performance)
    race.horses=race.horses.map((horse,i)=>({...horse,performanceEvidence:{...Object.fromEntries(performanceFeatureNames.map((name,j)=>[name,Number(vectors[i][j].toFixed(4))])),note:'Yalnız önceki yarışlar; aynı ülke/pist/yüzey/ırk/mesafe referansı. Eksik derece puana çevrilmez; bu resmi ticari hız figürü değildir.'}}))
  }
  let programPaces=null
  if(ranked.some(r=>racingCountry(r.city)==='US'))try{programPaces=paceHistory(readOfficialCharts(date).races)}catch{}
  for(const race of ranked.filter(r=>racingCountry(r.city)==='US'))if(programPaces){
    const values=paceFeatures(race,date,programPaces,equibaseTracks[race.city]?.name)
    race.horses=race.horses.map((horse,i)=>({...horse,paceEvidence:Object.fromEntries(paceFeatureNames.map((name,j)=>[name,Number(values[i][j].toFixed(4))]))}))
    race.paceCoverage={runners:race.horses.length,withPastCallPositions:values.filter(v=>v[0]>0).length,numericModelUsed:Boolean(bundles.get('US')?.metadata.inputs?.includes('verified_past_call_positions'))}
  }
  if(shadow)for(const race of ranked.filter(r=>!r.foreign&&!racingCountry(r.city))){
    const trial=rankRaceLocally(race,date,localHistoryCache.histories.get(historyKey('TR',shadow))||createRankingHistory(),shadow)
    if(trial.rankingMethod===shadow.metadata.method)saveForecastSnapshots({date,races:[trial],source:'shadow_performance',modelVersion:shadow.metadata.method,inputHash:analysisFingerprint([race])})
  }
  for(const race of ranked){const country=racingCountry(race.city)||'TR',bundle=nextShadows.get(country);if(!bundle)continue
    const trial=rankRaceLocally(race,date,localHistoryCache.histories.get(historyKey(country,bundle))||createRankingHistory({identityVersion:bundle.metadata.identityVersion||1}),bundle)
    if(trial.rankingMethod===bundle.metadata.method)saveForecastSnapshots({date,races:[trial],source:'shadow_data',modelVersion:bundle.metadata.method,inputHash:analysisFingerprint([race])})
  }
  for(const race of ranked){const country=racingCountry(race.city)||'TR',bundle=dailyShadows.get(country);if(!bundle)continue
    const trial=rankRaceLocally(race,date,localHistoryCache.histories.get(historyKey(country,bundle))||createRankingHistory({identityVersion:bundle.metadata.identityVersion||1}),bundle)
    if(trial.rankingMethod===bundle.metadata.method)saveForecastSnapshots({date,races:[trial],source:'shadow_daily',modelVersion:bundle.metadata.method,inputHash:analysisFingerprint([race])})
  }
  for(const race of ranked){
    const country=racingCountry(race.city),candidate=overseasShadows.get(country)
    if(!candidate)continue
    const trial=rankRaceLocally(race,date,localHistoryCache.histories.get(historyKey(country,candidate))||createRankingHistory({identityVersion:candidate.metadata.identityVersion||1}),candidate)
    if(trial.rankingMethod===candidate.metadata.method)saveForecastSnapshots({date,races:[trial],source:'shadow_overseas',modelVersion:candidate.metadata.method,inputHash:analysisFingerprint([race])})
  }
  for(const race of ranked){const country=racingCountry(race.city)||'TR',bundle=intelligenceShadows.get(country);if(!bundle)continue
    const trial=rankRaceLocally(race,date,localHistoryCache.histories.get(country)||createRankingHistory(),bundle)
    recordIntelligenceForecast({date,race,trial,bundle,save:saveForecastSnapshots,fingerprint:analysisFingerprint})
  }
  for(const bundle of breedShadows)for(const race of ranked.filter(r=>!racingCountry(r.city)&&!r.foreign)){
    const trial=rankRaceLocally(race,date,localHistoryCache.histories.get('TR')||createRankingHistory(),bundle)
    recordIntelligenceForecast({date,race,trial,bundle,save:saveForecastSnapshots,fingerprint:analysisFingerprint})
  }
  if(pedigreeShadow)for(const race of ranked.filter(r=>!r.foreign&&!racingCountry(r.city))){
    const trial=rankRaceLocally(race,date,localHistoryCache.histories.get(historyKey('TR',pedigreeShadow))||createRankingHistory({identityVersion:pedigreeShadow.metadata.identityVersion||1}),pedigreeShadow)
    if(trial.rankingMethod===pedigreeShadow.metadata.method)saveForecastSnapshots({date,races:[trial],source:'shadow_pedigree',modelVersion:pedigreeShadow.metadata.method,inputHash:analysisFingerprint([race])})
  }
  return ranked
}
function rankingSignature(date){const bundles=[loadRankingModel({metadataOnly:true}),loadForeignRankingModel('US',{metadataOnly:true})].filter(Boolean);return JSON.stringify({models:bundles.map(b=>({method:b.metadata.method,through:b.metadata.trainedThrough,trees:b.metadata.trees,temperature:b.metadata.temperature})),history:historicalDataRevision(date)})}

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

function parseAgf(value) {
  const match = String(value || '').match(/%\s*(\d+(?:[.,]\d+)?)/)
  if (!match) return null
  const share = Number.parseFloat(match[1].replace(',', '.'))
  return Number.isFinite(share) && share >= 0 && share <= 100 ? share : null
}

function parseTime(value) {
  return parseRaceTime(value)
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
    .replace(/ı/g, 'i')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0].toLocaleUpperCase('en-US') + word.slice(1))
    .join('')
}

async function fetchForeignProgramCities(date) {
  return cachedMeetingDiscovery(formatDate(date).iso, () => discoverForeignProgramCities(date))
}

async function discoverForeignProgramCities(date) {
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
  const previous = meetingOptionsByDate.get(formatDate(date).iso) || []
  for (const meeting of availableMeetings) meeting.firstRaceTime = previous.find(item => normalizeText(item.city) === normalizeText(meeting.city))?.firstRaceTime || null
  meetingPageUrlsByDate.set(formatDate(date).iso, new Map(availableMeetings.filter((meeting) => meeting.url).map((meeting) => [normalizeText(meeting.city), meeting.url])))
  meetingOptionsByDate.set(formatDate(date).iso, orderMeetings(availableMeetings, loadStoredProgram(formatDate(date).iso, 'Tümü')))
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

function parseMeetingEnvironment(html, providerUrl, date) {
  const text = loadHtml(html)('body').text().replace(/\s+/g, ' ').trim()
  const weather = text.match(/Hava\s*:\s*([^|]{1,100}?)(?=\s+PDF|\s+Program|\s+Çim\s*:|\s+Kum\s*:|$)/i)?.[1]?.trim() || null
  const tracks = [...text.matchAll(/(Çim|Kum|Sentetik)\s*:\s*([^:|]{1,60}?)(?=\s+(?:Hava|Çim|Kum|Sentetik)\s*:|\s+PDF|$)/gi)].map((match) => ({ surface: match[1], condition: match[2].trim() }))
  return { date, weather, tracks, providerUrl, observedAt: new Date().toISOString(), source: 'TJK resmi program' }
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
      const timeColumn=findCsvColumn(headers,'Derece')
      const unplaced=timeColumn>=0&&officialUnplaced(cells.eq(positionColumn).text(),cells.eq(timeColumn).text())
      if (!Number.isInteger(horseNo) || horseNo < 1 || !Number.isInteger(finishPosition) || (finishPosition < 1&&!unplaced)) continue
      results.set(horseNo, { finishPosition,...(unplaced?{officialUnplaced:true}:{}), sourceName:name,closingOdds: parseNumber(cells.eq(oddsColumn).text()),timeSeconds:timeColumn>=0?parseTime(cells.eq(timeColumn).text()):null })
    }
    if (results.size) races.set(raceNo, results)
  })

  return races
}

function summarizeHorsePerformance(tables, targetDate, horseName) {
  const normalize = (value) => normalizeText(value).replace(/ı/g, 'i').replace(/[^a-z0-9]/g, '')
  const table = tables.find((candidate) => {
    const headers = candidate.headers.map(normalize)
    return headers.includes('tarih') && headers.includes('sehir') && headers.includes('jokey')
  })
  if (!table) return null

  const headers = table.headers.map(normalize)
  const column = (name) => headers.findIndex((header) => header === name)
  const raceColumn = headers.findIndex((header) => header.includes('knokadi'))
  const indexes = {
    date: column('tarih'),
    distance: column('msf'),
    surface: column('pist'),
    finish: column('s'),
    time: column('derece'),
    weight: column('siklet'),
    jockey: column('jokey'),
    start: column('st'),
    className: column('kcins'),
    handicap: column('hp'),
  }
  const historicalRuns = table.rows.map((row) => {
    const date = normalizeDateToken(row[indexes.date])
    const finishPosition = Number.parseInt(row[indexes.finish], 10)
    const rawSurface = String(row[indexes.surface] || '')
    const normalizedSurface = normalize(rawSurface)
    const surface = normalizedSurface.startsWith('s') || normalizedSurface.includes('sentetik')
      ? 'sentetik'
      : normalizedSurface.startsWith('c') || normalizedSurface.includes('cim')
        ? 'cim'
        : normalizedSurface.startsWith('k') || normalizedSurface.includes('kum')
          ? 'kum'
          : 'unknown'
    return {
      horseName,
      date,
      raceNo: Number(String(row[raceColumn] || '').match(/\d+/)?.[0]) || null,
      city: String(row[column('sehir')] || '').trim() || null,
      distance: parseNumber(row[indexes.distance]),
      surface,
      finishPosition: Number.isInteger(finishPosition) && finishPosition > 0 ? finishPosition : null,
      timeSeconds: parseTime(row[indexes.time]),
      weight: parseWeight(row[indexes.weight]),
      jockey: String(row[indexes.jockey] || '').trim() || null,
      start: parseNumber(row[indexes.start]),
      className: String(row[indexes.className] || '').trim() || null,
      handicapRating: parseNumber(row[indexes.handicap]),
    }
  }).filter((run) => run.date && run.date < targetDate && run.finishPosition)
    .sort((left, right) => right.date.localeCompare(left.date))

  const summarize = (runs) => {
    const placedRuns = runs.filter((run) => run.finishPosition)
    return {
      starts: runs.length,
      wins: runs.filter((run) => run.finishPosition === 1).length,
      topThree: runs.filter((run) => run.finishPosition <= 3).length,
      averageFinish: placedRuns.length ? Number((placedRuns.reduce((sum, run) => sum + run.finishPosition, 0) / placedRuns.length).toFixed(1)) : null,
      bestTimeSeconds: runs.reduce((best, run) => run.timeSeconds && (!best || run.timeSeconds < best) ? run.timeSeconds : best, null),
    }
  }

  return {
    ...summarize(historicalRuns),
    recentFinishes: historicalRuns.slice(0, 6).map((run) => run.finishPosition),
    latestStart: historicalRuns[0]?.date || null,
    pastRuns: historicalRuns.slice(0, 100),
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
    const sixLegs=sixLegOrdinals(line,1+races.filter(r=>r.sixLegStarts?.length).length)
    if(sixLegs.length)current.sixLegStarts=[...new Set([...(current.sixLegStarts||[]),...sixLegs])]
    const fiveLegs=marketOrdinals(line,5,1+races.filter(r=>r.fiveLegStarts?.length).length)
    if(fiveLegs.length)current.fiveLegStarts=[...new Set([...(current.fiveLegStarts||[]),...fiveLegs])]
    if (/^1\.\)/.test(cells[0])) {const prizes=parseRacePrizes(cells);if(prizes.length)current.prizeMoney={source:'official_tjk_csv',prizes};continue}
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
        agf: findCsvColumn(cells, 'AGF'),
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
      weight: parseWeight(read('weight')),
      jockey: read('jockey') || 'Bilinmiyor',
      marketShare: parseAgf(read('agf')),
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
  let prefetchedMeetingHtml = null
  if (isForeign && meetingUrl) {
    try {
      const response = await fetch(meetingUrl, { headers: {'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'}, signal: AbortSignal.timeout(csvRequestTimeoutMs) })
      if (response.ok) {
        prefetchedMeetingHtml = await response.text()
        const $ = loadHtml(prefetchedMeetingHtml)
        const urls = $('a[href]').toArray().map(e=>new URL($(e).attr('href'),meetingUrl)).filter(u=>u.hostname==='medya-cdn.tjk.org' && /GunlukYarisProgrami.*\.csv$/i.test(u.pathname))
        for (const url of urls.reverse()) if (!sources.some(s=>s.url===url.href)) sources.unshift({label:`${city} resmi sayfa CSV`,url:url.href})
      }
    } catch {}
    // The undated general endpoint cannot be trusted to supply an archived meeting.
    sources.splice(0,sources.length,...sources.filter(s=>!s.url.includes('GunlukYarisProgramiYurtDisiCSV')))
  }
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
          const meetingResponse = prefetchedMeetingHtml ? null : await fetch(meetingUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36' },
            signal: AbortSignal.timeout(csvRequestTimeoutMs),
          })
          if (meetingResponse && !meetingResponse.ok) throw new Error(`Toplantı sayfası ${meetingResponse.status} döndürdü.`)
          const meetingHtml = prefetchedMeetingHtml || await meetingResponse.text()
          const details = parseMeetingRunnerDetails(meetingHtml, meetingUrl)
          const environment = parseMeetingEnvironment(meetingHtml, meetingUrl, expectedDate)
          if (!details.length) throw new Error('Toplantı sayfasında koşu tabloları bulunamadı.')
          races = enrichRacesWithMeetingDetails(races, details, meetingUrl)
          for (const race of races) for (const horse of race.horses) {
            if (horse.sourceData?.tjk) horse.sourceData.tjk.raceEnvironment = environment
          }
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
      if(['FR','ZA'].includes(racingCountry(city))&&horseIdentity(text.replace(/^\uFEFF/,'').split(';')[0])===horseIdentity(city))for(const race of races)for(const horse of race.horses){
        const parsedMother=parseMaternalColumn(horse.dam)
        if(!parsedMother)continue
        const record={date:expectedDate,city,raceNo:race.no,horseNo:horse.no,name:horse.name,sire:horse.sire,rawDam:horse.dam,...parsedMother,provider:'TJK official program CSV',sourceUrl:source.url,fetchedAt:new Date().toISOString(),availability:'static_pedigree'}
        horse.sourceData={...horse.sourceData,tjk:{...horse.sourceData?.tjk,programMaternalLine:record}}
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
    weight: parseWeight(totalWeight || horse.weight),
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
  const knownMeetings = meetingOptionsByDate.get(expectedDate)
  if (knownMeetings) {
    for (const meeting of knownMeetings) {
      const official = meetings.find(item => item.date === expectedDate && matchesVenueSelection(meeting.city, item.location, item.hippodrome))
      if (official?.runs?.length) meeting.firstRaceTime = [...official.runs].sort((a,b) => Number(a.no) - Number(b.no)).map(run => String(run.startTime || '').replace(':', '.'))[0]
    }
  }
  if (!meetingOptionsByDate.has(expectedDate)) {
    meetingOptionsByDate.set(expectedDate, meetings
      .filter((meeting) => meeting.date === expectedDate)
      .map((meeting) => ({
        city: String(meeting.location || meeting.hippodrome || '').trim(),
        foreign: Boolean(meeting.abroad),
        firstRaceTime: [...(meeting.runs || [])].sort((a,b) => Number(a.no) - Number(b.no)).map(run => String(run.startTime || '').replace(':', '.'))[0] || null,
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
  const fastProgram=process.env.HORSERIDE_FAST_PROGRAM==='1'
  const workoutResults = await mapWithConcurrency(fastProgram?[]:workoutTasks, 3, async ({ race, workoutUrl }) => {
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
        profileTasksByKey.set(`horse:${horse.horseId}`, { key: `horse:${horse.horseId}`, type: 'horse', horseName: horse.name, url, city: race.city, referer: race.meetingPageUrl })
      }
      if (!race.foreign && horse.jockeyId && horse.jockeyStatsUrl) {
        profileTasksByKey.set(`jockey:${horse.jockeyId}`, { key: `jockey:${horse.jockeyId}`, type: 'jockey', url: horse.jockeyStatsUrl, city: race.city, referer: race.meetingPageUrl })
      }
    }
  }

  if(fastProgram)pendingProgramProfileTasks=[...profileTasksByKey.values()]
  const profileResults = await mapWithConcurrency([...profileTasksByKey.values()], 4, async (task) => {
    try {
      const cached=fastProgram?findFreshSourceSnapshot(task.url,6*3600000):null
      if(fastProgram&&!cached)return {key:task.key,summary:null}
      const profile = cached?{tables:JSON.parse(cached),rawSource:null}:await fetchOfficialProfile(task.url, task.referer, task.city, task.type === 'horse' ? 'tjk_horse_history' : 'tjk_jockey_stats')
      return {
        key: task.key,
        summary: task.type === 'horse' ? summarizeHorsePerformance(profile.tables, formatDate(date).iso, task.horseName) : summarizeJockeyPerformance(profile.tables),
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
      let horsePerformance = horse.horseId ? profilesByKey.get(`horse:${horse.horseId}`) : null
      if(!horsePerformance&&horse.horseId)try{const tables=findHorseProfileTables(horse.horseId);if(tables)horsePerformance=summarizeHorsePerformance(tables,formatDate(date).iso,horse.name)}catch{}
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

export async function enrichPublishedProfiles(date){
 const lock='data/maintenance/program-profiles.lock'
 try{if(existsSync(lock)){const owner=JSON.parse(readFileSync(lock,'utf8'));if(isProcessRunning(owner.pid))return;unlinkSync(lock)}writeFileSync(lock,JSON.stringify({pid:process.pid}),{flag:'wx'})}catch{return}
 const started=Date.now();let saved=0,failed=0
 try{await mapWithConcurrency(pendingProgramProfileTasks,4,async task=>{
  try{const profile=await fetchOfficialProfile(task.url,task.referer,task.city,task.type==='horse'?'tjk_horse_history':'tjk_jockey_stats');if(profile.rawSource){saveProgram({date,city:task.city,fetchedAt:new Date().toISOString(),races:[],rawSources:[profile.rawSource]});saved++}}
  catch{failed++}
 });hydratePublishedProfiles(date);analysisLog('program_profiles_ready',{date,total:pendingProgramProfileTasks.length,completed:saved,durationMs:Date.now()-started,code:failed?`partial_${failed}`:undefined})}
 finally{try{unlinkSync(lock)}catch{}}
}
export function hydratePublishedProfiles(date){
 const program=readServedProgram(date);if(!program)return
 const races=program.races.map(r=>({...r,horses:r.horses.map(h=>{if(!h.horseId)return h;try{const tables=findHorseProfileTables(h.horseId);return tables?{...h,horsePerformance:summarizeHorsePerformance(tables,date,h.name)}:h}catch{return h}})}))
 publishProgram(date,{...program,races})
}
async function fetchPrograms(date, citySelection) {
  return cachedProgramSource(`${formatDate(date).iso}:${normalizeText(citySelection)}`, async () => {
    if (!isAllCitySelection(citySelection) && !isAllForeignSelection(citySelection)) {
      const all = cachedProgramSource.peek(`${formatDate(date).iso}:${normalizeText('Tümü')}`)
      const races = all?.races.filter(race => matchesVenueSelection(citySelection, race.city, race.venue)) || []
      if (races.length) return { ...all, city: citySelection, races }
    }
    const result = await fetchProgramsUncached(date, citySelection)
    const meetings = orderMeetings(result.meetings || [], result.races)
    meetingOptionsByDate.set(formatDate(date).iso, meetings)
    return { ...result, meetings }
  })
}

async function fetchProgramsUncached(date, citySelection) {
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

function normalizeMeetingName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function sendJson(response, status, data) {
  const transfer=jsonTransfer(data,response.req?.headers?.['accept-encoding'])
  response.writeHead(status, {
    ...transfer.headers,
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  response.end(transfer.body)
}

async function loadPublicCommentary(date, city) {
  const baseUrl = 'https://tjkbulten.atyarisi.com/api/v1/GetCommentsByDate'
  const requestOptions = {
    headers: { Accept: 'application/json', 'User-Agent': 'GanyanZekasi/0.1 public-race-commentary' },
    signal: AbortSignal.timeout(15_000),
  }
  const dateUrl = new URL(baseUrl)
  dateUrl.searchParams.set('date', date)
  const dateResponse = await fetch(dateUrl, requestOptions)
  if (!dateResponse.ok) throw new Error(`At Yarışı yorum servisi ${dateResponse.status} döndürdü.`)
  const datePayload = await dateResponse.json()
  if (datePayload.sc !== 200 || !Array.isArray(datePayload.d?.hippodromes)) {
    throw new Error('At Yarışı yorum servisi beklenen program listesini döndürmedi.')
  }

  const meeting = datePayload.d.hippodromes.find((item) => normalizeMeetingName(item.name) === normalizeMeetingName(city))
  if (!meeting) return { date, city, source: 'atyarisi.com', sourceUrl: 'https://www.atyarisi.com/tjk-at-yarisi-tahminleri', fetchedAt: new Date().toISOString(), comments: [], unavailableReason: 'Bu tarih ve şehir için At Yarışı yorum verisi yok.' }

  const commentsUrl = new URL(baseUrl)
  commentsUrl.searchParams.set('date', date)
  commentsUrl.searchParams.set('programId', String(meeting.programId))
  const commentsResponse = await fetch(commentsUrl, requestOptions)
  if (!commentsResponse.ok) throw new Error(`At Yarışı yorum servisi ${commentsResponse.status} döndürdü.`)
  const commentsPayload = await commentsResponse.json()
  if (commentsPayload.sc !== 200 || !Array.isArray(commentsPayload.d?.comments)) {
    throw new Error('At Yarışı yorum servisi beklenen yorum listesini döndürmedi.')
  }

  const localRaces = getProgramForAnalysis(date, city)
  const raceByNumber = new Map(localRaces.map((race) => [Number(race.no), race]))
  const editorNames = new Map((commentsPayload.d.editors || []).map((editor) => [Number(editor.editorId), editor.editorFullName]))
  const uniqueComments = new Map()
  for (const comment of commentsPayload.d.comments) {
    const raceNo = Number(String(comment.raceNo || '').match(/^\s*(\d+)/)?.[1])
    const race = raceByNumber.get(raceNo)
    const ranking = String(comment.comment || '').match(/SIRALAMAM\s*:\s*([\d\s,./-]+)/i)?.[1]
    if (!race || !ranking) continue

    const validRunners = new Map(race.horses.map((horse) => [Number(horse.no), horse]))
    const seenNumbers = new Set()
    const horses = (ranking.match(/\d+/g) || []).map(Number).filter((number) => {
      if (!validRunners.has(number) || seenNumbers.has(number)) return false
      seenNumbers.add(number)
      return true
    }).map((number, index) => ({ number, name: validRunners.get(number).name, rank: index + 1 }))
    if (!horses.length) continue

    const editorId = Number(comment.editorId)
    const key = `${raceNo}:${editorId}`
    uniqueComments.set(key, {
      raceNo,
      author: editorNames.get(editorId) || 'At Yarışı editörü',
      editorId,
      comment: String(comment.comment || '').slice(0, 1_500),
      horses,
    })
  }

  return {
    date,
    city,
    source: 'atyarisi.com',
    sourceUrl: 'https://www.atyarisi.com/tjk-at-yarisi-tahminleri',
    fetchedAt: new Date().toISOString(),
    comments: [...uniqueComments.values()],
    unavailableReason: uniqueComments.size ? null : 'Bu tarih ve şehir için eşleşen, at numarası içeren yorum bulunamadı.',
  }
}

function loadStoredProgram(date, city) {
  const selection = isAllCitySelection(city) ? 'Tümü' : city
  return getProgramForAnalysis(date, selection).map((race) => ({
    ...race,
    horses: race.horses.map((horse) => ({
      ...horse,
      probability: horse.probability ?? horse.baselineProbability ?? 0,
    })).sort((left, right) => right.independentScore - left.independentScore || right.probability - left.probability),
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

function parseAnalysisOutput(text, races, {discardInvalidSurprise=false}={}) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('OpenAI geçerli JSON tahmini döndürmedi.')
  }
  if (typeof parsed.summary !== 'string' || !Array.isArray(parsed.races)) {
    throw new Error('OpenAI tahmin yanıtı beklenen alanları içermiyor.')
  }

  const seenRaces = new Set()
  const analyzedRaces = parsed.races.map((prediction) => {
    const race = races.find((item) => item.city === prediction.city && item.no === Number(prediction.raceNo))
    if (!race || !Array.isArray(prediction.picks)) throw new Error('OpenAI yarış eşlemesi geçersiz.')
    const raceKey = `${race.city}:${race.no}`
    if (seenRaces.has(raceKey)) throw new Error(`${race.city} ${race.no}. koşu analizde birden fazla kez döndü.`)
    seenRaces.add(raceKey)
    const normalizeName = (value) => String(value || '').normalize('NFKC').toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    const horsesByName = new Map(race.horses.map((horse) => [normalizeName(horse.name), horse]))
    const invalidPickCount = prediction.picks.slice(0, 5).filter((pick) => !pick || typeof pick.horseName !== 'string' || !horsesByName.has(normalizeName(pick.horseName))).length
    const seenPicks = new Set()
    const picks = prediction.picks.slice(0, 5).flatMap((pick) => {
      if (!pick || typeof pick.horseName !== 'string') return []
      const horse = horsesByName.get(normalizeName(pick.horseName))
      if (!horse) return []
      const horseKey = normalizeName(horse.name)
      if (seenPicks.has(horseKey)) return []
      seenPicks.add(horseKey)
      const reason = String(pick.reason || '').trim().replace(/\s+/g, ' ')
      const sentenceCount = (reason.replace(/\b\d+\.(?=\s+(?:koşu|ayak|sıra))/gi, '').match(/[.!?]+(?=\s|$)/g) || []).length
      if (sentenceCount < 3) return []
      return [{ horseName: horse.name, reason: reason.slice(0, 1_200) }]
    })
    if (invalidPickCount || picks.length < Math.min(4, race.horses.length)) throw new Error(`${race.city} ${race.no}. koşu: ${prediction.picks.length} aday, ${invalidPickCount} eşleşmeyen ad, ${picks.length} geçerli gerekçe; analiz kaydedilmedi.`)
    const confidence = ['low', 'medium', 'high'].includes(prediction.confidence) ? prediction.confidence : 'low'
    let surprise = null
    if (prediction.surprise) {
      const horse = horsesByName.get(normalizeName(prediction.surprise.horseName))
      const reason = String(prediction.surprise.reason || '').trim()
      if (!horse || picks.slice(0, 2).some((pick) => pick.horseName === horse.name) || reason.length < 60) {
        if(!discardInvalidSurprise)throw new Error('Sürpriz aday mevcut programdan, ilk iki aday dışında ve gerekçeli olmalı.')
        analysisLog('invalid_surprise_discarded',{city:race.city,raceNos:[race.no]})
      } else {
      const allowed = race.surpriseCandidates ?? surpriseCandidates(race,picks)
      if(allowed.includes(horse.name))surprise = { horseName: horse.name, reason: reason.slice(0, 1000) }
      }
    }
    return {
      city: race.city,
      raceNo: race.no,
      picks,
      confidence,
      surprise,
      risks: [
        ...(invalidPickCount ? [`${invalidPickCount} model adayı programdaki atlarla eşleşmedi ve kupon havuzundan çıkarıldı.`] : []),
        ...(Array.isArray(prediction.risks) ? prediction.risks.slice(0, invalidPickCount ? 3 : 4).map((item) => String(item).slice(0, 240)) : []),
      ],
    }
  })
  if (analyzedRaces.length !== races.length) throw new Error(`OpenAI ${analyzedRaces.length}/${races.length} koşu için tahmin üretti; analiz kaydedilmedi.`)

  return { version: dailyAnalysisVersion, summary: parsed.summary.slice(0, 1_200), races: analyzedRaces }
}

function buildHistoricalAnalysisContext(races, targetDate, {archive=null}={}) {
  resetPedigreeRegistryCache()
  races=enrichRunnerPedigree(races,targetDate)
  races=enrichAustralianRaces(races,targetDate)
  const horseKeys=new Map()
  const contextHorseKey=value=>{
    if(!horseKeys.has(value))horseKeys.set(value,horseIdentityV2(value).toLowerCase())
    return horseKeys.get(value)
  }
  const contextJockeyKey=value=>jockeyIdentityV2(value).toLowerCase()
  let hkHealth=null,hkWork=null
  if(races.some(r=>racingCountry(r.city)==='HK')){
    try{hkHealth=JSON.parse(readFileSync('data/external/hkjc-additional/current-evidence.json','utf8'))}catch{}
    try{hkWork=JSON.parse(readFileSync('data/external/hkjc-additional/trackwork-records.json','utf8'))}catch{}
  }
  const since = new Date(`${targetDate}T12:00:00`)
  since.setDate(since.getDate() - 730)
  const sinceDate = formatDate(since).iso
  const fieldRows = [...new Map(listBacktestEntries(sinceDate, targetDate).map(row=>[`${row.date}:${normalizeMeetingName(row.city)}:${row.raceNo}:${performanceKey(row.horseName)}`,row])).values()]
  const requestedCountries=new Set(races.map(r=>racingCountry(r.city)||'TR'))
  const externalWorkouts=requestedCountries.has('US')?foreignWorkoutRecords():[]
  const historicalArchive=archive??listHistoricalRaces({since:sinceDate,before:targetDate,countries:[...new Set([...requestedCountries,'TR'])]})
  const analysisHistory=historicalArchive.filter(r=>requestedCountries.has(racingCountry(r.city)||'TR')&&r.date>=sinceDate&&r.date<targetDate)
  const runsByHorse=new Map()
  for(const old of analysisHistory)for(const runner of old.horses){
    const result=old.results.get(runner.no)
    if(!result?.finishPosition)continue
    const key=`${racingCountry(old.city)||'TR'}:${contextHorseKey(runner.name)}`
    if(!runsByHorse.has(key))runsByHorse.set(key,[])
    runsByHorse.get(key).push({date:old.date,city:old.city,raceNo:old.no,distance:parseNumber(old.distance),surface:old.surface,finishPosition:result.finishPosition,timeSeconds:result.timeSeconds,weight:runner.weight,start:runner.start,jockey:runner.jockey,className:old.type,handicapRating:runner.handicapRating,source:racingCountry(old.city)?'TJK foreign archive':'TJK domestic archive',externalEvidence:runner.externalEvidence||null})
  }
  let verifiedPaces=new Map()
  if(requestedCountries.has('US'))try{verifiedPaces=paceHistory(readOfficialCharts(targetDate).races)}catch{}
  const stewardByHorse=new Map()
  for(const old of historicalArchive.filter(r=>!r.foreign&&r.date<targetDate&&r.date>=sinceDate))for(const horse of old.horses)if(horse.stewardEvidence?.length){
    const key=`${old.date}:${normalizeMeetingName(old.city)}:${contextHorseKey(horse.name)}`
    stewardByHorse.set(key,horse.stewardEvidence)
  }
  const knownFields=new Set(fieldRows.map(row=>`${row.date}:${normalizeMeetingName(row.city)}:${row.raceNo}:${contextHorseKey(row.horseName)}`))
  for(const old of analysisHistory)for(const horse of old.horses){
    const result=old.results.get(horse.no)
    const key=`${old.date}:${normalizeMeetingName(old.city)}:${old.no}:${contextHorseKey(horse.name)}`
    if(result?.finishPosition&&!knownFields.has(key)){knownFields.add(key);fieldRows.push({date:old.date,city:old.city,raceNo:old.no,horseName:horse.name,jockey:horse.jockey,surface:old.surface,distance:old.distance,finishPosition:result.finishPosition,closingOdds:result.closingOdds,modelRank:null})}
  }
  const jockeyRows=new Map()
  for(const row of fieldRows){
    const jockey=contextJockeyKey(row.jockey)
    if(!jockey||jockey==='bilinmiyor'||row.date<sinceDate||row.date>=targetDate)continue
    const key=`${racingCountry(row.city)||'TR'}:${jockey}`
    if(!jockeyRows.has(key))jockeyRows.set(key,[])
    jockeyRows.get(key).push(row)
  }
  const fields = new Map()
  for (const row of fieldRows) {
    const key = `${row.date}:${normalizeMeetingName(row.city)}:${Number(row.raceNo)}`
    if (!fields.has(key)) fields.set(key, [])
    if (!fields.get(key).some((item) => contextHorseKey(item.horseName) === contextHorseKey(row.horseName))) fields.get(key).push(row)
  }
  const summarizeRuns = (runs) => ({
    starts: runs.length,
    wins: runs.filter((run) => run.finishPosition === 1).length,
    topThree: runs.filter((run) => run.finishPosition <= 3).length,
    averageFinish: runs.length ? Number((runs.reduce((sum, run) => sum + run.finishPosition, 0) / runs.length).toFixed(1)) : null,
    bestTimeSeconds: runs.reduce((best, run) => run.timeSeconds && (!best || run.timeSeconds < best) ? run.timeSeconds : best, null),
  })

  return races.map((race) => {
    const raceDistance = parseNumber(race.distance)
    const raceSurface = normalizeSurface(race.surface)
    const racePaces=racingCountry(race.city)==='US'?paceFeatures(race,targetDate,verifiedPaces,equibaseTracks[race.city]?.name):null
    return {
      ...race,
      historyLimitations: racingCountry(race.city)?'Yalnız TJK programına alınan yurtdışı yarışlar taranmıştır; tam kariyer kaydı değildir. Ülkeler arası sınıf ve ham dereceler eşdeğer sayılmaz. externalEvidence yalnız tamamlanmış önceki yarışın sonuç çizelgesidir.':undefined,
      horses: race.horses.map((horse,horseIndex) => {
        const profileTables = findHorseProfileTables(horse.horseId)
        const horsePerformance = profileTables ? summarizeHorsePerformance(profileTables, targetDate, horse.name) : horse.horsePerformance
        const archiveRuns=[...(runsByHorse.get(`${racingCountry(race.city)||'TR'}:${contextHorseKey(horse.name)}`)||[])].sort((a,b)=>b.date.localeCompare(a.date))
        const mergedRuns=racingCountry(race.city)==='AU'?[...new Map([...(horsePerformance?.pastRuns||[]),...archiveRuns].map(run=>[run.date,run])).values()].sort((a,b)=>b.date.localeCompare(a.date)):racingCountry(race.city)?archiveRuns:[...new Map([...archiveRuns,...(horsePerformance?.pastRuns||[])].map(run=>[`${run.date}:${normalizeMeetingName(run.city)}:${run.raceNo}`,run])).values()].sort((a,b)=>b.date.localeCompare(a.date))
        const recentRuns = mergedRuns
          .filter((run) => run.date < targetDate && run.date >= sinceDate)
          .slice(0, 40)
        const sameDistanceRuns = raceDistance ? recentRuns.filter((run) => run.distance && Math.abs(run.distance - raceDistance) <= 200) : []
        const sameSurfaceRuns = raceSurface === 'unknown' ? [] : recentRuns.filter((run) => normalizeSurface(run.surface) === raceSurface)
        const enrichedRuns = recentRuns.map((original) => {
          const reports=stewardByHorse.get(`${original.date}:${normalizeMeetingName(original.city)}:${contextHorseKey(horse.name)}`)
          const run={...original,stewardReports:reports?.slice(0,2).map(e=>({date:e.date,sourceUrl:e.sourceUrl,classification:e.classification,text:e.text.slice(0,600)}))}
          if (!run.city || !run.raceNo) return { ...run, competition: null }
          const field = fields.get(`${run.date}:${normalizeMeetingName(run.city)}:${Number(run.raceNo)}`)
          if (!field) return { ...run, competition: null }
          const runnerKey = contextHorseKey(horse.name)
          const runner = field.find((item) => contextHorseKey(item.horseName) === runnerKey)
          if (!runner) return { ...run, competition: null }
          const topRivals = field
            .filter((item) => contextHorseKey(item.horseName) !== runnerKey)
            .sort((left, right) => left.finishPosition - right.finishPosition || left.modelRank - right.modelRank)
            .slice(0, 5)
            .map((item) => ({ name: item.horseName, modelRank: item.modelRank, finishPosition: item.finishPosition, closingOdds: item.closingOdds }))
          return { ...run, competition: { fieldSize: field.length, runnerModelRank: runner?.modelRank || null, runnerFinishPosition: runner?.finishPosition || run.finishPosition, topRivals } }
        })
        // Keep the longer history locally; send a bounded, relevant subset to the paid model.
        const relevant=[...enrichedRuns.filter(run=>Math.abs(run.distance-raceDistance)<=200&&normalizeSurface(run.surface)===raceSurface).slice(0,8),...enrichedRuns.slice(0,6)]
        const compactRuns=[...new Map(relevant.map(run=>[`${run.date}:${run.city}:${run.raceNo}`,run])).values()].slice(0,14)
        const workoutTables=findHorseProfileTables(horse.horseId,'tjk_horse_workouts')
        const workouts=(racingCountry(race.city)==='US'?matchEquibaseWorkouts(externalWorkouts,horse,targetDate):workoutTables?summarizeWorkoutHistory(workoutTables,horse.name,targetDate,{identityVersion:2}):horse.workouts||[]).filter(w=>w.dateISO&&w.dateISO<targetDate).slice(0,8)
        const workout=horse.workout&&normalizeDateToken(horse.workout.date)<targetDate?horse.workout:workouts[0]||null
        return {
          ...horse,
          jockeyPerformance: jockeyEvidence(race,horse,targetDate,jockeyRows.get(`${racingCountry(race.city)||'TR'}:${contextJockeyKey(horse.jockey)}`)||[]),
          workout,
          workouts,
          paceEvidence:racePaces?Object.fromEntries(paceFeatureNames.map((name,i)=>[name,racePaces[horseIndex][i]])):undefined,
          publicHealthEvidence:racingCountry(race.city)==='HK'?currentHongKongEvidence(hkHealth,horse,targetDate):undefined,
          publicTrackworkEvidence:racingCountry(race.city)==='HK'&&hkWork?.observedDate<=targetDate?{observedAt:hkWork.observedAt,records:hkWork.records.filter(w=>performanceKey(w.horseName)===performanceKey(horse.name.replace(/\s*\([^)]*\)/g,''))&&w.dateISO<targetDate).slice(-8),note:'Resmi çalışma açıklaması; mesafe veya ara derece etiketleri doğrulanmadan sayısal idman puanı üretilmez.'}:undefined,
          horsePerformance: { ...(horsePerformance || {}),pastRuns:undefined, sameDistance: summarizeRuns(sameDistanceRuns), sameSurface: summarizeRuns(sameSurfaceRuns), sameDistanceAndSurface: summarizeRuns(sameDistanceRuns.filter((run) => normalizeSurface(run.surface) === raceSurface)), recentRuns: compactRuns },
          recentLoadEvidence:recentLoadEvidence(recentRuns,workouts,horse,race,targetDate),
          evidenceCoverage: {
            recentRuns: recentRuns.length,
            sameDistanceRuns: sameDistanceRuns.length,
            sameSurfaceRuns: sameSurfaceRuns.length,
            matchedCompetitionFields: enrichedRuns.filter((run) => run.competition).length,
            hasWorkout: Boolean(workout),
            hasJockeyProfile: Boolean(jockeyRows.get(`${racingCountry(race.city)||'TR'}:${contextJockeyKey(horse.jockey)}`)?.length),
          },
        }
      }),
    }
  })
}

async function analyzeDailyBatch(date, city, races) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey&&!localAnalysisEnabled()) throw Object.assign(new Error('AI yorum servisi şu anda yapılandırılmamış. Veri temelli sıralama kullanılabilir; sunucu ayarlarının kontrol edilmesi gerekiyor.'), { status: 503 })

  if (!races.length) throw Object.assign(new Error('Önce bu günün yarış programını çekip SQLite’a kaydetmelisiniz.'), { status: 409 })
  const model = explanationModel()
  const programJSON=JSON.stringify({date,city,races:compactAnalysisContext(races)})
  let input = `Yarış programını ve performans alanlarını analiz et. Tüm açıklamaları doğal, akıcı ve tutarlı Türkçe yaz. Kısa ve doğrudan cümleler kur. At adları dışında İngilizce terim, alan adı, teknik kimlik, yazılım/model adı veya sürüm numarası yazma. Handikap puanı, yarış sınıfı, kum/çim/sentetik pist ve anne-baba hattı terimlerini tutarlı kullan. Veride olmayan neden-sonuç ilişkisi kurma. Yalnızca istenen JSON nesnesini döndür. Her koşu için TAM DÖRT farklı aday zorunludur (programda dört at yoksa tüm atları yaz). horseName alanına name değerini KG, DB, SK gibi ekleriyle karakter karakter aynen kopyala. Her reason en az üç nokta ile biten tam cümle içermelidir. Her koşuda surprise alanına ilk iki aday DIŞINDA, mesafe/pist, rakip, jokey veya idman kanıtıyla kazanma yolu bulunan bir sürpriz adayı yaz. surprise.reason alanında 2-3 cümleyle neden ana adaylardan geride olduğunu, hangi somut koşulda öne çıkabileceğini ve riskini açıkla. Piyasa oranları verilmediğinden az oynandığını veya yüksek oranlı olduğunu iddia etme. Yeterli somut geçmiş kanıtı yoksa surprise=null kullan; sırf sürpriz üretmek için uydurma yapma.
Her koşuda tam dört atı (dörtten az at varsa tümünü) model sırasına göre yaz. Her atın reason alanında noktayla biten üç kısa tam cümle kullan. İlk sıradaki at için neden yarışın en güçlü adayı olduğunu açıkla; son yarış kazanıp kazanmadığını tek başına yeterli kanıt sayma. Her adayın son bitirişleri yanında aynı mesafe aralığındaki geçmişini, pist yüzeyi eşleşmesini, zaman/derece gelişimini, sınıf/şart düzeyini, kilo ve start etkisini, atın geçmiş rakiplerinin sıralama/bitiriş kanıtını ve mevcut alandaki yakın rakiplerin verilerini kıyasla. ` +
    'analysisCandidates alanı varsa bunlar tarihsel ayrı testten geçen yerel sayısal modelin dört adayıdır; picks isimlerini bu sırayla aynen kullan ve verilerle nedenlerini açıkla. Böylece doğrulanmış sıralama, açıklama modeli tarafından keyfi değiştirilmez. Bu alan yoksa adayları verilen kanıtla değerlendir. horsePerformance.sameDistance ve sameSurface özetlerini, recentRuns içindeki mesafe/pist/derece/className/handicapRating bilgilerini, competition.topRivals içindeki gerçek isim-bitiriş verilerini kullan; eski model sırası veya dahili kimlikleri kullanıcı açıklamasına yazma. İdman varsa tarih, pist, çalışma türü ve ölçülen split sürelerini karşılaştır; iş rakamını mesafe/zaman bağlamı olmadan övgü olarak sunma. ' +
    'Tarih/şehir/koşu eşleşmesi bulunmayan geçmiş rakip alanını kullanma; bu durumda rakip kalite kıyasının mevcut olmadığını söyle. evidenceCoverage alanını kanıt yeterliliğini değerlendirirken kullan. sameDistanceAndSurface birleşik uyumunu önceliklendir; farklı pist/mesafelerin ham derecelerini doğrudan kıyaslama. environment varsa resmi hava, nem ve pist durumunun uygunluğunu değerlendir; yoksa hava etkisi hakkında bilgi uydurma. Eski model sıralamasını mutlak kalite ölçüsü sayma; sınıf adları da yalnızca yaklaşık seviye göstergesidir. Rakip, mesafe, pist, idman, derece veya jokey hakkında verilen veri dışına çıkma; eksik alanları açıkla. At adlarını yalnızca mevcut koşudaki program adlarıyla kullan. Göreli skoru kazanma olasılığı gibi sunma; yüzdeyle kazanma ihtimali, garanti veya kesin sonuç üretme. Veri zayıfsa güven düzeyini düşür.\n' +
    'performanceEvidence varsa geçmiş hız referansının örnek sayısını ve sınıf/rakip farkını açıkla; speedEvidenceCount sıfırsa hız kanıtı varmış gibi yazma. Komiser metninde ceza alan binicinin atını otomatik olarak mağdur veya şanssız sayma. publicHealthEvidence eski resmi olay kayıtlarıdır, güncel hastalık tanısı değildir. weatherForecast bölgesel tahmindir; resmi pist durumu veya gerçekleşmiş hava yerine kullanma. Yeni hava tahmini ve HK kayıtları henüz sayısal modelde öğrenilmiş değildir.\n' +
    'paceEvidence varsa verifiedPaceStarts örnek sayısı ile ilk ara konumdan finişe yükselme/gerileme ve rakiplerin önde gitme geçmişini birlikte tartış. Start sütunu ara konum değildir; eksik ara konumu tahmin etme. Tempo geçmişi tek başına bugünkü yarışın nasıl akacağını kanıtlamaz.\n' +
    'Sürpriz yalnızca surpriseCandidates listesinden seçilebilir. Bu liste AGF ilk iki favorisini ve ikinci sıradaki eşitlikleri dışlar; boşsa surprise=null zorunludur. AGF ana aday sırasını değiştirmek için kullanılmaz. Her aday için üç kısa, somut cümle yaz; tekrarlı uzun açıklamaları çıkar. Risklerde hiçbir atın geçmişi yok gibi toplu iddialar kurma; eksik kanıtı at bazında belirt. Risk cümleleri aday gerekçeleriyle ve evidenceCoverage sayılarıyla çelişmemeli.\n' +
    'Yazım: Birbirine bağlı üç kısa cümleyle doğal bir anlatım kur. Önce adayın neden önde olduğunu, sonra en yakın rakibinden somut farkını, son olarak varsa koşuya özgü riskini anlat. Aynı kalıp cümleleri adaylar arasında tekrarlama; eksik sütunları sırayla sayma. Teknik alan adlarını ve yazılım sürümlerini yazma. recentLoadEvidence varsa yalnız gözlenen yarış sıklığı, dinlenme aralığı ve kilo/mesafe değişimini somut sayılarla değerlendir; sık koşmuş olmasından tek başına yorgunluk, sakatlık veya formsuzluk çıkarma. Eksik geçmişi ilk start sanma.\n' +
    'JSON biçimi: {"summary":"...","races":[{"city":"...","raceNo":1,"picks":[{"horseName":"...","reason":"Verilen geçmişi kıyaslayan ilk cümle. Mesafe ve pist kanıtını açıklayan ikinci cümle. Koşuya özgü değerlendirmeyi tamamlayan üçüncü cümle."}],"confidence":"low|medium|high","risks":["..."],"surprise":null}]}\n' +
    programJSON
  if(localAnalysisEnabled())input=localAnalysisInput(date,city,races)
  if (Buffer.byteLength(input, 'utf8') > 750_000) {
    throw Object.assign(new Error('Günlük analiz girdisi çok büyük; maliyeti sınırlamak için tek şehir seçin.'), { status: 413 })
  }
  const inputHash = createHash('sha256').update(`${dailyAnalysisVersion}:${model}:schema-for-races-v1:${input.slice(0,input.length-programJSON.length)}:${analysisFingerprint(races)}`).digest('hex')
  const legacyHash=createHash('sha256').update(`${dailyAnalysisVersion}:${model}:schema-for-races-v1:${input}`).digest('hex')
  const cachedBatch=findAnalysisBatch(inputHash)||findAnalysisBatch(legacyHash)
  if(cachedBatch){analysisLog('batch_cache_hit',{date,city,raceNos:races.map(r=>r.no),cached:true});return cachedBatch.inputHash===inputHash?cachedBatch:saveAnalysisBatch({...cachedBatch,inputHash})}
  const responsePayload = await requestAnalysis(JSON.stringify({
      model,
      store: false,
      max_output_tokens: Math.min(12_000, Math.max(3_000, races.length * 2_000)),
      reasoning: { effort: 'low' },
      instructions: 'Akıcı ve doğal Türkçe kullan; teknik model adlarını, sürüm numaralarını ve veri alanı isimlerini kullanıcı metnine yazma. Seçili ülkenin yarışlarını yalnızca verilen program, geçmiş performans, jokey ve idman alanlarına dayanarak analiz et. Kaynakta olmayan bilgi, oran veya sonuç uydurma; eksik alanı belirsizlik say. At isimlerini listedeki adlarıyla aynen kullan. Her koşu için tam dört farklı aday (dörtten az at varsa tüm atlar), her adayın reason alanında noktayla biten en az üç kısa veri dayanaklı tam cümle, low/medium/high belirsizlik seviyesi ve en çok 4 risk yaz. analysisCandidates varsa aynı adayları aynı sırayla kullan. surprise alanı zorunludur; uygun kanıt yoksa null kullan. Kupon oluşturma; kupon kombinasyonları bütçe ve her ayaktaki aday ağırlıklarına göre uygulama içinde hesaplanıyor. Kazanma olasılığı yüzdesi veya kesin kupon garantisi verme. Yalnız JSON döndür: {"summary":"...","races":[{"city":"...","raceNo":1,"picks":[{"horseName":"...","reason":"..."}],"confidence":"low|medium|high","risks":["..."],"surprise":null}]} .',
      input,
      text: { format: { type: 'json_schema', name: 'race_analysis', strict: true, schema: schemaForRaces(races) } },
    }), apiKey, {date,city,raceNos:races.map(r=>r.no)})
  if (responsePayload.status === 'incomplete') {
    throw new Error(`OpenAI yanıtı tamamlanmadı: ${responsePayload.incomplete_details?.reason || 'sebep belirtilmedi'}.`)
  }
  const outputText = responsePayload.output_text || responsePayload.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text
  if (!outputText) throw new Error('OpenAI yanıtında analiz metni bulunamadı.')

  const analysis = parseAnalysisOutput(outputText, races,{discardInvalidSurprise:true})
  for (const prediction of analysis.races) {
    const race = races.find((item) => item.city === prediction.city && item.no === prediction.raceNo)
    if(race.analysisCandidates&&prediction.picks.some((pick,i)=>pick.horseName!==race.analysisCandidates[i]))throw new Error('AI açıklaması doğrulanmış aday sırasıyla eşleşmedi; analiz kaydedilmedi.')
    prediction.evidence = {
      runners: race.horses.length,
      withHistory: race.horses.filter((horse) => horse.evidenceCoverage.recentRuns > 0).length,
      withDistanceAndSurface: race.horses.filter((horse) => horse.horsePerformance.sameDistanceAndSurface.starts > 0).length,
      withRivalFields: race.horses.filter((horse) => horse.evidenceCoverage.matchedCompetitionFields > 0).length,
      withJockeyHistory: race.horses.filter((horse) => horse.evidenceCoverage.hasJockeyProfile).length,
      withWorkout: race.horses.filter((horse) => horse.evidenceCoverage.hasWorkout).length,
      weather: race.environment?.weather || null,
      trackConditions: race.environment?.tracks || [],
    }
  }
  return saveAnalysisBatch({ date, city, model, inputHash, analysis, createdAt: new Date().toISOString() })
}

async function createDailyAnalysis(date, city, onProgress = () => {}, priorityRaceNo = null) {
  const preparationStarted=Date.now()
  const programFingerprint=analysisFingerprint(getProgramForAnalysis(date,city,{includeWorkouts:false}))
  const entryFingerprint=analysisEntryFingerprint(getProgramForAnalysis(date,city,{includeWorkouts:false}))
  const modelSignature=rankingSignature(date)
  const entryFingerprints=Object.fromEntries(getProgramForAnalysis(date,city,{includeWorkouts:false}).map(r=>[Number(r.no),analysisEntryFingerprint([r])]))
  // Explain the ranking actually published to clients, rather than independently
  // reranking against an archive that may have changed since publication.
  const published=(readServedProgram(date)?.races||[]).filter(r=>r.city===city)
  const matchingPublished=published.length>0&&analysisEntryFingerprint(published)===entryFingerprint
  const ranked=await attachRaceForecasts(matchingPublished?published:locallyRankRaces(getProgramForAnalysis(date, city,{includeWorkouts:false}),date),date)
  const races = buildHistoricalAnalysisContext(ranked, date).map((race) => ({
    ...race,
    analysisCandidates:race.rankingSource==='local_trained_model'?race.horses.slice(0,4).map(h=>h.name):undefined,
    surpriseCandidates:surpriseCandidates(race,race.rankingSource==='local_trained_model'?race.horses.slice(0,2).map(h=>h.name):[]),
    surpriseAgfAvailable:race.horses.every(h=>typeof h.marketShare==='number'&&h.marketShare>=0)&&race.horses.some(h=>h.marketShare>0),
    horses: race.horses.map(({ marketShare, horseId, sourceData, probability, baselineProbability, independentScore, ...horse }) => horse),
  }))
  if (!races.length) throw Object.assign(new Error('Önce yarış programı alınmalı.'), { status: 409 })
  analysisLog('context_ready',{date,city,durationMs:Date.now()-preparationStarted,total:races.length})
  const previous=getValidDailyAnalysis(date,city)
  const reusedResults=previous?.analysis?.partial?[{inputHash:previous.inputHash,model:previous.model,analysis:previous.analysis}]:[]
  const completedNos=new Set(reusedResults.flatMap(r=>r.analysis.races.map(p=>Number(p.raceNo))))
  const batches = []
  const batchSize=localAnalysisEnabled()?1:3
  for (let index=0; index<races.length; index+=batchSize){
    let batch=races.slice(index,index+batchSize).filter(r=>!completedNos.has(Number(r.no)))
    if(priorityRaceNo){batch=batch.filter(r=>Number(r.no)===Number(priorityRaceNo))}
    if(!batch.length)continue
    if(batch.length===2)batches.push([batch[0]],[batch[1]])
    else batches.push(batch)
  }
  // Preserve batch membership so existing paid responses remain reusable.
  batches.sort((a,b) => Number(b.some(r => r.no === priorityRaceNo)) - Number(a.some(r => r.no === priorityRaceNo)))
  let completed = completedNos.size
  const completedResults = [...reusedResults]
  const failures=[]
  onProgress({ phase: 'analyzing', completed, total: races.length })
  const freshResults = await mapWithConcurrency(batches, localAnalysisEnabled()?1:2, async batch => {
    try{
    let result
    try{result=await analyzeDailyBatch(date,city,batch)}catch(error){
      if(!localAnalysisEnabled()||error.code==='deployment_pause')throw error
      analysisLog('local_data_summary',{date,city,raceNos:batch.map(r=>r.no),code:analysisErrorCode(error)})
      result={date,city,model:explanationModel(),inputHash:createHash('sha256').update('verified-data-summary:'+analysisFingerprint(batch)).digest('hex'),analysis:localEvidenceAnalysis(batch,{date}),createdAt:new Date().toISOString()}
    }
    completedResults.push(result)
    completed += batch.length
    const currentProgram=getProgramForAnalysis(date,city,{includeWorkouts:false})
    if(analysisEntryFingerprint(currentProgram)!==entryFingerprint||!sameRankingModels(rankingSignature(date),modelSignature))throw Error('Program analiz sırasında değişti; güncel programla tekrar deneyin.')
    const partialRaces=completedResults.flatMap(r=>r.analysis.races).map(p=>{const rich=races.find(r=>r.city===p.city&&Number(r.no)===Number(p.raceNo)),enriched=rich?enrichCommentaryRace(rich,p,date):p;return {...enriched,surprise:validSurprise(currentProgram.find(r=>r.city===p.city&&Number(r.no)===Number(p.raceNo)),enriched)}})
    const partialAnalysis={version:dailyAnalysisVersion,programFingerprint,entryFingerprint,entryFingerprints,publishedCandidateSignature:candidateSignature(ranked),rankingSignature:modelSignature,partial:partialRaces.length<races.length,summary:'Tamamlanan koşular gösteriliyor; diğer yorumlar hazırlanıyor.',races:partialRaces}
    const partialHash=createHash('sha256').update(completedResults.map(r=>r.inputHash).join(':')).digest('hex'),partialAt=new Date().toISOString()
    saveDailyAiAnalysis({date,city,model:result.model,inputHash:partialHash,analysis:partialAnalysis,createdAt:partialAt})
    for(const current of ranked.filter(r=>partialRaces.some(p=>Number(p.raceNo)===Number(r.no))))saveForecastSnapshots({date,races:[current],source:'daily_ai',modelVersion:`daily-${dailyAnalysisVersion}:${current.rankingMethod||'baseline'}`,inputHash:partialHash,predictions:partialRaces,capturedAt:partialAt})
    onProgress({ phase: 'analyzing', completed, total: races.length, analysis:{summary:'Tamamlanan koşular gösteriliyor; diğer koşuların analizi sürüyor.',races:partialRaces} })
    return result
    }catch(error){failures.push(error);analysisLog('batch_error',{date,city,raceNos:batch.map(r=>r.no),code:analysisErrorCode(error)});return null}
  })
  const results=[...reusedResults,...freshResults].filter(Boolean)
  if(failures.length){const partial=findDailyAiAnalysis(date,city);if(partial?.analysis?.entryFingerprint===entryFingerprint&&partial.analysis.races?.length)return saveDailyAiAnalysis({...partial,analysis:{...partial.analysis,partial:true,notice:analysisError(failures[0])}});throw failures[0]}
  const analysis = { version: dailyAnalysisVersion, programFingerprint, entryFingerprint, entryFingerprints, publishedCandidateSignature:candidateSignature(ranked), rankingSignature:modelSignature,summary: [...new Set(results.map((result) => result.analysis.summary))].join(' ').slice(0,1800), races: results.flatMap((result) => result.analysis.races) }
  if (analysis.races.length !== races.length&&!priorityRaceNo) throw new Error('Günlük analiz tamamlanmadı; kayıt yapılmadı.')
  analysis.partial=analysis.races.length!==races.length
  analysis.races=analysis.races.map(p=>{const rich=races.find(r=>r.city===p.city&&Number(r.no)===Number(p.raceNo));return rich?enrichCommentaryRace(rich,p,date):p})
  analysis.explanationRevision='evidence-v2'
  const inputHash=createHash('sha256').update(results.map((result) => result.inputHash).join(':')).digest('hex')
  const createdAt=new Date().toISOString()
  // Discard a response if the field changed while the model was working.
  if(analysisEntryFingerprint(getProgramForAnalysis(date,city,{includeWorkouts:false}))!==entryFingerprint||!sameRankingModels(rankingSignature(date),modelSignature))throw new Error('Program analiz sırasında değişti; güncel programla tekrar deneyin.')
  for(const race of races)saveForecastSnapshots({date,races:[race],source:'daily_ai',modelVersion:`daily-${dailyAnalysisVersion}:${race.rankingMethod||'baseline'}`,inputHash,predictions:analysis.races,capturedAt:createdAt})
  return saveDailyAiAnalysis({ date, city, model: results[0].model, inputHash, analysis, createdAt })
}

function getValidDailyAnalysis(date, city) {
  if(process.env.HORSERIDE_ANALYSIS_WORKER!=='1'){
   const ready=preparedAnalysisPayloads.get(`${date}:${city}`)
   return ready&&!ready.payload.analysis?.partial&&ready.signature===analysisCacheSignature(readServedProgram(date)?.races||[],city)?ready.payload:null
  }
  const cached = findDailyAiAnalysis(date, city)
  return retainUnchangedDailyAnalysis(cached,{version:dailyAnalysisVersion,rankingSignature:rankingSignature(date),program:getProgramForAnalysis(date,city,{includeWorkouts:false}),rankedProgram:readServedProgram(date)?.races||[]})
}

function dailyAnalysisPayload(date,city,record,cached=true){
 const program=readServedProgram(date)?.races||[]
 return {date,city,createdAt:record.createdAt,cached,analysis:publicAnalysis({...record.analysis,races:record.analysis.races.map(p=>({...p,surprise:validSurprise(program.find(r=>r.city===p.city&&Number(r.no)===Number(p.raceNo)),p)}))})}
}
const preparedAnalysisPayloads=new Map()
function rememberPreparedAnalysis(date,city,record){
 const races=readServedProgram(date)?.races||[]
 const payload=dailyAnalysisPayload(date,city,record)
 preparedAnalysisPayloads.set(`${date}:${city}`,{signature:analysisCacheSignature(races,city),payload})
 while(preparedAnalysisPayloads.size>24)preparedAnalysisPayloads.delete(preparedAnalysisPayloads.keys().next().value)
 return payload
}
const savedAnalysisLookups=new Map()
async function restoreSavedAnalysis(date,city){
 const ready=getValidDailyAnalysis(date,city)
 if(ready||process.env.HORSERIDE_ANALYSIS_WORKER==='1')return ready
 const races=readServedProgram(date)?.races||[]
 if(!races.some(r=>r.city===city))return null
 const key=`${date}:${city}`,signature=analysisCacheSignature(races,city),previous=savedAnalysisLookups.get(key)
 if(previous?.signature===signature&&Date.now()-previous.at<60000)return previous.promise
 const lookup={signature,at:Date.now()}
 lookup.promise=runAnalysisWorker(date,city,()=>{},null,{cacheOnly:true,timeoutMs:30000}).then(result=>result.record&&signature===analysisCacheSignature(readServedProgram(date)?.races||[],city)?rememberPreparedAnalysis(date,city,result.record):null).catch(error=>{savedAnalysisLookups.delete(key);throw error})
 savedAnalysisLookups.set(key,lookup)
 while(savedAnalysisLookups.size>40)savedAnalysisLookups.delete(savedAnalysisLookups.keys().next().value)
 return lookup.promise
}
const analysisPrewarmer=createAnalysisPrewarmer({
 priorities:localAnalysisEnabled()?['İstanbul','Elazığ']:[],
 blocked:()=>Boolean(analysisAccessStatus().blocked&&!(localAnalysisEnabled()&&billingCodes.has(analysisAccessStatus().code)))||(!localAnalysisEnabled()&&analysisUsageLedger().summary().remainingTokens<30000),
 ready:(date,city)=>{const record=getValidDailyAnalysis(date,city);if(record)rememberPreparedAnalysis(date,city,record);return record&&!record.analysis?.partial?record:null},
 run:async(date,city)=>{
  const job=analysisJobs.start(`${date}:${city}`,async report=>{
   const result=await getOrCreateDailyAnalysis(date,city,report)
   return rememberPreparedAnalysis(date,city,result.record)
  })
  while(analysisJobs.get(job.id)?.status==='running')await new Promise(resolve=>setTimeout(resolve,500))
  const result=analysisJobs.get(job.id)
  if(result?.status==='error')throw Error(result.error)
 }
})
const storedAnalysisRestores=new Map()
let restoringAnalyses=false
async function restoreServerAnalyses(day,snapshot){
 if(restoringAnalyses)return
 restoringAnalyses=true
 try{
  for(const city of new Set(snapshot.races.map(r=>r.city))){
   if(getValidDailyAnalysis(day,city))continue
   const key=`${day}:${city}`,signature=analysisCacheSignature(snapshot.races,city),attempt=storedAnalysisRestores.get(key)
   if(attempt?.signature===signature&&Date.now()-attempt.at<300000)continue
   storedAnalysisRestores.set(key,{signature,at:Date.now()})
   try{
    // Restore persisted explanations without workouts, network fetches or paid generation.
    const result=await runAnalysisWorker(day,city,()=>{},null,{cacheOnly:true,timeoutMs:30000})
    if(result.record&&signature===analysisCacheSignature(readServedProgram(day)?.races||[],city))rememberPreparedAnalysis(day,city,result.record)
   }catch(error){console.error('Analysis cache restore:',city,error.message)}
  }
  for(const key of storedAnalysisRestores.keys())if(!key.startsWith(day+':'))storedAnalysisRestores.delete(key)
 }finally{restoringAnalyses=false}
}
function prepareServerAnalyses(day,snapshot){
 if(snapshot?.races?.length)
  void restoreServerAnalyses(day,snapshot).then(()=>{
   if((localAnalysisEnabled()||process.env.OPENAI_API_KEY)&&process.env.HORSERIDE_AI_PREWARM!=='0')return analysisPrewarmer.tick(day,snapshot.races)
  }).catch(error=>console.error('Analysis warmup:',error.message))
}

async function getOrCreateDailyAnalysis(date, city, onProgress = () => {}, priorityRaceNo = null) {
  const ready=await restoreSavedAnalysis(date,city)
  if(ready&&(!ready.analysis?.partial||priorityRaceNo&&ready.analysis.races.some(r=>Number(r.raceNo)===Number(priorityRaceNo))))return {record:ready,cached:true}
  assertAnalysisAccess()
  if(process.env.HORSERIDE_ANALYSIS_WORKER!=='1'){
   const key=`${date}:${city}`
   let pending=dailyAnalysisRequests.get(key)
   if(!pending){
    pending=(async()=>{
     const published=(readServedProgram(date)?.races||[]).filter(r=>r.city===city)
     if(analysisEntryFingerprint(published)!==analysisEntryFingerprint(getProgramForAnalysis(date,city,{includeWorkouts:false}))){
      analysisLog('program_sync_required',{date,city})
      onProgress({phase:'preparing',completed:0,total:published.length})
      await waitForAnalysisProgram({matches:()=>analysisEntryFingerprint((readServedProgram(date)?.races||[]).filter(r=>r.city===city))===analysisEntryFingerprint(getProgramForAnalysis(date,city,{includeWorkouts:false})),refresh:()=>refreshServedProgram(date)})
      if(analysisEntryFingerprint((readServedProgram(date)?.races||[]).filter(r=>r.city===city))!==analysisEntryFingerprint(getProgramForAnalysis(date,city,{includeWorkouts:false})))throw Error('Program değişti; güncel analiz hazırlanacak.')
     }
     const signature=analysisCacheSignature(readServedProgram(date)?.races||[],city)
     const result=await runAnalysisWorker(date,city,onProgress,priorityRaceNo,{timeoutMs:localAnalysisEnabled()?60*60000:10*60000})
     if(signature!==analysisCacheSignature(readServedProgram(date)?.races||[],city))throw Error('Program değişti; güncel analiz hazırlanacak.')
     if(!reusableDailyAnalysis(result.record,{version:dailyAnalysisVersion,rankingSignature:rankingSignature(date),program:getProgramForAnalysis(date,city,{includeWorkouts:false}),rankedProgram:readServedProgram(date)?.races||[]}))throw Error('Güncel aday sırası değişti; analiz yeniden hazırlanacak.')
     rememberPreparedAnalysis(date,city,result.record)
     return result
    })().finally(()=>dailyAnalysisRequests.delete(key))
    dailyAnalysisRequests.set(key,pending)
   }
   return pending
  }
  const cached = getValidDailyAnalysis(date, city)
  if (cached&&(!cached.analysis?.partial||priorityRaceNo&&cached.analysis.races.some(r=>Number(r.raceNo)===Number(priorityRaceNo)))) return { record: cached, cached: true }

  const key = `${date}:${city}`
  let pending = dailyAnalysisRequests.get(key)
  if (!pending) {
    pending = (async () => {
      const total = getProgramForAnalysis(date, city,{includeWorkouts:false}).length
      if (!total) throw Object.assign(new Error('Önce yarış programı alınmalı.'), { status: 409 })
      onProgress({ phase: 'preparing', completed: 0, total })
      const enrichment=await waitForEnrichment(ensureWorkouts(date,city))
      if(!enrichment.ready)console.warn('Analysis uses available workout archive; refresh pending or unavailable:',city)
      const ready = getValidDailyAnalysis(date, city)
      const published=(readServedProgram(date)?.races||[]).filter(r=>r.city===city)
      if(!ready&&analysisEntryFingerprint(published)!==analysisEntryFingerprint(getProgramForAnalysis(date,city,{includeWorkouts:false})))throw Error('Program değişti; güncel analiz hazırlanacak.')
      return ready&&(!ready.analysis?.partial||priorityRaceNo&&ready.analysis.races.some(r=>Number(r.raceNo)===Number(priorityRaceNo)))?ready:createDailyAnalysis(date, city, onProgress, priorityRaceNo)
    })()
    dailyAnalysisRequests.set(key, pending)
  }
  try {
    return { record: await pending, cached: false }
  } finally {
    if (dailyAnalysisRequests.get(key) === pending) dailyAnalysisRequests.delete(key)
  }
}

function summarizeProspectiveForecasts(sinceDate,country='TR') {
  const outcomes=new Map()
  for(const row of listBacktestEntries(sinceDate)){
    const key=`${row.date}:${row.city}:${row.raceNo}`
    if(!outcomes.has(key))outcomes.set(key,new Map())
    outcomes.get(key).set(horseIdentity(row.horseName),row.finishPosition)
  }
  if(country!=='TR')for(const race of listHistoricalRaces().filter(r=>r.foreign&&r.date>=sinceDate&&racingCountry(r.city)===country))outcomes.set(`${race.date}:${race.city}:${race.no}`,new Map(race.horses.map(h=>[horseIdentity(h.name),race.results.get(h.no)?.finishPosition])))
  return summarizeForecasts(listForecastSnapshots(sinceDate),outcomes,country==='TR'&&loadRankingModel()?.metadata?.inputs?.includes('workouts'),country,country==='TR'?loadRankingModel()?.metadata?.method:null)
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
  let winnerInTopThree=0
  let marketFavoriteHits = 0
  let marketFavoriteRaces = 0
  let brierTotal = 0
  let expectedTopOneTotal = 0
  let walkForwardRaces = 0
  let walkForwardTopOneHits = 0
  let walkForwardBaselineHits = 0
  let walkForwardTopThreeHits = 0
  let walkForwardTopThreeCoverage = 0
  let walkForwardWinnerInTopThree=0
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
    const topThreeRaceHit = selectedTopThree.some((row) => row.finishPosition > 0 && row.finishPosition <= 3)
    if (topThreeRaceHit) topThreeCoverage += 1
    if(selectedTopThree.some(row=>row.finishPosition===1))winnerInTopThree++
    topThreeHits += selectedTopThree.filter((row) => row.finishPosition > 0 && row.finishPosition <= 3).length

    const walkForwardRows = rows.filter((row) => Number.isInteger(row.walkForwardRank))
    if (walkForwardRows.length === rows.length) {
      walkForwardRaces += 1
      const walkForwardPredicted = walkForwardRows.find((row) => row.walkForwardRank === 1)
      const walkForwardWinnerHit = walkForwardRows.some((row) => row.finishPosition === 1 && row.horseNo === walkForwardPredicted?.horseNo)
      if (walkForwardWinnerHit) walkForwardTopOneHits += 1
      const baselinePredicted = rows.find((row) => row.modelRank === 1)
      if (winnerRows.some((row) => row.horseNo === baselinePredicted?.horseNo)) walkForwardBaselineHits += 1
      const walkForwardTopThree = walkForwardRows.filter((row) => row.walkForwardRank <= 3)
      if (walkForwardTopThree.some((row) => row.finishPosition > 0 && row.finishPosition <= 3)) walkForwardTopThreeCoverage += 1
      if(walkForwardTopThree.some(row=>row.finishPosition===1))walkForwardWinnerInTopThree++
      walkForwardTopThreeHits += walkForwardTopThree.filter((row) => row.finishPosition > 0 && row.finishPosition <= 3).length
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
    topThree: { hits: topThreeHits, picks: evaluatedRaces * 3, precision: percentage(topThreeHits, evaluatedRaces * 3), raceCoverage: percentage(topThreeCoverage, evaluatedRaces),winnerCoverage:percentage(winnerInTopThree,evaluatedRaces) },
    walkForward: {
      races: walkForwardRaces,
      topOne: { hits: walkForwardTopOneHits, races: walkForwardRaces, rate: percentage(walkForwardTopOneHits, walkForwardRaces) },
      topThree: { hits: walkForwardTopThreeHits, picks: walkForwardRaces * 3, precision: percentage(walkForwardTopThreeHits, walkForwardRaces * 3), raceCoverage: percentage(walkForwardTopThreeCoverage, walkForwardRaces),winnerCoverage:percentage(walkForwardWinnerInTopThree,walkForwardRaces) },
      brierScore: walkForwardRaces ? Number((walkForwardBrierTotal / walkForwardRaces).toFixed(4)) : null,
      improvementVsBaseline: walkForwardRaces ? Number((walkForwardTopOneHits / walkForwardRaces * 100 - walkForwardBaselineHits / walkForwardRaces * 100).toFixed(1)) : null,
    },
    closingFavorite: { hits: marketFavoriteHits, races: marketFavoriteRaces, rate: percentage(marketFavoriteHits, marketFavoriteRaces) },
    brierScore: evaluatedRaces ? Number((brierTotal / evaluatedRaces).toFixed(4)) : null,
    averagePredictedTopOne: evaluatedRaces ? Number((expectedTopOneTotal / evaluatedRaces * 100).toFixed(1)) : null,
    prospective: summarizeProspectiveForecasts(sinceDate),
    foreignProspective:summarizeProspectiveForecasts(sinceDate,'US'),
    localRanking: loadRankingModel()?.metadata||null,
    foreignRanking: ['US','GB','FR','ZA'].map(country=>{try{return JSON.parse(readFileSync(`data/foreign-models/${country}-report.json`,'utf8'))}catch{return null}}).filter(Boolean),
    speedClassExperiments: (()=>{try{return JSON.parse(readFileSync('data/foreign-models-performance/training-report.json','utf8')).countries.filter(r=>r.test)}catch{return []}})(),
    expandedDataExperiments: (()=>{try{return JSON.parse(readFileSync('data/foreign-models-next/training-report.json','utf8')).countries.filter(r=>r.test)}catch{return []}})(),
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
  return horseIdentity(value).toLowerCase()
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
    if (finishPosition > 0 && finishPosition <= 3) current.topThree += 1
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
              saveHistoricalRace(dateKey,{...race,city:meeting.city},results)
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

async function collectHistoricalDay(dateKey,{foreignOnly=false,countries=null,stageWinnerTargetsPath=null}={}) {
  if(stageWinnerTargetsPath&&!stageWinnerTargetsPath.startsWith('data/external/'))throw Error('Invalid staging path')
  const date=new Date(`${dateKey}T12:00:00`)
  await fetchForeignProgramCities(date)
  const meetings=selectHistoricalMeetings(meetingOptionsByDate.get(dateKey)||[],{foreignOnly,countries})
  const reports=await mapWithConcurrency(meetings,2,async meeting=>{
    try {
      const [program,outcome]=await Promise.all([
        withRetries(()=>fetchProgram(date,meeting.city,{isForeign:foreignOnly,meetingUrl:meeting.url})),
        withRetries(()=>fetchOfficialRaceResults(date,meeting)),
      ])
      let saved=0
      const rejected=[],rejectedDetails=[],winnerTargets=[]
      for(const originalRace of program.races){
        const race={...originalRace,horses:originalRace.horses.filter(h=>!h.outOfRace)}
        const results=outcome.races.get(race.no)
        if(stageWinnerTargetsPath){const target=buildWinnerOnlyTarget(race,results,{date:dateKey,city:meeting.city,programUrl:program.url,resultUrl:outcome.url});if(target)winnerTargets.push(target);else rejected.push(race.no);continue}
        if(!results||!race.horses.length||!race.horses.every(h=>resolvedRunnerResult(results.get(h.no)))||![...results.values()].some(r=>r.finishPosition===1)){rejected.push(race.no);rejectedDetails.push({raceNo:race.no,hasResult:!!results,programRunners:race.horses.length,resultRunners:results?.size||0,missingResults:race.horses.filter(h=>!resolvedRunnerResult(results?.get(h.no))).map(h=>({no:h.no,name:h.name})),resultNumbers:results?[...results.keys()]:[]});continue}
        saveHistoricalRace(dateKey,{...race,city:meeting.city,foreign:foreignOnly},results)
        if(!foreignOnly)saveBacktestRace({date:dateKey,city:meeting.city,raceNo:race.no,surface:race.surface,breed:classifyRaceBreed(race),horses:race.horses,results,sourceUrl:program.url,modelVersion:baselineModelVersion})
        saved++
      }
      if(stageWinnerTargetsPath&&winnerTargets.length){
       let staged={races:[]};try{staged=JSON.parse(readFileSync(stageWinnerTargetsPath,'utf8'))}catch{}
       const key=r=>JSON.stringify([r.date,r.city,r.no]),merged=new Map(staged.races.map(r=>[key(r),r]));for(const r of winnerTargets)merged.set(key(r),r)
       writeFileSync(stageWinnerTargetsPath,JSON.stringify({races:[...merged.values()]}))
      }
      return {city:meeting.city,saved,stagedWinnerTargets:winnerTargets.length,expected:program.races.length,rejected,rejectedDetails,programUrl:program.url,resultsUrl:outcome.url,outcomeRaceNumbers:[...outcome.races.keys()]}
    } catch(error){return {city:meeting.city,saved:0,error:error.message}}
  })
  return {date:dateKey,meetings:meetings.length,saved:reports.reduce((n,r)=>n+r.saved,0),reports,failures:reports.filter(r=>r.error)}
}

async function collectHorseWorkouts(date,city,limit=100,{horseIds=null}={}){
  const races=getProgramForAnalysis(date,city)
  const selectedIds=horseIds?new Set(horseIds.map(String)):null
  const tasks=races.flatMap(race=>race.horses.filter(h=>h.horseId&&(!selectedIds||selectedIds.has(String(h.horseId)))).map(horse=>({race,horse}))).slice(0,limit)
  const report={attempted:0,withWorkouts:0,failures:[],skipped:0}
  let consecutiveFailures=0
  await mapWithConcurrency(tasks,2,async({race,horse})=>{
    if(consecutiveFailures>=6){report.skipped++;return}
    report.attempted++
    try{
      const url=`https://www.tjk.org/TR/YarisSever/Query/Page/IdmanIstatistikleri?QueryParameter_AtId=${encodeURIComponent(horse.horseId)}`
      const profile=await fetchOfficialProfile(url,'https://www.tjk.org/',city,'tjk_horse_workouts')
      const workouts=summarizeWorkoutHistory(profile.tables,horse.name,date)
      if(!workouts.length)throw new Error('At ve tarih ile doğrulanmış idman kaydı bulunamadı')
      await retrySqliteBusy(()=>saveHorseWorkouts(date,race.city,race.no,horse.no,horse.horseId,workouts))
      if(profile.rawSource)await retrySqliteBusy(()=>saveProgram({date,city,fetchedAt:new Date().toISOString(),races:[],rawSources:[profile.rawSource]}))
      report.withWorkouts++;consecutiveFailures=0
    }catch(error){consecutiveFailures++;report.failures.push({raceNo:race.no,horseName:horse.name,error:error.message})}
  })
  return report
}

let settlementPending=null
async function settleForecasts(){
  if(settlementPending)return settlementPending
  if(process.env.HORSERIDE_ANALYSIS_WORKER!=='1'){
   settlementPending=runAnalysisWorker('','',()=>{},null,{worker:new URL('./settlement-worker.mjs',import.meta.url)}).finally(()=>{settlementPending=null})
   return settlementPending
  }
  const today=formatDate(new Date()).iso
  const since=new Date(Date.now()-14*86400000).toISOString().slice(0,10)
  const forecasts=listForecastSnapshots(since)
  const known=new Set(listBacktestEntries(since).map(r=>`${r.date}:${r.city}:${r.raceNo}`))
  for(const race of listHistoricalRaces().filter(r=>r.foreign&&r.date>=since))known.add(`${race.date}:${race.city}:${race.no}`)
  const dates=[...new Set(forecasts.filter(r=>r.date<today&&!known.has(`${r.date}:${r.city}:${r.race_no}`)).map(r=>r.date))].slice(0,3)
  settlementPending=(async()=>{for(const date of dates){const daily=forecasts.filter(r=>r.date===date);if(daily.some(r=>!racingCountry(r.city)))await collectHistoricalDay(date);if(daily.some(r=>racingCountry(r.city)))await collectHistoricalDay(date,{foreignOnly:true})}})()
  try{await settlementPending}finally{settlementPending=null}
}


async function buildFreshProgramPayload(date,city) {
    const started=Date.now(),day=formatDate(date).iso
    analysisLog('program_fetch_started',{date:day,city})
    const result = await fetchPrograms(date, city)
    analysisLog('program_fetch_ready',{date:day,city,durationMs:Date.now()-started,total:result.races.length})
    const walkForwardModel = result.races.some(r=>!racingCountry(r.city))?getWalkForwardModelForDate(formatDate(date).iso):null
    const baselineRaces = walkForwardModel
      ? result.races.map((race) => racingCountry(race.city)?race:scoreRace(race, { weights: walkForwardModel.weights, history: walkForwardModel.history }))
      : result.races
    const fetchedAt = new Date().toISOString()
    const modelTrainedThroughDate = walkForwardModel ? new Date(date) : null
    if (modelTrainedThroughDate) modelTrainedThroughDate.setDate(modelTrainedThroughDate.getDate() - 1)
    const stored = saveProgram({ city: result.city, date: formatDate(date).iso, fetchedAt, providerUrl: result.providerUrls[0], races: baselineRaces, rawSources: result.rawSources || [] })
    const storedProgram = loadStoredProgram(formatDate(date).iso, city)
    const scoredRaces=attachOfficialMarketEvidence(locallyRankRaces(storedProgram.length?restoreProgramPrizes(storedProgram,baselineRaces):baselineRaces,formatDate(date).iso),baselineRaces)
    analysisLog('program_ranking_ready',{date:day,city,durationMs:Date.now()-started})
    if(!isAllCitySelection(city)&&(racingCountry(city)==='US'||scoredRaces.some(r=>r.horses.some(h=>h.horseId))))void ensureWorkouts(formatDate(date).iso,city).catch(error=>console.error('Workout enrichment:',error.message))
    recordCompletedNumericForecasts({date:formatDate(date).iso,races:scoredRaces,save:saveForecastSnapshots,fingerprint:analysisFingerprint,baselineModel:walkForwardModel?.modelVersion||baselineModelVersion})
    const firstLearned=scoredRaces.find(r=>r.rankingSource==='local_trained_model')
    const learned=firstLearned?(loadForeignRankingModel(racingCountry(firstLearned.city))||loadRankingModel())?.metadata:null
    const displayedRaces=scoredRaces
    const forecastRaces=await attachRaceForecasts(displayedRaces,formatDate(date).iso)
    return { source: result.source, city: result.city, date: formatDate(date).iso, fetchedAt, providerUrls: result.providerUrls, failures: result.failures, meetings: result.meetings || meetingOptionsByDate.get(formatDate(date).iso) || [], races: forecastRaces, agfUsed: false, jockeyHistoryUsed: Boolean(walkForwardModel||learned), stored, model: learned?.method || walkForwardModel?.modelVersion || baselineModelVersion, modelTrainingStartDate: learned?.train.from || walkForwardModel?.trainingStartDate || null, modelTrainedThrough: learned?.trainedThrough || (modelTrainedThroughDate ? formatDate(modelTrainedThroughDate).iso : null), modelTrainingRaces: learned?.liveTrainingRaces || walkForwardModel?.trainingRaces || 0 }
}

const homeDeployment=process.env.HORSERIDE_NO_LISTEN==='1'?null:remoteDeployment()
export const server = createServer(async (request, response) => {
  if(homeDeployment)return forwardToHome(request,response,homeDeployment)
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
  if (requestUrl.pathname === '/api/health') return sendJson(response, 200, { ok: true, service: 'horseride-data', aiConfigured: localAnalysisEnabled()||Boolean(process.env.OPENAI_API_KEY),analysisRunning:analysisJobs.runningCount() })
  if (requestUrl.pathname === '/api/maintenance' && request.method === 'GET') {
    try { return sendJson(response, 200, JSON.parse(readFileSync('data/maintenance/state.json','utf8'))) }
    catch { return sendJson(response, 200, { phase: 'not_started' }) }
  }
  if (requestUrl.pathname === '/api/performance' && request.method === 'GET') {
    const days = Number(requestUrl.searchParams.get('days') || 90)
    if (!Number.isInteger(days) || days < 1 || days > 90) return sendJson(response, 400, { error: 'Gün aralığı 1-90 arasında olmalı.' })
    return sendJson(response, 200, { performance: performanceSummary(days) })
  }
  if(requestUrl.pathname==='/api/data/quality'&&request.method==='GET'){
    const date=String(requestUrl.searchParams.get('date')||formatDate(new Date()).iso)
    const city=String(requestUrl.searchParams.get('city')||defaultCity)
    const races=buildHistoricalAnalysisContext(getProgramForAnalysis(date,city),date)
    return sendJson(response,200,{date,city,quality:programQuality(races),foreignArchive:foreignCoverage(listHistoricalRaces()),races:races.map(r=>({raceNo:r.no,runners:r.horses.length,history:r.horses.filter(h=>h.evidenceCoverage.recentRuns>0).length,matchedDistanceAndSurface:r.horses.filter(h=>h.horsePerformance.sameDistanceAndSurface.starts>0).length,rivalFields:r.horses.filter(h=>h.evidenceCoverage.matchedCompetitionFields>0).length,workouts:r.horses.filter(h=>h.workout).length}))})
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
    if (!['GET', 'POST'].includes(request.method)) return sendJson(response, 405, { error: 'Bu endpoint GET veya POST bekliyor.' })
    try {
      const body = request.method === 'GET' ? Object.fromEntries(requestUrl.searchParams) : await readJsonBody(request)
      const date = String(body.date || '')
      const city = String(body.city || '').trim()
      const parsedDate = new Date(`${date}T12:00:00`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || formatDate(parsedDate).iso !== date) {
        return sendJson(response, 400, { error: 'Geçersiz tarih.' })
      }
      if (!city || city.length > 80) return sendJson(response, 400, { error: 'Geçerli şehir gerekli.' })
      const toPayload = result => {
        const program=(readServedProgram(date)?.races||[]).filter(r=>r.city===city)
        return {date,city,createdAt:result.record.createdAt,cached:result.cached,analysis:publicAnalysis({...result.record.analysis,races:result.record.analysis.races.map(p=>({...p,surprise:validSurprise(program.find(r=>r.city===p.city&&Number(r.no)===Number(p.raceNo)),p)}))})}
      }
      const cached = await restoreSavedAnalysis(date, city)
      if (cached && (request.method === 'GET' || !cached.analysis.partial || cached.analysis.races.some(r => Number(r.raceNo) === Number(body.raceNo)))) return sendJson(response, 200, toPayload({ record: cached, cached: true }))
      assertAnalysisAccess()
      if (request.method === 'GET') return sendJson(response, 200, { date, city, available: false, job: analysisJobs.getRunning(`${date}:${city}`) })
      if (body.async === true) {
        const job = analysisJobs.start(`${date}:${city}`, async report => toPayload(await getOrCreateDailyAnalysis(date, city, report, Number(body.raceNo) || null)))
        return sendJson(response, 202, { job })
      }
      const result = await getOrCreateDailyAnalysis(date, city)
      return sendJson(response, 200, toPayload(result))
    } catch (error) {
      analysisLog('request_error',{code:analysisErrorCode(error),status:error.status||502})
      return sendJson(response, error.status || 502, { error: billingCodes.has(error.code)?`AI yorum servisi geçici olarak kapalı. ${analysisError(error)}`:analysisError(error),code:error.code })
    }
  }
  if (requestUrl.pathname.startsWith('/api/analysis/jobs/') && request.method === 'GET') {
    const job = analysisJobs.get(requestUrl.pathname.slice('/api/analysis/jobs/'.length))
    return job ? sendJson(response, 200, { job }) : sendJson(response, 404, { error: 'Analiz oturumu bulunamadı. Yeniden deneyin.' })
  }
  if(requestUrl.pathname==='/api/recommendations/record'&&request.method==='POST'){
   try{const body=await readJsonBody(request);const day=localDay();if(typeof body.date!=='string'||![shiftDay(day,-1),day,shiftDay(day,1)].includes(body.date)||typeof body.city!=='string'||body.city.length>80)return sendJson(response,400,{error:'Geçerli gün ve hipodrom gerekli.'});return sendJson(response,200,recordShownRecommendations(body))}catch{return sendJson(response,503,{error:'Kupon kaydı henüz alınamadı.'})}
  }
  if(requestUrl.pathname==='/api/application-report'&&request.method==='GET'){
    const period=requestUrl.searchParams.get('period')||'week',scope=requestUrl.searchParams.get('scope')||'all',source=requestUrl.searchParams.get('source')||'numeric'
    if(!['week','total'].includes(period)||!['all','domestic','foreign'].includes(scope)||!['numeric','daily_ai'].includes(source))return sendJson(response,400,{error:'Geçersiz rapor filtresi.'})
    try{return sendJson(response,200,await publicRead('report',{period,scope,source}))}catch(error){console.error('Application report:',error.message);return sendJson(response,503,{error:'Rapor güncelleniyor. Kısa süre sonra tekrar deneyin.'})}
  }
  if(requestUrl.pathname==='/api/simulation'&&request.method==='GET'){try{return sendJson(response,200,await publicRead('simulation'))}catch(error){console.error('Simulation:',error.message);return sendJson(response,503,{error:'Simülasyon güncelleniyor.'})}}
  if(requestUrl.pathname==='/api/coupon-showcase'&&request.method==='GET'){
   const date=requestUrl.searchParams.get('date')||localDay(),city=requestUrl.searchParams.get('city')
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return sendJson(response,400,{error:'Geçersiz tarih.'})
   if(city&&city.length>80)return sendJson(response,400,{error:'Geçersiz hipodrom.'})
   for(let attempt=0;attempt<3;attempt++)try{return sendJson(response,200,await readCouponShowcase(date,city&&!isAllCitySelection(city)?city:''))}catch(error){
    if(!/database is (?:locked|busy)/i.test(error.message)||attempt===2){console.error('Coupon showcase:',error.message);return sendJson(response,503,{error:'Kupon kayıtları güncelleniyor; kısa süre sonra otomatik yeniden denenecek.'})}
    await new Promise(resolve=>setTimeout(resolve,150))
   }
  }
  if(requestUrl.pathname==='/api/analysis/usage'&&request.method==='GET')return sendJson(response,200,{...analysisUsageLedger().summary(),provider:localAnalysisEnabled()?'local':'cloud',local:localAnalysisEnabled()?localAnalysisLedger().summary():null})
  if(requestUrl.pathname==='/api/daily-ticket'&&request.method==='GET'){
    const date=requestUrl.searchParams.get('date')||formatDate(new Date()).iso
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return sendJson(response,400,{error:'Geçersiz tarih.'})
    try{return sendJson(response,200,dailyApplicationTicket(date))}catch(error){console.error('Daily ticket:',error.message);return sendJson(response,503,{error:'Günlük kupon güncelleniyor. Kısa süre sonra tekrar deneyin.'})}
  }
  if(requestUrl.pathname==='/api/social-coupons'&&request.method==='GET'){
    const date=requestUrl.searchParams.get('date')||'',city=(requestUrl.searchParams.get('city')||'').trim()
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(`${date}T12:00:00Z`))||!city||city.length>80)return sendJson(response,400,{error:'Geçerli tarih ve hipodrom gerekli.'})
    const program=readServedProgram(date),races=(program?.races||[]).filter(r=>r.city===city)
    return sendJson(response,200,await getSocialCoupons(date,city,races))
  }
  if (requestUrl.pathname === '/api/commentary' && request.method === 'GET') {
    const date = String(requestUrl.searchParams.get('date') || '')
    const city = String(requestUrl.searchParams.get('city') || '').trim()
    const parsedDate = new Date(`${date}T12:00:00`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || formatDate(parsedDate).iso !== date) {
      return sendJson(response, 400, { error: 'Geçersiz tarih.' })
    }
    if (!city || city.length > 80) return sendJson(response, 400, { error: 'Geçerli şehir gerekli.' })
    try {
      return sendJson(response, 200, await loadPublicCommentary(date, city))
    } catch (error) {
      return sendJson(response, error.status || 502, { error: error.message })
    }
  }
  if (requestUrl.pathname === '/api/history/horse') {
    const name = requestUrl.searchParams.get('name')
    if (!name) return sendJson(response, 400, { error: 'name parametresi gerekli.' })
    try{return sendJson(response, 200, await publicRead('horse',{name}))}catch{return sendJson(response,503,{error:'Kaydedilmiş tahmin geçmişi güncelleniyor.'})}
  }
  if (requestUrl.pathname === '/api/history/races') return sendJson(response, 200, { analyses: listRecentAnalyses() })
  if (requestUrl.pathname === '/api/history/health') return sendJson(response, 200, databaseHealth())
  if (requestUrl.pathname === '/api/meetings') {
    const dateParam = requestUrl.searchParams.get('date')
    const date = dateParam ? new Date(`${dateParam}T12:00:00`) : new Date()
    if (Number.isNaN(date.getTime())) return sendJson(response, 400, { error: 'Geçersiz tarih.' })
    const saved=readServedProgram(formatDate(date).iso)
    if(saved?.meetings?.length)return sendJson(response,200,{date:saved.date,meetings:saved.meetings})
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
    const dateISO=formatDate(date).iso
    const snapshot=readServedProgram(dateISO)
    if(!snapshot||Date.now()-Date.parse(snapshot.fetchedAt)>300000)void refreshServedProgram(dateISO).catch(e=>console.error('Background program refresh:',e.message))
    if(!snapshot)return sendJson(response,202,{date:dateISO,city,races:[],meetings:[],refreshing:true,source:'preparing',message:'Program hazırlanıyor; otomatik tekrar denenecek.'})
    const filtered=isAllCitySelection(city)?snapshot.races:isAllForeignSelection(city)?snapshot.races.filter(r=>racingCountry(r.city)):snapshot.races.filter(r=>matchesVenueSelection(city,r.city,r.venue))
    const dailyAnalyses=[...new Set(filtered.map(r=>r.city))].flatMap(meeting=>{
      const prepared=preparedAnalysisPayloads.get(`${dateISO}:${meeting}`)
      if(!prepared||prepared.signature!==analysisCacheSignature(filtered,meeting))return []
      return [{...prepared.payload,analysis:{...prepared.payload.analysis,races:prepared.payload.analysis.races.map(p=>({...p,surprise:validSurprise(filtered.find(r=>r.city===p.city&&Number(r.no)===Number(p.raceNo)),p)}))}}]
    })
    return sendJson(response,200,{...snapshot,city,races:compactProgramRaces(filtered),dailyAnalyses,refreshing:Date.now()-Date.parse(snapshot.fetchedAt)>300000,source:'program_snapshot'})
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
        races: locallyRankRaces(cachedProgram,formatDate(date).iso),
        stored: { storedRaces: cachedProgram.length, fromCache: true },
        model: 'cached_program',
      })
    }
    return sendJson(response, 502, { error: error.message, source: 'tjk_csv' })
  }
})
if (process.env.HORSERIDE_NO_LISTEN !== '1') {
  const stopHttpMeasurement=attachHttpPerformance(server)
  server.once('close',stopHttpMeasurement)
  const bindHost=process.env.HOST||'0.0.0.0'
  server.listen(port,bindHost, () => console.log(`HorseRide data API listening on http://${bindHost}:${port}`))
  if(!homeDeployment){
  void ensureLocalLlm().catch(error=>console.error('Local LLM:',error.message))
  setTimeout(()=>settleForecasts().catch(error=>console.error('Forecast settlement:',error.message)),5000).unref()
  const warmProgram=()=>{
   void ensureLocalLlm().catch(error=>console.error('Local LLM recovery:',error.message))
   const day=formatDate(new Date()).iso,snapshot=readServedProgram(day)
   prepareServerAnalyses(day,snapshot)
   if(!snapshot||Date.now()-Date.parse(snapshot.fetchedAt)>300000)
    void refreshServedProgram(day).then(fresh=>prepareServerAnalyses(day,fresh)).catch(e=>console.error('Program warmup:',e.message))
   else prepareServerAnalyses(day,snapshot)
  }
  setTimeout(warmProgram,1000).unref();setInterval(warmProgram,60000).unref()
  setInterval(()=>settleForecasts().catch(error=>console.error('Forecast settlement:',error.message)),3600000).unref()
  }
}
export { fetchProgram, locallyRankRaces, settleForecasts, getValidDailyAnalysis, getOrCreateDailyAnalysis, buildFreshProgramPayload, buildHistoricalAnalysisContext, parseAnalysisOutput, createDailyAnalysis, performanceSummary, summarizeHorsePerformance, collectHistoricalDay, scoreRace, parseCsv, parseOfficialRaceResults, collectHorseWorkouts }
