import test from 'node:test'
import assert from 'node:assert/strict'
import {probabilityQuality} from './probability-quality.mjs'
const row={date:'2026-01-02',city:'A',raceNo:1,country:'US',modelVersion:'v',trainedThrough:'2026-01-01',capturedAt:'2026-01-02T10:00:00Z',scheduledStart:'2026-01-02T11:00:00Z',race:{rankingSource:'local_trained_model',horses:[{name:'A',probability:80},{name:'B',probability:20}]},market:{source:'market_prestart',capturedAt:'2026-01-02T10:00:00Z',picks:[{horseName:'A',marketShare:20},{horseName:'B',marketShare:80}]}}
test('scores only prestart matched fields; DNF is a known loss',()=>{const outcomes=new Map([['2026-01-02:A:1',new Map([['A',1],['B',0]])]]),r=probabilityQuality([row,{...row,capturedAt:row.scheduledStart}],outcomes);assert.equal(r.total.races,1);assert.equal(r.total.topOne,1);assert.ok(Math.abs(r.total.brier-.08)<1e-10);assert.equal(r.total.pairedMarketTopOne,0);assert.equal(r.excluded.not_verified_prestart_model,1)})
test('missing starters or results are excluded; dead heats divide credit',()=>{let result=probabilityQuality([row],new Map([['2026-01-02:A:1',new Map([['A',1]])]]));assert.equal(result.total.races,0);assert.equal(result.excluded.field_or_identity_mismatch,1);result=probabilityQuality([row],new Map([['2026-01-02:A:1',new Map([['A',1],['B',1]])]]));assert.equal(result.bins.reduce((n,b)=>n+b.winCredit,0),1)})

test('last served model per race counts once and poststart market is excluded',()=>{const outcome=new Map([['2026-01-02:A:1',new Map([['A',1],['B',0]])]]);const later={...row,modelVersion:'v2',capturedAt:'2026-01-02T10:30:00Z',market:{...row.market,capturedAt:row.scheduledStart}};const result=probabilityQuality([row,later],outcome);assert.equal(result.total.races,1);assert.equal(result.recorded,1);assert.equal(result.total.pairedMarketRaces,0);assert.deepEqual(Object.keys(result.byModel),['v2'])})

test('descriptive groups use captured field and normalized confidence only',()=>{const outcome=new Map([['2026-01-02:A:1',new Map([['A',1],['B',0]])]]);const result=probabilityQuality([row],outcome);assert.equal(result.byFieldSize['2-7'].races,1);assert.equal(result.byFieldSize['12+'].races,0);assert.equal(result.byTopConfidence['50_plus'].races,1);assert.equal(result.byTopConfidence['below_30'].races,0);assert.equal(result.automaticModelChange,false)})

test('fixed blend uses only verified paired market without changing captured predictions',()=>{
 const before=JSON.stringify(row),outcomes=new Map([['2026-01-02:A:1',new Map([['A',1],['B',0]])]])
 const r=probabilityQuality([row],outcomes),b=r.total.fixedHalfBlend
 assert.equal(b.races,1);assert.equal(b.brier,.5);assert.equal(b.activated,false);assert.equal(JSON.stringify(row),before)
 const invalid={...row,market:{...row.market,capturedAt:row.scheduledStart}}
 assert.equal(probabilityQuality([invalid],outcomes).total.fixedHalfBlend.races,0)
})
