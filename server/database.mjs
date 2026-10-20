import { createHash } from 'node:crypto'
import {ensureForecastModelIdentity} from './forecast-model-identity.mjs'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { parseWeight,horseIdentity as horseIdentityForReport } from './data-quality.mjs'
import { summarizeWorkoutHistory } from './workout-history.mjs'
import {maternalRecordKey,verifiedProgramMaternalLine} from './program-maternal-lines.mjs'

const databasePath = resolve(process.env.HORSERIDE_DB || 'data/horseride.sqlite')
mkdirSync(dirname(databasePath), { recursive: true })

const database = new DatabaseSync(databasePath)
database.exec(`PRAGMA busy_timeout = ${process.env.HORSERIDE_NO_LISTEN === '1' ? 30000 : 1000}`)
database.exec(`CREATE TABLE IF NOT EXISTS application_tickets(id TEXT PRIMARY KEY,date TEXT NOT NULL,city TEXT NOT NULL,payload_json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS application_daily_ticket(date TEXT PRIMARY KEY,ticket_id TEXT NOT NULL);`)
database.exec(`CREATE TABLE IF NOT EXISTS application_result_projection(date TEXT NOT NULL,city TEXT NOT NULL,race_no INTEGER NOT NULL,fetched_at TEXT NOT NULL,results_json TEXT NOT NULL,PRIMARY KEY(date,city,race_no));`)
database.exec('CREATE TABLE IF NOT EXISTS forecast_surprises(snapshot_id TEXT PRIMARY KEY,payload_json TEXT NOT NULL)')
export function storeApplicationTickets(tickets,best){
 for(const ticket of tickets){if(ticket.capturedAt>=ticket.scheduledStart)continue;const id=`${ticket.date}:${ticket.city}:${ticket.ordinal}:${ticket.algorithm}`;if(database.prepare('SELECT 1 FROM application_tickets WHERE id=?').get(id))continue;database.prepare('INSERT OR IGNORE INTO application_tickets VALUES(?,?,?,?)').run(id,ticket.date,ticket.city,JSON.stringify({...ticket,id}))}
 if(best){const id=`${best.date}:${best.city}:${best.ordinal}:${best.algorithm}`;if(database.prepare('SELECT 1 FROM application_tickets WHERE id=?').get(id)){
  const old=database.prepare('SELECT t.payload_json FROM application_daily_ticket b JOIN application_tickets t ON t.id=b.ticket_id WHERE b.date=?').get(best.date)
  if(old&&JSON.parse(old.payload_json).algorithm==='optimal-100-v1'&&best.officialVerified)database.prepare('UPDATE application_daily_ticket SET ticket_id=? WHERE date=?').run(id,best.date)
  else database.prepare('INSERT OR IGNORE INTO application_daily_ticket VALUES(?,?)').run(best.date,id)
 }}
}
export function applicationTickets(since='2026-10-10'){
 return database.prepare('SELECT t.payload_json,b.date AS best_day FROM application_tickets t LEFT JOIN application_daily_ticket b ON b.ticket_id=t.id WHERE t.date>=? ORDER BY t.date,t.id').all(since).map(row=>({...JSON.parse(row.payload_json),dailyBest:Boolean(row.best_day)}))
}
export function listApplicationForecasts(since,through,source){
 const archived=new Map()
 if(source==='daily_ai')for(const row of database.prepare('SELECT * FROM daily_ai_analyses WHERE date>=? AND date<=?').all(since,through))archived.set(`${row.date}:${row.city}:${row.input_hash}:${row.created_at}`,JSON.parse(row.analysis_json))
 return database.prepare(`SELECT f.*,s.payload_json AS surprise_json FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY date,city,race_no ORDER BY captured_at DESC,id DESC) AS latest FROM forecast_snapshots WHERE date>=? AND date<=? AND source=? AND captured_at<scheduled_start) f LEFT JOIN forecast_surprises s ON s.snapshot_id=f.id WHERE latest=1 ORDER BY date,city,race_no`).all(since,through,source).map(row=>{
  const picks=JSON.parse(row.picks_json),saved=row.surprise_json?JSON.parse(row.surprise_json):null,prediction=archived.get(`${row.date}:${row.city}:${row.input_hash}:${row.captured_at}`)?.races?.find(p=>p.city===row.city&&Number(p.raceNo)===row.race_no)
  const samePicks=prediction&&JSON.stringify(prediction.picks.map(p=>p.horseName))===JSON.stringify(picks.map(p=>p.horseName))
  const tracked=Boolean(saved||samePicks&&Object.hasOwn(prediction,'surprise'))
  return {...row,picks,surpriseTracked:tracked,surprise:saved?saved.surprise:samePicks?prediction.surprise||null:null}
 })
}
export function applicationOutcomes(since='2026-10-10'){
 const results=new Map(),add=(key,name,position)=>{if(!results.has(key))results.set(key,new Map());results.get(key).set(horseIdentityForReport(name),position)}
 for(const r of database.prepare('SELECT date,city,race_no,horse_name,finish_position FROM backtest_entries WHERE date>=? AND finish_position>0').iterate(since))add(`${r.date}:${r.city}:${r.race_no}`,r.horse_name,r.finish_position)
 for(const r of database.prepare('SELECT date,city,race_no,results_json FROM application_result_projection WHERE date>=?').iterate(since))for(const [name,p]of JSON.parse(r.results_json))add(`${r.date}:${r.city}:${r.race_no}`,name,p)
 // Reports remain read-only while collectors hold write locks. Fresh official
 // rows override the existing projection in memory, without writing on GET.
 for(const r of database.prepare(`SELECT h.* FROM historical_race_data h LEFT JOIN application_result_projection p USING(date,city,race_no) WHERE h.date>=? AND (p.fetched_at IS NULL OR p.fetched_at<>h.fetched_at)`).iterate(since)){
  const race=JSON.parse(r.race_json),outcomes=new Map(JSON.parse(r.results_json)),finished=race.horses.map(h=>[horseIdentityForReport(h.name),outcomes.get(Number(h.no))?.finishPosition]).filter(([,p])=>p>0)
  const key=`${r.date}:${r.city}:${r.race_no}`;results.set(key,new Map(finished))
 }
 return results
}
export function applicationResultUrl(date,city){return database.prepare('SELECT source_url FROM backtest_entries WHERE date=? AND city=? AND source_url LIKE ? LIMIT 1').get(date,city,'%tjk.org%')?.source_url||null}
export function updateApplicationPayout(id,payout,evidence){const row=database.prepare('SELECT payload_json FROM application_tickets WHERE id=?').get(id);if(row){const ticket=JSON.parse(row.payload_json);database.prepare('UPDATE application_tickets SET payload_json=? WHERE id=?').run(JSON.stringify({...ticket,verifiedPayout:payout,payoutEvidence:evidence}),id)}}
export function updateApplicationSettlement(id,officialResult,payoutEvidence,verifiedPayout){const row=database.prepare('SELECT payload_json FROM application_tickets WHERE id=?').get(id);if(row){const ticket=JSON.parse(row.payload_json);database.prepare('UPDATE application_tickets SET payload_json=? WHERE id=?').run(JSON.stringify({...ticket,officialResult,payoutEvidence,verifiedPayout}),id)}}
// Collectors and analysis workers share WAL storage; wait for brief writer locks.
database.exec(`PRAGMA busy_timeout = ${process.env.HORSERIDE_NO_LISTEN === '1' ? 30000 : 1000}`)
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
  CREATE INDEX IF NOT EXISTS source_snapshot_profile_lookup ON source_snapshots(source,provider_url,fetched_at DESC);
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
    UNIQUE(date, city, race_no, source, model_version, input_hash)
  );
  CREATE TABLE IF NOT EXISTS historical_race_data (
    date TEXT NOT NULL, city TEXT NOT NULL, race_no INTEGER NOT NULL,
    race_json TEXT NOT NULL, results_json TEXT NOT NULL, fetched_at TEXT NOT NULL,
    PRIMARY KEY(date, city, race_no)
  );
  CREATE INDEX IF NOT EXISTS application_forecast_lookup ON forecast_snapshots(source,date,city,race_no,captured_at);
  CREATE TABLE IF NOT EXISTS historical_content_revisions(date TEXT PRIMARY KEY,revision INTEGER NOT NULL);
  CREATE TRIGGER IF NOT EXISTS historical_content_insert AFTER INSERT ON historical_race_data BEGIN
    INSERT INTO historical_content_revisions VALUES(NEW.date,1) ON CONFLICT(date) DO UPDATE SET revision=revision+1;
  END;
  CREATE TRIGGER IF NOT EXISTS historical_content_update AFTER UPDATE OF date,race_json,results_json ON historical_race_data
  WHEN OLD.date IS NOT NEW.date OR OLD.race_json IS NOT NEW.race_json OR OLD.results_json IS NOT NEW.results_json BEGIN
    INSERT INTO historical_content_revisions VALUES(NEW.date,1) ON CONFLICT(date) DO UPDATE SET revision=revision+1;
  END;
  CREATE TRIGGER IF NOT EXISTS historical_content_delete AFTER DELETE ON historical_race_data BEGIN
    INSERT INTO historical_content_revisions VALUES(OLD.date,1) ON CONFLICT(date) DO UPDATE SET revision=revision+1;
  END;
