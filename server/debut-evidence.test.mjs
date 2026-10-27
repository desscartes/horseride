import test from 'node:test'
import assert from 'node:assert/strict'
import {debutEvidence} from './debut-evidence.mjs'
test('missing history is unknown, verified zero is debut, conflicting history is flagged',()=>{
 assert.equal(debutEvidence({},'2026-10-27').status,'career_unverified')
 const h={australianEvidence:{career:{starts:0}}};assert.equal(debutEvidence(h,'2026-10-27').status,'verified_debut')
 const r=debutEvidence({...h,horsePerformance:{recentRuns:[{date:'2026-10-26',finishPosition:2}]}},'2026-10-27');assert.equal(r.status,'observed_prior_start');assert.equal(r.identityConflict,true);assert.equal(r.missingIsPoorForm,false)
})
