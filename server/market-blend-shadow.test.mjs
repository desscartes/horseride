import test from 'node:test'
import assert from 'node:assert/strict'
import {marketBlendShadow} from './market-blend-shadow.mjs'
const row={date:'2026-01-02',trainedThrough:'2026-01-01',capturedAt:'2026-01-02T09:00:00Z',scheduledStart:'2026-01-02T10:00:00Z',race:{rankingSource:'local_trained_model',horses:[{name:'A',probability:80},{name:'B',probability:20}]},market:{source:'market_prestart',capturedAt:'2026-01-02T09:00:00Z',picks:[{horseName:'B',marketShare:80},{horseName:'A',marketShare:20}]}}
test('shadow matches names, preserves active prediction and rejects future market',()=>{const before=JSON.stringify(row),result=marketBlendShadow(row);assert.deepEqual(result.picks.map(p=>p.probability),[50,50]);assert.equal(result.role,'shadow_only');assert.equal(JSON.stringify(row),before);assert.equal(marketBlendShadow({...row,market:{...row.market,capturedAt:row.scheduledStart}}),null)})
