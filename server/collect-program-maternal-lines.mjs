import {DatabaseSync} from 'node:sqlite'
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs'
import {horseIdentity} from './data-quality.mjs'
import {racingCountry} from './foreign-data.mjs'
import {parseMaternalColumn,maternalRecordKey,loadProgramMaternalRecords} from './program-maternal-lines.mjs'
const records=loadProgramMaternalRecords(),report={checkedAt:new Date().toISOString(),scope:'Existing official CSV snapshots only; static maternal ancestry',countries:{},rejected:[]}
const requestedDate=process.argv[2]
if(requestedDate&&!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate))throw Error('Invalid program date')
const requestedPayload=requestedDate?JSON.parse(readFileSync(`data/program-cache/${requestedDate}.json`,'utf8')):null
if(requestedPayload&&requestedPayload.date!==requestedDate)throw Error('Program date mismatch')
const targets=requestedPayload?[...new Set(requestedPayload.races.map(r=>racingCountry(r.city)||'TR'))].map(country=>[country,requestedDate]):[['FR','2026-10-13'],['ZA','2026-10-16']]
const db=new DatabaseSync('data/horseride.sqlite',{readOnly:true})
for(const [country,date]of targets){
 const payload=requestedPayload||JSON.parse(readFileSync(`data/program-cache/${date}.json`,'utf8')),races=payload.races.filter(r=>(racingCountry(r.city)||'TR')===country)
 const sources=new Map()
 for(const row of db.prepare("SELECT city,provider_url,raw_content,fetched_at FROM source_snapshots WHERE date=? AND source='tjk_csv' ORDER BY fetched_at DESC").all(date))if(!sources.has(row.city))sources.set(row.city,row)
 const totals=report.countries[country]={date,runners:races.reduce((n,r)=>n+r.horses.length,0),matched:0,notExplicit:0}
 for(const [city,source]of sources){
  const wanted=races.filter(r=>r.city===city);if(!wanted.length)continue
  let url;try{url=new URL(source.provider_url)}catch{continue}
  if(url.hostname!=='medya-cdn.tjk.org'||!url.pathname.includes(`/TJKPDF/${date.slice(0,4)}/${date}/CSV/GunlukYarisProgrami/`))continue
  const lines=source.raw_content.replace(/^\uFEFF/,'').split(/\r?\n/),header=lines[0].split(';'),display=date.split('-').reverse().join('/')
  if(!header.includes(display)||horseIdentity(header[0])!==horseIdentity(city)){report.rejected.push({city,date,reason:'Source date/city mismatch'});continue}
  let no=null,columns=null
  for(const line of lines.slice(1)){
   const cells=line.split(';').map(v=>v.trim()),m=cells[0].match(/^(\d+)\.\s*Ko[sş]u\b/i)
   if(m){no=Number(m[1]);columns=null;continue}
   if(cells[0]==='At No'){columns=cells;continue}
   if(!no||!columns||!/^\d+$/.test(cells[0]))continue
   const race=wanted.find(r=>Number(r.no)===no),horse=race?.horses.find(h=>Number(h.no)===Number(cells[0]));if(!horse)continue
   const name=cells[columns.indexOf('At İsmi')],sire=cells[columns.indexOf('Orijin(Baba)')],rawDam=cells[columns.indexOf('Orijin(Anne)')]
   if(!name||!sire||!rawDam||horseIdentity(name)!==horseIdentity(horse.name)||horseIdentity(sire)!==horseIdentity(horse.sire)||horseIdentity(rawDam)!==horseIdentity(horse.dam)){report.rejected.push({city,date,no,horseNo:horse.no,reason:'Horse or parent mismatch'});continue}
   const parsed=parseMaternalColumn(rawDam);if(!parsed){totals.notExplicit++;continue}
   const key=maternalRecordKey(date,race,horse)
   if(records[key]&&horseIdentity(records[key].damsire)!==horseIdentity(parsed.damsire)){report.rejected.push({city,date,no,horseNo:horse.no,reason:'Conflicting ancestor'});continue}
   records[key]={date,city,raceNo:no,horseNo:horse.no,name,sire,rawDam,...parsed,provider:'TJK official program CSV',sourceUrl:source.provider_url,fetchedAt:source.fetched_at,availability:'static_pedigree'};totals.matched++
  }
 }
}
db.close();const directory='data/external/tjk-maternal-lines';mkdirSync(directory,{recursive:true});const path=directory+'/records.json';writeFileSync(path+'.tmp',JSON.stringify({records}));renameSync(path+'.tmp',path);writeFileSync(directory+'/collection-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
