import {test} from 'node:test'
import assert from 'node:assert/strict'
import {pinnedStudyMetrics} from './pinned-study-metrics.mjs'
const pin={artifact:'TR',method:'candidate',trainedThrough:'2026-10-16',registeredAt:'2026-10-18T08:00:00Z',minimumDays:21,minimumRaces:300}
const row={date:'2026-10-18',city:'Bursa',race_no:1,model_version:'candidate',source:'shadow_intelligence',captured_at:'2026-10-18T09:00:00Z',scheduled_start:'2026-10-18T10:00:00Z',picks:[{horseName:'A',probability:60},{horseName:'B',probability:40}]}
const outcomes=new Map([['2026-10-18:Bursa:1',new Map([['A',1],['B',2]])]])
test('study excludes pre-registration and post-start captures and reports a paired incumbent',()=>{
 const old={...row,source:'numeric',model_version:'incumbent',picks:[row.picks[1],row.picks[0]]}
 const result=pinnedStudyMetrics(pin,[row,{...row,race_no:2,captured_at:'2026-10-18T07:00:00Z'},{...row,race_no:3,captured_at:row.scheduled_start}], [old],outcomes)
 assert.equal(result.recorded,1);assert.equal(result.paired.races,1);assert.equal(result.paired.candidateHits,1);assert.equal(result.paired.incumbentHits,0);assert.equal(result.minimumSampleReached,false);assert.equal(result.automaticActivation,false)
})
test('different fields and decision times are excluded from a paired comparison',()=>{
 const shifted={...row,source:'numeric',captured_at:'2026-10-18T09:03:00Z'}
 assert.equal(pinnedStudyMetrics(pin,[row],[shifted],outcomes).paired.captureTimeMismatch,1)
 const different={...shifted,captured_at:row.captured_at,picks:[{horseName:'A'},{horseName:'C'}]}
 assert.equal(pinnedStudyMetrics(pin,[row],[different],outcomes).paired.fieldMismatch,1)
})
test('a later unrelated reference does not hide the genuine simultaneous control',()=>{
 const simultaneous={...row,source:'numeric'},later={...simultaneous,captured_at:'2026-10-18T09:10:00Z'}
 const result=pinnedStudyMetrics(pin,[row],[simultaneous,later],outcomes)
 assert.equal(result.paired.races,1);assert.equal(result.paired.maxCaptureSeparationSeconds,0)
})
