import{createHash}from'node:crypto';
export const scopePolicy={maxSlides:10,maxRacesPerSlide:8,cutoffMinutes:10,maximumSourceAgeMinutes:120};
export const legacyRaceKinds=new Set(['race_model_cards','foreign_race_model_cards','foreign_form_archive','archive_observations','evidence_rich_model_comments','meeting','meeting_reel']);
export const raceStart=(r,day)=>Date.parse(`${r.scheduledDate||day}T${String(r.time||r.start).replace('.',':')}:00+03:00`);
export const scopeTitle=s=>s==='domestic'?'YURT İÇİ YARIŞLAR':'YURT DIŞI YARIŞLAR';
export const displayCity=s=>String(s).replace(/Guney Afrika/gi,'Güney Afrika').replace(/�ili/g,'Şili');
const fingerprint=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function belongs(m,scope){return m.foreign===(scope==='foreign')}
export function legacyPublications(publications,day,scope){
 return publications.filter(({manifest:m,publication:p})=>m.date===day&&legacyRaceKinds.has(m.kind)&&['published','published_verified','publishing_unknown'].includes(p.status)&&((m.kind.startsWith('foreign_'))===(scope==='foreign')));
}
export function buildScopePlan(program,views,{scope,now=new Date().toISOString(),maxSlides=10,maxRacesPerSlide=8,previewOnly=false}={}){
 if(!['domestic','foreign'].includes(scope))throw Error('Invalid daily race scope');
 const day=program.date,clock=Date.parse(now),meetings=(program.meetings||[]).filter(m=>belongs(m,scope));
 const expected=(program.races||[]).filter(r=>meetings.some(m=>m.city===r.city)),future=expected.filter(r=>raceStart(r,day)>clock+scopePolicy.cutoffMinutes*60000);
 const missing=[],rows=[],coverage=[];
 for(const m of meetings){
  const required=future.filter(r=>r.city===m.city);if(!required.length)continue;
  const v=views.find(v=>v.city===m.city),source=program.cityFetchedAt?.[m.city]||program.fetchedAt,age=(clock-Date.parse(source))/60000;
  if(!Number.isFinite(age)||age<0||(!previewOnly&&age>scopePolicy.maximumSourceAgeMinutes)){missing.push({city:m.city,reason:'source_stale',sourceFetchedAt:source});continue}
  if(!v||!v.sourceUrl||required.some(r=>!v.races.some(x=>Number(x.raceNo)===Number(r.no)))){missing.push({city:m.city,reason:'race_summary_or_source_incomplete'});continue}
  for(const r of required){const x=v.races.find(x=>Number(x.raceNo)===Number(r.no));rows.push({...x,city:m.city,displayCity:displayCity(m.city),country:v.country,mode:v.mode,sourceFetchedAt:source,startAt:new Date(raceStart(r,day)).toISOString(),modelMethod:v.method||null,trainedThrough:v.trainedThrough||null})}
  coverage.push({city:m.city,mode:v.mode,country:v.country,races:required.length,method:v.method||null,trainedThrough:v.trainedThrough||null,entryFingerprint:v.entryFingerprint||null,sourceFetchedAt:source,sourceUrl:v.sourceUrl||null});
 }
 rows.sort((a,b)=>a.startAt.localeCompare(b.startAt)||a.city.localeCompare(b.city,'tr')||a.raceNo-b.raceNo);
 const id=`daily-scope-${day}-${scope}`,excludedStarted=expected.length-future.length;
 const perSlide=Math.max(3,Math.ceil(rows.length/maxSlides)),capacity=maxSlides*maxRacesPerSlide;
 const status=program.source!=='tjk_csv'?'unverified_program':!future.length?'no_upcoming_races':missing.length?'waiting_for_complete_scope':rows.length>capacity?'scope_capacity_exceeded':'ready';
 const slides=status==='ready'?Array.from({length:Math.ceil(rows.length/perSlide)},(_,i)=>rows.slice(i*perSlide,(i+1)*perSlide)):[];
 const digest={date:day,scope,rows,coverage,excludedStarted,expectedRaceCount:expected.length};
 const substantive={...digest,rows:rows.map(({sourceFetchedAt,...r})=>r),coverage:coverage.map(({sourceFetchedAt,...c})=>c)};
 return {...digest,id,title:scopeTitle(scope),status,missing,slides,rowsPerSlide:perSlide,capacity,previewOnly,factsSignature:fingerprint(substantive),snapshotAt:now,expiresAt:rows.length?new Date(Math.min(...rows.map(r=>Date.parse(r.startAt)))-scopePolicy.cutoffMinutes*60000).toISOString():null};
}
