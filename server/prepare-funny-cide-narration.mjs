import{readFile,writeFile,mkdir,copyFile}from'node:fs/promises';
import{historyStoryPlan}from'./history-story-plans.mjs';
import{withHistoryEntities}from'./history-entity-tags.mjs';
import{matchStoryVenue,confirmVenueProgram,venueStoryPlan}from'./venue-history.mjs';
const day='2026-11-04',id='finger-lakes-2007-funny-cide',root='data/instagram',dir=root+'/history-'+id;
const json=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''));
let ledger=null;try{ledger=await json(dir+'/publication.json')}catch(e){if(e.code!=='ENOENT')throw e}
if(ledger?.mediaId||ledger?.status==='publishing_unknown')throw Error('Preserve existing/unknown publication');
const catalogPath=root+'/history-catalog.json',catalog=await json(catalogPath),e=catalog.episodes.find(e=>e.id===id);
if(!e?.reviewed||!e.sources?.length)throw Error('Missing reviewed historical source');
const texts=['4 Temmuz. Tribünlerde on iki binden fazla seyirci vardı.','Kentucky Derbisi galibi Funny Cide, kariyerinin son yarışına çıkıyordu.','Gerilerden geldi; düzlükte rakiplerinden uzaklaşarak kazandı.','Finger Lakes’te koşan ilk Kentucky Derbisi galibi, son startını da birincilikle tamamladı.'];
await copyFile(catalogPath,root+'/history-catalog.json.before-short-funny-cide-20261104');
e.storySegments=texts.map(text=>({text,speed:.98,pauseAfter:.28}));e.reviewedAt=day;e.editorialSourceCheck='2026-11-04 official Finger Lakes history: July 4 2007, >12000 crowd, last career start, came from behind and won.';
await writeFile(catalogPath,JSON.stringify(catalog,null,2));
const program=await json('data/program-cache/'+day+'.json'),match=matchStoryVenue(e,program,day);if(!match)throw Error('Venue not upcoming today');
const source=await confirmVenueProgram(e,program,day);
const selected={...venueStoryPlan(withHistoryEntities(historyStoryPlan(e)),match,day),venueVerification:source,productionDay:day};
await mkdir(dir,{recursive:true});await writeFile(dir+'/episode.json',JSON.stringify(selected,null,2));await writeFile(dir+'/narration.txt',selected.narration);
console.log(JSON.stringify({episode:id,words:selected.narration.split(/\s+/).length,officialVenueVerified:true,publication:false}));
