import {readFile,writeFile,rename} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {parseTjkPedigree,saveRegistryPedigree,validatedRegistryPedigree} from './pedigree-registry.mjs'
import {readServedProgram} from './served-program.mjs'
export function verifiedStagedPedigree(item,html,horse){
 if(!/^[1-9]\d*$/.test(item.horseId)||String(horse.horseId)!==item.horseId||horse.name!==item.horse.name)return null
 if(createHash('sha256').update(html).digest('hex')!==item.sha256)return null
 return parseTjkPedigree(html,horse,item.sourceUrl)
}
export async function applyStagedPedigree(day){
 const directory=`data/maintenance/pedigree-staging-${day}`;let manifest;try{manifest=JSON.parse(await readFile(directory+'/manifest.json','utf8'))}catch(e){if(e.code==='ENOENT')return;throw e}
 if(manifest.day!==day)throw Error('Staging date mismatch')
 const horses=(readServedProgram(day)?.races||[]).flatMap(r=>r.horses),report={day,checkedAt:new Date().toISOString(),saved:0,rejected:[],alreadyKnown:0}
 for(const item of manifest.saved){if(!/^[1-9]\d*$/.test(item.horseId)){report.rejected.push({reason:'Invalid horse id'});continue}const h=horses.find(h=>String(h.horseId)===item.horseId&&h.name===item.horse.name);if(!h){report.rejected.push({id:item.horseId,reason:'No current identity match'});continue}if(validatedRegistryPedigree(h)){report.alreadyKnown++;continue}const html=await readFile(`${directory}/${item.horseId}.html`,'utf8');if(createHash('sha256').update(html).digest('hex')!==item.sha256)throw Error('Staging source integrity mismatch');const row=verifiedStagedPedigree(item,html,h);if(!row){report.rejected.push({id:item.horseId,reason:'Current parents not verified'});continue}await saveRegistryPedigree({...row,collectedAt:item.capturedAt,validatedAt:new Date().toISOString()});report.saved++}
 let retries={};try{retries=JSON.parse(await readFile('data/external/tjk-pedigree/retries.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 for(const failure of manifest.failures||[]){if(!/^[1-9]\d*$/.test(failure.horseId))continue;const after=new Date(Date.parse(failure.failedAt||manifest.finishedAt)+(/not verified/i.test(failure.error)?7*86400000:3600000)).toISOString();if(!(Date.parse(retries[failure.horseId]?.after||'')>=Date.parse(after)))retries[failure.horseId]={after,reason:failure.error}}
 const retryPath='data/external/tjk-pedigree/retries.json';await writeFile(retryPath+`.${process.pid}.tmp`,JSON.stringify(retries));await rename(retryPath+`.${process.pid}.tmp`,retryPath)
 await writeFile(directory+'/apply-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({stagedPedigreeApplied:report.saved,rejected:report.rejected.length,alreadyKnown:report.alreadyKnown}))
}
