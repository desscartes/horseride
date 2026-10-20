import {readFile,writeFile} from 'node:fs/promises'
import {mergeOfficialCharts} from './overseas-chart-input.mjs'
import {foreignHorseIdentity} from './foreign-data.mjs'
const root=process.argv[2];if(!root?.startsWith('data/intelligence-models/'))throw Error('Frozen root required')
const read=async p=>JSON.parse(await readFile(p,'utf8')),data=await read(`${root}/US/US-training.json`),charts=mergeOfficialCharts([await read(`${root}/charts.json`)],data.races.map(r=>r.date).sort().at(-1))
const history=new Map()
for(const c of charts.races)for(const h of c.runners){const id=foreignHorseIdentity(h.name);if(!history.has(id))history.set(id,[]);history.get(id).push({c,h})}
const result={checkedAt:new Date().toISOString(),root,source:charts.audit,chartRunners:0,withFinishCall:0,withEarlyCall:0,withRaceFractions:0,withRaceWinnerTime:0,withComment:0,withTemperature:0,withPurse:0,rows:0,rowsWithPriorChart:0,rowsWithPriorCall:0,rowsWithPriorClassText:0,frozenExternalStartsKnown:0,examples:[]}
for(const c of charts.races)for(const h of c.runners){result.chartRunners++;result.withFinishCall+=Number(Number.isInteger(h.calls?.Fin));result.withEarlyCall+=Number(Object.entries(h.calls||{}).some(([k,v])=>!['Start','Str','Fin'].includes(k)&&Number.isInteger(v)));result.withRaceFractions+=Number(c.fractionalTimes?.length>0);result.withRaceWinnerTime+=Number(Boolean(c.winnerTime));result.withComment+=Number(Boolean(h.comment));result.withTemperature+=Number(Number.isFinite(c.temperatureC));result.withPurse+=Number(/Purse:\s*\$[\d,]+/.test(c.conditions||''))}
const feature=data.featureNames.indexOf('externalChartStarts')
for(const r of data.races)for(let i=0;i<r.horses.length;i++){
 result.rows++;const prior=(history.get(foreignHorseIdentity(r.horses[i]))||[]).filter(v=>v.c.date<r.date)
 result.rowsWithPriorChart+=Number(prior.length>0);result.rowsWithPriorCall+=Number(prior.some(v=>Number.isInteger(v.h.calls?.Fin)&&Object.keys(v.h.calls).some(k=>!['Start','Str','Fin'].includes(k))));result.rowsWithPriorClassText+=Number(prior.some(v=>v.c.conditions));const used=feature>=0&&r.features[i][feature]>0;result.frozenExternalStartsKnown+=Number(used)
 if(prior.length&&!used&&result.examples.length<15)result.examples.push({date:r.date,city:r.city,raceNo:r.no,horse:r.horses[i],priorCharts:prior.length})
}
result.note='Frozen source utilization diagnostic, not new data or measured accuracy. Per-race winner time and fractions are not individual horse times. Matching is the existing normalized-name US chart policy; registry-verified full careers are not established.'
await writeFile(`${root}/US-chart-utilization-audit.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result))
