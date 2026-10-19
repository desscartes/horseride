import './runtime-env.mjs'
import {remoteDeployment} from './deployment-role.mjs'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile, rename, copyFile, unlink, access } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { localDay, shiftDay, collectionDates, promotionAllowed } from './maintenance-policy.mjs'
import {isProcessRunning} from './process-liveness.mjs'

process.chdir(fileURLToPath(new URL('../', import.meta.url)))
if(remoteDeployment()){console.log('Collection and training are owned by the home server; local run skipped.');process.exit(0)}
const directory = 'data/maintenance'
await mkdir(directory, { recursive: true })
const lock = `${directory}/daily.lock`
try{const morning=JSON.parse(await readFile(`${directory}/morning.lock`,'utf8'));if(isProcessRunning(morning.pid)&&String(morning.pid)!==process.env.HORSERIDE_MORNING_OWNER){console.log('Morning preparation owns collection and training');process.exit(0)}}catch(e){if(e.code!=='ENOENT')throw e}
try {
  const previous = JSON.parse(await readFile(lock, 'utf8'))
  if(isProcessRunning(previous.pid))process.exit(0)
  await unlink(lock)
} catch (e) { if (e.code !== 'ENOENT') throw e }
await writeFile(lock, JSON.stringify({ pid: process.pid }), { flag: 'wx' })
const today = localDay(), through = shiftDay(today, -1)
let state = { startedAt: new Date().toISOString(), day: today, through, phase: 'collecting', reports: [], errors: [] }
try { const previous = JSON.parse(await readFile(`${directory}/state.json`,'utf8')); state.previousCompletedDay = previous.completedDay } catch {}
async function persist() {
  const temp = `${directory}/state.json.tmp`
  await writeFile(temp, JSON.stringify(state, null, 2)); await rename(temp, `${directory}/state.json`)
}
async function run(command, args, env = {}, timeout = 45 * 60_000) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: { ...process.env, ...env }, windowsHide: true, stdio: ['ignore','pipe','pipe'] })
    const timer = setTimeout(() => { child.kill(); reject(Error(`${args.find(a=>/\.(?:mjs|py)$/.test(a))||args[0]} timed out`)) }, timeout)
    child.stdout.on('data', b => process.stdout.write(b))
    child.stderr.on('data', b => process.stderr.write(b))
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('exit', code => { clearTimeout(timer); code === 0 ? resolvePromise() : reject(Error(`${args[0]} exited ${code}`)) })
  })
}
async function json(path) { return JSON.parse(await readFile(path,'utf8')) }
async function active(country) {
  if(country==='TR')try{
    const pedigree=await json((await json('data/pedigree-models/active-TR.json')).reportPath)
    let daily=null;try{daily=await json((await json('data/daily-models/active-TR.json')).reportPath)}catch{}
    if(pedigree.enabled&&(!daily||pedigree.trainedThrough>daily.trainedThrough))return pedigree
  }catch{}
  try { return await json((await json(`data/daily-models/active-${country}.json`)).reportPath) }
  catch { return json(country === 'TR' ? 'data/ranking-report.json' : 'data/foreign-models/US-report.json') }
}
try {
  await persist()
  process.env.HORSERIDE_NO_LISTEN = '1'
  const { collectHistoricalDay } = await import('./index.mjs')
  const { listHistoricalRaces } = await import('./database.mjs')
  let archive = listHistoricalRaces()
  const dates = collectionDates(today, archive.map(r => r.date).sort().at(-1))
  for (const date of dates) for (const foreignOnly of [false, true]) {
    try {
      const report = await collectHistoricalDay(date, { foreignOnly })
      state.reports.push({ ...report, foreignOnly })
      if (report.failures.length || report.reports.some(r => r.rejected?.length)) state.errors.push(`${date} ${foreignOnly ? 'foreign' : 'TR'}: incomplete outcomes, will revisit`)
    } catch (error) { state.errors.push(`${date}: ${error.message}`) }
    await persist()
  }
  state.phase = 'enriching'; await persist()
  try{
    const {reportProspective}=await import('./report-prospective.mjs')
    const report=await reportProspective()
    state.prospectiveReport={updatedAt:report.updatedAt,groups:report.groups}
  }catch(error){state.errors.push(`Prospective measurement: ${error.message}`)}
  const environment = { ARCHIVE_THROUGH_DATE: through, WORKOUT_FROM_DATE: shiftDay(today,-7), WORKOUT_THROUGH_DATE: through }
  try { await run(process.execPath, ['--use-system-ca','server/collect-training-workouts.mjs'], environment, 20*60_000) }
  catch (error) { state.errors.push(`Workouts: ${error.message}`) }
  // Archive official overseas workouts daily even when no user requests an AI analysis.
  try {
    const { collectEquibaseWorkouts } = await import('./collect-equibase-workouts.mjs')
    state.foreignWorkouts = await collectEquibaseWorkouts()
    if (state.foreignWorkouts.failures.length) state.errors.push('Equibase workouts: partial source coverage, will retry')
  } catch (error) { state.errors.push(`Equibase workouts: ${error.message}`) }
  await persist()
  let config = {}
  try { config = await json('data/maintenance/config.json') } catch (error) { if(error.code !== 'ENOENT') throw error }
  const python = process.env.PYTHON_BIN || (config.python && existsSync(config.python) ? config.python : process.platform === 'win32' ? 'python' : 'python3')
  if(config.historyBackfillEnabled){
    state.phase='backfilling_careers';await persist()
    try{await run(process.execPath,['--use-system-ca','server/backfill-campaign.mjs'],{},40*60_000)}catch(error){state.errors.push(`History backfill: ${error.message}`)}
  }
  // Expand official US archives beyond TJK-listed meetings, without changing live inputs.
  try {
    if(config.overseasDataExperimentEnabled){
      await run(process.execPath,['--use-system-ca','server/collect-equibase-charts.mjs'],{ARCHIVE_FROM_DATE:shiftDay(today,-7),ARCHIVE_THROUGH_DATE:through},15*60_000)
      await run(python,['server/parse-equibase-charts.py','data/external/equibase'],{},20*60_000)
    }
    const {collectCareerCharts}=await import('./collect-career-charts.mjs')
    state.careerCharts=await collectCareerCharts({output:'data/external/equibase-career',through,from:shiftDay(today,-60),existingDirectory:'data/external/equibase',maxDownloads:120})
    await run(python,['server/parse-equibase-charts.py','data/external/equibase-career'],{},20*60_000)
  } catch(error){state.errors.push(`Expanded official charts: ${error.message}`)}
  state.phase='enriching_historical_fields';await persist()
  try{await run(python,['server/collect-chart-pedigree.py'],environment,20*60_000)}catch(error){state.errors.push(`Official chart pedigree: ${error.message}`)}
  try{await run(process.execPath,['--use-system-ca','server/collect-tjk-pedigree.mjs'],environment,10*60_000);state.maternalPedigree=await json('data/external/tjk-pedigree/collection-report.json');if(state.maternalPedigree.failures.length||state.maternalPedigree.pendingObserved>state.maternalPedigree.saved)state.errors.push('Maternal pedigree: partial official source coverage, will retry')}catch(error){state.errors.push(`Maternal pedigree collection: ${error.message}`)}
  try{await run(process.execPath,['--use-system-ca','server/enrich-historical-data.mjs'],environment,15*60_000)}catch(error){state.errors.push(`Historical field enrichment: ${error.message}`)}
  state.models = []
  try{await run(process.execPath,['--use-system-ca','server/collect-historical-prizes.mjs'],{PRIZE_COUNTRIES:'TR,US',PRIZE_MEETINGS_PER_PERIOD:'20',PRIZE_PERIODS:'train',PRIZE_SPREAD_MONTHS:'1'},12*60_000)}catch(error){state.errors.push(`Historical prizes: ${error.message}`)}
  for (const country of ['TR','US']) {
    try {
      const incumbent = await active(country)
      const currentArchive = listHistoricalRaces().filter(r => r.date <= through && (country === 'TR' ? !r.foreign : r.foreign && r.city.endsWith('ABD')))
      if (!currentArchive.some(r => r.date > incumbent.trainedThrough)) { state.models.push({ country, status: 'no_new_completed_races' }); continue }
      try {
        const latest = await json((await json(`data/daily-models/latest-${country}.json`)).reportPath)
        if (latest.dailyTraining?.day === today && latest.dailyTraining?.archiveRaces === currentArchive.length) {
          state.models.push({ country, status: 'already_trained_today', trainedThrough: latest.trainedThrough }); continue
        }
      } catch {}
      const runId = state.startedAt.replace(/[.:]/g,'-')
      const output = `data/daily-models/${today}/${runId}/${country}`
      await mkdir(output, { recursive: true })
      const env = { ...environment, PERFORMANCE_FEATURES: '1', PEDIGREE_FEATURES:incumbent.featurePipeline==='pedigree_v1'?'1':'', IDENTITY_VERSION: String(incumbent.identityVersion || 1), TRAIN_COUNTRIES: country, PACE_FEATURES: '', TRAINING_OUTPUT: `${output}/TR-training.json`, FOREIGN_MODEL_DIR: output, EXTERNAL_CHARTS_PATH: incumbent.externalChartsPath || 'data/external/equibase/parsed.json' }
      state.phase = `exporting_${country}`; await persist()
      await run(process.execPath, [country === 'TR' ? 'server/export-training.mjs' : 'server/export-foreign-training.mjs'], env)
      const trainingPath = `${output}/${country}-training.json`
      const training = await json(trainingPath)
      if (incumbent.featureIndexes.some((i,n) => training.featureNames[i] !== incumbent.featureNames[n])) throw Error('Feature pipeline mismatch; candidate held')
      const incumbentPath = `${output}/incumbent-report.json`
      await writeFile(incumbentPath, JSON.stringify(incumbent))
      state.phase = `training_${country}`; await persist()
      await run(python, ['server/train-daily-ranking.py', country, output, incumbentPath], {}, 45*60_000)
      const reportPath = `${output}/report.json`
      const report = await json(reportPath)
      report.dailyTraining = { ...report.dailyTraining, day: today, archiveRaces: currentArchive.length }
      report.externalChartsPath = incumbent.externalChartsPath
      report.trainingDataPath = trainingPath
      report.dailyModelPath = `${output}/live.json`
      const eligible = promotionAllowed(report)
      report.enabled = eligible; report.shadowEnabled = !eligible; report.promoted = eligible
      // Python/JavaScript predictions must agree before a model can become active.
      const { evaluateTreeModel } = await import('./ranking.mjs')
      const reference = await json(`${output}/reference.json`)
      const model = await json(report.dailyModelPath)
      const maxDifference = Math.max(...reference.features.map((f,i) => Math.abs(evaluateTreeModel(model,report.featureIndexes.map(index => f[index])) - reference.scores[i])))
      report.runtimeParityMaxDifference = maxDifference
      if (!Number.isFinite(maxDifference) || maxDifference > 1e-6) throw Error('Prediction runtime parity failed; activation rejected')
      await writeFile(reportPath, JSON.stringify(report,null,2))
      const latestTemp = `data/daily-models/latest-${country}.json.tmp`
      await writeFile(latestTemp, JSON.stringify({ reportPath, modelPath: report.dailyModelPath }))
      await rename(latestTemp, `data/daily-models/latest-${country}.json`)
      if (eligible) {
        const activePath = `data/daily-models/active-${country}.json`
        try { await access(activePath); await copyFile(activePath, `${output}/previous-active.json`) } catch {}
        await writeFile(`${activePath}.tmp`, JSON.stringify({ reportPath, modelPath: report.dailyModelPath }))
        await rename(`${activePath}.tmp`, activePath)
      }
      state.models.push({ country, status: eligible ? 'promoted' : 'trained_shadow', trainedThrough: report.trainedThrough, evaluation: report.evaluation, runtimeParityMaxDifference: maxDifference })
    } catch (error) { state.errors.push(`${country} training: ${error.message}`) }
    await persist()
  }
  if(config.pedigreeExperimentEnabled){
    state.phase='training_pedigree';await persist()
    try{await run(process.execPath,['server/run-pedigree-experiment.mjs'],{},45*60_000)}catch(error){state.errors.push(`Pedigree training: ${error.message}`)}
  }
  if(config.overseasDataExperimentEnabled){
    state.phase='training_overseas_data';await persist()
    try{
      const output=`data/overseas-expansion/${today}/${state.startedAt.replace(/[.:]/g,'-')}`
      await run(process.execPath,['--use-system-ca','server/run-overseas-training.mjs',output],{},45*60_000)
      state.overseasModels=(await json(`${output}/training-report.json`)).countries.map(r=>({country:r.country,status:r.status,evaluation:r.evaluation,shadowEnabled:r.shadowEnabled}))
    }catch(error){state.errors.push(`Overseas data training: ${error.message}`)}
  }
  // Current program creates genuine pre-start records, never retrospective forecasts.
  if(config.intelligenceExperimentEnabled){
    state.phase='training_intelligence';await persist()
    try{
      const output=`data/intelligence-models/${today}/${state.startedAt.replace(/[.:]/g,'-')}`
      try{
        await run(process.execPath,['--use-system-ca','server/run-intelligence-training.mjs',output],{RACE_PRIZE_REGISTRY_PATH:'data/external/race-prizes/records.json'},120*60_000)
      }catch(error){
        const interrupted=await json(`${output}/training-state.json`).catch(()=>null)
        if(!/timed out/.test(error.message)||!['training','verifying'].includes(interrupted?.phase))throw error
        state.intelligenceResume={root:output,reason:error.message,attemptedAt:new Date().toISOString()};await persist()
        await new Promise(resolve=>setTimeout(resolve,1000))
        await run(process.execPath,['--use-system-ca','server/resume-intelligence-study.mjs',output],{},60*60_000)
      }
      state.intelligenceModels=(await json(`${output}/training-report.json`)).countries.map(r=>({country:r.country,status:r.status,evaluation:r.evaluation,selectiveGate:r.selectiveGate,shadowEnabled:r.shadowEnabled}))
    }catch(error){state.errors.push(`Intelligence training: ${error.message}`)}
  }
  try {
    const response = await fetch(`http://127.0.0.1:${process.env.PORT || 8788}/api/races?date=${today}&city=${encodeURIComponent('Tümü')}`, { signal: AbortSignal.timeout(180_000) })
    if (!response.ok) throw Error(`HTTP ${response.status}`)
    state.currentProgramRaces = (await response.json()).races?.length || 0
  } catch (error) { state.errors.push(`Current program: ${error.message}`) }
  state.phase = state.errors.length ? 'partial' : 'complete'
  if (!state.errors.length) state.completedDay = today
  state.finishedAt = new Date().toISOString(); await persist()
  console.log(JSON.stringify(state))
} catch (error) {
  state.phase = 'error'; state.errors.push(error.message); state.finishedAt = new Date().toISOString(); await persist(); process.exitCode = 1
} finally { await unlink(lock).catch(() => {}) }
