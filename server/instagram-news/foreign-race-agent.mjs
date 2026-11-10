import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { racingCountry } from '../foreign-data.mjs'
import { loadForeignRankingModel } from '../ranking.mjs'
import { buildCityFacts } from './facts.mjs'
import { buildRaceCardFacts } from './race-card-facts.mjs'
import { readPublicationCadence } from './cadence.mjs'
import { uploadImages, publish, sha } from '../instagram-agent-io.mjs'

const exec = promisify(execFile)
const root = 'data/instagram'
const json = async path => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
const citySlug = city => city.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
const signature = cards => sha(JSON.stringify({ races: cards?.races ?? null, method: cards?.method ?? null, trainedThrough: cards?.trainedThrough ?? null }))

export function eligibleForeignRaceCards(program, report) {
  return (program.meetings ?? []).filter(meeting => meeting.foreign).map(meeting => {
    const city = meeting.city, country = racingCountry(city)
    const active = country && loadForeignRankingModel(country, { metadataOnly: true })?.metadata
    if (!active) { report.blocked.push({ city, reason: 'foreign_active_model_unavailable' }); return null }
    const facts = buildCityFacts(program, city)
    if (!facts) { report.blocked.push({ city, reason: 'foreign_program_stale_or_started' }); return null }
    const cards = buildRaceCardFacts(program, city, active)
    if (!cards || cards.races.length !== facts.totalRaces) {
      report.blocked.push({ city, reason: 'foreign_model_ranking_incomplete', totalRaces: facts.totalRaces })
      return null
    }
    return { city, country, facts, cards }
  }).filter(Boolean).sort((a, b) => Date.parse(a.facts.firstStartAt) - Date.parse(b.facts.firstStartAt))
}

export async function publishForeignRaceCards({ day, program, report, config }) {
  const candidates = eligibleForeignRaceCards(program, report)
  const limit = Math.max(0, Math.min(8, Number(config.maxForeignPostsPerDay) || 1))
  let posted = 0
  for (const { city, country, facts, cards } of candidates) {
    if (posted >= limit) break
    let previousFormat = null
    try { previousFormat = await json(`${root}/foreign-${day}-${country.toLowerCase()}/publication.json`) } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (previousFormat?.status === 'published_verified') {
      const oldManifest = await json(`${root}/foreign-${day}-${country.toLowerCase()}/manifest.json`)
      if (oldManifest.cities?.includes(city)) { posted++; continue }
    }
    for (let part = 0; part < Math.ceil(cards.races.length / 10); part++) {
      if (posted >= limit) break
      const start = part * 10, end = Math.min(start + 10, cards.races.length)
      const chunk = { ...cards, races: cards.races.slice(start, end) }
      const id = `foreign-race-cards-${day}-${citySlug(city)}${part ? `-part-${part + 1}` : ''}`
      const directory = `${root}/${id}`
      await mkdir(directory, { recursive: true })
      let publication = null
      try { publication = await json(`${directory}/publication.json`) } catch (error) { if (error.code !== 'ENOENT') throw error }
      if (publication?.status === 'published_verified' || publication?.mediaId) { posted++; continue }
      if (publication?.status === 'publishing_unknown') { report.blocked.push({ city, reason: 'foreign_publication_outcome_unknown' }); continue }
      const cadence = await readPublicationCadence(root, day, new Date().toISOString(), config)
      if (!cadence.due) { report.blocked.push({ city, reason: cadence.reason, nextAt: cadence.nextAt }); continue }
      let manifest = null
      try { manifest = await json(`${directory}/manifest.json`) } catch (error) { if (error.code !== 'ENOENT') throw error }
      if (manifest && manifest.factsSignature !== signature(chunk)) {
        if (publication) { report.blocked.push({ city, reason: 'foreign_program_changed_after_container' }); continue }
        manifest = null
      }
      try {
        if (!manifest) {
          const result = JSON.parse((await exec(process.execPath, ['server/instagram-news/render-race-cards.mjs', resolve(`data/program-cache/${day}.json`), city, directory, String(start), String(end)], { windowsHide: true, timeout: 90000, maxBuffer: 20000 })).stdout.trim())
          if (result.slideCount !== end - start || result.modelRaces !== facts.totalRaces) throw Error('foreign_race_card_render_incomplete')
          const paths = Array.from({ length: result.slideCount }, (_, index) => `${directory}/slide-${index + 1}.jpg`)
          const caption = await readFile(`${directory}/caption.txt`, 'utf8')
          if (caption.length > 2200) throw Error('caption_length_exceeded')
          const images = await uploadImages(id, paths)
          await copyFile(paths[0], `${directory}/image.jpg`)
          manifest = {
            id, account: 'ganyan_zekasi', instagramId: '17841441483231653', date: day, city, country,
            kind: 'foreign_race_model_cards', part: part + 1, factsSignature: signature(chunk), sourceUrl: facts.sourceUrl,
            modelMethod: cards.method, modelTrainedThrough: cards.trainedThrough,
            expiresAt: new Date(Date.parse(facts.firstStartAt) - 10 * 60000).toISOString(),
            localImage: 'image.jpg', imageSha256: images[0].sha256, imageUrl: images[0].url,
            images, caption, altText: `${city} yarışları: her görselde bir koşunun etkin model ilk dört sırası ve doğrulanmış eski sonuç veya idman notları.`,
          }
          await writeFile(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2))
        }
        await publish(id, 'Prepare')
        const beforePublication = await readPublicationCadence(root, day, new Date().toISOString(), config)
        const latestProgram = await json(`data/program-cache/${day}.json`)
        const latest = eligibleForeignRaceCards(latestProgram, { blocked: [] }).find(item => item.city === city)?.cards
        if (!beforePublication.due || !latest || signature({ ...latest, races: latest.races.slice(start, end) }) !== manifest.factsSignature) {
          report.blocked.push({ city, reason: 'foreign_last_minute_revalidation_failed' })
          continue
        }
        await publish(id, 'Publish')
        publication = await json(`${directory}/publication.json`)
        if (publication.status === 'published_verified') { report.published.push({ city, country, kind: 'foreign_race_model_cards', url: publication.permalink }); posted++ }
        else report.blocked.push({ city, reason: 'foreign_container_not_ready' })
      } catch (error) {
        report.blocked.push({ city, reason: 'foreign_publication_failed', detail: String(error.message).slice(0, 140) })
      }
    }
  }
}
