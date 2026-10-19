import {load} from 'cheerio'
import {readFileSync,existsSync,statSync} from 'node:fs'
import {foreignHorseIdentity,racingCountry} from './foreign-data.mjs'
const clean=v=>String(v||'').replace(/\s+/g,' ').trim()
const months={Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'}
const day=s=>{const m=s.match(/(\d{2})([A-Z][a-z]{2})(\d{2})/);return m&&months[m[2]]?`20${m[3]}-${months[m[2]]}-${m[1]}`:null}
const seconds=s=>{const m=s?.match(/(\d+):(\d{2})\.(\d{2})/);return m?Number(m[1])*60+Number(m[2])+Number(m[3])/100:null}
export function australianSurface(value){
 const text=String(value||'')
 if(/\b(?:Synth\w*|Polytrack|AllWeather)\b/i.test(text))return 'Sentetik'
 if(/\b(?:Dirt|Sand)\b/i.test(text))return 'Kum'
 if(/\b(?:(?:Good|Soft|Heavy|Firm)\s*[1-9]|[GSHF][1-9])\b/i.test(text))return 'Çim'
 return null
}
export function parseAustralianForm(html,{date,city,sourceUrl,observedAt=new Date().toISOString()}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||racingCountry(city)!=='AU')throw Error('Expected dated Australian meeting')
 const $=load(html),runners=[]
 // Bind the requested date to the source meeting, not to a caller-supplied label alone.
 const expected=`${Number(date.slice(8))} ${new Date(date+'T12:00:00Z').toLocaleString('en-GB',{month:'long',timeZone:'UTC'})} ${date.slice(0,4)}`
 if(!clean($('.race-venue-date').text()).includes(expected))throw Error('Official meeting date mismatch')
 for(const el of $('table.horse-form-table').toArray()){
  const table=$(el),info=table.find('.horse-info').first(),name=clean(info.find('.horse-name').text()),no=Number(info.find('.horse-number').text()),raceNo=Number(table.prevAll('table.race-title').first().find('.raceNum').text().match(/\d+/)?.[0])
  if(!name||!no||!raceNo)continue
  const plain=info.find('.plain'),parents=plain.find('a.GreenLink').map((i,e)=>clean($(e).text())).get(),text=clean(table.text()),link=info.find('.horse-name a').attr('href'),horseCode=link?new URL(link,sourceUrl).searchParams.get('horsecode'):null
  const starts=text.match(/Record:\s*(\d+):(\d+)-(\d+)-(\d+)/),pastRuns=[],trials=[]
  for(const row of table.find('table.horse-last-start tr').toArray()){
   const pos=clean($(row).find('td.Pos').text()),remain=$(row).find('td.remain'),raw=clean(remain.text()),meeting=remain.find('a[href*="Meeting.aspx"]').first(),when=day(meeting.text()),p=pos.match(/^([JT])?\s*(\d+)\s*of\s*(\d+)$/)
   if(!when||when>=date||!p)continue
   const track=clean(meeting.text()).replace(/\s+\d{2}[A-Z][a-z]{2}\d{2}.*/,''),distance=Number(raw.match(/\b(\d{3,4})m\b/)?.[1])||null,condition=raw.match(/\b(Good\s*\d|Soft\s*\d|Heavy\s*\d|Firm\s*\d|Synth\w*)\b/i)?.[1]||null
   const prefix=clean(remain.html()?.split(/<br\s*\/?\s*>/i)[0]?.replace(/<[^>]+>/g,' ')),className=prefix.match(/\b\d{3,4}m\s+(?:Good\s*\d|Soft\s*\d|Heavy\s*\d|Firm\s*\d|Synthetic)?\s*(.*?)\s*\$/i)?.[1]||null
   const r={date:when,city:track+' Avustralya',distance,surface:australianSurface(raw),finishPosition:Number(p[2]),fieldSize:Number(p[3]),className,going:condition,jockey:clean(remain.find('a[href*="JockeyLastRuns"]').first().text()),weight:Number(prefix.match(/(\d+(?:\.\d+)?)kg/)?.[1])||null,source:'Racing Australia official form',sourceUrl:new URL(meeting.attr('href'),sourceUrl).href,winnerTimeSeconds:seconds(raw),timeSeconds:null}
   // Published elapsed time belongs to the race winner, never assume it is this runner's time.
   if(p[1])trials.push({...r,kind:p[1]==='J'?'jump_out':'trial',timeMeaning:'winner_time_not_runner_time'})
   else pastRuns.push(r)
  }
  runners.push({date,city,raceNo,no,name,horseCode,sire:parents[0]||null,dam:parents[1]||null,damsire:parents[2]||null,career:starts?{starts:Number(starts[1]),wins:Number(starts[2]),seconds:Number(starts[3]),thirds:Number(starts[4])}:null,pastRuns,trials,sourceUrl,observedAt})
 }
 if(!runners.length)throw Error('No official runner profiles parsed')
 return {date,city,sourceUrl,observedAt,runners}
}
export function matchingAustralianProfile(race,horse,date,snapshots){
 if(racingCountry(race.city)!=='AU')return null
 const matches=snapshots.filter(s=>s.date===date&&s.city===race.city).flatMap(s=>s.runners).filter(p=>p.raceNo===Number(race.no)&&p.no===Number(horse.no)&&foreignHorseIdentity(p.name)===foreignHorseIdentity(horse.name)&&p.horseCode&&horse.sire&&horse.dam&&foreignHorseIdentity(p.sire)===foreignHorseIdentity(horse.sire)&&foreignHorseIdentity(p.dam)===foreignHorseIdentity(horse.dam))
 return matches.length===1?matches[0]:null
}
let cached={stamp:null,snapshots:[]}
export function australianFormSnapshots(){
 const file=process.env.AU_FORM_REGISTRY_PATH||'data/external/racing-australia/registry.json'
 try{const stamp=statSync(file).mtimeMs;if(stamp!==cached.stamp)cached={stamp,snapshots:JSON.parse(readFileSync(file,'utf8')).snapshots||[]};return cached.snapshots}catch{return []}
}
export function enrichAustralianRaces(races,date,{snapshots=australianFormSnapshots()}={}){
 return races.map(r=>racingCountry(r.city)!=='AU'?r:{...r,horses:r.horses.map(h=>{const p=matchingAustralianProfile(r,h,date,snapshots);return p?{...h,australianEvidence:p,horsePerformance:{...h.horsePerformance,pastRuns:p.pastRuns.filter(x=>x.date<date)},trialEvidence:p.trials.filter(x=>x.date<date)}:h})})
}