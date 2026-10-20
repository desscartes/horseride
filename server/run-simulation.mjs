import './runtime-env.mjs'
import {captureSimulation} from './simulation-service.mjs'
import {retrySqliteBusy} from './sqlite-retry.mjs'
console.log(JSON.stringify(await retrySqliteBusy(()=>captureSimulation())))
