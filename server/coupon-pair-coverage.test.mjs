import test from 'node:test'
import assert from 'node:assert/strict'
import {pairModelCoverage} from './coupon-pair-coverage.mjs'
import {selectSimulationTickets} from './simulation-policy.mjs'
const ticket=(city,ids)=>({date:'2026-10-20',city,cost:40,estimatedChance:.4,legs:[{raceNo:1,modelVersion:'v1',estimatedCoverage:.4,horses:ids.map(number=>({number,estimatedProbability:.4/ids.length}))}]})
test('shared identical event is not counted as independent opportunity',()=>{
 const a=ticket('A',[1]),b=ticket('A',[1]);assert.equal(pairModelCoverage(a,b).atLeastOne,.4)
 assert.equal(pairModelCoverage(a,ticket('B',[1])).atLeastOne,.64)
 const selected=selectSimulationTickets([[a],[b],[ticket('B',[1])]],80)
 assert.equal(new Set(selected.map(t=>t.city)).size,2)
})
test('disjoint selections in a shared race have zero joint hit coverage',()=>{
 assert.equal(pairModelCoverage(ticket('A',[1]),ticket('A',[2])).atLeastOne,.8)
})
test('unknown or conflicting shared distributions use conservative bound',()=>{
 const a=ticket('A',[1]),b=ticket('A',[1]);delete b.legs[0].horses[0].estimatedProbability
 assert.equal(pairModelCoverage(a,b).basis,'conservative_overlap_bound_missing_distribution')
 b.legs[0].horses[0].estimatedProbability=.4;b.legs[0].modelVersion='other'
 assert.equal(pairModelCoverage(a,b).atLeastOne,.4)
 assert.throws(()=>pairModelCoverage({...a,estimatedChance:NaN},b),/Invalid/)
})
