import test from 'node:test'
import assert from 'node:assert/strict'
import {auditTrainingContract} from './training-contract.mjs'
const row=()=>({date:'2026-01-01',city:'A',no:1,horses:['ONE','TWO'],features:[[1],[2]],labels:[1,0],baseline:[.5,.5]})
test('accepts aligned evidence and dead heat labels',()=>{const r=row();r.labels=[1,1];assert.equal(auditTrainingContract({featureNames:['x'],races:[r]}).passed,true)})
test('rejects duplicate identities, misalignment and invalid numeric inputs',()=>{const r=row();r.horses=['ONE KG','ONE'];r.features=[[null]];const result=auditTrainingContract({featureNames:['x'],races:[r,r]});assert.equal(result.passed,false);for(const code of ['ambiguous_runner_identity','runner_alignment','invalid_feature_values','duplicate_race'])assert.ok(result.counts[code])})
