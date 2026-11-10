// A domestic meeting must not wait for every overseas provider to finish.
process.env.HORSERIDE_FORECAST_SPOOL='1';process.env.HORSERIDE_NO_LISTEN='1';process.env.HORSERIDE_FAST_PROGRAM='1';
import {mkdirSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {isProcessRunning} from './process-liveness.mjs';
const {readServedProgram,publishProgram}=await import('./served-program.mjs');
const [day,city]=process.argv.slice(2);
if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!['Adana','Ankara','Antalya','Bursa','Diyarbakır','Elazığ','İstanbul','İzmir','Kocaeli','Şanlıurfa'].includes(city))throw Error('Invalid domestic meeting');
mkdirSync('data/maintenance',{recursive:true});const lock='data/maintenance/program-city-'+day+'-'+city+'.lock';
try{const owner=JSON.parse(readFileSync(lock,'utf8'));if(isProcessRunning(owner.pid)){console.log(JSON.stringify({status:'city_refresh_already_running',city}));process.exit(0)}unlinkSync(lock)}catch(e){if(e.code!=='ENOENT')throw e}
writeFileSync(lock,JSON.stringify({pid:process.pid}),{flag:'wx'});
process.once('exit',()=>{try{const owner=JSON.parse(readFileSync(lock,'utf8'));if(owner.pid===process.pid)unlinkSync(lock)}catch{}});
const {buildFreshProgramPayload}=await import('./index.mjs');
const fresh=await buildFreshProgramPayload(new Date(day+'T12:00:00'),city);
if(fresh.source!=='tjk_csv'||fresh.races.some(r=>r.city!==city)||!fresh.races.length)throw Error('Fresh domestic source identity mismatch');
const old=readServedProgram(day);if(!old)throw Error('Full program snapshot missing');
publishProgram(day,{...old,cityFetchedAt:{...old.cityFetchedAt,[city]:fresh.fetchedAt},providerUrls:[...new Set([...old.providerUrls,...fresh.providerUrls])],races:[...old.races.filter(r=>r.city!==city),...fresh.races],meetings:old.meetings});
console.log(JSON.stringify({status:'domestic_meeting_refreshed',city,fetchedAt:fresh.fetchedAt,races:fresh.races.length,otherMeetingsNotRestamped:true}));
process.exit(0);
