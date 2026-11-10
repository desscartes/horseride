import { Worker, isMainThread, parentPort } from 'node:worker_threads'
import './runtime-env.mjs'
import { analysisUsageLedger, createUsageLedger } from './analysis-usage.mjs'

let cached = null
let cachedAt = 0
let pending = null

export function readUsageSummary({ maxAgeMs = 60_000, timeoutMs = 5_000 } = {}) {
  if (!isMainThread) throw Error('Usage summary reader runs on the main thread')
  if (cached && Date.now() - cachedAt < maxAgeMs) return Promise.resolve(cached)
  if (pending) return pending
  pending = new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { execArgv: [] })
    let finished = false
    const finish = (error, result) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      void worker.terminate()
      if (error) return reject(error)
      cached = result
      cachedAt = Date.now()
      resolve(result)
    }
    const timer = setTimeout(() => finish(Error('Usage summary timed out')), timeoutMs)
    worker.once('message', message => message?.error ? finish(Error(message.error)) : finish(null, message.result))
    worker.once('error', error => finish(error))
    worker.once('exit', code => { if (!finished) finish(Error(`Usage summary worker exited ${code}`)) })
  }).finally(() => { pending = null })
  return pending
}

if (!isMainThread) {
  try {
    const paidLedger = analysisUsageLedger()
    const paid = paidLedger.summary()
    paidLedger.close()
    const isLocal = process.env.HORSERIDE_ANALYSIS_PROVIDER === 'local'
    let local = null
    if (isLocal) {
      const localLedger = createUsageLedger(process.env.HORSERIDE_LOCAL_USAGE_FILE || 'data/maintenance/local-analysis.sqlite', { tokenLimit: 1e9, callLimit: 1e9 })
      local = localLedger.summary()
      localLedger.close()
    }
    parentPort.postMessage({ result: { ...paid, provider: isLocal ? 'local' : 'cloud', local } })
  } catch (error) {
    parentPort.postMessage({ error: error.message })
  }
}
