import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

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
    PRIMARY KEY (race_id, horse_id),
    FOREIGN KEY (race_id) REFERENCES races(id),
    FOREIGN KEY (horse_id) REFERENCES horses(id)
  );
`)

const raceStatement = database.prepare(`
  INSERT INTO races (id, date, city, race_no, time, type, distance, surface, conditions, provider_url, fetched_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET time=excluded.time, type=excluded.type, distance=excluded.distance, surface=excluded.surface, conditions=excluded.conditions, provider_url=excluded.provider_url, fetched_at=excluded.fetched_at
`)
const horseStatement = database.prepare('INSERT INTO horses (id, name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING')
const entryStatement = database.prepare(`
  INSERT INTO race_entries (race_id, horse_id, horse_no, age, sire, dam, weight, jockey, trainer, start_number, last_six, days_since_race, best_time_seconds, independent_score, probability)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(race_id, horse_id) DO UPDATE SET jockey=excluded.jockey, trainer=excluded.trainer, weight=excluded.weight, start_number=excluded.start_number, last_six=excluded.last_six, days_since_race=excluded.days_since_race, best_time_seconds=excluded.best_time_seconds, independent_score=excluded.independent_score, probability=excluded.probability
`)

function horseId(name) {
  return name.trim().toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9ÇĞİÖŞÜ]+/gi, '-').replace(/^-|-$/g, '')
}

export function saveProgram({ city, date, fetchedAt, providerUrl, races }) {
  for (const race of races) {
    const raceId = `${date}:${city}:${race.no}`
    raceStatement.run(raceId, date, city, race.no, race.time, race.type, race.distance, race.surface, race.conditions, providerUrl, fetchedAt)
    for (const horse of race.horses) {
      const id = horseId(horse.name)
      horseStatement.run(id, horse.name)
      entryStatement.run(raceId, id, horse.no, horse.age, horse.sire, horse.dam, horse.weight, horse.jockey, horse.trainer, horse.start, horse.lastSix, horse.daysSinceRace, horse.bestTimeSeconds, horse.independentScore, horse.probability)
    }
  }
  return { storedRaces: races.length, databasePath }
}

export function findHorseHistory(name) {
  return database.prepare(`
    SELECT r.date, r.city, r.race_no AS raceNo, r.distance, r.surface, e.weight, e.jockey, e.trainer, e.start_number AS start, e.last_six AS lastSix, e.days_since_race AS daysSinceRace, e.best_time_seconds AS bestTimeSeconds, e.independent_score AS independentScore, e.probability
    FROM race_entries e JOIN horses h ON h.id = e.horse_id JOIN races r ON r.id = e.race_id
    WHERE h.name LIKE ? ORDER BY r.date DESC, r.race_no DESC LIMIT 50
  `).all(`%${name}%`)
}

export function databaseHealth() {
  return database.prepare('SELECT COUNT(*) AS entries, (SELECT COUNT(*) FROM races) AS races, (SELECT COUNT(*) FROM horses) AS horses FROM race_entries').get()
}
