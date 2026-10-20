import test from 'node:test'
import assert from 'node:assert/strict'
import {simulationAllowance,selectSimulationTickets,weekStart} from './simulation-policy.mjs'
test('weekly allowance resets Monday and reserves money for all remaining days',()=>{
 assert.equal(weekStart('2026-10-20'),'2026-10-19')
 assert.equal(simulationAllowance('2026-10-20',[]).daily,166)
 assert.equal(simulationAllowance('2026-10-25',[{week:'2026-10-19',spent:950}]).daily,50)
 assert.equal(simulationAllowance('2026-10-26',[{week:'2026-10-19',spent:1000}]).daily,142)
})
test('two distinct games maximize model hit expectation within combined budget',()=>{
 const g=[[{city:'A',cost:40,estimatedChance:.2},{city:'A',cost:80,estimatedChance:.3}],[{city:'B',cost:40,estimatedChance:.15}],[{city:'C',cost:40,estimatedChance:.25}]]
 const t=selectSimulationTickets(g,100);assert.deepEqual(t.map(t=>t.city),['C','A']);assert.ok(t.reduce((n,t)=>n+t.cost,0)<=100)
 assert.equal(selectSimulationTickets(g,1).length,0)
 assert.equal(selectSimulationTickets([g[0]],50).length,1)
})
