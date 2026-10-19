import {readFile,writeFile,rename,mkdir} from 'node:fs/promises'
import {evaluateTreeModel} from './ranking.mjs'
import {promotionAllowed} from './maintenance-policy.mjs'
const root=process.argv[2]
if(!root||!root.startsWith('data/pedigree-models/'))throw Error('Expected isolated pedigree experiment directory')
const json=async p=>JSON.parse(await readFile(p,'utf8'))
const report=await json(`${root}/report.json`),reference=await json(`${root}/reference.json`),model=await json(`${root}/live.json`)
const difference=Math.max(...reference.features.map((f,i)=>Math.abs(evaluateTreeModel(model,report.featureIndexes.map(j=>f[j]))-reference.scores[i])))
if(!Number.isFinite(difference)||difference>1e-6)throw Error('Python/Node prediction parity failed')
report.runtimeParityMaxDifference=difference
// Parent-group evidence must be learned and prospective quality gates must pass.
const eligible=report.pedigreeImportance>0&&promotionAllowed(report)
report.enabled=eligible;report.promoted=eligible;report.shadowEnabled=!eligible
report.deploymentStatus=eligible?'validated_promotion':'shadow_validation'
await writeFile(`${root}/report.json`,JSON.stringify(report,null,2))
await mkdir('data/pedigree-models',{recursive:true})
const pointer={reportPath:`${root}/report.json`,modelPath:`${root}/live.json`}
await writeFile('data/pedigree-models/latest-TR.json.tmp',JSON.stringify(pointer))
await rename('data/pedigree-models/latest-TR.json.tmp','data/pedigree-models/latest-TR.json')
if(eligible){await writeFile('data/pedigree-models/active-TR.json.tmp',JSON.stringify(pointer));await rename('data/pedigree-models/active-TR.json.tmp','data/pedigree-models/active-TR.json')}
console.log(JSON.stringify({eligible,runtimeParityMaxDifference:difference,retrospective:report.retrospectiveAblation,evaluation:report.evaluation,coverage:report.pedigreeCoverage}))
