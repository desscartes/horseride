import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { parseWeight } from './data-quality.mjs'
import { summarizeWorkoutHistory } from './workout-history.mjs'

const databasePath = resolve(process.env.HORSERIDE_DB || 'data/horseride.sqlite')
mkdirSync(dirname(databasePath), { recursive: true })

const database = new DatabaseSync(databasePath)
database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS races (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    city TEXT NOT NULL,
    race_no INTEGER NOT NULL,
    time TEXT,
    type TEXT,
    distance TEXT,
    surface TEXT,
    conditions TEXT,
    provider_url TEXT,
    fetched_at TEXT NOT NULL,
    UNIQUE(date, city, race_no)
  );
  CREATE TABLE IF NOT EXISTS horses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS race_entries (
    race_id TEXT NOT NULL,
    horse_id TEXT NOT NULL,
    horse_no INTEGER,
    age TEXT,
    sire TEXT,
    dam TEXT,
    weight REAL,
    jockey TEXT,
    trainer TEXT,
    start_number REAL,
    last_six TEXT,
    days_since_race REAL,
    best_time_seconds REAL,
    independent_score REAL,
    probability REAL,
    market_share REAL,
    PRIMARY KEY (race_id, horse_id),
    FOREIGN KEY (race_id) REFERENCES races(id),
    FOREIGN KEY (horse_id) REFERENCES horses(id)
  );
  CREATE TABLE IF NOT EXISTS race_entry_sources (
    race_id TEXT NOT NULL,
    horse_id TEXT NOT NULL,
    source_json TEXT NOT NULL,
    PRIMARY KEY (race_id, horse_id),
    FOREIGN KEY (race_id) REFERENCES races(id),
    FOREIGN KEY (horse_id) REFERENCES horses(id)
  );
  CREATE TABLE IF NOT EXISTS source_snapshots (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    city TEXT NOT NULL,
    source TEXT NOT NULL,
    provider_url TEXT NOT NULL,
    content_type TEXT,
    checksum TEXT NOT NULL,
    raw_content TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    UNIQUE(date, city, provider_url, checksum)
  );
  CREATE TABLE IF NOT EXISTS daily_ai_analyses (
    date TEXT NOT NULL,
    city TEXT NOT NULL,
    model TEXT NOT NULL,
    input_hash TEXT NOT NULL,
    analysis_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY(date, city)
  );
  CREATE TABLE IF NOT EXISTS backtest_entries (
    date TEXT NOT NULL,
    city TEXT NOT NULL,
    race_no INTEGER NOT NULL,
    horse_no INTEGER NOT NULL,
    horse_name TEXT NOT NULL,
    jockey TEXT,
    race_surface TEXT,
    race_breed TEXT,
    model_rank INTEGER NOT NULL,
    model_score REAL NOT NULL,
    probability REAL NOT NULL,
    finish_position INTEGER NOT NULL,
    closing_odds REAL,
    walk_forward_rank INTEGER,
    walk_forward_probability REAL,
    source_url TEXT NOT NULL,
    model_version TEXT NOT NULL,
    PRIMARY KEY (date, city, race_no, horse_no, model_version)
  );
  CREATE TABLE IF NOT EXISTS walk_forward_models (
    target_date TEXT PRIMARY KEY,
    training_start_date TEXT NOT NULL,
    training_races INTEGER NOT NULL,
    weights_json TEXT NOT NULL,
    model_version TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS daily_ai_batches (
    input_hash TEXT PRIMARY KEY, record_json TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS forecast_snapshots (
    id TEXT PRIMARY KEY, date TEXT NOT NULL, city TEXT NOT NULL, race_no INTEGER NOT NULL,
    source TEXT NOT NULL, model_version TEXT NOT NULL, captured_at TEXT NOT NULL,
    scheduled_start TEXT NOT NULL, input_hash TEXT NOT NULL, picks_json TEXT NOT NULL,
    UNIQUE(date, city, race_no, source, input_hash)
  );
  CREATE TABLE IF NOT EXISTS historical_race_data (
    date TEXT NOT NULL, city TEXT NOT NULL, race_no INTEGER NOT NULL,
    race_json TEXT NOT NULL, results_json TEXT NOT NULL, fetched_at TEXT NOT NULL,
    PRIMARY KEY(date, city, race_no)
  );
`)

const backtestColumns = database.prepare('PRAGMA table_info(backtest_entries)').all()
if (!backtestColumns.some((column) => column.name === 'walk_forward_rank')) database.exec('ALTER TABLE backtest_entries ADD COLUMN walk_forward_rank INTEGER')
if (!backtestColumns.some((column) => column.name === 'walk_forward_probability')) database.exec('ALTER TABLE backtest_entries ADD COLUMN walk_forward_probability REAL')
if (!backtestColumns.some((column) => column.name === 'jockey')) database.exec('ALTER TABLE backtest_entries ADD COLUMN jockey TEXT')
if (!backtestColumns.some((column) => column.name === 'race_surface')) database.exec('ALTER TABLE backtest_entries ADD COLUMN race_surface TEXT')
if (!backtestColumns.some((column) => column.name === 'race_breed')) database.exec('ALTER TABLE backtest_entries ADD COLUMN race_breed TEXT')
const raceEntryColumns = database.prepare('PRAGMA table_info(race_entries)').all()
if (!raceEntryColumns.some((column) => column.name === 'market_share')) database.exec('ALTER TABLE race_entries ADD COLUMN market_share REAL')

const raceStatement = database.prepare(`
  INSERT INTO races (id, date, city, race_no, time, type, distance, surface, conditions, provider_url, fetched_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET time=excluded.time, type=excluded.type, distance=excluded.distance, surface=excluded.surface, conditions=excluded.conditions, provider_url=excluded.provider_url, fetched_at=excluded.fetched_at
`)
const horseStatement = database.prepare('INSERT INTO horses (id, name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING')
const entryStatement = database.prepare(`
  INSERT INTO race_entries (race_id, horse_id, horse_no, age, sire, dam, weight, jockey, trainer, start_number, last_six, days_since_race, best_time_seconds, independent_score, probability, market_share)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(race_id, horse_id) DO UPDATE SET jockey=excluded.jockey, trainer=excluded.trainer, weight=excluded.weight, start_number=excluded.start_number, last_six=excluded.last_six, days_since_race=excluded.days_since_race, best_time_seconds=excluded.best_time_seconds, independent_score=excluded.independent_score, probability=excluded.probability, market_share=excluded.market_share
`)
const entrySourceStatement = database.prepare(`
  INSERT INTO race_entry_sources (race_id, horse_id, source_json)
  VALUES (?, ?, ?)
  ON CONFLICT(race_id, horse_id) DO UPDATE SET source_json=excluded.source_json
`)
const snapshotStatement = database.prepare(`
  INSERT INTO source_snapshots (id, date, city, source, provider_url, content_type, checksum, raw_content, fetched_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(date, city, provider_url, checksum) DO UPDATE SET fetched_at=excluded.fetched_at
`)
const recentRacesStatement = database.prepare(`
  SELECT
    r.id,
    r.date,
    r.city,
    r.race_no AS raceNo,
    r.time,
    r.type,
    r.distance,
    r.surface,
    r.conditions,
    r.fetched_at AS fetchedAt,
    (SELECT h.name FROM race_entries e JOIN horses h ON h.id = e.horse_id WHERE e.race_id = r.id ORDER BY e.probability DESC, e.independent_score DESC LIMIT 1) AS favorite,
    (SELECT e.probability FROM race_entries e WHERE e.race_id = r.id ORDER BY e.probability DESC, e.independent_score DESC LIMIT 1) AS confidence,
    (SELECT COUNT(*) FROM race_entries e WHERE e.race_id = r.id) AS horseCount
  FROM races r
  ORDER BY r.date DESC, r.race_no DESC
  LIMIT ?
`)
const raceTopHorsesStatement = database.prepare(`
  SELECT
    h.name,
    e.probability,
    e.independent_score AS independentScore,
    e.jockey,
    e.last_six AS lastSix
  FROM race_entries e
  JOIN horses h ON h.id = e.horse_id
  WHERE e.race_id = ?
  ORDER BY e.probability DESC, e.independent_score DESC
  LIMIT 3
`)

function horseId(name) {
  return name.trim().toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9ÇĞİÖŞÜ]+/gi, '-').replace(/^-|-$/g, '')
}

export function saveProgram({ city, date, fetchedAt, providerUrl, races, rawSources = [] }) {
  for (const race of races) {
    const raceCity = race.city || city
    const raceId = `${date}:${raceCity}:${race.no}`
    raceStatement.run(...[raceId, date, raceCity, race.no, race.time, race.type, race.distance, race.surface, race.conditions, providerUrl, fetchedAt].map(value=>value??null))
    // A withdrawn runner must not survive in SQLite after the official field changes.
    const activeIds = new Set(race.horses.map(horse=>horseId(horse.name)))
    for (const old of database.prepare('SELECT horse_id FROM race_entries WHERE race_id=?').all(raceId)) {
      if (activeIds.has(old.horse_id)) continue
      database.prepare('DELETE FROM race_entry_sources WHERE race_id=? AND horse_id=?').run(raceId,old.horse_id)
      database.prepare('DELETE FROM race_entries WHERE race_id=? AND horse_id=?').run(raceId,old.horse_id)
    }
    for (const horse of race.horses) {
      const id = horseId(horse.name)
      horseStatement.run(id, horse.name)
      entryStatement.run(...[raceId, id, horse.no, horse.age, horse.sire, horse.dam, parseWeight(horse.weight), horse.jockey, horse.trainer, horse.start, horse.lastSix, horse.daysSinceRace, horse.bestTimeSeconds, horse.independentScore, horse.probability, horse.marketShare].map(value=>value??null))
      if (horse.sourceData) entrySourceStatement.run(raceId, id, JSON.stringify(horse.sourceData))
    }
  }

  for (const rawSource of rawSources) {
    if (typeof rawSource.content !== 'string' || !rawSource.providerUrl) continue
    const sourceCity = rawSource.city || city
    const checksum = createHash('sha256').update(rawSource.content).digest('hex')
    const id = createHash('sha256').update(`${date}\n${sourceCity}\n${rawSource.providerUrl}\n${checksum}`).digest('hex')
    snapshotStatement.run(id, date, sourceCity, rawSource.source || 'unknown', rawSource.providerUrl, rawSource.contentType || null, checksum, rawSource.content, fetchedAt)
  }

  return { storedRaces: races.length, storedSnapshots: rawSources.length, databasePath }
}

export function findHorseHistory(name) {
  return database.prepare(`
    SELECT r.date, r.city, r.race_no AS raceNo, r.distance, r.surface, e.weight, e.jockey, e.trainer, e.start_number AS start, e.last_six AS lastSix, e.days_since_race AS daysSinceRace, e.best_time_seconds AS bestTimeSeconds, e.independent_score AS independentScore, e.probability
    FROM race_entries e JOIN horses h ON h.id = e.horse_id JOIN races r ON r.id = e.race_id
    WHERE h.name LIKE ? ORDER BY r.date DESC, r.race_no DESC LIMIT 50
  `).all(`%${name}%`)
}

export function listRecentAnalyses(limit = 12) {
  return recentRacesStatement.all(limit).map((race) => ({
    ...race,
    confidence: Math.round(race.confidence || 0),
    horses: raceTopHorsesStatement.all(race.id).map((horse, index) => ({ ...horse, rank: index + 1 })),
  }))
}

export function databaseHealth() {
  return database.prepare('SELECT COUNT(*) AS entries, (SELECT COUNT(*) FROM races) AS races, (SELECT COUNT(*) FROM horses) AS horses, (SELECT COUNT(*) FROM source_snapshots) AS sourceSnapshots FROM race_entries').get()
}

export function saveBacktestRace({ date, city, raceNo, surface, breed, horses, results, sourceUrl, modelVersion, walkForward = null }) {
  const statement = database.prepare(`
    INSERT INTO backtest_entries (date, city, race_no, horse_no, horse_name, jockey, race_surface, race_breed, model_rank, model_score, probability, finish_position, closing_odds, walk_forward_rank, walk_forward_probability, source_url, model_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date, city, race_no, horse_no, model_version) DO UPDATE SET
      horse_name=excluded.horse_name,
      jockey=excluded.jockey,
      race_surface=excluded.race_surface,
      race_breed=excluded.race_breed,
      model_rank=excluded.model_rank,
      model_score=excluded.model_score,
      probability=excluded.probability,
      finish_position=excluded.finish_position,
      closing_odds=excluded.closing_odds,
      walk_forward_rank=excluded.walk_forward_rank,
      walk_forward_probability=excluded.walk_forward_probability,
      source_url=excluded.source_url
  `)
  for (const [index, horse] of horses.entries()) {
    const result = results.get(Number(horse.no))
    if (!result) continue
    const candidate = walkForward?.get(Number(horse.no))
    statement.run(date, city, raceNo, Number(horse.no), horse.name, horse.jockey || null, surface || null, breed || null, index + 1, horse.independentScore, horse.probability, result.finishPosition, result.closingOdds, candidate?.rank ?? null, candidate?.probability ?? null, sourceUrl, modelVersion)
  }
}

export function listBacktestEntries(sinceDate, endDate = null) {
  return database.prepare(`
    SELECT date, city, race_no AS raceNo, horse_no AS horseNo, horse_name AS horseName, jockey,
      race_surface AS surface, race_breed AS breed,
      model_rank AS modelRank, model_score AS modelScore, probability, finish_position AS finishPosition,
      closing_odds AS closingOdds, walk_forward_rank AS walkForwardRank,
      walk_forward_probability AS walkForwardProbability, model_version AS modelVersion
    FROM backtest_entries
    WHERE date >= ? AND (? IS NULL OR date < ?)
    ORDER BY date, city, race_no, model_rank
  `).all(sinceDate, endDate, endDate)
}

export function clearWalkForwardEntries(startDate, endDate, modelVersion) {
  const update = database.prepare(`
    UPDATE backtest_entries
    SET walk_forward_rank=NULL, walk_forward_probability=NULL
    WHERE date BETWEEN ? AND ? AND model_version=?
  `).run(startDate, endDate, modelVersion)
  database.prepare('DELETE FROM walk_forward_models WHERE target_date BETWEEN ? AND ?').run(startDate, endDate)
  return update
}

export function saveWalkForwardModel({ targetDate, trainingStartDate, trainingRaces, weights, modelVersion }) {
  database.prepare(`
    INSERT INTO walk_forward_models (target_date, training_start_date, training_races, weights_json, model_version, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(target_date) DO UPDATE SET
      training_start_date=excluded.training_start_date,
      training_races=excluded.training_races,
      weights_json=excluded.weights_json,
      model_version=excluded.model_version,
      created_at=excluded.created_at
  `).run(targetDate, trainingStartDate, trainingRaces, JSON.stringify(weights), modelVersion, new Date().toISOString())
}

export function findLatestWalkForwardModel(targetDate) {
  const row = database.prepare(`
    SELECT target_date AS targetDate, training_start_date AS trainingStartDate,
      training_races AS trainingRaces, weights_json AS weightsJson, model_version AS modelVersion
    FROM walk_forward_models
    WHERE target_date <= ?
    ORDER BY target_date DESC LIMIT 1
  `).get(targetDate)
  return row ? { ...row, weights: JSON.parse(row.weightsJson) } : null
}

export function getProgramForAnalysis(date, city) {
  const entries = database.prepare(`
    SELECT r.id AS raceId, r.city, r.race_no AS raceNo, r.time, r.type, r.distance, r.surface, r.conditions,
      e.horse_no AS horseNo, h.name AS horseName, e.age, e.sire, e.dam, e.weight, e.jockey, e.trainer,
      e.start_number AS start, e.last_six AS lastSix, e.days_since_race AS daysSinceRace,
      e.best_time_seconds AS bestTimeSeconds, e.independent_score AS independentScore, e.probability, e.market_share AS marketShare,
      s.source_json AS sourceJson
    FROM races r
    JOIN race_entries e ON e.race_id = r.id
    JOIN horses h ON h.id = e.horse_id
    LEFT JOIN race_entry_sources s ON s.race_id = r.id AND s.horse_id = e.horse_id
    WHERE r.date = ? AND (? IN ('Tümü', 'Tüm program') OR r.city = ?)
    ORDER BY r.city, r.race_no, e.horse_no
  `).all(date, city, city)
  const workoutSnapshots = database.prepare(`
    SELECT provider_url AS providerUrl, raw_content AS rawContent
    FROM source_snapshots
    WHERE date = ? AND source = 'tjk_workout'
  `).all(date)
  const workoutsByRaceCode = new Map()
  for (const snapshot of workoutSnapshots) {
    try {
      const raceCode = new URL(snapshot.providerUrl).searchParams.get('KosuKodu')
      if (raceCode) workoutsByRaceCode.set(raceCode, JSON.parse(snapshot.rawContent))
    } catch {
      continue
    }
  }

  const racesById = new Map()
  for (const entry of entries) {
    if (!racesById.has(entry.raceId)) {
      racesById.set(entry.raceId, {
        city: entry.city,
        no: entry.raceNo,
        time: entry.time,
        type: entry.type,
        distance: entry.distance,
        surface: entry.surface,
        conditions: entry.conditions,
        horses: [],
      })
    }
    let sourceData = {}
    try {
      sourceData = entry.sourceJson ? JSON.parse(entry.sourceJson) : {}
    } catch {
      sourceData = {}
    }
    const tjk = sourceData.tjk || {}
    const environment = tjk.raceEnvironment
    // Do not use historical weather observed after the target day.
    if (environment?.observedAt?.slice(0, 10) <= date) racesById.get(entry.raceId).environment = environment
    let raceCode = null
    try {
      raceCode = tjk.workoutUrl ? new URL(tjk.workoutUrl).searchParams.get('KosuKodu') : null
    } catch {
      raceCode = null
    }
    const workouts = raceCode ? workoutsByRaceCode.get(raceCode) || [] : []
    const workout = workouts.find((item) => item.number === entry.horseNo) || null
    const workoutTables=findHorseProfileTables(tjk.horseId,'tjk_horse_workouts')
    const horseWorkouts=workoutTables?summarizeWorkoutHistory(workoutTables,entry.horseName,date):tjk.workouts||[]
    racesById.get(entry.raceId).horses.push({
      no: entry.horseNo,
      name: entry.horseName,
      age: entry.age,
      sire: entry.sire,
      dam: entry.dam,
      weight: parseWeight(entry.weight),
      handicapRating: (() => {
        const index = sourceData.headers?.findIndex((header) => header === 'H' || header === 'HP') ?? -1
        const value = index >= 0 ? Number(sourceData.values?.[index]) : NaN
        return Number.isFinite(value) ? value : null
      })(),
      jockey: entry.jockey,
      trainer: entry.trainer,
      start: entry.start,
      lastSix: entry.lastSix,
      daysSinceRace: entry.daysSinceRace,
      bestTimeSeconds: entry.bestTimeSeconds,
      independentScore: entry.independentScore,
      probability: entry.probability,
      marketShare: entry.marketShare,
      baselineProbability: entry.probability,
      horsePerformance: tjk.horsePerformance || null,
      horseId: tjk.horseId || null,
      jockeyId: tjk.jockeyId || null,
      workouts: horseWorkouts,
      jockeyPerformance: tjk.jockeyPerformance || null,
      workout,
    })
  }
  return [...racesById.values()]
}

export function findHorseProfileTables(horseId,source='tjk_horse_history') {
  if (!horseId) return null
  const snapshots = database.prepare(`SELECT provider_url AS url, raw_content AS content FROM source_snapshots WHERE source=? AND provider_url LIKE ? ORDER BY fetched_at DESC`).all(source,`%QueryParameter_AtId=${String(horseId)}%`)
  for (const snapshot of snapshots) {
    try {
      if (new URL(snapshot.url).searchParams.get('QueryParameter_AtId') === String(horseId)) return JSON.parse(snapshot.content)
    } catch { continue }
  }
  return null
}

export function findDailyAiAnalysis(date, city) {
  const row = database.prepare(`
    SELECT date, city, model, input_hash AS inputHash, analysis_json AS analysisJson, created_at AS createdAt
    FROM daily_ai_analyses WHERE date = ? AND city = ?
  `).get(date, city)
  if (!row) return null
  return { ...row, analysis: JSON.parse(row.analysisJson) }
}

export function repairStoredWeights() {
  const rows=database.prepare(`SELECT e.race_id,e.horse_id,e.weight,s.source_json FROM race_entries e LEFT JOIN race_entry_sources s ON s.race_id=e.race_id AND s.horse_id=e.horse_id WHERE e.weight>80 OR e.weight<35`).all()
  let repaired=0,missing=0
  const update=database.prepare('UPDATE race_entries SET weight=? WHERE race_id=? AND horse_id=?')
  for(const row of rows){
    let weight=null
    try {const source=JSON.parse(row.source_json||'{}'); const index=source.headers?.findIndex(h=>String(h).trim().toLocaleLowerCase('tr-TR')==='kilo');weight=index>=0?parseWeight(source.values[index]):null} catch {}
    update.run(weight,row.race_id,row.horse_id)
    if(weight==null)missing++;else repaired++
  }
  return {repaired,markedMissing:missing}
}

export function scheduledRaceStart(date,time,{calendarDate=false}={}) {
  const m=String(time||'').match(/^(\d{1,2})[.:](\d{2})$/)
  if(!m||Number(m[1])>23||Number(m[2])>59)return null
  let start=new Date(`${date}T${m[1].padStart(2,'0')}:${m[2]}:00+03:00`)
  if(!calendarDate&&Number(m[1])<5)start=new Date(start.getTime()+86400000)
  return start.toISOString()
}

export function saveForecastSnapshots({date,races,source,modelVersion,inputHash,predictions,capturedAt=new Date().toISOString()}) {
  let saved=0
  for(const race of races){
    const start=scheduledRaceStart(race.scheduledDate||date,race.time,{calendarDate:Boolean(race.scheduledDate)})
    if(!start||capturedAt>=start)continue
    const prediction=predictions?.find(p=>p.city===race.city&&p.raceNo===race.no)
    const picks=prediction?.picks||race.horses.map(h=>({horseName:h.name,horseNo:h.no,probability:h.probability}))
    const id=createHash('sha256').update(`${date}:${race.city}:${race.no}:${source}:${inputHash}`).digest('hex')
    const result=database.prepare(`INSERT OR IGNORE INTO forecast_snapshots VALUES(?,?,?,?,?,?,?,?,?,?)`).run(id,date,race.city,race.no,source,modelVersion,capturedAt,start,inputHash,JSON.stringify(picks))
    saved+=Number(result.changes)
  }
  return saved
}

export function listForecastSnapshots(sinceDate) {
  return database.prepare('SELECT * FROM forecast_snapshots WHERE date>=? AND captured_at<scheduled_start ORDER BY captured_at').all(sinceDate).map(row=>({...row,picks:JSON.parse(row.picks_json)}))
}

export function saveHistoricalRace(date,race,results) {
  database.prepare(`INSERT INTO historical_race_data VALUES(?,?,?,?,?,?) ON CONFLICT(date,city,race_no) DO UPDATE SET race_json=excluded.race_json,results_json=excluded.results_json,fetched_at=excluded.fetched_at`).run(date,race.city,race.no,JSON.stringify(race),JSON.stringify([...results]),new Date().toISOString())
}

export function listHistoricalRaces() {
  return database.prepare('SELECT * FROM historical_race_data ORDER BY date,city,race_no').all().map(row=>({date:row.date,...JSON.parse(row.race_json),results:new Map(JSON.parse(row.results_json))}))
}
export function historicalDataRevision(targetDate){
  const row=database.prepare('SELECT count(*) n,max(fetched_at) updated FROM historical_race_data WHERE date<?').get(targetDate)
  return `${row.n}:${row.updated||''}`
}

export function saveHorseWorkouts(date,city,raceNo,horseNo,horseId,workouts) {
  const entries=database.prepare(`SELECT s.race_id,s.horse_id,s.source_json FROM race_entry_sources s JOIN race_entries e ON e.race_id=s.race_id AND e.horse_id=s.horse_id JOIN races r ON r.id=s.race_id WHERE r.date=? AND r.city=? AND r.race_no=? AND e.horse_no=?`).all(date,city,raceNo,horseNo)
  for(const row of entries){const source=JSON.parse(row.source_json);if(String(source.tjk?.horseId)!==String(horseId))continue;source.tjk={...source.tjk,workouts};database.prepare('UPDATE race_entry_sources SET source_json=? WHERE race_id=? AND horse_id=?').run(JSON.stringify(source),row.race_id,row.horse_id)}
}

export function saveDailyAiAnalysis({ date, city, model, inputHash, analysis, createdAt }) {
  database.prepare(`
    INSERT INTO daily_ai_analyses (date, city, model, input_hash, analysis_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(date, city) DO UPDATE SET
      model=excluded.model,
      input_hash=excluded.input_hash,
      analysis_json=excluded.analysis_json,
      created_at=excluded.created_at
  `).run(date, city, model, inputHash, JSON.stringify(analysis), createdAt)
  return findDailyAiAnalysis(date, city)
}

export function findAnalysisBatch(inputHash){
  const row=database.prepare('SELECT record_json FROM daily_ai_batches WHERE input_hash=?').get(inputHash)
  return row?JSON.parse(row.record_json):null
}
export function saveAnalysisBatch(record){
  database.prepare('INSERT OR REPLACE INTO daily_ai_batches VALUES(?,?,?)').run(record.inputHash,JSON.stringify(record),record.createdAt)
  return record
}

export function findFreshSourceSnapshot(providerUrl, maxAgeMs) {
  const snapshot = database.prepare(`
    SELECT raw_content AS content, fetched_at AS fetchedAt
    FROM source_snapshots
    WHERE provider_url = ?
    ORDER BY fetched_at DESC
    LIMIT 1
  `).get(providerUrl)
  if (!snapshot || Date.now() - Date.parse(snapshot.fetchedAt) > maxAgeMs) return null
  return snapshot.content
}
