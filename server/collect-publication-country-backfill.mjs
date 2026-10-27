process.env.HORSERIDE_NO_LISTEN='1';
import {acquireCollectionGate} from './collection-gate.mjs';import {localDay,shiftDay} from './maintenance-policy.mjs';import {readFile,writeFile} from 'node:fs/promises';
await acquireCollectionGate();
const day=process.argv[2]||localDay(),path='data/maintenance/publication-cl-backfill.json';let state={dates:{}};try{state=JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
const {collectHistoricalDay}=await import('./index.mjs');
// One bounded official-source day per invocation; never treat absent results as training data.
for(let offset=1;offset<=365;offset++){const date=shiftDay(day,-offset),old=state.dates[date];if(old?.status==='complete'||(old?.attempts||0)>=2)continue;
 const entry={startedAt:new Date().toISOString(),attempts:(old?.attempts||0)+1,status:'running'};state.dates[date]=entry;await writeFile(path,JSON.stringify(state,null,2));
 try{entry.result=await collectHistoricalDay(date,{foreignOnly:true,countries:['CL']});entry.status='complete'}catch(e){entry.status='failed';entry.error=String(e.message).slice(0,180)}entry.finishedAt=new Date().toISOString();await writeFile(path,JSON.stringify(state,null,2));console.log(JSON.stringify({date,...entry}));break;
}
