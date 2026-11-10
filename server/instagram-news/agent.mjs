import{publishEvidenceDigest}from'./evidence-digest-agent.mjs'
import{runDailyScopeAgent}from'./daily-scope-agent.mjs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildCityFacts } from './facts.mjs'
import { buildRaceCardFacts } from './race-card-facts.mjs'
import { buildCityObservations, observationPostDue } from './observations.mjs'
import { publishForeignRaceCards } from './foreign-race-agent.mjs'
import { publishForeignFormGroup } from './foreign-form-agent.mjs'
import { readPublicationCadence } from './cadence.mjs'
import { uploadImages, publish, sha, verifyConnection } from '../instagram-agent-io.mjs'
import { loadRankingModel } from '../ranking.mjs'

const exec = promisify(execFile)
const json = async path => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
const root = 'data/instagram'
const signature = facts => sha(JSON.stringify(facts.races))
const newsSignature = cards => sha(JSON.stringify({ races: cards?.races ?? null, method: cards?.method ?? null, trainedThrough: cards?.trainedThrough ?? null }))
const citySlug = city => city.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')

export async function runEditorialAgent({ day, report, config }) {
  const cycleStarted=Date.now()
  const progress=async(phase,city=null)=>writeFile(root+'/agent-progress.json',JSON.stringify({phase,city,pid:process.pid,at:new Date().toISOString()}))
  await progress('starting')
  report.mode = 'editorial_news'
  const connection = await json('data/maintenance/instagram-connection.json')
  if (Date.now() - Date.parse(connection.checkedAt) > 86400000) await verifyConnection()
  const verified = await json('data/maintenance/instagram-connection.json')
  if (!verified.valid || verified.account !== 'ganyan_zekasi' || !(verified.expiresAtUnix * 1000 > Date.now() + 600000)) {
    report.blocked.push({ reason: 'instagram_connection_not_ready' })
    return
  }
  await progress('connection_checked')
  const programPath = `data/program-cache/${day}.json`
  const localHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  let program = null
  try { program = await json(programPath) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  if (!program?.meetings?.length && localHour >= 7) {
    const attemptPath = `${root}/early-program-${day}.json`
    let attempt = null
    try { attempt = await json(attemptPath) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    if (!attempt || Date.now() - Date.parse(attempt.at) >= 45 * 60000) {
      await writeFile(attemptPath, JSON.stringify({ at: new Date().toISOString() }))
      try {
        await exec(process.execPath, ['--use-system-ca', 'server/program-refresh.mjs', day], {
          env: { ...process.env, HORSERIDE_PROGRAM_ONLY: '1' }, windowsHide: true, timeout: 240000, maxBuffer: 20000,
        })
        program = await json(programPath)
      } catch (error) {
        report.blocked.push({ reason: 'official_program_early_refresh_failed', detail: String(error.message).slice(0, 120) })
      }
    }
  }
  if (!program?.meetings?.length) {
    report.blocked.push({ reason: 'official_program_not_yet_cached' })
    report.status = 'waiting_for_program'
    return
  }
  const sourceAge = Date.now() - Date.parse(program.fetchedAt)
  const upcoming = (program.races ?? []).some(race => {
    const clock = String(race.time ?? '').replace('.', ':')
    const start = Date.parse(`${race.scheduledDate ?? day}T${clock}:00+03:00`)
    return Number.isFinite(start) && start - Date.now() > 20 * 60000
  })
  await progress('program_loaded')
  if(config.racePublicationMode==='daily_scopes'){
    await runDailyScopeAgent({day,program,report,config})
    return
  }
  const activeModel = loadRankingModel({ metadataOnly: true })?.metadata
  const cities = [...new Set((program.meetings ?? []).filter(meeting => !meeting.foreign).map(meeting => meeting.city))]
  cities.sort((a, b) => {
    const start = city => Math.min(...program.races.filter(race => race.city === city).map(race => Date.parse(`${race.scheduledDate ?? day}T${String(race.time).replace('.', ':')}:00+03:00`)))
    return start(a) - start(b) || a.localeCompare(b, 'tr')
  })
  const limit = Math.max(1, Math.min(8, Number(config.maxEditorialPostsPerDay) || 2))
  let cityPosts = 0
  for (const city of cities) {
    await progress('domestic_city',city)
    if (cityPosts >= limit) break
    const cityRaces=(program.races??[]).filter(r=>r.city===city)
    const firstStart=Math.min(...cityRaces.map(r=>Date.parse(`${r.scheduledDate??day}T${String(r.time).replace('.',':')}:00+03:00`)))
    const cityAge=Date.now()-Date.parse(program.cityFetchedAt?.[city]??program.fetchedAt)
    if(firstStart>Date.now()+10*60000&&cityAge>90*60000){
      if(Date.now()-cycleStarted>120000){report.blocked.push({city,reason:'domestic_refresh_deferred_to_next_cycle'});continue}
      try{
        try{await exec(process.execPath,['--use-system-ca','server/refresh-domestic-entry-proof.mjs',day,city],{windowsHide:true,timeout:90000,maxBuffer:3000})}
        catch(error){
          if(error.code!==2)throw error
          await exec(process.execPath,['--use-system-ca','server/program-city-refresh.mjs',day,city],{windowsHide:true,timeout:360000,maxBuffer:3000})
        }
        program=await json(programPath)
      }catch(error){report.blocked.push({city,reason:'domestic_refresh_failed',detail:String(error.message).slice(0,100)})}
    }
    const facts = buildCityFacts(program, city)
    if (!facts) { report.blocked.push({ city, reason: 'program_stale_or_started' }); continue }
    const cards = buildRaceCardFacts(program, city, activeModel)
    if (!cards || cards.races.length !== facts.totalRaces) { report.blocked.push({ city, reason: 'model_ranking_incomplete', rankedRaces: cards?.races.length ?? 0, totalRaces: facts.totalRaces }); continue }
    const cityKey = citySlug(city)
    let previousFormat = null
    try { previousFormat = await json(`${root}/news-${day}-${cityKey}/publication.json`) } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (previousFormat?.status === 'published_verified') { cityPosts++; continue }
    for (let part = 0; part < Math.ceil(cards.races.length / 10); part++) {
    if (cityPosts >= limit) break
    const start = part * 10, end = Math.min(start + 10, cards.races.length)
    const id = `race-cards-${day}-${cityKey}${part ? `-part-${part + 1}` : ''}`
    const directory = `${root}/${id}`
    await mkdir(directory, { recursive: true })
    let entry = null
    try { entry = await json(`${directory}/publication.json`) } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (entry?.status === 'published_verified' || entry?.mediaId) { cityPosts++; continue }
    if (entry?.status === 'publishing_unknown') { report.blocked.push({ city, reason: 'publication_outcome_unknown' }); continue }
    const cadence = await readPublicationCadence(root, day, new Date().toISOString(), config)
    if (!cadence.due) { report.blocked.push({ city, reason: cadence.reason, nextAt: cadence.nextAt }); continue }
    let manifest = null
    try { manifest = await json(`${directory}/manifest.json`) } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (manifest && manifest.factsSignature !== newsSignature({ ...cards, races: cards.races.slice(start, end) })) {
      if (entry) { report.blocked.push({ city, reason: 'program_changed_after_container' }); continue }
      manifest = null
    }
    try {
      if (!manifest) {
        await progress('rendering',city)
        const rendered = JSON.parse((await exec(process.execPath, ['server/instagram-news/render-race-cards.mjs', resolve(`data/program-cache/${day}.json`), city, directory, String(start), String(end)], { windowsHide: true, timeout: 90000, maxBuffer: 20000 }).catch(async error=>{await writeFile(directory+'/render-error.json',JSON.stringify({code:error.code,killed:error.killed,message:String(error.message).slice(0,300),stderr:String(error.stderr??'').slice(0,5000),stdout:String(error.stdout??'').slice(0,2000)}));throw error})).stdout.trim())
        if (rendered.slideCount !== end - start || rendered.modelRaces !== facts.totalRaces) throw Error('Incomplete race ranking or slide count')
        const paths = Array.from({ length: rendered.slideCount }, (_, index) => `${directory}/slide-${index + 1}.jpg`)
        const images = await uploadImages(id, paths)
        await copyFile(paths[0], `${directory}/image.jpg`)
        const caption = await readFile(`${directory}/caption.txt`, 'utf8')
        manifest = {
          id, account: 'ganyan_zekasi', instagramId: '17841441483231653', date: day, city,
          kind: 'race_model_cards', part: part + 1, factsSignature: newsSignature({ ...cards, races: cards.races.slice(start, end) }), sourceUrl: facts.sourceUrl,
          modelIncluded: true, modelMethod: cards.method, modelTrainedThrough: cards.trainedThrough,
          expiresAt: new Date(Date.parse(`${day}T${facts.firstStart.replace('.', ':')}:00+03:00`) - 10 * 60000).toISOString(),
          localImage: 'image.jpg', imageSha256: images[0].sha256, imageUrl: images[0].url,
          images, caption, altText: `${city} yarışları: her görselde bir koşunun etkin model ilk dört sırası ve atların hedef yarış öncesi doğrulanmış geçmiş veri notları.`,
        }
        if (caption.length > 2200) throw Error('caption_length_exceeded')
        await writeFile(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2))
      }
      await progress('preparing_publication',city)
      await publish(id, 'Prepare')
      const beforePublication = await readPublicationCadence(root, day, new Date().toISOString(), config)
      if (!beforePublication.due) { report.blocked.push({ city, reason: beforePublication.reason, nextAt: beforePublication.nextAt }); continue }
      const latestProgram = await json(`data/program-cache/${day}.json`)
      const latest = buildCityFacts(latestProgram, city)
      const latestCards = buildRaceCardFacts(latestProgram, city, loadRankingModel({ metadataOnly: true })?.metadata)
      if (!latest || !latestCards || newsSignature({ ...latestCards, races: latestCards.races.slice(start, end) }) !== manifest.factsSignature) { report.blocked.push({ city, reason: 'last_minute_data_revalidation_failed' }); continue }
      await progress('publishing',city)
      await publish(id, 'Publish')
      entry = await json(`${directory}/publication.json`)
      if (entry.status === 'published_verified') { report.published.push({ city, url: entry.permalink }); cityPosts++ }
      else report.blocked.push({ city, reason: 'container_not_ready' })
    } catch (error) {
      report.blocked.push({ city, reason: 'editorial_publication_failed', detail: String(error.message).slice(0, 120) })
    }
    }
  }
  await publishEvidenceDigest({day,report,config})
  if (Date.now()-cycleStarted < 120000 && upcoming && sourceAge > (localHour < 9 ? 45 : 90) * 60000) {
    try {
      await exec(process.execPath, ['--use-system-ca', 'server/program-refresh.mjs', day], {
        env: { ...process.env, HORSERIDE_PROGRAM_ONLY: '1' }, windowsHide: true, timeout: 240000, maxBuffer: 20000,
      })
      program = await json(programPath)
    } catch (error) {
      report.blocked.push({ reason: 'official_program_refresh_failed', detail: String(error.message).slice(0, 120) })
    }
  }
  await publishForeignRaceCards({ day, program, report, config })
  await publishForeignFormGroup({ day, program, report, config })
  let jockeyFile = null
  try { jockeyFile = await json(`data/maintenance/jockey-evidence-${day}.json`) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (jockeyFile) {
    const candidates = cities.map(city => buildCityObservations(program, city, jockeyFile))
      .filter(Boolean)
      .filter(item => observationPostDue(item))
      .sort((a, b) => b.races.filter(race => race.workout).length - a.races.filter(race => race.workout).length)
    for (const observations of candidates.slice(0, Math.max(0, Math.min(2, Number(config.maxObservationPostsPerDay) || 1)))) {
      const city = observations.city
      const baseId = `race-cards-${day}-${citySlug(city)}`
      let base = null
      try { base = await json(`${root}/${baseId}/publication.json`) } catch (error) { if (error.code !== 'ENOENT') throw error }
      if (base?.status !== 'published_verified') continue
      const id = `archive-${day}-${citySlug(city)}`
      const directory = `${root}/${id}`
      await mkdir(directory, { recursive: true })
      let entry = null
      try { entry = await json(`${directory}/publication.json`) } catch (error) { if (error.code !== 'ENOENT') throw error }
      if (entry?.status === 'published_verified' || entry?.mediaId) continue
      if (entry?.status === 'publishing_unknown') { report.blocked.push({ city, reason: 'observation_outcome_unknown' }); continue }
      const cadence = await readPublicationCadence(root, day, new Date().toISOString(), config)
      if (!cadence.due) { report.blocked.push({ city, reason: cadence.reason, nextAt: cadence.nextAt }); continue }
      let manifest = null
      try { manifest = await json(`${directory}/manifest.json`) } catch (error) { if (error.code !== 'ENOENT') throw error }
      if (manifest && manifest.factsSignature !== signature(observations)) { report.blocked.push({ city, reason: 'observation_data_changed' }); continue }
      try {
        if (!manifest) {
        await progress('rendering',city)
          await exec(process.execPath, ['server/instagram-news/render-observations.mjs', resolve(`data/program-cache/${day}.json`), resolve(`data/maintenance/jockey-evidence-${day}.json`), city, directory], { windowsHide: true, timeout: 40000, maxBuffer: 20000 })
          const paths = [1,2,3].map(index => `${directory}/slide-${index}.jpg`)
          const images = await uploadImages(id, paths)
          await copyFile(paths[0], `${directory}/image.jpg`)
          const caption = await readFile(`${directory}/caption.txt`, 'utf8')
          if (caption.length > 2200) throw Error('caption_length_exceeded')
          manifest = {
            id, account: 'ganyan_zekasi', instagramId: '17841441483231653', date: day, city,
            kind: 'archive_observations', factsSignature: signature(observations), sourceUrl: observations.sourceUrl,
            expiresAt: new Date(observations.firstStartAt - 45 * 60000).toISOString(),
            localImage: 'image.jpg', imageSha256: images[0].sha256, imageUrl: images[0].url,
            images, caption, altText: `${city} idman ve jokey arşivi; tüm koşularda geçmiş kayıtlar ve örnek sayıları belirtilmiştir.`,
          }
          await writeFile(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2))
        }
        await progress('preparing_publication',city)
      await publish(id, 'Prepare')
        const beforePublication = await readPublicationCadence(root, day, new Date().toISOString(), config)
        if (!beforePublication.due) { report.blocked.push({ city, reason: beforePublication.reason, nextAt: beforePublication.nextAt }); continue }
        const latest = buildCityObservations(await json(`data/program-cache/${day}.json`), city, await json(`data/maintenance/jockey-evidence-${day}.json`))
        if (!latest || signature(latest) !== manifest.factsSignature) { report.blocked.push({ city, reason: 'observation_revalidation_failed' }); continue }
        await progress('publishing',city)
      await publish(id, 'Publish')
        entry = await json(`${directory}/publication.json`)
        if (entry.status === 'published_verified') report.published.push({ city, kind: 'archive_observations', url: entry.permalink })
        else report.blocked.push({ city, reason: 'observation_container_not_ready' })
      } catch (error) {
        report.blocked.push({ city, reason: 'observation_publication_failed', detail: String(error.message).slice(0, 120) })
      }
    }
  }
  report.status = report.published.length ? 'published' : report.blocked.length ? 'waiting_for_editorial_data' : 'no_due_meeting'
}
