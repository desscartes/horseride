import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {load} from 'cheerio'
import {listHistoricalRaces} from './database.mjs'

const directory='data/training-workouts'
await mkdir(directory,{recursive:true})
const dates=[...new Set(listHistoricalRaces().filter(r=>!r.foreign && (!process.env.WORKOUT_FROM_DATE || r.date >= process.env.WORKOUT_FROM_DATE) && (!process.env.WORKOUT_THROUGH_DATE || r.date <= process.env.WORKOUT_THROUGH_DATE)).map(r=>r.date))]
let next=0,completed=0,failures=[]
const headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',Referer:'https://www.tjk.org/'}
async function request(url){
  let error
  for(let attempt=0;attempt<3;attempt++)try{const response=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);return await response.text()}catch(e){error=e}
  throw error
}
async function collect(date){
  const file=`${directory}/${date}.json`
  try{const cached=JSON.parse(await readFile(file,'utf8'));if(cached.complete)return}catch{}
  const formatted=date.split('-').reverse().join('/')
  const url=new URL('https://www.tjk.org/TR/YarisSever/Query/Page/IdmanIstatistikleri');url.searchParams.set('QueryParameter_tarih',formatted)
  const html=await request(url),$=load(html)
  if($('input[name="OldQueryParameter_tarih"]').val()!==formatted)throw Error('Requested race date not confirmed')
  const table=$('table').filter((i,e)=>$(e).text().includes('İ. Tarihi')).first()
  const names=table.find('tr').first().children('th,td').map((i,e)=>$(e).text().trim()).get()
  const rowsFrom=root=>root('tr').map((i,e)=>{const cells=root(e).children('td').map((j,c)=>root(c).text().trim()).get();return cells.length===names.length?[cells]:null}).get()
  let rows=rowsFrom(load($.html(table)))
  const total=Number(html.match(/Toplam\s+(\d+)\s+sonuçtan/)?.[1])
  if(!Number.isFinite(total))throw Error('Result count absent')
  const pager=$('form.pagerForm'),params=new URLSearchParams()
  pager.find('input[name]').each((i,e)=>params.set($(e).attr('name'),$(e).val()))
  let page=Number(params.get('PageNumber')||1)
  const seen=new Set(rows.map(r=>JSON.stringify(r)))
  while(rows.length<total){
    if(!pager.attr('action')||page>100)throw Error('Incomplete pagination')
    params.set('PageNumber',String(page++))
    const pageUrl=new URL(pager.attr('action'),'https://www.tjk.org');pageUrl.search=params.toString()
    const additional=rowsFrom(load('<table>'+await request(pageUrl)+'</table>'))
    if(!additional.length)throw Error('Empty pagination before declared total')
    // Different workouts can be identical rows. Keep them; guard against a repeated page.
    if(additional.every(r=>seen.has(JSON.stringify(r))))throw Error('Repeated pagination')
    for(const row of additional)seen.add(JSON.stringify(row))
    rows.push(...additional)
  }
  if(rows.length!==total)throw Error(`Expected ${total}, received ${rows.length}`)
  await writeFile(file,JSON.stringify({date,providerUrl:String(url),fetchedAt:new Date().toISOString(),complete:true,total,tables:[{headers:names,rows}]}))
}
await Promise.all(Array.from({length:8},async()=>{while(next<dates.length){const date=dates[next++];try{await collect(date);completed++}catch(error){failures.push({date,error:error.message});console.error(date,error.message)}if((completed+failures.length)%10===0)console.log(JSON.stringify({completed,total:dates.length,failures:failures.length}),Date.now())}}))
await writeFile(`${directory}/collection-report.json`,JSON.stringify({completed,total:dates.length,failures},null,2))
console.log(JSON.stringify({completed,total:dates.length,failures}))
