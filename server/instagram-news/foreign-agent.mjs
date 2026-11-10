import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { racingCountry } from '../foreign-data.mjs'
import { loadForeignRankingModel } from '../ranking.mjs'
import { buildCityFacts } from './facts.mjs'
import { buildCityModelFacts } from './model-facts.mjs'
import { readPublicationCadence } from './cadence.mjs'
import { uploadImages, publish, sha } from '../instagram-agent-io.mjs'

const exec = promisify(execFile)
const root = 'data/instagram'
const json = async path => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
const citySlug = city => city.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
const cleanHorse = name => String(name ?? '')
  .replace(/\s+\((?:USA|GB|IRE|FR|GER|AUS|NZ|SAF|JPN|CAN|ARG|BRZ|CHI)\)(?=\s|$)/gi, '')
  .replace(/(?:\s+(?:KG|K|DB|SK|SKG|GKR|ÖG|TG|YP|BB|DS|AP|HKG|M))+$/i, '').trim()
const signature = entries => sha(JSON.stringify(entries.map(({ city, facts, model }) => ({ city, races: facts.races, model: model.races, method: model.method, trainedThrough: model.trainedThrough }))))

export function eligibleForeign(program, report) {
  const entries = []
  for (const meeting of (program.meetings ?? []).filter(item => item.foreign)) {
    const country = racingCountry(meeting.city)
    const active = country && loadForeignRankingModel(country, { metadataOnly: true })?.metadata
    if (!active) { report.blocked.push({ city: meeting.city, reason: 'foreign_active_model_unavailable' }); continue }
    const facts = buildCityFacts(program, meeting.city)
    if (!facts) { report.blocked.push({ city: meeting.city, reason: 'foreign_program_stale_or_started' }); continue }
    const model = buildCityModelFacts(program, meeting.city, active)
    if (!model || model.rankedRaces !== facts.totalRaces || facts.totalRaces > 10) {
      report.blocked.push({ city: meeting.city, reason: 'foreign_model_ranking_incomplete', rankedRaces: model?.rankedRaces ?? 0, totalRaces: facts.totalRaces })
      continue
    }
    entries.push({ city: meeting.city, country, facts, model })
  }
  return entries.sort((a, b) => Date.parse(a.facts.firstStartAt) - Date.parse(b.facts.firstStartAt))
}

export function groupCaption(entries, country, day) {
  const label = { US: 'ABD', GB: 'BİRLEŞİK KRALLIK', FR: 'FRANSA', ZA: 'GÜNEY AFRİKA', AU: 'AVUSTRALYA', CA: 'KANADA', JP: 'JAPONYA' }[country] ?? country
  const parts = [`${label} | ${day.split('-').reverse().join('.')} · model sıralaması`]
  for (const { city, model } of entries) {
    parts.push(`\n${city} (${model.totalRaces} koşu)`)
    for (const race of model.races) parts.push(`${race.raceNo}. ${race.first.no} ${cleanHorse(race.first.name)} / ${race.second.no} ${cleanHorse(race.second.name)}`)
  }
  parts.push(`\nKartlar her koşunun modeldeki ilk iki atını, ilk atın son sonuçlarını${country === 'US' ? ' ve varsa tarihli idmanını' : ''} gösterir. Kaynak: TJK${country === 'US' ? ' ve Equibase idman kayıtları' : ''}. Son model eğitimi: ${entries[0].model.trainedThrough.split('-').reverse().join('.')}. Bu sıralama kesin sonuç veya kazanma olasılığı değildir.\n\n#GanyanZekası #AtYarışı #YurtDışıYarışları`)
  const caption = parts.join('\n')
  if (caption.length > 2200) throw Error(`foreign_caption_too_long:${caption.length}`)
  return caption
}

