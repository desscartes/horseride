import {mkdir,writeFile,access} from 'node:fs/promises'
import {listHistoricalRaces} from './database.mjs'
import {equibaseTracks} from './foreign-data.mjs'
const directory='data/external/equibase';await mkdir(directory,{recursive:true})
// Fetch only dates in the known TJK archive and official track identifiers.
const meetings=[...new Map(listHistoricalRaces().filter(r=>r.foreign&&equibaseTracks[r.city]&&(!process.env.ARCHIVE_THROUGH_DATE||r.date<=process.env.ARCHIVE_THROUGH_DATE)).map(r=>[`${r.city}:${r.date}`,{city:r.city,date:r.date}])).values()].sort((a,b)=>a.date.localeCompare(b.date))
const report={provider:'Equibase free PDF',attempted:0,saved:0,failures:[]}
async function collect({city,date}){
  const [year,month,day]=date.split('-'),name=`${equibaseTracks[city].code}${month}${day}${year.slice(2)}USA`,file=`${directory}/${name}.pdf`,url=`https://tvg.equibase.com/static/chart/pdf/${name}.pdf`
  try{await access(file);report.saved++;return}catch{}
  report.attempted++
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(15000)})
    if(!response.ok)throw Error(`HTTP ${response.status}`)
    const bytes=Buffer.from(await response.arrayBuffer())
    if(bytes.subarray(0,4).toString()!=='%PDF')throw Error('PDF yerine erişim/HTML sayfası')
    await writeFile(file,bytes);await writeFile(file.replace('.pdf','.source.json'),JSON.stringify({url,date,retrievedAt:new Date().toISOString(),availability:'post_race'}));report.saved++
  }catch(e){report.failures.push({city,date,error:e.message})}
}
for(let offset=0;offset<meetings.length;offset+=3){
  await Promise.all(meetings.slice(offset,offset+3).map(collect))
  await writeFile(`${directory}/collection-report.json`,JSON.stringify(report,null,2))
  if(offset%30===0)console.log(JSON.stringify({processed:Math.min(offset+3,meetings.length),total:meetings.length,saved:report.saved,failures:report.failures.length}))
}
await writeFile(`${directory}/collection-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report))
