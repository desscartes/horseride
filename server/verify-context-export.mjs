import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const [root,out]=process.argv.slice(2)
if(!root?.startsWith('data/intelligence-models/')||!out?.startsWith('data/experiments/'))throw Error('Versioned paths required')
const read=async p=>JSON.parse(await readFile(p,'utf8')),old=await read(`${root}/US/US-training.json`),addon=await read(`${root}/US/prior-race-context-v1.json`),current=await read(`${out}/export-qa/US-training.json`)
assert.deepEqual(current.featureNames,[...old.featureNames,...addon.featureNames]);assert.equal(current.priorRaceContextSchemaVersion,1);assert.equal(current.races.length,old.races.length)
let runners=0
for(let i=0;i<old.races.length;i++){
 const a=old.races[i],b=current.races[i],c=addon.races[i]
 for(const k of ['date','city','no','horses','labels','baseline'])assert.deepEqual(b[k],a[k],`Race ${i} ${k} mismatch`)
 for(let j=0;j<a.features.length;j++){assert.deepEqual(b.features[j],[...a.features[j],...c.features[j]],`Race ${i} runner ${j} feature mismatch`);runners++}
}
const result={checkedAt:new Date().toISOString(),races:old.races.length,runners,originalFeatures:old.featureNames.length,addedFeatures:addon.featureNames.length,fullExportReconstructionParity:true,fullServingPipelineParity:false,activeModelChanged:false}
await writeFile(`${out}/export-reconstruction-verification.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result))
