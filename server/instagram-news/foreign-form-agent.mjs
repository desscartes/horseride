import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { racingCountry } from '../foreign-data.mjs'
import { loadForeignRankingModel } from '../ranking.mjs'
import { buildForeignFormFacts } from './foreign-form-facts.mjs'
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
const signature = entries => sha(JSON.stringify(entries.map(({ city, facts }) => ({ city, races: facts.races, sourceTime: facts.fetchedAt }))))

export function eligibleForeignForm(program) {
  return (program.meetings ?? []).filter(meeting => meeting.foreign).map(meeting => {
    const country = racingCountry(meeting.city)
    if (!country) return null
    const model = loadForeignRankingModel(country, { metadataOnly: true })?.metadata
    const ranked = model && buildCityModelFacts(program, meeting.city, model)
    const raceCount = (program.races ?? []).filter(race => race.city === meeting.city).length
    if (ranked?.rankedRaces === raceCount) return null
    const facts = buildForeignFormFacts(program, meeting.city)
    return facts ? { city: meeting.city, country, facts } : null
  }).filter(Boolean).sort((a, b) => Date.parse(a.facts.firstStartAt) - Date.parse(b.facts.firstStartAt))
}

function groupCaption(entries, day) {
  if (entries.length === 1) return null // Use the city renderer's more detailed caption.
  const parts = [`YURT DIŞI | ${day.split('-').reverse().join('.')} · geçmiş form karşılaştırması`]
  for (const { city, facts } of entries) {
    parts.push(`\n${city} (${facts.comparableRaces}/${facts.totalRaces} koşuda geçmiş karşılaştırma)`)
    for (const race of facts.races) parts.push(race.insufficientHistory
      ? `${race.raceNo}. Geçmiş sonuç kapsamı yetersiz (${race.comparableRunners}/${race.activeRunners} at)`
      : race.informative
      ? `${race.raceNo}. ${race.first.no} ${cleanHorse(race.first.name)} ${race.first.top3}/${race.first.starts}${race.second ? ` · ${race.second.no} ${cleanHorse(race.second.name)} ${race.second.top3}/${race.second.starts}` : ' · diğerlerinde ilk üç yok'}`
      : `${race.raceNo}. Ayırıcı geçmiş form kaydı yok (${race.comparableRunners}/${race.activeRunners} at)`)
  }
  parts.push('\nSayılar son altı görünür sonuçtaki ilk üç bitirişleridir. Kaynak: TJK. Bu geçmiş karşılaştırması model sırası veya gelecek sonuç tahmini değildir.\n\n#GanyanZekası #AtYarışı #YurtDışıYarışları')
  const caption = parts.join('\n')
  if (caption.length > 2200) throw Error(`foreign_form_caption_too_long:${caption.length}`)
  return caption
}

export async function publishForeignFormGroup({ day, program, report, config }) {
  if (!(Number(config.maxForeignFormPostsPerDay) > 0)) return
  const candidates = eligibleForeignForm(program)
  if (!candidates.length) return
  const entries = []
  let expectedSlides = 0
  for (const entry of candidates) {
    const slides = Math.ceil(entry.facts.totalRaces / 4)
    if (entries.length >= 3 || expectedSlides + slides > 10) break
    entries.push(entry)
    expectedSlides += slides
  }
  const id = `foreign-form-${day}`
  const directory = `${root}/${id}`
  await mkdir(directory, { recursive: true })
  let publication = null
  try { publication = await json(`${directory}/publication.json`) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (publication?.status === 'published_verified' || publication?.mediaId) return
  if (publication?.status === 'publishing_unknown') { report.blocked.push({ kind: 'foreign_form', reason: 'publication_outcome_unknown' }); return }
  const cadence = await readPublicationCadence(root, day, new Date().toISOString(), config)
  if (!cadence.due) { report.blocked.push({ kind: 'foreign_form', reason: cadence.reason, nextAt: cadence.nextAt }); return }
  let manifest = null
  try { manifest = await json(`${directory}/manifest.json`) } catch (error) { if (error.code !== 'ENOENT') throw error }
  const factsSignature = signature(entries)
  if (manifest && manifest.factsSignature !== factsSignature) {
    if (publication) { report.blocked.push({ kind: 'foreign_form', reason: 'program_changed_after_container' }); return }
    manifest = null
  }
  try {
    if (!manifest) {
      const paths = [], captions = []
      for (const { city, facts } of entries) {
        const output = `${directory}/${citySlug(city)}`
        const result = JSON.parse((await exec(process.execPath, ['server/instagram-news/render-foreign-form.mjs', resolve(`data/program-cache/${day}.json`), city, output], { windowsHide: true, timeout: 45000, maxBuffer: 20000 })).stdout.trim())
        const slideCount = Math.ceil(facts.totalRaces / 4)
        if (result.slideCount !== slideCount || result.raceCount !== facts.totalRaces) throw Error(`foreign_form_render_incomplete:${city}`)
        captions.push(await readFile(`${output}/caption.txt`, 'utf8'))
        for (let index = 1; index <= slideCount; index++) {
          const target = `${directory}/slide-${paths.length + 1}.jpg`
          await copyFile(`${output}/slide-${index}.jpg`, target)
          paths.push(target)
        }
      }
      const caption = entries.length === 1 ? captions[0] : groupCaption(entries, day)
      if (caption.length > 2200) throw Error('caption_length_exceeded')
      const images = await uploadImages(id, paths)
      await copyFile(paths[0], `${directory}/image.jpg`)
      manifest = {
        id, account: 'ganyan_zekasi', instagramId: '17841441483231653', date: day,
        cities: entries.map(item => item.city), kind: 'foreign_form_archive', factsSignature,
        sourceUrls: entries.map(item => item.facts.sourceUrl),
        expiresAt: new Date(Math.min(...entries.map(item => Date.parse(item.facts.firstStartAt))) - 10 * 60000).toISOString(),
        localImage: 'image.jpg', imageSha256: images[0].sha256, imageUrl: images[0].url,
        images, caption, altText: 'Yurt dışı yarışlarında her koşunun son altı görünür sonucundaki ilk üç bitiriş sayıları ve karşılaştırma kapsamı. Model tahmini değildir.',
      }
      await writeFile(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2))
    }
    await publish(id, 'Prepare')
    const beforePublication = await readPublicationCadence(root, day, new Date().toISOString(), config)
    const latestProgram = await json(`data/program-cache/${day}.json`)
    const latest = eligibleForeignForm(latestProgram).filter(item => entries.some(old => old.city === item.city))
    if (!beforePublication.due || latest.length !== entries.length || signature(latest) !== manifest.factsSignature) {
      report.blocked.push({ kind: 'foreign_form', reason: 'last_minute_revalidation_failed' })
      return
    }
    await publish(id, 'Publish')
    publication = await json(`${directory}/publication.json`)
    if (publication.status === 'published_verified') report.published.push({ kind: 'foreign_form_archive', cities: entries.map(item => item.city), url: publication.permalink })
    else report.blocked.push({ kind: 'foreign_form', reason: 'container_not_ready' })
  } catch (error) {
    report.blocked.push({ kind: 'foreign_form', reason: 'publication_failed', detail: String(error.message).slice(0, 140) })
  }
}
