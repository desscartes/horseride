import {test} from 'node:test'
import assert from 'node:assert/strict'
import {recordIntelligenceForecast} from './record-pinned-forecast.mjs'
test('a new study namespaces unchanged input and records the incumbent at the same real decision time',()=>{
 const saved=[],race={rankingMethod:'active'},trial={rankingMethod:'candidate'},registeredAt='2026-10-18T08:00:00Z',now=()=> '2026-10-18T09:00:00Z'
 const options={date:'2026-10-18',race,trial,bundle:{metadata:{method:'candidate',prospectiveRegisteredAt:registeredAt}},save:r=>saved.push(r),fingerprint:()=> 'existing-program-hash',now}
 recordIntelligenceForecast(options)
 assert.equal(saved.length,2);assert.equal(saved[0].source,'numeric');assert.equal(saved[1].source,'shadow_intelligence');assert.equal(saved[0].capturedAt,saved[1].capturedAt);assert.notEqual(saved[0].inputHash,saved[1].inputHash);assert.notEqual(saved[1].inputHash,'existing-program-hash')
 const again=[];recordIntelligenceForecast({...options,save:r=>again.push(r)})
 assert.equal(again[1].inputHash,saved[1].inputHash)
 recordIntelligenceForecast({...options,now:()=> '2026-10-18T07:59:59Z'});assert.equal(saved.length,2)
})
