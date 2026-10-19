import test from 'node:test'
import assert from 'node:assert/strict'
import {evidenceCoverageDiagnostics as inspect} from './evidence-coverage-drift.mjs'
const splits=(a,b)=>({fit:{coverage:{workout:{knownPercent:a}}},test:{coverage:{workout:{knownPercent:b}}}})
test('large fit/test availability differences are explicit without changing the model',()=>{
 const result=inspect(splits(0.4,66.6))
 assert.equal(result.diagnostics[0].status,'very_sparse_fit_evidence')
 assert.equal(result.diagnostics[0].differencePoints,66.2)
 assert.equal(result.automaticModelChange,false)
 assert.equal(inspect(splits(80,30)).diagnostics[0].status,'large_coverage_shift')
})
test('missing source in both periods is distinct from missing diagnostics or a small change',()=>{
 assert.equal(inspect(splits(0,0)).diagnostics[0].status,'unavailable_in_both_periods')
 for(const pair of [[94,95],[null,50],[50,undefined],[NaN,20],[-1,50]])assert.equal(inspect(splits(...pair)).diagnostics.length,0)
})
