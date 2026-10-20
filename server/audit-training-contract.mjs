import {readFile,writeFile} from 'node:fs/promises'
import {auditTrainingContract} from './training-contract.mjs'
const [root,countryList='TR,US']=process.argv.slice(2)
if(!root?.startsWith('data/intelligence-models/'))throw Error('Versioned model root required')
const countries=[]
for(const country of countryList.split(',')){if(!/^[A-Z]{2}$/.test(country))throw Error('Invalid country');const path=`${root}/${country}/${country}-training.json`;const data=JSON.parse(await readFile(path,'utf8'));countries.push({country,path,...auditTrainingContract(data)})}
const report={checkedAt:new Date().toISOString(),root,passed:countries.every(r=>r.passed),countries}
await writeFile(`${root}/training-contract-audit.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1
