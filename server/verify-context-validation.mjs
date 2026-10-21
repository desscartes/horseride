import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {evaluateTreeModel} from './ranking.mjs'
const out=process.argv[2];if(!out?.startsWith('data/experiments/'))throw Error('Experiment output required')
const read=async p=>JSON.parse(await readFile(p,'utf8')),report=await read(out+'/validation-report.json'),checks=[]
assert.equal(report.testScored,false);assert.equal(report.activeModelChanged,false)
const variants=report.variants.map(r=>r.variant);assert.equal(variants.length,2);assert.equal(new Set(variants).size,2);assert.ok(variants.includes('control'));assert.ok(variants.every(v=>['control','context','load'].includes(v)))
for(const variant of variants){const model=await read(`${out}/${variant}-model.json`),ref=await read(`${out}/${variant}-reference.json`);const delta=Math.max(...ref.features.map((f,i)=>Math.abs(evaluateTreeModel(model,f)-ref.scores[i])));assert.ok(delta<1e-6,'Python/Node score mismatch');checks.push({variant,runners:ref.features.length,maxDifference:delta})}
const result={checkedAt:new Date().toISOString(),checks,pythonNodeScoringParity:true,fullServingPipelineParity:false,activeModelChanged:false,note:'Scoring parity only. The serving pipeline must independently reconstruct every feature before prospective serving or promotion.'}
await writeFile(out+'/scoring-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
