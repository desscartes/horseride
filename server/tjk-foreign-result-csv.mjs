import {foreignHorseIdentity} from './foreign-data.mjs'
import {horseIdentity} from './data-quality.mjs'
export function matchTjkForeignResultCsv(csv,{date,city,program,htmlResults}){
 const lines=String(csv).replace(/^\uFEFF/,'').split(/\r?\n/),header=lines[0].split(';'),expected=date.split('-').reverse().join('/')
 if(!header.includes(expected)||horseIdentity(header[0])!==horseIdentity(city))throw Error('Result CSV meeting identity mismatch')
 const raw=new Map();let no=null,columns=null
 for(const line of lines.slice(1)){
  const cells=line.split(';').map(s=>s.trim()),race=cells[0].match(/^(\d+)\.\s*Ko[sş]u\b/i)
  if(race){no=Number(race[1]);columns=null;raw.set(no,[]);continue}
  if(!no)continue
  if(cells[0]==='At No'||cells[0]==='Sıra'){columns=cells;continue}
  if(columns&&/^\d+$/.test(cells[0])&&cells[1])raw.get(no).push(Object.fromEntries(columns.map((k,i)=>[k,cells[i]||''])))
 }
 const races=new Map(),rejected=[]
 for(const race of program){
  const starters=race.horses.filter(h=>!h.outOfRace),rows=raw.get(Number(race.no))||[],anchors=htmlResults.get(Number(race.no)),results=new Map(),errors=[]
  const byName=new Map();for(const h of starters){const key=foreignHorseIdentity(h.name);if(byName.has(key))errors.push('ambiguous_program_name');byName.set(key,h)}
  for(const row of rows){
   const h=byName.get(foreignHorseIdentity(row['At İsmi']));if(!h){errors.push('unmatched_csv_runner');continue}
   if(!h.sire||!h.dam||horseIdentity(row['Orijin(Baba)'])!==horseIdentity(h.sire)||horseIdentity(row['Orijin(Anne)'])!==horseIdentity(h.dam)){errors.push('parent_identity_mismatch');continue}
   const explicit=row['Sıra'];const confirmed=anchors?.get(h.no)?.finishPosition
   const position=explicit!==undefined?Number(explicit):confirmed,unplaced=position===0&&/^Derecesiz$/i.test(row.Derece||'')
   if(!Number.isInteger(position)||position<0||position>starters.length||(position===0&&!unplaced)){errors.push('unresolved_finish');continue}
   if(results.has(h.no)){errors.push('duplicate_result_runner');continue}
   results.set(h.no,{finishPosition:position,...(unplaced?{officialUnplaced:true}:{}),timeSeconds:null,source:'official_tjk_result_csv',sourceName:row['At İsmi']})
  }
  // At No is NOT a placing: only an explicit placing column or an independently
  // confirmed HTML placing can supply a label. Never infer places from row order.
  if(!anchors||anchors.size<Math.min(3,starters.length))errors.push('insufficient_html_crosscheck')
  else for(const [horseNo,result]of anchors){if(!results.has(horseNo)||results.get(horseNo).finishPosition!==result.finishPosition)errors.push('html_csv_finish_mismatch');else results.set(horseNo,{...results.get(horseNo),closingOdds:result.closingOdds,timeSeconds:result.timeSeconds??null})}
  if(rows.length!==starters.length||results.size!==starters.length)errors.push('incomplete_result_field')
  if(![...results.values()].some(r=>r.finishPosition===1))errors.push('missing_winner')
  if(errors.length)rejected.push({raceNo:race.no,reasons:[...new Set(errors)],programRunners:starters.length,csvRows:rows.length})
  else races.set(Number(race.no),results)
 }
 return {races,rejected}
}