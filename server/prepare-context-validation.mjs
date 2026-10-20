import {readFile,writeFile,rename} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {externalChartHistory} from './foreign-data.mjs'
import {priorRaceContext,priorRaceContextNames} from './prior-race-context.mjs'
const root=process.argv[2];if(!root?.startsWith('data/intelligence-models/'))throw Error('Frozen root required')
const raw=await readFile(`${root}/charts.json`),training=await readFile(`${root}/US/US-training.json`),data=JSON.parse(training),history=externalChartHistory(JSON.parse(raw).races)
let runners=0,known=0
const races=data.races.map(r=>{const features=priorRaceContext({...r,horses:r.horses.map(name=>({name}))},r.date,history);runners+=features.length;known+=features.filter(f=>f[0]>0).length;return {date:r.date,city:r.city,no:r.no,horses:r.horses,features}})
const path=`${root}/US/prior-race-context-v1.json`,value={experimental:true,active:false,sourceSha256:createHash('sha256').update(raw).digest('hex'),trainingSha256:createHash('sha256').update(training).digest('hex'),featureNames:priorRaceContextNames,races}
await writeFile(path+'.tmp',JSON.stringify(value));await rename(path+'.tmp',path);console.log(JSON.stringify({races:races.length,runners,known,active:false,trainingSha256:value.trainingSha256}))
