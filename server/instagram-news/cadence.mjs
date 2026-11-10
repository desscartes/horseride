import { readFile, readdir } from 'node:fs/promises'

function istanbulDay(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = type => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function publicationCadence(publications, day, now, { maxFeedPostsPerDay = 3, minFeedGapMinutes = 90, reservedUntil = null } = {}) {
  const clock = Date.parse(now)
  const reservedTime = reservedUntil ? Date.parse(reservedUntil) : NaN
  if (Number.isFinite(reservedTime) && istanbulDay(reservedTime) === day && clock < reservedTime) {
    return { due: false, reason: 'special_post_window', nextAt: new Date(reservedTime).toISOString() }
  }
  const times = publications.filter(item => item?.status === 'published_verified' && item.kind !== 'story' && item.mediaType !== 'STORIES')
    .map(item => Date.parse(item.publishedAt ?? item.verifiedAt))
    .filter(time => Number.isFinite(time) && time <= clock)
  const todayCount = times.filter(time => istanbulDay(time) === day).length
  const lastPublishedAt = times.length ? Math.max(...times) : null
  if (todayCount >= maxFeedPostsPerDay) return { due: false, reason: 'daily_feed_limit', todayCount, lastPublishedAt }
  if (lastPublishedAt !== null && clock - lastPublishedAt < minFeedGapMinutes * 60000) {
    return { due: false, reason: 'feed_spacing', todayCount, lastPublishedAt, nextAt: new Date(lastPublishedAt + minFeedGapMinutes * 60000).toISOString() }
  }
  return { due: true, todayCount, lastPublishedAt }
}

export async function readPublicationCadence(root, day, now, config = {}) {
  const entries = (await readdir(root, { withFileTypes: true })).filter(item => item.isDirectory() && !['media-repo', 'retired'].includes(item.name))
  const publications = []
  for (const item of entries) {
    try { publications.push(JSON.parse((await readFile(`${root}/${item.name}/publication.json`, 'utf8')).replace(/^\uFEFF/, ''))) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  return publicationCadence(publications, day, now, config)
}
