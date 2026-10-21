import {createHash} from 'node:crypto'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
const modelHashes=new WeakMap(),archivedModels=new Set()
export function recordRankingInputs({race,date,bundle,vectors,prediction},{directory='data/external/ranking-inputs',now=new Date()}={}){
 const capturedAt=now.toISOString(),m=String(race.time||'').match(/^(\d{1,2})[.:](\d{2})$/)
 if(!m||+m[1]>23||+m[2]>59||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!bundle.metadata.trainedThrough||bundle.metadata.trainedThrough>=date)return {recorded:false,reason:'ineligible'}
 let day=race.scheduledDate||date
 if(!race.scheduledDate&&+m[1]<5){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+1);day=d.toISOString().slice(0,10)}
 const scheduledStart=new Date(`${day}T${m[1].padStart(2,'0')}:${m[2]}:00+03:00`).toISOString()
 if(capturedAt>=scheduledStart)return {recorded:false,reason:'started'}
 if(vectors.length!==race.horses.length||vectors.some(v=>!v.length||v.some(n=>!Number.isFinite(n))))return {recorded:false,reason:'invalid_vectors'}
 let modelContentSha256=modelHashes.get(bundle.model)
 if(!modelContentSha256){modelContentSha256=createHash('sha256').update(JSON.stringify(bundle.model)).digest('hex');modelHashes.set(bundle.model,modelContentSha256)}
 const modelDirectory=join(directory,'models');mkdirSync(modelDirectory,{recursive:true})
 const modelPath=join(modelDirectory,modelContentSha256+'.json')
 if(!archivedModels.has(modelPath)){try{writeFileSync(modelPath,JSON.stringify(bundle.model),{flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e}archivedModels.add(modelPath)}
 const payload={schemaVersion:1,date,city:race.city,raceNo:race.no,scheduledStart,method:bundle.metadata.method,trainedThrough:bundle.metadata.trainedThrough,featurePipeline:bundle.metadata.featurePipeline,modelContentSha256,temperature:bundle.metadata.temperature,featureIndexes:bundle.metadata.featureIndexes||null,horses:race.horses.map((h,i)=>({name:h.name,no:h.no,vector:vectors[i],probability:prediction.horses.find(p=>p.name===h.name&&p.no===h.no)?.probability}))}
 if(payload.horses.some(h=>!Number.isFinite(h.probability)))return {recorded:false,reason:'prediction_identity_mismatch'}
 const inputHash=createHash('sha256').update(JSON.stringify(payload)).digest('hex'),folder=join(directory,date),file=join(folder,inputHash+'.json');mkdirSync(folder,{recursive:true})
 try{writeFileSync(file,JSON.stringify({...payload,inputHash,capturedAt,scope:'Exact vectors supplied to this serving model before race start; serialized model content hash, not an artifact-file promotion certificate.'}),{flag:'wx'});return {recorded:true,file,inputHash}}catch(e){if(e.code==='EEXIST')return {recorded:false,reason:'duplicate',inputHash};throw e}
}
