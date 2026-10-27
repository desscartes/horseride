// Refresh only public entry evidence; never change stored forecasts or claim a new model run.
process.env.HORSERIDE_NO_LISTEN='1'
process.env.HORSERIDE_FAST_PROGRAM='1'
import {readFile,writeFile} from 'node:fs/promises'
import {scheduledMeetingDates,racingCountry} from './foreign-data.mjs'
import {analysisEntryFingerprint} from './analysis-entry-policy.mjs'
import {raceStartISO} from './preparation-readiness.mjs'
import {canonicalEntries,publicationEntriesMatch} from './publication-entry-confirmation.mjs'
import {localDay} from './maintenance-policy.mjs'
const day=process.argv[2]||localDay(),program=JSON.parse(await readFile('data/program-cache/'+day+'.json','utf8')),report={date:day,checkedAt:new Date().toISOString(),cities:[]},now=Date.now()
const {fetchProgram}=await import('./index.mjs')
for(const city of new Set(program.races.filter(r=>r.rankingSource==='local_trained_model'&&Date.parse(raceStartISO(r,day))>now+10*60000).map(r=>r.city))){
 const races=program.races.filter(r=>r.city===city),meetingUrl=races.find(r=>r.meetingPageUrl)?.meetingPageUrl||(program.meetings||[]).find(m=>m.city===city)?.url
 try{const fresh=await fetchProgram(new Date(day+'T12:00:00'),city,{isForeign:!!racingCountry(city),meetingUrl}),current=scheduledMeetingDates(fresh.races.map(r=>({...r,city:r.venue||city,foreign:!!racingCountry(city)})),day),expected=analysisEntryFingerprint(races),ordered=canonicalEntries,future=rows=>rows.filter(r=>Date.parse(raceStartISO(r,day))>now+10*60000),sameEntries=publicationEntriesMatch(future(races),future(current))
  report.cities.push({city,checkedAt:new Date().toISOString(),originalProgramFetchedAt:program.fetchedAt,entryFingerprint:expected,confirmed:sameEntries,scope:'future_races_only',raceNumbers:future(races).map(r=>Number(r.no)),sourceUrl:fresh.url,races:current.length,differences:[...future(races).filter(r=>!future(current).some(x=>Number(x.no)===Number(r.no))).map(r=>'removed_race:'+r.no),...ordered(future(current)).flatMap(r=>{const old=ordered(races).find(x=>x.no===r.no);if(!old)return ['race:'+r.no];return ['time','scheduledDate','type','distance','surface','conditions'].filter(k=>JSON.stringify(old[k])!==JSON.stringify(r[k])).map(k=>'race:'+r.no+':'+k).concat(r.horses.flatMap(h=>{const was=old.horses.find(x=>x.no===h.no);if(!was)return ['horse:'+r.no+':'+h.no];return ['name','age','weight','start','jockey','trainer','outOfRace','lastSix','daysSinceRace','bestTimeSeconds','handicapRating'].filter(k=>JSON.stringify(k==='outOfRace'?Boolean(was[k]):was[k])!==JSON.stringify(k==='outOfRace'?Boolean(h[k]):h[k])).map(k=>'horse:'+r.no+':'+h.no+':'+k)}))})].slice(0,30),reason:sameEntries?'current_official_entries_match_saved_model_inputs':'entry_change_requires_reranking'})
 }catch(e){report.cities.push({city,confirmed:false,reason:'source_verification_failed',error:e.message})}
 await writeFile('data/maintenance/publication-program-confirmation-'+day+'.json',JSON.stringify(report,null,2))
}
await writeFile('data/maintenance/publication-program-confirmation-'+day+'.json',JSON.stringify(report,null,2))
console.log(JSON.stringify(report))
