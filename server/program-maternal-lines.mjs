import {readFileSync} from 'node:fs'
import {horseIdentity} from './data-quality.mjs'
const codes='USA GB GBR IRE FR FRA GER CAN AUS NZ NZL SAF RSA ZAF JPN ARG BRZ CHI TUR ITY ITA SPA ESP POR DEN SWE NOR FIN POL CZE HUN AUT BEL HOL NED SUI RUS UKR URU PER VEN MEX KOR IND UAE BHR QAT KSA ZIM ZAM KEN SIN MAL HKG CHN'.split(' ')
const countrySuffix=new RegExp(`\\s*\\((?:${codes.join('|')})\\)\\s*$`,'i')
export function parseMaternalColumn(value){
 const text=String(value||'').trim();let depth=0,start=-1,last=null
 for(let i=0;i<text.length;i++){
  if(text[i]==='('){if(depth===0)start=i;depth++}
  else if(text[i]===')'){if(--depth<0)return null;if(depth===0)last={start,end:i+1,inside:text.slice(start+1,i).trim()}}
 }
 if(depth||!last||last.end!==text.length||codes.includes(last.inside.toUpperCase()))return null
 const dam=text.slice(0,last.start).trim(),damsire=last.inside.replace(countrySuffix,'').trim()
 if(!dam||!damsire||damsire.length>100||!/[\p{L}]/u.test(damsire)||/[();|/]/.test(damsire)||/^(UNKNOWN|BILINMIYOR)$/i.test(damsire))return null
 // Remaining parentheses in the dam must be an explicit country suffix.
 if(/[()]/.test(dam.replace(countrySuffix,'')))return null
 return {dam,damsire}
}
export const maternalRecordKey=(date,race,horse)=>JSON.stringify([date,race.city,Number(race.no),Number(horse.no)])
export function loadProgramMaternalRecords(){try{return JSON.parse(readFileSync('data/external/tjk-maternal-lines/records.json','utf8')).records||{}}catch{return {}}}
export function verifiedProgramMaternalLine(horse,race,date,records){
 const row=records[maternalRecordKey(date,race,horse)];if(!row)return null
 let url;try{url=new URL(row.sourceUrl)}catch{return null}
 if(row.date!==date||row.provider!=='TJK official program CSV'||url.protocol!=='https:'||url.hostname!=='medya-cdn.tjk.org'||!url.pathname.includes(`/TJKPDF/${date.slice(0,4)}/${date}/CSV/GunlukYarisProgrami/`))return null
 if(horseIdentity(row.name)!==horseIdentity(horse.name)||horseIdentity(row.sire)!==horseIdentity(horse.sire)||horseIdentity(row.rawDam)!==horseIdentity(horse.dam))return null
 const parsed=parseMaternalColumn(row.rawDam)
 return parsed&&horseIdentity(parsed.damsire)===horseIdentity(row.damsire)?{...row,dam:parsed.dam,damsire:parsed.damsire}:null
}
