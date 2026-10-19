import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {join,resolve,sep} from 'node:path'
import {pinIntelligenceStudy,intelligenceStudyPointer} from './prospective-model-pin.mjs'
const testRoot=resolve('.migration','pin-tests')
async function temporary(){await mkdir(testRoot,{recursive:true});return mkdtemp(join(testRoot,'case-'))}
async function cleanup(directory){if(!resolve(directory).startsWith(testRoot+sep))throw Error('Unsafe test cleanup');await rm(directory,{recursive:true,force:true})}
test('a registered model survives a daily pointer change and cannot silently mutate',async()=>{
 const directory=await temporary(),root=join(directory,'fixed'),folder=join(root,'TR')
 try{
  await mkdir(folder,{recursive:true});const report={method:'frozen',shadowEnabled:true,fullRuntimeFeatureParity:true,enabled:false,promoted:false,trainedThrough:'2026-10-16'}
  await writeFile(join(folder,'report.json'),JSON.stringify(report));await writeFile(join(folder,'live.json'),'{}')
  const registered=await pinIntelligenceStudy(root,['TR'],{directory,now:'2026-10-18T00:00:00Z'});assert.equal(registered[0].status,'registered')
  await writeFile(join(directory,'latest-TR.json'),JSON.stringify({reportPath:'different',modelPath:'different'}))
  assert.equal(intelligenceStudyPointer('TR',{directory}).method,'frozen')
  assert.equal((await pinIntelligenceStudy(root,['TR'],{directory}))[0].status,'retained')
  const pin=JSON.parse(await readFile(join(directory,'prospective-TR.json'),'utf8'));assert.equal(pin.role,'shadow_only')
  await writeFile(join(folder,'live.json'),'changed model bytes')
  assert.throws(()=>intelligenceStudyPointer('TR',{directory}),/changed/)
 }finally{await cleanup(directory)}
})
test('same-day or unverified artifacts cannot be registered',async()=>{
 const directory=await temporary(),root=join(directory,'new'),folder=join(root,'US')
 try{
  await mkdir(folder,{recursive:true});await writeFile(join(folder,'report.json'),JSON.stringify({method:'unsafe',shadowEnabled:true,fullRuntimeFeatureParity:true,trainedThrough:'2026-10-18'}))
  await assert.rejects(pinIntelligenceStudy(root,['US'],{directory,now:'2026-10-18T00:00:00Z'}),/prior-day/)
 }finally{await cleanup(directory)}
})
