import test from 'node:test'
import assert from 'node:assert/strict'
import {currentHongKongEvidence} from './hkjc-current-evidence.mjs'
test('current health snapshot is not backfilled into older tests and future medical events are excluded',()=>{
 const old={horseName:'A',brandNo:'E123',date:'2026-09-01',details:'Official note'}
 const snapshot={observedDate:'2026-10-06',observedAt:'2026-10-06T10:00Z',veterinary:[old,{...old,date:'2026-10-07'}]}
 assert.equal(currentHongKongEvidence(snapshot,{name:'A (NZ)'},'2026-10-05'),null)
 assert.equal(currentHongKongEvidence(snapshot,{name:'A (NZ)'},'2026-10-06').records.length,1)
 assert.equal(currentHongKongEvidence({...snapshot,veterinary:[old,{...old,brandNo:'D999'}]},{name:'A'},'2026-10-06'),null)
})
