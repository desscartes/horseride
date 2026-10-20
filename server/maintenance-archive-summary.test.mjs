import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {maintenanceArchiveSummary} from './maintenance-archive-summary.mjs'
test('aggregate counts preserve domestic/US scope, prior cutoff and new-date decision',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE historical_race_data(date TEXT,city TEXT,race_json TEXT)')
 const rows=[{date:'2026-01-01',city:'Ankara',foreign:false},{date:'2026-01-02',city:'Bursa'},{date:'2026-01-03',city:'Adana',foreign:null},{date:'2026-01-01',city:'A ABD',foreign:true},{date:'2026-01-02',city:'B ABD',foreign:true},{date:'2026-01-02',city:'Other Fransa',foreign:true},{date:'2026-01-02',city:'Domestic ABD',foreign:false},{date:'2026-01-04',city:'C ABD',foreign:true}]
 for(const r of rows)db.prepare('INSERT INTO historical_race_data VALUES(?,?,?)').run(r.date,r.city,JSON.stringify(r))
 for(const country of ['TR','US']){const old=rows.filter(r=>r.date<='2026-01-03'&&(country==='TR'?!r.foreign:r.foreign&&r.city.endsWith('ABD')));assert.deepEqual(maintenanceArchiveSummary(db,country,'2026-01-03','2026-01-01'),{races:old.length,newerRaces:old.filter(r=>r.date>'2026-01-01').length})}
 assert.throws(()=>maintenanceArchiveSummary(db,'GB','2026-01-03','2026-01-01'),/Invalid/);db.close()
})
