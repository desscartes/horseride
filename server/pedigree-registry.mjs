import {load} from 'cheerio'
import {horseIdentity} from './data-quality.mjs'
import {readFileSync} from 'node:fs'
import {mkdir,writeFile,rename} from 'node:fs/promises'
const file=process.env.PEDIGREE_REGISTRY_PATH||'data/external/tjk-pedigree/registry.json'
let records;function registry(){if(!records){try{records=JSON.parse(readFileSync(file,'utf8')).records||{}}catch{records={}}}return records}
export function resetPedigreeRegistryCache(){records=undefined}
export const pedigreeParentIdentity=value=>horseIdentity(String(value||'').replace(/\s*\((?:USA|GB|IRE|FR|GER|CAN|AUS|NZ|SAF|JPN|ARG|BRZ|CHI|TUR)\)\s*$/i,''))
const identity=pedigreeParentIdentity
export function validatedRegistryPedigree(horse,catalog=registry()){
 const row=catalog[String(horse.horseId||horse.sourceData?.tjk?.horseId||'')]
 if(!row||identity(row.sire)!==identity(horse.sire)||identity(row.dam)!==identity(String(horse.dam||'').split(/\s+[-–—/]\s+/)[0]))return null
 return row
}
export function parseTjkPedigree(html,horse,sourceUrl){
 const url=new URL(sourceUrl),id=String(horse.horseId||horse.sourceData?.tjk?.horseId||'')
 if(url.hostname!=='www.tjk.org'||!id||url.searchParams.get('QueryParameter_AtId')!==id||!url.pathname.endsWith('/AtKosuBilgileri'))return null
 const $=load(html),fields=new Map()
 function add(label,value){value=String(value||'').replace(/\s+/g,' ').trim();if(!value||value.length>160||/\b(?:Sahip|Antrenör|Yetiştirici|Doğum)\b/i.test(value))return;if(!fields.has(label))fields.set(label,new Set());fields.get(label).add(value)}
 $('tr').each((i,e)=>{const cells=$(e).children('th,td');const label=cells.first().text().trim().replace(/:$/,'');if(['Baba','Anne'].includes(label)&&cells.length===2)add(label,cells.eq(1).text())})
 // TJK's actual profile places multiple fields in one container. Each key
 // belongs to its immediately following value span, rather than the parent.
 $('span.key').each((i,e)=>{const label=$(e).text().trim();if(['Baba','Anne'].includes(label))add(label,$(e).next('span.value').text())})
 $('label,dt,strong,b,span').each((i,e)=>{const label=$(e).text().trim().replace(/:$/,'');if(!['Baba','Anne'].includes(label))return;const parent=$(e).parent();const text=parent.text().trim();if(text.startsWith(label))add(label,text.slice(label.length).replace(/^\s*:\s*/,''))})
 if(fields.get('Baba')?.size!==1||fields.get('Anne')?.size!==1)return null
 const sire=[...fields.get('Baba')][0],parts=[...fields.get('Anne')][0].split(/\s*\/\s*/)
 if(parts.length!==2||!parts.every(v=>v.trim()))return null
 const [dam,damsire]=parts.map(v=>v.trim())
 if(identity(sire)!==identity(horse.sire)||identity(dam)!==identity(String(horse.dam||'').split(/\s+[-–—/]\s+/)[0]))return null
 return {horseId:id,sire,dam,damsire,sourceUrl,collectedAt:new Date().toISOString(),provider:'TJK official horse profile'}
}
let pending=Promise.resolve()
export function saveRegistryPedigree(row){
 registry()[row.horseId]=row
 pending=pending.catch(()=>{}).then(async()=>{await mkdir('data/external/tjk-pedigree',{recursive:true});const temp=`${file}.${process.pid}.tmp`;await writeFile(temp,JSON.stringify({records:registry()}));await rename(temp,file)})
 return pending
}
