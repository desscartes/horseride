import './runtime-env.mjs'
import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {horseIdentity} from './data-quality.mjs'
import {parseRacePrizes} from './race-prizes.mjs'
const targetPath='data/external/racing-australia/tjk-winner-targets.json',path='data/external/race-prizes/records.json',targets=JSON.parse(readFileSync(targetPath,'utf8')).races,meetings=new Map(),records={}
for(const r of targets)meetings.set(JSON.stringify([r.date,r.city]),{date:r.date,city:r.city,url:r.winnerEvidence.programUrl})
mkdirSync('data/external/race-prizes/winner-target-csv',{recursive:true})
const report={startedAt:new Date().toISOString(),meetings:meetings.size,completed:[],failures:[]}
for(const m of meetings.values()){
 try{
  const id=createHash('sha256').update(m.url).digest('hex').slice(0,16),file='data/external/race-prizes/winner-target-csv/'+id+'.csv';let text
  try{text=readFileSync(file,'utf8')}catch{const response=await fetch(m.url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('HTTP '+response.status);text=(await response.text()).replace(/^\uFEFF/,'')}
  const header=text.split(/\r?\n/)[0].split(';');if(!header.includes(m.date.split('-').reverse().join('/'))||horseIdentity(header[0])!==horseIdentity(m.city))throw Error('CSV meeting identity mismatch')
  let no=null,count=0;for(const line of text.split(/\r?\n/)){const cells=line.split(';'),race=cells[0].match(/^(\d+)\.\s*Ko[sş]u\b/i);if(race){no=Number(race[1]);continue}if(!no||!/^1\.\)/.test(cells[0]))continue;const prizes=parseRacePrizes(cells);if(prizes.length){records[JSON.stringify([m.date,m.city,no])]={source:'official_tjk_csv',sourceUrl:m.url,fetchedAt:new Date().toISOString(),prizes};count++}}
  if(!count)throw Error('No prizes parsed');writeFileSync(file,text);report.completed.push({...m,races:count})
 }catch(e){report.failures.push({...m,error:e.message})}
}
const latest=JSON.parse(readFileSync(path,'utf8'));latest.records={...latest.records,...records};latest.collectedAt=new Date().toISOString();writeFileSync(path+'.tmp',JSON.stringify(latest));renameSync(path+'.tmp',path);report.finishedAt=new Date().toISOString();report.collectedRaces=Object.keys(records).length;report.registryRaces=Object.keys(latest.records).length;writeFileSync('data/maintenance/au-winner-prize-collection.json',JSON.stringify(report,null,2));console.log(JSON.stringify({meetings:meetings.size,collectedRaces:report.collectedRaces,failures:report.failures.length,registryRaces:report.registryRaces}))