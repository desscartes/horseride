import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateCouponPairs} from './coupon-benchmark-results.mjs'
const fields=Array.from({length:6},(_,i)=>({raceNo:i+1,names:['A','B']})),ticket=name=>({budget:30,cost:20,legs:fields.map(f=>({raceNo:f.raceNo,horses:[{name}]}))})
const pair={role:'prospective_same_budget_shadow_benchmark',date:'2026-01-01',city:'X',ordinal:1,budget:30,capturedAt:'2026-01-01T09:00:00Z',scheduledStart:'2026-01-01T10:00:00Z',fields,model:ticket('A'),market:ticket('B')}
const outcomes=()=>new Map(fields.map(f=>[`2026-01-01:X:${f.raceNo}`,new Map([['A',1],['B',2]])]))
test('settles all six legs with paired cost and first capture only',()=>{const r=evaluateCouponPairs([pair,{...pair,capturedAt:'2026-01-01T09:30:00Z',model:ticket('B')}],outcomes());assert.equal(r.settled.pairs,1);assert.equal(r.settled.modelWins,1);assert.equal(r.settled.marketWins,0);assert.equal(r.settled.modelSpend,20);assert.equal(r.roi,null)})
test('changed fields, missing results, poststart and malformed tickets are excluded',()=>{let o=outcomes();o.get('2026-01-01:X:1').delete('B');assert.equal(evaluateCouponPairs([pair],o).settled.pairs,0);o=outcomes();o.delete('2026-01-01:X:6');assert.equal(evaluateCouponPairs([pair],o).excluded.result_pending,1);assert.equal(evaluateCouponPairs([{...pair,capturedAt:pair.scheduledStart}],outcomes()).settled.pairs,0);assert.equal(evaluateCouponPairs([{...pair,fields:undefined}],outcomes()).excluded.missing_frozen_fields,1)})
