import { randomUUID } from 'node:crypto'
import {analysisLog,analysisErrorCode} from './analysis-log.mjs'
import {analysisError,publicAnalysis} from '../src/data/analysisLanguage.js'

export function createAnalysisJobs({ now = Date.now, retentionMs = 30 * 60_000, log=analysisLog } = {}) {
  const jobs = new Map()
  const running = new Map()
  const publicJob = job => job && ({ id: job.id, status: job.status, progress: {...job.progress,analysis:publicAnalysis(job.progress?.analysis),elapsedMs:now()-job.startedAt}, result: job.result, error: job.error,code:job.code })
  function prune() {
    for (const [id, job] of jobs) if (job.finishedAt != null && now() - job.finishedAt > retentionMs) jobs.delete(id)
  }
  return {
    start(key, task) {
      prune()
      if (running.has(key)) return publicJob(running.get(key))
      const job = { id: randomUUID(), startedAt:now(), status: 'running', progress: { phase: 'preparing', completed: 0, total: 0 } }
      const [date,...parts]=key.split(':');const context={jobId:job.id,date,city:parts.join(':')}
      log('job_started',context)
      jobs.set(job.id, job)
      running.set(key, job)
      Promise.resolve().then(() => task(progress => { job.progress = progress;log('job_progress',{...context,phase:progress.phase,completed:progress.completed,total:progress.total,elapsedMs:now()-job.startedAt}) })).then(result => {
        job.status = 'ready'
        job.result = result?.analysis?{...result,model:undefined,analysis:publicAnalysis(result.analysis)}:result
        log('job_ready',{...context,elapsedMs:now()-job.startedAt})
      }).catch(error => {
        job.status = 'error'
        job.error = analysisError(error)
        job.code=error.code
        log('job_error',{...context,elapsedMs:now()-job.startedAt,code:analysisErrorCode(error)})
      }).finally(() => { job.finishedAt = now(); running.delete(key) })
      return publicJob(job)
    },
    get(id) { prune(); return publicJob(jobs.get(id)) },
    getRunning(key) { return publicJob(running.get(key)) },
    runningCount() { return running.size },
  }
}
