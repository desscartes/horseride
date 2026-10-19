import {foreignHorseIdentity} from './foreign-data.mjs'
import {pedigreeParentIdentity as parent} from './pedigree-registry.mjs'
export function verifiedChartPedigree(horse,rows,targetDate){
 const matches=rows.filter(row=>{
  let url;try{url=new URL(row.sourceUrl)}catch{}
  return /^\d{4}-\d{2}-\d{2}$/.test(row.date||'')&&row.date<targetDate&&row.availability==='post_race_static_pedigree'&&url?.protocol==='https:'&&['tvg.equibase.com','www.equibase.com'].includes(url.hostname)&&foreignHorseIdentity(row.name)===foreignHorseIdentity(horse.name)&&parent(row.sire)===parent(horse.sire)&&parent(row.dam)===parent(String(horse.dam||'').split(/\s+[-–—/]\s+/)[0])&&row.damsire
 })
 if(!matches.length||new Set(matches.map(r=>parent(r.damsire))).size!==1)return null
 return matches.sort((a,b)=>a.date.localeCompare(b.date))[0]
}
