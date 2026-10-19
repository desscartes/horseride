import {mkdir,readFile,writeFile,access} from 'node:fs/promises'
import {load} from 'cheerio'
import {listHistoricalRaces} from './database.mjs'
import {horseIdentity} from './data-quality.mjs'
const directory='data/external/stewards';await mkdir(directory,{recursive:true})
const from=process.argv[2]||'2025-10-05',through=process.argv[3]||'2026-10-05'
const reports=new Map(),failures=[]
for(let page=1;page<=60;page++){
  const url=page===1?'https://www.tjk.org/TR/YarisSever/Query/Page/KomiserRaporlari':`https://www.tjk.org/TR/YarisSever/Query/Page/KomiserRaporlari?PageNumber=${page}`
  try{
    const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error(`HTTP ${r.status}`)
    const html=await r.text(),$=load(html),rows=$('tr').toArray().flatMap(e=>{
      const link=$(e).find('a[href*="raporftp"]').attr('href'),cells=$(e).find('td').toArray().map(c=>$(c).text().trim())
      const token=cells.find(v=>/^\d{2}\.\d{2}\.\d{4}$/.test(v));if(!link||!token)return []
      const [day,month,year]=token.split('.'),date=`${year}-${month}-${day}`,sourceUrl=new URL(link,url).href
      if(!/^https:\/\/medya-cdn\.tjk\.org\/raporftp\/YarisBilgileri\/\d{4}\/\d+\.pdf$/.test(sourceUrl))return []
      return [{date,city:cells[1],sourceUrl,availability:'post_race_report'}]
    })
    let added=0
    for(const row of rows)if(row.date>=from&&row.date<=through&&!reports.has(row.sourceUrl)){reports.set(row.sourceUrl,row);added++}
    console.log(JSON.stringify({page,discovered:reports.size,oldest:rows.at(-1)?.date}))
    if(!rows.length||rows.at(-1).date<from||(page>1&&!added))break
  }catch(e){failures.push({page,error:e.message});break}
}
// The dated official PDFs expose a stable meeting code. Validate every inferred
// document header during parsing; unavailable reports remain missing.
const codes=new Map()
for(const row of reports.values()){
 const code=new URL(row.sourceUrl).pathname.match(/\/(\d{8})(\d+)\.pdf$/)?.[2]
 if(code){const city=horseIdentity(row.city);if(!codes.has(city))codes.set(city,new Set());codes.get(city).add(code)}
}
for(const race of listHistoricalRaces().filter(r=>!r.foreign&&r.date>=from&&r.date<=through)){
 const candidates=codes.get(horseIdentity(race.city));if(candidates?.size!==1)continue
 const code=[...candidates][0],sourceUrl=`https://medya-cdn.tjk.org/raporftp/YarisBilgileri/${race.date.slice(0,4)}/${race.date.replaceAll('-','')}${code}.pdf`
 if(!reports.has(sourceUrl))reports.set(sourceUrl,{date:race.date,city:race.city,sourceUrl,availability:'post_race_report',urlMethod:'verified_official_meeting_code_header_validation_required'})
}
let next=0,saved=0;const rows=[...reports.values()]
await Promise.all(Array.from({length:3},async()=>{while(next<rows.length){const row=rows[next++],name=new URL(row.sourceUrl).pathname.split('/').at(-1),file=`${directory}/${name}`
  try{try{await access(file)}catch{const r=await fetch(row.sourceUrl,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`HTTP ${r.status}`);const bytes=Buffer.from(await r.arrayBuffer());if(bytes.subarray(0,4).toString()!=='%PDF')throw Error('Not PDF');await writeFile(file,bytes)}
    await writeFile(file.replace('.pdf','.source.json'),JSON.stringify({...row,retrievedAt:new Date().toISOString()}));saved++
    if(saved%50===0)console.log(JSON.stringify({saved,total:rows.length}))
  }catch(e){failures.push({url:row.sourceUrl,error:e.message})}
}}))
const report={from,through,discovered:rows.length,saved,failures}
await writeFile(`${directory}/collection-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({saved,failures:failures.length}))
