import test from 'node:test'
import assert from 'node:assert/strict'
import { createProgramCache } from './program-cache.mjs'
import { orderMeetings } from '../src/data/meetingOrder.js'

test('shares concurrent loads, expires entries and isolates caller mutations', async () => {
  let time = 0, calls = 0
  const cache = createProgramCache({ ttlMs: 100, now: () => time })
  const fetcher = async () => { calls++; return { horses: [{ name: 'A' }] } }
  const [a,b] = await Promise.all([cache('day:city', fetcher), cache('day:city', fetcher)])
  assert.equal(calls, 1)
  a.horses[0].name = 'changed'
  assert.equal(b.horses[0].name, 'A')
  assert.equal((await cache('day:city', fetcher)).horses[0].name, 'A')
  time = 100
  assert.equal(cache.peek('day:city'), null)
  await cache('day:city', fetcher)
  assert.equal(calls, 2)
  await cache('different-day:city', fetcher)
  assert.equal(calls, 3)
})

test('retries failures instead of caching them', async () => {
  const cache = createProgramCache()
  await assert.rejects(cache('x', async () => { throw Error('offline') }))
  assert.equal(await cache('x', async () => 'recovered'), 'recovered')
})

test('orders domestic and foreign meetings together by first race, including midnight crossings', () => {
  const meetings = [{ city: 'Late', foreign: true }, { city: 'Early', foreign: false }, { city: 'Unknown', foreign: true }]
  const races = [{ city: 'Late', no: 1, time: '22.00' }, { city: 'Late', no: 5, time: '00.10' }, { city: 'Early', no: 1, time: '14:30' }]
  const sorted = orderMeetings(meetings, races)
  assert.deepEqual(sorted.map(m => m.city), ['Early', 'Late', 'Unknown'])
  assert.equal(sorted[1].firstRaceTime, '22.00')
  assert.equal(meetings[0].firstRaceTime, undefined)
})
