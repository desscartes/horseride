import test from 'node:test'
import assert from 'node:assert/strict'
import {selectPrizeMeetings} from './prize-meeting-selection.mjs'
test('monthly backfill reaches older training months while keeping country and period limits',()=>{
 const rows=['2026-09-03','2026-09-02','2026-08-30','2025-06-20'].flatMap(date=>['TR','US'].map(country=>({date,country,period:'train',city:'A'})))
 rows.push({date:'2026-09-20',country:'TR',period:'validation',city:'A'})
 const selected=selectPrizeMeetings(rows,{perPeriod:3,spreadMonths:true})
 for(const country of ['TR','US'])assert.deepEqual(selected.filter(r=>r.country===country&&r.period==='train').map(r=>r.date),['2025-06-20','2026-08-30','2026-09-03'])
 assert.equal(selected.filter(r=>r.period==='validation').length,1)
 assert.deepEqual(selectPrizeMeetings(rows,{perPeriod:1}).filter(r=>r.period==='train').map(r=>r.date),['2026-09-03','2026-09-03'])
})