export async function publishForeignModelGroups({ day, program, report, config }) {
  const candidates = eligibleForeign(program, report)
  const groups = new Map()
  for (const entry of candidates) {
    if (!groups.has(entry.country)) groups.set(entry.country, [])
    groups.get(entry.country).push(entry)
  }
  const limit = Math.max(0, Math.min(3, Number(config.maxForeignPostsPerDay) || 1))
  let attempted = 0
  for (const [country, all] of groups) {
    if (attempted >= limit) break
    const entries = all.slice(0, country === 'US' ? 3 : 5) // Instagram permits at most ten carousel images.
    for (const omitted of all.slice(entries.length)) report.blocked.push({ city: omitted.city, reason: 'foreign_carousel_capacity' })
    const id = `foreign-${day}-${country.toLowerCase()}`
    const directory = `${root}/${id}`
    await mkdir(directory, { recursive: true })
    let publication = null
    try { publication = await json(`${directory}/publication.json`) } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (publication?.status === 'published_verified' || publication?.mediaId) continue
    if (publication?.status === 'publishing_unknown') { report.blocked.push({ country, reason: 'foreign_publication_outcome_unknown' }); continue }
    const cadence = await readPublicationCadence(root, day, new Date().toISOString(), config)
    if (!cadence.due) { report.blocked.push({ country, reason: cadence.reason, nextAt: cadence.nextAt }); continue }
    attempted++
    let manifest = null
    try { manifest = await json(`${directory}/manifest.json`) } catch (error) { if (error.code !== 'ENOENT') throw error }
    const factsSignature = signature(entries)
    if (manifest && manifest.factsSignature !== factsSignature) {
      if (publication) { report.blocked.push({ country, reason: 'foreign_program_changed_after_container' }); continue }
      manifest = null
    }
    try {
      if (!manifest) {
        const paths = []
        for (const { city, facts } of entries) {
          const output = `${directory}/${citySlug(city)}`
          const result = JSON.parse((await exec(process.execPath, ['server/instagram-news/render.mjs', resolve(`data/program-cache/${day}.json`), city, output], { windowsHide: true, timeout: 45000, maxBuffer: 20000 })).stdout.trim())
          const expectedSlides = country === 'US' ? Math.ceil(facts.totalRaces / 3) : Math.ceil(facts.totalRaces / 5)
          if (result.slideCount !== expectedSlides || result.modelRaces !== facts.totalRaces || paths.length + result.slideCount > 10) throw Error(`foreign_render_incomplete:${city}`)
          for (let index = 1; index <= result.slideCount; index++) {
            const target = `${directory}/slide-${paths.length + 1}.jpg`
            await copyFile(`${output}/slide-${index}.jpg`, target)
            paths.push(target)
          }
        }
        const caption = groupCaption(entries, country, day)
        const images = await uploadImages(id, paths)
        await copyFile(paths[0], `${directory}/image.jpg`)
        manifest = {
          id, account: 'ganyan_zekasi', instagramId: '17841441483231653', date: day, country,
          cities: entries.map(item => item.city), kind: 'foreign_model_news', factsSignature,
          sourceUrls: entries.map(item => item.facts.sourceUrl), modelMethods: [...new Set(entries.map(item => item.model.method))],
          expiresAt: new Date(Math.min(...entries.map(item => Date.parse(item.facts.firstStartAt))) - 10 * 60000).toISOString(),
          localImage: 'image.jpg', imageSha256: images[0].sha256, imageUrl: images[0].url,
          images, caption, altText: `${country} yarışları: her koşu için etkin yerel modelin ilk iki sırası, TJK son sonuç dizisi ve varsa Equibase idmanı.`,
        }
        await writeFile(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2))
      }
      await publish(id, 'Prepare')
      const beforePublication = await readPublicationCadence(root, day, new Date().toISOString(), config)
      const latestProgram = await json(`data/program-cache/${day}.json`)
      const latest = eligibleForeign(latestProgram, { blocked: [] }).filter(item => item.country === country && entries.some(old => old.city === item.city))
      if (!beforePublication.due || latest.length !== entries.length || signature(latest) !== manifest.factsSignature) {
        report.blocked.push({ country, reason: 'foreign_last_minute_revalidation_failed' })
        continue
      }
      await publish(id, 'Publish')
      publication = await json(`${directory}/publication.json`)
      if (publication.status === 'published_verified') report.published.push({ country, cities: entries.map(item => item.city), kind: 'foreign_model_news', url: publication.permalink })
      else report.blocked.push({ country, reason: 'foreign_container_not_ready' })
    } catch (error) {
      report.blocked.push({ country, reason: 'foreign_publication_failed', detail: String(error.message).slice(0, 140) })
    }
  }
}
