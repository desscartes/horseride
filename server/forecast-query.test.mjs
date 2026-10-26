import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {listApplicationForecasts} from './database.mjs'
test('thin latest-row query preserves prestart cutoff, per-race selection and tie order',()=>{
 const d=new DatabaseSync(process.env.HORSERIDE_DB),insert=d.prepare('INSERT INTO forecast_snapshots VALUES(?,?,?,?,?,?,?,?,?,?)')
 for(const [id,no,at,name]of [['a',1,'05:00','OLD'],['b',1,'06:00','NEW'],['c',1,'06:00','TIE'],['d',1,'08:00','TOO LATE'],['e',2,'05:00','OTHER']])insert.run(id,'2026-10-26','Ankara',no,'numeric','test','2026-10-26T'+at+':00Z','2026-10-26T07:00:00Z',id,JSON.stringify([{horseName:name}]))
 d.close();const result=listApplicationForecasts('2026-10-26','2026-10-26','numeric');assert.deepEqual(result.map(r=>r.picks[0].horseName),['TIE','OTHER'])
})