`)

ensureForecastModelIdentity(database)
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

export function getProgramForAnalysis(date, city, {includeWorkouts=true}={}) {
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
  const workoutSnapshots = includeWorkouts ? database.prepare(`
    SELECT provider_url AS providerUrl, raw_content AS rawContent
    FROM source_snapshots
    WHERE date = ? AND source = 'tjk_workout'
  `).all(date) : []
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
    const workoutTables=includeWorkouts?findHorseProfileTables(tjk.horseId,'tjk_horse_workouts'):null
    const horseWorkouts=includeWorkouts?(workoutTables?summarizeWorkoutHistory(workoutTables,entry.horseName,date):tjk.workouts||[]):[]
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
    if(tjk.programMaternalLine){
      const race=racesById.get(entry.raceId),horse=race.horses.at(-1)
      const proof=verifiedProgramMaternalLine(horse,race,date,{[maternalRecordKey(date,race,horse)]:tjk.programMaternalLine})
      if(proof){horse.damsire=proof.damsire;horse.pedigreeSource=proof}
    }
  }
  return [...racesById.values()]
}

export function findHorseProfileTables(horseId,source='tjk_horse_history') {
  if (!horseId) return null
  const snapshots = database.prepare(`SELECT provider_url AS url, raw_content AS content FROM source_snapshots WHERE source=? AND provider_url LIKE ? ORDER BY fetched_at DESC`).iterate(source,`%QueryParameter_AtId=${String(horseId)}%`)
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
    // Preserve legacy row IDs and linked surprise records for an already
    // captured model/input pair, while allowing a different model to coexist.
    if(database.prepare('SELECT 1 FROM forecast_snapshots WHERE date=? AND city=? AND race_no=? AND source=? AND model_version=? AND input_hash=? LIMIT 1').get(date,race.city,race.no,source,modelVersion,inputHash))continue
    const id=createHash('sha256').update(JSON.stringify([date,race.city,race.no,source,modelVersion,inputHash])).digest('hex')
    const result=database.prepare(`INSERT OR IGNORE INTO forecast_snapshots VALUES(?,?,?,?,?,?,?,?,?,?)`).run(id,date,race.city,race.no,source,modelVersion,capturedAt,start,inputHash,JSON.stringify(picks))
    if(result.changes&&source==='daily_ai'&&prediction&&Object.hasOwn(prediction,'surprise'))database.prepare('INSERT OR IGNORE INTO forecast_surprises VALUES(?,?)').run(id,JSON.stringify({surprise:prediction.surprise||null}))
    saved+=Number(result.changes)
  }
  return saved
}

export function listForecastSnapshots(sinceDate) {
  return database.prepare('SELECT * FROM forecast_snapshots WHERE date>=? AND captured_at<scheduled_start ORDER BY captured_at').all(sinceDate).map(row=>({...row,picks:JSON.parse(row.picks_json)}))
}
export function latestNumericForecastDecisions(since,through){
 return database.prepare(`SELECT id,date,city,race_no AS raceNo,captured_at AS capturedAt,scheduled_start AS scheduledStart FROM (
 SELECT id,date,city,race_no,captured_at,scheduled_start,ROW_NUMBER() OVER(PARTITION BY date,city,race_no ORDER BY captured_at DESC,id DESC) AS latest
 FROM forecast_snapshots WHERE source='numeric' AND date>=? AND date<=? AND captured_at<scheduled_start
 ) WHERE latest=1`).all(since,through)
}

export function saveHistoricalRace(date,race,results) {
  database.prepare(`INSERT INTO historical_race_data VALUES(?,?,?,?,?,?) ON CONFLICT(date,city,race_no) DO UPDATE SET race_json=excluded.race_json,results_json=excluded.results_json,fetched_at=excluded.fetched_at WHERE historical_race_data.race_json IS NOT excluded.race_json OR historical_race_data.results_json IS NOT excluded.results_json`).run(date,race.city,race.no,JSON.stringify(race),JSON.stringify([...results]),new Date().toISOString())
}

export function listHistoricalRaces() {
  return Array.from(database.prepare('SELECT * FROM historical_race_data ORDER BY date,city,race_no').iterate(),row=>({date:row.date,...JSON.parse(row.race_json),results:new Map(JSON.parse(row.results_json))}))
}
export function historicalRaceDates(){return database.prepare('SELECT DISTINCT date FROM historical_race_data ORDER BY date').all().map(r=>r.date)}
// Export one calendar day without retaining the complete archive's raw JSON
// strings alongside parsed objects. Training never needs all raw days at once.
export function* iterateHistoricalDay(date){
  for(const row of database.prepare('SELECT date,race_json,results_json FROM historical_race_data WHERE date=? ORDER BY city,race_no').iterate(date))yield {date:row.date,...JSON.parse(row.race_json),results:new Map(JSON.parse(row.results_json))}
}
export function historicalDataRevision(targetDate){
  const row=database.prepare('SELECT count(*) n FROM historical_race_data WHERE date<?').get(targetDate)
  const content=database.prepare('SELECT SUM(revision) AS revision FROM historical_content_revisions WHERE date<?').get(targetDate).revision||0
  return `${row.n}:content-v1:${content}`
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

// Simulation reserves and immutable tickets are committed together across processes.
database.exec('CREATE TABLE IF NOT EXISTS simulation_days(date TEXT PRIMARY KEY,week TEXT NOT NULL,payload_json TEXT NOT NULL)')
export function simulationDays(){return database.prepare('SELECT payload_json FROM simulation_days ORDER BY date DESC').all().map(r=>JSON.parse(r.payload_json))}
export function reserveSimulationDay(day){
 database.exec('BEGIN IMMEDIATE')
 try{
  if(database.prepare('SELECT 1 FROM simulation_days WHERE date=?').get(day.date)){database.exec('COMMIT');return false}
  const spent=simulationDays().filter(d=>d.week===day.week).reduce((n,d)=>n+d.spent,0)
  if(day.spent<0||spent+day.spent>1000.001||day.tickets.length>2||day.tickets.some(t=>t.capturedAt>=t.scheduledStart||Date.now()>=Date.parse(t.scheduledStart))||Math.abs(day.spent-day.tickets.reduce((n,t)=>n+t.cost,0))>0.001)throw Error('Simulation budget or prestart guard rejected')
  storeApplicationTickets(day.tickets)
  database.prepare('INSERT INTO simulation_days VALUES(?,?,?)').run(day.date,day.week,JSON.stringify(day))
  database.exec('COMMIT');return true
 }catch(e){database.exec('ROLLBACK');throw e}
}

export function updateApplicationTicketResultSource(id,url){const row=database.prepare('SELECT payload_json FROM application_tickets WHERE id=?').get(id);if(row){const t=JSON.parse(row.payload_json);if(!t.resultCsvUrl)database.prepare('UPDATE application_tickets SET payload_json=? WHERE id=?').run(JSON.stringify({...t,resultCsvUrl:url}),id)}}
