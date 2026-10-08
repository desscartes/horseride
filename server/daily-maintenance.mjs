import './runtime-env.mjs'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile, rename, copyFile, unlink, access } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { localDay, shiftDay, collectionDates, promotionAllowed } from './maintenance-policy.mjs'
import {isProcessRunning} from './process-liveness.mjs'

process.chdir(fileURLToPath(new URL('../', import.meta.url)))
const directory = 'data/maintenance'
await mkdir(directory, { recursive: true })
const lock = `${directory}/daily.lock`
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
    const timer = setTimeout(() => { child.kill(); reject(Error(`${args[0]} timed out`)) }, timeout)
    child.stdout.on('data', b => process.stdout.write(b))
    child.stderr.on('data', b => process.stderr.write(b))
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('exit', code => { clearTimeout(timer); code === 0 ? resolvePromise() : reject(Error(`${args[0]} exited ${code}`)) })
  })
}
async function json(path) { return JSON.parse(await readFile(path,'utf8')) }
async function active(country) {
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
  // Expand official US archives beyond TJK-listed meetings, without changing live inputs.
  try {
    const {collectCareerCharts}=await import('./collect-career-charts.mjs')
    state.careerCharts=await collectCareerCharts({output:'data/external/equibase-career',through,from:shiftDay(today,-60),existingDirectory:'data/external/equibase',maxDownloads:120})
    await run(python,['server/parse-equibase-charts.py','data/external/equibase-career'],{},20*60_000)
  } catch(error){state.errors.push(`Expanded official charts: ${error.message}`)}
  state.models = []
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
      const env = { ...environment, PERFORMANCE_FEATURES: '1', IDENTITY_VERSION: String(incumbent.identityVersion || 1), TRAIN_COUNTRIES: country, PACE_FEATURES: '', TRAINING_OUTPUT: `${output}/TR-training.json`, FOREIGN_MODEL_DIR: output, EXTERNAL_CHARTS_PATH: incumbent.externalChartsPath || 'data/external/equibase/parsed.json' }
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
  // Current program creates genuine pre-start records, never retrospective forecasts.
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
