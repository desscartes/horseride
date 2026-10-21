import {readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {join} from 'node:path'
import {evaluateTreeModel} from './ranking.mjs'
const date=process.argv[2];if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw Error('Explicit date required')
const base='data/external/ranking-inputs',models=new Map(),rows=[]
for(const file of readdirSync(join(base,date)).filter(f=>f.endsWith('.json'))){
 const row=JSON.parse(readFileSync(join(base,date,file),'utf8'))
 if(!(row.capturedAt<row.scheduledStart))throw Error('Poststart input journal')
 const {inputHash,capturedAt,scope,...payload}=row
 if(createHash('sha256').update(JSON.stringify(payload)).digest('hex')!==inputHash)throw Error('Input integrity mismatch')
 if(!models.has(row.modelContentSha256)){const text=readFileSync(join(base,'models',row.modelContentSha256+'.json'),'utf8');if(createHash('sha256').update(text).digest('hex')!==row.modelContentSha256)throw Error('Model integrity mismatch');models.set(row.modelContentSha256,JSON.parse(text))}
 const model=models.get(row.modelContentSha256),scores=row.horses.map(h=>evaluateTreeModel(model,row.featureIndexes?row.featureIndexes.map(i=>h.vector[i]):h.vector)/row.temperature),max=Math.max(...scores),exp=scores.map(s=>Math.exp(s-max)),sum=exp.reduce((a,b)=>a+b,0)
 const error=Math.max(...row.horses.map((h,i)=>Math.abs(Number((100*exp[i]/sum).toFixed(2))-h.probability)))
 if(!Number.isFinite(error)||error>1e-9)throw Error('Recorded probability replay mismatch')
 rows.push({city:row.city,raceNo:row.raceNo,method:row.method,runners:row.horses.length,maxDifference:error,inputHash})
}
const report={checkedAt:new Date().toISOString(),date,records:rows.length,models:models.size,verified:rows.length>0,rows,note:'Exact replay of captured serving inputs only; does not prove predictive superiority or source provenance.'};writeFileSync(`data/maintenance/ranking-input-replay-${date}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({records:rows.length,models:models.size,verified:report.verified}))
