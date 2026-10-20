import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const temp=mkdtempSync(join(tmpdir(),'horseride-simulation-'))
process.env.HORSERIDE_DB=join(temp,'test.sqlite')
const {reserveSimulationDay,simulationDays,applicationTickets}=await import('./database.mjs')
const ticket=(date,city,cost)=>({date,city,ordinal:1,algorithm:'simulation-six-v1',source:'simulation',capturedAt:new Date().toISOString(),scheduledStart:'2099-01-01T12:00:00.000Z',cost,legs:[],budget:cost})
test('immutable daily reservations, atomic weekly cap and real start guard',()=>{
 const a={date:'2098-12-22',week:'2098-12-22',spent:600,tickets:[ticket('2098-12-22','A',600)]}
 assert.equal(reserveSimulationDay(a),true)
 assert.equal(reserveSimulationDay(a),false)
 assert.equal(applicationTickets('2098').length,1)
 const b={date:'2098-12-23',week:a.week,spent:500,tickets:[ticket('2098-12-23','B',500)]}
 assert.throws(()=>reserveSimulationDay(b),/budget or prestart/)
 assert.equal(simulationDays().length,1);assert.equal(applicationTickets('2098').length,1)
 assert.throws(()=>reserveSimulationDay({...b,spent:1}),/budget or prestart/)
 assert.throws(()=>reserveSimulationDay({...b,spent:500,week:b.date,tickets:[{...b.tickets[0],scheduledStart:'2020-01-01T00:00:00Z'}]}),/budget or prestart/)
 assert.equal(reserveSimulationDay({...b,week:b.date}),true)
})
