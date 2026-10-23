import {readFile,writeFile} from 'node:fs/promises'
import {readServedProgram} from './served-program.mjs'
import {captureModelMetadata} from './capture-prestart.mjs'
import {localDay} from './maintenance-policy.mjs'
import {preparationReadiness} from './preparation-readiness.mjs'
const date=process.argv[2]||localDay(),p=readServedProgram(date);if(!p?.races?.length)throw Error('No published current program')
let coverage=null;try{coverage=JSON.parse(await readFile(`data/maintenance/current-runner-gaps-${date}.json`,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
let jockeyCoverage=null;try{jockeyCoverage=JSON.parse(await readFile(`data/maintenance/jockey-coverage-${date}.json`,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
const metadata=new Map();for(const r of p.races)if(!metadata.has(r.rankingMethod))metadata.set(r.rankingMethod,await captureModelMetadata(r))
const report=preparationReadiness(p,{date,metadata,coverage,jockeyCoverage});await writeFile(`data/maintenance/preparation-readiness-${date}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({firstUpcomingStart:report.firstUpcomingStart,races:report.races.length,servingReady:report.races.filter(r=>r.servingReady).length,dataComplete:report.races.filter(r=>r.dataComplete).length}))
