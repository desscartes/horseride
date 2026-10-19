import {readFileSync,existsSync,statSync} from 'node:fs'
import {mkdir,writeFile,rename} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
const digest=path=>createHash('sha256').update(readFileSync(path)).digest('hex')
const verified=new Map()
export function intelligenceStudyPointer(artifact,{directory='data/intelligence-models'}={}){
 if(!/^(TR|US|GB|FR|ZA|AU)(?:-(?:arabian|thoroughbred))?$/.test(artifact))throw Error('Invalid intelligence artifact')
 const pinPath=resolve(directory,`prospective-${artifact}.json`)
 if(!existsSync(pinPath))return JSON.parse(readFileSync(resolve(directory,`latest-${artifact}.json`),'utf8'))
 const pin=JSON.parse(readFileSync(pinPath,'utf8'))
 if(pin.schema!==1||pin.artifact!==artifact||pin.role!=='shadow_only')throw Error('Invalid prospective model pin')
 const signature=[pin.modelSha256,pin.reportSha256,statSync(pin.modelPath).mtimeMs,statSync(pin.reportPath).mtimeMs].join(':')
 if(verified.get(pinPath)!==signature){
  if(digest(pin.modelPath)!==pin.modelSha256||digest(pin.reportPath)!==pin.reportSha256)throw Error('Prospective model changed after registration')
  verified.set(pinPath,signature)
 }
 return pin
}
export async function pinIntelligenceStudy(root,artifacts,{directory='data/intelligence-models',now=new Date().toISOString()}={}){
 if(!resolve(root).startsWith(resolve(directory)+'/')&&!resolve(root).startsWith(resolve(directory)+'\\'))throw Error('Study must stay inside intelligence-models')
 const results=[];await mkdir(directory,{recursive:true})
 for(const artifact of artifacts){
  if(!/^(TR|US|GB|FR|ZA|AU)(?:-(?:arabian|thoroughbred))?$/.test(artifact))throw Error('Invalid intelligence artifact')
  const folder=resolve(root,artifact),reportPath=resolve(folder,'report.json'),modelPath=resolve(folder,'live.json'),report=JSON.parse(readFileSync(reportPath,'utf8'))
  if(!report.shadowEnabled||!report.fullRuntimeFeatureParity||report.enabled||report.promoted||!report.method||report.trainedThrough>=now.slice(0,10))throw Error('Only verified prior-day shadow artifacts may be registered')
  const path=resolve(directory,`prospective-${artifact}.json`)
  if(existsSync(path)){const existing=intelligenceStudyPointer(artifact,{directory});results.push({artifact,status:'retained',method:existing.method,registeredAt:existing.registeredAt});continue}
  const pointer={schema:1,artifact,role:'shadow_only',registeredAt:now,method:report.method,trainedThrough:report.trainedThrough,reportPath,modelPath,modelSha256:digest(modelPath),reportSha256:digest(reportPath),minimumDays:21,minimumRaces:300,note:'Fixed model for future pre-start monitoring. Daily latest pointers cannot replace this study. No automatic activation.'}
  await writeFile(path+'.tmp',JSON.stringify(pointer,null,2));await rename(path+'.tmp',path)
  results.push({artifact,status:'registered',method:report.method,registeredAt:now})
 }
 return results
}
