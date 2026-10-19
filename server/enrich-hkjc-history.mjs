import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {load} from 'cheerio'
import {listHistoricalRaces,saveHistoricalRace} from './database.mjs'
import {foreignHorseIdentity,racingCountry} from './foreign-data.mjs'
const directory='data/external/hkjc';await mkdir(directory,{recursive:true})
const races=listHistoricalRaces().filter(r=>r.foreign&&racingCountry(r.city)==='HK'),meetings=[...new Map(races.map(r=>[`${r.date}:${r.city}`,r])).values()]
const report={attempted:races.length,matchedRaces:0,filledTimes:0,failures:[]};let next=0
await Promise.all(Array.from({length:2},async()=>{while(next<meetings.length){const meeting=meetings[next++],course=meeting.city.startsWith('Sha Tin')?'ST':meeting.city.startsWith('Happy Valley')?'HV':null
  try{
    if(!course)throw Error('Unsupported racecourse')
    const get=async(no)=>{
      const url=`https://racing.hkjc.com/en-us/local/information/localresults?RaceNo=${no}&Racecourse=${course}&racedate=${meeting.date.replaceAll('-','%2F')}`,file=`${directory}/${meeting.date}-${course}-${no}.html`
      let html;try{html=await readFile(file,'utf8')}catch{const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`HTTP ${response.status}`);html=await response.text();await writeFile(file,html)}
      const $=load(html),display=meeting.date.split('-').reverse().join('/')
      if(!$.text().replace(/\s+/g,' ').includes(`Race Meeting: ${display}`))throw Error('Official meeting date not verified')
      const table=$('table').filter((i,t)=>$(t).find('tr').first().text().includes('Horse No.')&&$(t).find('tr').first().text().includes('Finish Time')).first()
      const runners=table.find('tr').toArray().slice(1).map(tr=>$(tr).children('td').toArray().map(td=>$(td).text().replace(/\s+/g,' ').trim())).filter(c=>c.length===12).map(c=>({finish:Number(c[0]),number:Number(c[1]),name:c[2].replace(/\s*\([A-Z]\d+\)/g,''),registryId:c[2].match(/\(([A-Z]\d+)\)/)?.[1],horseWeightKg:Number(c[6])*.45359237,beatenLengths:c[8],positions:c[9],time:c[10]}))
      const numbers=[...new Set($('a[href]').toArray().map(e=>$(e).attr('href')).filter(h=>h.includes('/localresults?')&&h.includes(`racedate=${meeting.date.replaceAll('-','/')}`)).map(h=>Number(new URL(h,url).searchParams.get('RaceNo'))).filter(n=>n>0&&n<=15))]
      return {url,runners,numbers}
    }
    const first=await get(1),charts=[first]
    for(const no of first.numbers.filter(n=>n!==1))try{charts.push(await get(no))}catch(e){report.failures.push({date:meeting.date,officialNo:no,error:e.message})}
    for(const race of races.filter(r=>r.date===meeting.date&&r.city===meeting.city)){
      // TJK and HKJC race numbers may differ. Match the full field and all placings.
      const matches=charts.filter(c=>c.runners.filter(p=>race.horses.some(h=>foreignHorseIdentity(h.name)===foreignHorseIdentity(p.name))).length===race.horses.length&&race.horses.every(h=>c.runners.find(p=>foreignHorseIdentity(p.name)===foreignHorseIdentity(h.name))?.finish===race.results.get(h.no)?.finishPosition))
      if(matches.length!==1){report.failures.push({date:race.date,no:race.no,error:'Unique complete field + placings not matched'});continue}
      const chart=matches[0],results=new Map(race.results);let filled=0
      const horses=race.horses.map(h=>{
        const p=chart.runners.find(p=>foreignHorseIdentity(p.name)===foreignHorseIdentity(h.name)),old=results.get(h.no),time=p.time.match(/^(\d+):(\d{2})\.(\d{2})$/),seconds=time?Number(time[1])*60+Number(time[2])+Number(time[3])/100:null
        if(seconds&&Number(time[2])<60&&seconds>=30&&seconds<=400){if(!old.timeSeconds)filled++;results.set(h.no,{...old,timeSeconds:seconds,timeSource:chart.url})}
        return {...h,externalEvidence:{provider:'HKJC',sourceUrl:chart.url,date:race.date,availability:'post_race',registryId:p.registryId,horseWeightKg:p.horseWeightKg,positions:p.positions,beatenLengths:p.beatenLengths}}
      })
      saveHistoricalRace(race.date,{...race,horses},results);report.matchedRaces++;report.filledTimes+=filled
    }
  }catch(e){report.failures.push({date:meeting.date,error:e.message})}
}}))
await writeFile(`${directory}/matching-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report))
