import {load} from 'cheerio'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {foreignHorseIdentity} from './foreign-data.mjs'
export function currentHongKongEvidence(snapshot,horse,date){
 if(!snapshot?.observedDate||snapshot.observedDate>date)return null
 const rows=snapshot.veterinary.filter(r=>foreignHorseIdentity(r.horseName)===foreignHorseIdentity(horse.name)&&r.date<date)
 if(new Set(rows.map(r=>r.brandNo)).size!==1)return null
 return {source:'HKJC public veterinary records',observedAt:snapshot.observedAt,records:rows.toSorted((a,b)=>b.date.localeCompare(a.date)).slice(0,6),note:'Kamuya açık kayıtlar; tüm sağlık geçmişi değildir. Geçmiş testlere sonradan eklenmez; yarıştan sonraki kayıt veya kontrol tarihleri kullanılmaz.'}
}
export async function collectHongKongCurrentEvidence(){
 const directory='data/external/hkjc-additional';await mkdir(directory,{recursive:true})
 const sourceUrl='https://racing.hkjc.com/en-us/local/information/ovedatabase?SelDate=full'
 const response=await fetch(sourceUrl,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`HKJC HTTP ${response.status}`)
 const html=await response.text();await writeFile(`${directory}/veterinary.html`,html)
 const $=load(html),veterinary=[];let brandNo='',horseName=''
 const iso=token=>{const match=token.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return match?`${match[3]}-${match[2]}-${match[1]}`:null}
 for(const row of $('table tr').toArray()){
  const c=$(row).find('td').toArray().map(e=>$(e).text().replace(/\s+/g,' ').trim());if(c.length!==5)continue
  if(c[0]&&c[1]){brandNo=c[0];horseName=c[1]}
  const date=iso(c[2]);if(!date||!brandNo||!horseName||!/^[A-Z]\d{3}$/.test(brandNo))continue
  // Passed-on assessments might be later than the target race, so preserve no
  // recovery inference in this qualitative snapshot.
  veterinary.push({brandNo,horseName,date,details:c[3],sourceUrl})
 }
 const observedAt=new Date().toISOString(),observedDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const snapshot={observedAt,observedDate,veterinary,sourceUrl}
 await writeFile(`${directory}/current-evidence.json`,JSON.stringify(snapshot));return {records:veterinary.length,horses:new Set(veterinary.map(r=>r.brandNo)).size,observedDate}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await collectHongKongCurrentEvidence()))
