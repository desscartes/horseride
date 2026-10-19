import './runtime-env.mjs'
import {DatabaseSync} from 'node:sqlite'
import {mkdirSync,writeFileSync,renameSync,readFileSync} from 'node:fs'
import {parseRacePrizes} from './race-prizes.mjs'
const db=new DatabaseSync(process.env.HORSERIDE_DB||'data/horseride.sqlite',{readOnly:true}),records={},seen=new Set()
try{Object.assign(records,JSON.parse(readFileSync('data/external/race-prizes/records.json','utf8')).records||{})}catch{}
let sources=0
for(const snapshot of db.prepare("SELECT date,city,provider_url,raw_content,fetched_at FROM source_snapshots WHERE source='tjk_csv' ORDER BY fetched_at DESC").iterate()){
 if(!snapshot.provider_url.includes('GunlukYarisProgrami'))continue
 const meeting=JSON.stringify([snapshot.date,snapshot.city]);if(seen.has(meeting))continue;seen.add(meeting);sources++
 let raceNo=null
 for(const line of snapshot.raw_content.split(/\r?\n/)){
  const cells=line.split(';'),header=cells[0].match(/^(\d+)\.\s*Ko[sş]u\b/i)
  if(header){raceNo=Number(header[1]);continue}
  if(!raceNo||!/^1\.\)/.test(cells[0]))continue
  const prizes=parseRacePrizes(cells)
  if(prizes.length)records[JSON.stringify([snapshot.date,snapshot.city,raceNo])]={source:'official_tjk_csv',sourceUrl:snapshot.provider_url,fetchedAt:snapshot.fetched_at,prizes}
 }
}
db.close();mkdirSync('data/external/race-prizes',{recursive:true})
const path='data/external/race-prizes/records.json';writeFileSync(path+'.tmp',JSON.stringify({collectedAt:new Date().toISOString(),sources,records}));renameSync(path+'.tmp',path)
console.log(JSON.stringify({sources,races:Object.keys(records).length}))
