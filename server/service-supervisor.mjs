import './runtime-env.mjs'
import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, appendFileSync,renameSync } from 'node:fs'
import {networkInterfaces,uptime} from 'node:os'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { localDay } from './maintenance-policy.mjs'
import {isProcessRunning} from './process-liveness.mjs'
import {recentOwner,shouldRestartOwnedApi} from './health-policy.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
process.chdir(root)
const directory = resolve('data/maintenance')
mkdirSync(directory, { recursive: true })
const lock = resolve(directory, 'supervisor.lock')
const log = message => appendFileSync(resolve(directory,'service.log'), `${new Date().toISOString()} ${message}\n`)
if (existsSync(lock)) {
  const previous=JSON.parse(readFileSync(lock))
  const bootAt=Date.now()-uptime()*1000
  const previousStartedAt=Date.parse(previous.startedAt)
  if(recentOwner(previous,Date.now(),bootAt)||(previousStartedAt>=bootAt&&isProcessRunning(previous.pid)))process.exit(0)
  unlinkSync(lock)
}
const ownership={pid:process.pid,startedAt:new Date().toISOString(),heartbeatAt:new Date().toISOString()}
writeFileSync(lock, JSON.stringify(ownership), { flag: 'wx' })
const port = Number(process.env.PORT || 8788)
let api, worker, snapshotWorker, stopping = false
let healthFailures=0,apiCheckPending=false,lastHealthyAt=null
let lastSnapshotStart = 0
let snapshotStarting = false
let lastMaintenanceStart = 0, lastMaintenanceDay = null
const healthy = async () => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(3000) })
    return response.ok && (await response.json()).service === 'horseride-data'
  } catch { return false }
}
function launch(script, args = []) {
  const child = spawn(process.execPath, ['--use-system-ca', script, ...args], { cwd: root, windowsHide: true, stdio: ['ignore','pipe','pipe'] })
  child.stdout.on('data', bytes => log(`${script}: ${bytes.toString().trim()}`))
  child.stderr.on('data', bytes => log(`${script}: ${bytes.toString().trim()}`))
  child.on('error', error => log(`${script}: ${error.message}`))
  return child
}
function portOccupied() {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port })
    const finish = value => { socket.destroy(); resolve(value) }
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.setTimeout(2000, () => finish(true))
  })
}
async function ensureApi() {
  if(stopping||apiCheckPending)return
  apiCheckPending=true
  try{
    const ok=await healthy()
    healthFailures=ok?0:healthFailures+1
    if(ok)lastHealthyAt=new Date().toISOString()
    const addresses=[...new Set(Object.values(networkInterfaces()).flat().filter(a=>a&&!a.internal&&a.family==='IPv4').map(a=>a.address))]
    const status={checkedAt:new Date().toISOString(),pid:process.pid,apiHealthy:ok,lastHealthyAt,consecutiveFailures:healthFailures,apiPid:api?.pid||null,phoneHealthUrls:addresses.map(a=>`http://${a}:${port}/api/health`)}
    writeFileSync(resolve(directory,'service-health.json'),JSON.stringify(status,null,2))
    if(shouldRestartOwnedApi({owned:Boolean(api),healthy:ok,failures:healthFailures})){
      log('Owned API failed three health checks; restarting')
      api.kill();return
    }
    if(api||ok||await portOccupied())return
    api=launch('server/index.mjs')
    log(`API started PID ${api.pid}`)
    api.on('exit',code=>{log(`API exited ${code}; will retry`);api=null})
  }finally{apiCheckPending=false}
}
function runMaintenance() {
  if (stopping || worker) return
  let state = {}
  try { state = JSON.parse(readFileSync(resolve(directory,'state.json'))) } catch {}
  const today = localDay()
  if (state.completedDay === today || (state.day === today && state.finishedAt && Date.now() - Date.parse(state.finishedAt) < 6 * 3600000) || (lastMaintenanceDay === today && Date.now() - lastMaintenanceStart < 6 * 3600000)) return
  lastMaintenanceStart = Date.now(); lastMaintenanceDay = today
  worker = launch('server/daily-maintenance.mjs')
  log(`Daily maintenance started PID ${worker.pid}`)
  worker.on('exit', code => { log(`Daily maintenance exited ${code}`); worker = null })
}
async function runSnapshots() {
  if(stopping||snapshotWorker||snapshotStarting||Date.now()-lastSnapshotStart<20*60_000)return
  snapshotStarting=true
  try{
    if(!await healthy()||stopping)return
    lastSnapshotStart=Date.now()
    snapshotWorker=launch('server/capture-prestart.mjs',['data/external/prestart'])
    snapshotWorker.on('error',()=>{snapshotWorker=null})
    snapshotWorker.on('exit',code=>{log(`Pre-start capture exited ${code}`);snapshotWorker=null})
  }catch(error){log(`Pre-start launch failed: ${error.message}`)}
  finally{snapshotStarting=false}
}
function shutdown() {
  stopping = true
  api?.kill(); worker?.kill(); snapshotWorker?.kill()
  try { if (JSON.parse(readFileSync(lock)).pid === process.pid) unlinkSync(lock) } catch {}
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
await ensureApi()
// Let the API become usable before CPU-intensive data processing starts.
setTimeout(runMaintenance, 30_000)
setTimeout(()=>void runSnapshots(),10_000)
setInterval(()=>{
  const current=JSON.parse(readFileSync(lock))
  if(current.pid!==process.pid){shutdown();return}
  ownership.heartbeatAt=new Date().toISOString()
  writeFileSync(`${lock}.${process.pid}.tmp`,JSON.stringify(ownership));renameSync(`${lock}.${process.pid}.tmp`,lock)
  void ensureApi().catch(error=>log(`API health check failed: ${error.message}`));void runSnapshots();runMaintenance()
},60_000)
log('Supervisor ready; API watch every minute, daily collection and training enabled')
