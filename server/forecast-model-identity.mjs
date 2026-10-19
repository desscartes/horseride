const legacyColumns='date,city,race_no,source,input_hash'
function legacyIdentity(database){
 return database.prepare('PRAGMA index_list(forecast_snapshots)').all().filter(i=>i.unique).some(index=>database.prepare('SELECT name FROM pragma_index_info(?) ORDER BY seqno').all(index.name).map(c=>c.name).join(',')===legacyColumns)
}
export function ensureForecastModelIdentity(database){
 if(!legacyIdentity(database))return false
 database.exec('BEGIN IMMEDIATE')
 try{
  if(!legacyIdentity(database)){database.exec('COMMIT');return false}
  const indexes=database.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='forecast_snapshots' AND sql IS NOT NULL").all()
  database.exec(`CREATE TABLE forecast_snapshots_model_identity (
   id TEXT PRIMARY KEY,date TEXT NOT NULL,city TEXT NOT NULL,race_no INTEGER NOT NULL,
   source TEXT NOT NULL,model_version TEXT NOT NULL,captured_at TEXT NOT NULL,
   scheduled_start TEXT NOT NULL,input_hash TEXT NOT NULL,picks_json TEXT NOT NULL,
   UNIQUE(date,city,race_no,source,model_version,input_hash)
  ); INSERT INTO forecast_snapshots_model_identity SELECT * FROM forecast_snapshots;`)
  const count=database.prepare('SELECT COUNT(*) AS n FROM forecast_snapshots').get().n
  if(database.prepare('SELECT COUNT(*) AS n FROM forecast_snapshots_model_identity').get().n!==count)throw Error('Forecast migration row count mismatch')
  database.exec('DROP TABLE forecast_snapshots; ALTER TABLE forecast_snapshots_model_identity RENAME TO forecast_snapshots;')
  for(const index of indexes)database.exec(index.sql)
  database.exec('COMMIT');return true
 }catch(error){database.exec('ROLLBACK');throw error}
}
