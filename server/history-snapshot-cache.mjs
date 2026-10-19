import {serialize,deserialize} from 'node:v8'
import {gzipSync,gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync,renameSync,mkdirSync,unlinkSync,existsSync,readdirSync,statSync} from 'node:fs'
import {resolve} from 'node:path'
const sourceFiles=['history-snapshot-cache.mjs','index.mjs','ranking.mjs','performance-features.mjs','pedigree-features.mjs','intelligence-features.mjs','race-class.mjs','data-quality.mjs','racing-identity.mjs','pedigree-registry.mjs','environment-features.mjs','horse-equipment.mjs','foreign-data.mjs']
const implementation=createHash('sha256').update(process.version+process.versions.v8+sourceFiles.map(name=>readFileSync(new URL(name,import.meta.url),'utf8')).join('\n')).digest('hex')
export function historySnapshotKey({date,revision,identitySignature,dependencySignature=''}){
 return createHash('sha256').update(JSON.stringify({schema:1,date,revision,identitySignature,dependencySignature,implementation})).digest('hex')
}
export function historyIdentitySignature(entries){return JSON.stringify([...entries].sort(([a],[b])=>a.localeCompare(b)))}
export function pedigreeHistoryDependency({path=resolve(process.env.PEDIGREE_REGISTRY_PATH||'data/external/tjk-pedigree/registry.json')}={}){
 try{const records=JSON.parse(readFileSync(path,'utf8')).records||{},parents=Object.entries(records).sort(([a],[b])=>a.localeCompare(b)).map(([id,row])=>[id,row.sire??null,row.dam??null,row.damsire??null]);return createHash('sha256').update(JSON.stringify(parents)).digest('hex')}catch{return 'unavailable'}
}
function location(key,directory){if(!/^[a-f0-9]{64}$/.test(key))throw Error('Invalid history snapshot key');return resolve(directory,`${key}.v8`)}
const defaultDirectory=()=>process.env.HORSERIDE_HISTORY_CACHE_DIR||'data/maintenance/history-cache'
export function loadHistorySnapshot(key,{directory=defaultDirectory()}={}){
 if(process.env.HORSERIDE_HISTORY_CACHE==='0')return null
 try{const saved=deserialize(gunzipSync(readFileSync(location(key,directory))));return saved.schema===1&&saved.key===key&&saved.histories instanceof Map?saved.histories:null}catch{return null}
}
export function saveHistorySnapshot(key,histories,{directory=defaultDirectory(),onEvent=()=>{}}={}){
 if(process.env.HORSERIDE_HISTORY_CACHE==='0'||!(histories instanceof Map))return false
 let temporary,phase='serializing'
 try{
  const path=location(key,directory);mkdirSync(directory,{recursive:true})
  if(existsSync(path)){if(loadHistorySnapshot(key,{directory}))return true;unlinkSync(path)}
  const raw=serialize({schema:1,key,histories});if(raw.length>768*1024*1024){onEvent({phase:'raw_size_limit',inputBytes:raw.length});return false}
  const bytes=gzipSync(raw,{level:1});if(bytes.length>256*1024*1024){onEvent({phase:'compressed_size_limit',inputBytes:bytes.length});return false}
  phase='writing';temporary=`${path}.${process.pid}.${Date.now()}.tmp`;writeFileSync(temporary,bytes);renameSync(temporary,path)
  onEvent({phase:'stored',inputBytes:raw.length})
  // Bound generated cache disk usage; never inspect or remove other files.
  try{const older=readdirSync(directory).filter(n=>/^[a-f0-9]{64}\.v8$/.test(n)&&n!==`${key}.v8`).map(n=>({path:resolve(directory,n),time:statSync(resolve(directory,n)).mtimeMs})).sort((a,b)=>b.time-a.time);for(const row of older.slice(3))try{unlinkSync(row.path)}catch{}}catch{}
  return true
 }catch(error){onEvent({phase,code:error.code||error.name});if(temporary)try{unlinkSync(temporary)}catch{};return false}
}
