import {load} from 'cheerio'
import {horseIdentity} from './data-quality.mjs'
export function mergeWorkoutArchive(previous, incoming) {
  const key=row=>[row.registryId,row.dateISO,row.hippodrome,row.distanceMeters].join(':')
  return [...new Map([...previous,...incoming].map(row=>[key(row),row])).values()].sort((a,b)=>a.dateISO.localeCompare(b.dateISO)||a.registryId.localeCompare(b.registryId))
}
const states='AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ')
const birthCodes=new RegExp(`\\s*\\((?:USA|${states.join('|')})\\)`,'g')
const identityCache=new Map()
const archiveIndexes=new WeakMap()
const identity=name=>{const text=String(name||'');if(identityCache.has(text))return identityCache.get(text);const value=horseIdentity(text.replace(birthCodes,'').replace(/(?:\s+(?:KG|DB|SKG|SK|K|OG|GKR|YP))+$/g,''));if(identityCache.size>100000)identityCache.clear();identityCache.set(text,value);return value}
export function parseEquibaseWorkouts(html,url){
  const $=load(html),header=$('#c-workouts-by-track h2').text().replace(/\s+/g,' ').trim(),dateText=header.match(/[A-Za-z]+ \d{1,2}, \d{4}/)?.[0]
  const date=dateText?new Date(`${dateText} 12:00:00 UTC`):null
  if(!date||!Number.isFinite(date.getTime()))throw Error('Official workout date missing')
  const dateISO=date.toISOString().slice(0,10),file=new URL(url).pathname.match(/([A-Z0-9]+)(\d{2})(\d{2})(\d{2})USA-EQB\.html$/)
  if(!file||dateISO!==`20${file[4]}-${file[2]}-${file[3]}`)throw Error('Workout date does not match official URL')
  const hippodrome=$('#c-workouts-by-track h2 a').first().text().trim(),rows=[]
  $('table.phone-collapse').each((i,table)=>{
    const info=$(table).prevAll('.session-info').first(),distance=info.find('h3').text().trim(),furlongs={One:1,Two:2,Three:3,Four:4,Five:5,Six:6,Seven:7,Eight:8}[distance.split(' ')[0]]
    if(!furlongs||!distance.includes('Furlong'))return
    const surface=info.find('tr').toArray().find(tr=>$(tr).children().first().text().trim()==='Surface:')
    const ground=surface?$(surface).children().eq(1).text().trim():''
    $(table).find('tbody tr').each((j,tr)=>{
      const cell=label=>$(tr).find(`td[data-label="${label}"]`).text().trim(),name=cell('Horse Name'),time=cell('Time'),match=time.match(/^(?:(\d+):)?(\d{1,2})\.(\d{2})$/)
      const seconds=match?Number(match[1]||0)*60+Number(match[2])+Number(match[3])/100:null,meters=furlongs*201.168
      const profile=$(tr).find('td[data-label="Horse Name"] a[href]').first().attr('href'),registryId=profile?new URL(profile,url).searchParams.get('refno'):null
      if(!name||/^Unnamed/i.test(name)||!registryId||!seconds||Number(match[2])>=60||seconds<meters/20||seconds>meters/5)return
      rows.push({horseName:name,registryId,dateISO,age:Number(cell('Age')),hippodrome,surface:ground==='Dirt'?'Kum':ground.includes('All Weather')?'Sentetik':ground==='Turf'?'Çim':ground,distanceMeters:Number(meters.toFixed(3)),timeSeconds:seconds,sourceNotes:cell('Notes'),groupRank:cell('Rank'),provider:'Equibase',sourceUrl:url,splits:{}})
    })
  })
  return rows
}
export function matchEquibaseWorkouts(records,horse,date){
  const age=Number(String(horse.age||'').match(/^\d+/)?.[0])
  if(!age)return []
  const wanted=identity(horse.name),since=new Date(new Date(`${date}T12:00:00Z`).getTime()-90*86400000).toISOString().slice(0,10)
  // Loaded archives are immutable; merge operations return a new array. Index
  // names once instead of scanning all training facilities for every starter.
  let indexed=archiveIndexes.get(records)
  if(!indexed||indexed.length!==records.length){
    const byName=new Map()
    for(const row of records){const key=identity(row.horseName);if(!byName.has(key))byName.set(key,[]);byName.get(key).push(row)}
    indexed={length:records.length,byName};archiveIndexes.set(records,indexed)
  }
  const birthYear=Number(String(date).slice(0,4))-age
  // North American official ages advance on January 1. A December work by a
  // two-year-old belongs to the same horse racing at age three in January.
  const matches=(indexed.byName.get(wanted)||[]).filter(r=>Number.isInteger(r.age)&&r.age>0&&Number(String(r.dateISO).slice(0,4))-r.age===birthYear&&r.dateISO<date&&r.dateISO>=since)
  if(new Set(matches.map(r=>r.registryId)).size!==1)return []
  const birth=String(horse.name).match(/\(([A-Z]{2})\)/)?.[1]
  return matches.filter(r=>!birth||!states.includes(birth)||r.horseName.endsWith(`(${birth})`)).sort((a,b)=>b.dateISO.localeCompare(a.dateISO)).slice(0,12)
}
