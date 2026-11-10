import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publicationCadence, readPublicationCadence } from './cadence.mjs'

const published = at => ({ status: 'published_verified', publishedAt: at })
test('a published Story neither consumes feed quota nor postpones feed posts', () => {
  const posts=[published('2026-11-10T06:00:00Z'),{...published('2026-11-10T08:59:00Z'),kind:'story'}]
  const result=publicationCadence(posts,'2026-11-10','2026-11-10T09:00:00Z',{maxFeedPostsPerDay:2,minFeedGapMinutes:45})
  assert.equal(result.todayCount,1)
  assert.equal(result.due,true)
})
test('reads Windows PowerShell publication ledgers with a UTF-8 BOM', async () => {
  const root = await mkdtemp(join(tmpdir(), 'horse-ig-cadence-'))
  try {
    await mkdir(join(root, 'cumhuriyet-2026-10-29'))
    await writeFile(join(root, 'cumhuriyet-2026-10-29', 'publication.json'), '\uFEFF' + JSON.stringify(published('2026-10-29T06:06:33Z')))
    const result = await readPublicationCadence(root, '2026-10-29', '2026-10-29T09:07:00Z')
    assert.equal(result.todayCount, 1)
    assert.equal(result.due, true)
  } finally { await rm(root, { recursive: true, force: true }) }
})
test('reserves the approved Republic post window before city posts', () => {
  const config = { reservedUntil: '2026-10-29T10:30:00+03:00' }
  const early = publicationCadence([], '2026-10-29', '2026-10-29T06:30:00Z', config)
  assert.equal(early.reason, 'special_post_window')
  assert.equal(early.nextAt, '2026-10-29T07:30:00.000Z')
  assert.equal(publicationCadence([], '2026-10-29', '2026-10-29T07:30:00Z', config).due, true)
})
test('prevents a burst of race posts after a scheduled Republic post', () => {
  const day = '2026-10-29'
  const posts = [published('2026-10-29T06:00:00Z')]
  const early = publicationCadence(posts, day, '2026-10-29T06:30:00Z')
  assert.equal(early.due, false)
  assert.equal(early.reason, 'feed_spacing')
  assert.equal(early.nextAt, '2026-10-29T07:30:00.000Z')
  assert.equal(publicationCadence(posts, day, '2026-10-29T07:30:00Z').due, true)
})

test('counts local calendar day and caps feed volume', () => {
  const posts = [published('2026-10-28T21:30:00Z'), published('2026-10-29T06:00:00Z'), published('2026-10-29T08:00:00Z')]
  const result = publicationCadence(posts, '2026-10-29', '2026-10-29T10:00:00Z')
  assert.equal(result.todayCount, 3)
  assert.equal(result.reason, 'daily_feed_limit')
})
