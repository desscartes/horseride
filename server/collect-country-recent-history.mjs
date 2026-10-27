process.env.HORSERIDE_NO_LISTEN='1'
import {acquireCollectionGate} from './collection-gate.mjs'
import {localDay,shiftDay} from './maintenance-policy.mjs'
import {writeFile} from 'node:fs/promises'
await acquireCollectionGate()
const {collectHistoricalDay}=await import('./index.mjs'),day=process.argv[2]||localDay(),reports=[]
for(const daysAgo of [Number(process.argv[3]||1)]){const date=shiftDay(day,-daysAgo);try{reports.push({date,result:await collectHistoricalDay(date,{foreignOnly:true,countries:['CL','US']})})}catch(e){reports.push({date,error:e.message})}await writeFile('data/maintenance/publication-country-history-'+day+'.json',JSON.stringify({day,reports},null,2))}
