import { randomUUID } from 'node:crypto'

export function createAnalysisJobs({ now = Date.now, retentionMs = 30 * 60_000 } = {}) {
  const jobs = new Map()
  const running = new Map()
  const publicJob = job => job && ({ id: job.id, status: job.status, progress: job.progress, result: job.result, error: job.error })
  function prune() {
    for (const [id, job] of jobs) if (job.finishedAt != null && now() - job.finishedAt > retentionMs) jobs.delete(id)
  }
  return {
    start(key, task) {
      prune()
      if (running.has(key)) return publicJob(running.get(key))
      const job = { id: randomUUID(), status: 'running', progress: { phase: 'preparing', completed: 0, total: 0 } }
      jobs.set(job.id, job)
      running.set(key, job)
      Promise.resolve().then(() => task(progress => { job.progress = progress })).then(result => {
        job.status = 'ready'
        job.result = result
      }).catch(error => {
        job.status = 'error'
        job.error = error.message || 'Analiz tamamlanamadı.'
      }).finally(() => { job.finishedAt = now(); running.delete(key) })
      return publicJob(job)
    },
    get(id) { prune(); return publicJob(jobs.get(id)) },
    runningCount() { return running.size },
  }
}
