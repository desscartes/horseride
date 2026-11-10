import'./runtime-env.mjs';import{DatabaseSync}from'node:sqlite';import{readdir,readFile,unlink,writeFile}from'node:fs/promises';import{resolve}from'node:path';import{createHash}from'node:crypto';
const dir=resolve('data/forecast-write-spool');let names=[];try{names=await readdir(dir)}catch(e){if(e.code!=='ENOENT')throw e}
const report={checkedAt:new Date().toISOString(),replayed:0,deferred:0,rejected:[]};
if(names.length){const db=new DatabaseSync(resolve(process.env.HORSERIDE_DB||'data/horseride.sqlite'));db.exec('PRAGMA busy_timeout=250');
 for(const name of names.filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).slice(0,20)){
  const row=JSON.parse(await readFile(dir+'/'+name,'utf8'));
  const hash=createHash('sha256').update(JSON.stringify([row.date,row.city,row.raceNo,row.source,row.modelVersion,row.inputHash])).digest('hex');
  if(row.id!==hash||name!==hash+'.json'||!(row.capturedAt<row.start&&row.spooledAt<row.start)||!Array.isArray(row.picks)){report.rejected.push(name);continue}
  try{db.exec('BEGIN IMMEDIATE');
   if(!db.prepare('SELECT 1 FROM forecast_snapshots WHERE date=? AND city=? AND race_no=? AND source=? AND model_version=? AND input_hash=?').get(row.date,row.city,row.raceNo,row.source,row.modelVersion,row.inputHash)){
    db.prepare('INSERT OR IGNORE INTO forecast_snapshots VALUES(?,?,?,?,?,?,?,?,?,?)').run(row.id,row.date,row.city,row.raceNo,row.source,row.modelVersion,row.capturedAt,row.start,row.inputHash,JSON.stringify(row.picks));
    if(row.surprise)db.prepare('INSERT OR IGNORE INTO forecast_surprises VALUES(?,?)').run(row.id,JSON.stringify(row.surprise));
   }db.exec('COMMIT');await unlink(dir+'/'+name);report.replayed++;
  }catch(error){try{db.exec('ROLLBACK')}catch{};if(error.errcode===5||/locked|busy/i.test(error.message)){report.deferred++;break}throw error}
 }db.close();}
await writeFile('data/maintenance/forecast-spool-status.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
