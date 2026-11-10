// Refresh publication evidence without waiting for overseas collection or refitting a model.
process.env.HORSERIDE_NO_LISTEN='1';process.env.HORSERIDE_FAST_PROGRAM='1';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {publicationEntriesMatch,canonicalEntries} from './publication-entry-confirmation.mjs';
import {analysisEntryFingerprint} from './analysis-entry-policy.mjs';
import {scheduledMeetingDates} from './foreign-data.mjs';
import {readServedProgram,publishProgram} from './served-program.mjs';
const [day,city]=process.argv.slice(2);
if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!['Adana','Ankara','Antalya','Bursa','Diyarbakır','Elazığ','İstanbul','İzmir','Kocaeli','Şanlıurfa'].includes(city))throw Error('Invalid domestic meeting');
const futureOnly=process.argv.includes('--future-only');
const isFuture=r=>Date.parse(`${r.scheduledDate??day}T${String(r.time).replace('.',':')}:00+03:00`)>Date.now()+10*60000;
const program=readServedProgram(day),saved=program?.races.filter(r=>r.city===city&&(!futureOnly||isFuture(r)));
if(!saved?.length)throw Error('Saved city missing');
const meetingUrl=program.meetings.find(m=>m.city===city)?.url;
const {fetchProgram}=await import('./index.mjs');
const fresh=await fetchProgram(new Date(day+'T12:00:00'),city,{meetingUrl,isForeign:false});
const current=scheduledMeetingDates(fresh.races.map(r=>({...r,city,foreign:false})),day).filter(r=>!futureOnly||isFuture(r));
const environment=rows=>canonicalEntries(rows).map(r=>{const e=r.environment||r.horses.find(h=>h.sourceData?.tjk?.raceEnvironment)?.sourceData.tjk.raceEnvironment;return e?{date:e.date,weather:e.weather,tracks:e.tracks}:null});
const identity=rows=>canonicalEntries(rows).map(r=>[r.no,r.horses.map(h=>[h.no,h.horseId??h.sourceData?.tjk?.horseId??null])]);
const unchanged=publicationEntriesMatch(saved,current)&&JSON.stringify(environment(saved))===JSON.stringify(environment(current))&&JSON.stringify(identity(saved))===JSON.stringify(identity(current));
const differences=[];
for(const race of canonicalEntries(current)){
 const old=canonicalEntries(saved).find(r=>r.no===race.no);if(!old){differences.push('race_added:'+race.no);continue}
 for(const key of ['time','scheduledDate','type','distance','surface','conditions'])if(JSON.stringify(old[key])!==JSON.stringify(race[key]))differences.push('race:'+race.no+':'+key);
 for(const h of race.horses){const was=old.horses.find(x=>x.no===h.no);if(!was){differences.push('runner_added:'+race.no+':'+h.no);continue}for(const key of ['name','age','weight','start','jockey','trainer','lastSix','daysSinceRace','bestTimeSeconds','handicapRating'])if(JSON.stringify(was[key])!==JSON.stringify(h[key]))differences.push('runner:'+race.no+':'+h.no+':'+key)}
 for(const h of old.horses)if(!race.horses.some(x=>x.no===h.no))differences.push('runner_removed:'+race.no+':'+h.no);
}
if(JSON.stringify(environment(saved))!==JSON.stringify(environment(current)))differences.push('environment_changed');
if(JSON.stringify(identity(saved))!==JSON.stringify(identity(current)))differences.push('horse_identity_changed');
const proof={day,city,checkedAt:new Date().toISOString(),confirmed:unchanged,scope:futureOnly?'future_races_only':'all_races',raceNumbers:saved.map(r=>r.no),differences:differences.slice(0,30),originalProgramFetchedAt:program.fetchedAt,entryFingerprint:analysisEntryFingerprint(saved),sourceUrl:fresh.url,modelRecalculated:false,reason:unchanged?'official_entries_and_environment_unchanged':'changed_inputs_require_reranking'};
await mkdir('data/instagram/program-checks',{recursive:true});await writeFile('data/instagram/program-checks/'+day+'-'+city+'.json',JSON.stringify(proof,null,2));
if(!unchanged){console.log(JSON.stringify(proof));process.exit(2)}
// Re-read before committing: never overwrite concurrent collection with an older copy.
const latest=readServedProgram(day);
if(analysisEntryFingerprint(latest.races.filter(r=>r.city===city&&(!futureOnly||isFuture(r))))!==proof.entryFingerprint)throw Error('City changed during verification');
publishProgram(day,{...latest,cityFetchedAt:{...latest.cityFetchedAt,[city]:proof.checkedAt},cityRefreshEvidence:{...latest.cityRefreshEvidence,[city]:proof}});
console.log(JSON.stringify(proof));
process.exit(0);
