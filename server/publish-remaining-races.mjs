import{readFile,writeFile,mkdir,copyFile}from'node:fs/promises';import{execFile}from'node:child_process';import{promisify}from'node:util';
import{buildRaceCardFacts}from'./instagram-news/race-card-facts.mjs';import{buildCityFacts}from'./instagram-news/facts.mjs';import{loadRankingModel}from'./ranking.mjs';
import{uploadImages,publish,sha}from'./instagram-agent-io.mjs';import{analysisEntryFingerprint}from'./analysis-entry-policy.mjs';import{readPublicationCadence}from'./instagram-news/cadence.mjs';
const exec=promisify(execFile),[day,city]=process.argv.slice(2),urgent=process.argv.includes('--deadline-exception');
if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!['Adana','Kocaeli'].includes(city))throw Error('Unsupported recovery request');
const root='data/instagram',id='remaining-'+day+'-'+city.toLowerCase(),dir=root+'/'+id;
const json=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''));
await mkdir(dir,{recursive:true});let ledger=null;try{ledger=await json(dir+'/publication.json')}catch(e){if(e.code!=='ENOENT')throw e}
if(ledger?.mediaId){console.log(JSON.stringify({status:ledger.status,url:ledger.permalink}));process.exit(0)}
if(ledger)throw Error('Existing unfinished publication must be reconciled');
const source=await json('data/program-cache/'+day+'.json'),start=r=>Date.parse(`${r.scheduledDate??day}T${String(r.time).replace('.',':')}:00+03:00`);
const races=source.races.filter(r=>r.city===city&&start(r)>Date.now()+10*60000);if(races.length<2||races.length>10)throw Error('Not enough future races');
const program={...source,races,publicationScope:'remaining'};
const model=loadRankingModel({metadataOnly:true})?.metadata,cards=buildRaceCardFacts(program,city,model),facts=buildCityFacts(program,city);
if(!cards||cards.races.length!==races.length||!facts)throw Error('Current complete remaining-race model data missing');
const cadence=await readPublicationCadence(root,day,new Date().toISOString(),await json(root+'/agent-config.json'));
if(!cadence.due&&!urgent)throw Error('Not due under regular publication spacing');
const fingerprint=analysisEntryFingerprint(races);await writeFile(dir+'/program.json',JSON.stringify(program));
const rendered=await exec(process.execPath,['server/instagram-news/render-race-cards.mjs',dir+'/program.json',city,dir,'0',String(races.length)],{windowsHide:true,timeout:90000,env:{...process.env,HORSERIDE_CHROMIUM_EXE:'D:/Tools/HorseRideChromium/chrome-headless-shell.exe'}});
if(JSON.parse(rendered.stdout).slideCount!==races.length)throw Error('Incomplete slides');
const images=await uploadImages(id,Array.from({length:races.length},(_,i)=>dir+'/slide-'+(i+1)+'.jpg'));await copyFile(dir+'/slide-1.jpg',dir+'/image.jpg');
const caption=(await readFile(dir+'/caption.txt','utf8'))+' #'+city+' #'+city+'Hipodromu';
const manifest={id,account:'ganyan_zekasi',instagramId:'17841441483231653',date:day,city,kind:'remaining_race_model_cards',scope:'future_races_only',raceNumbers:races.map(r=>r.no),entryFingerprint:fingerprint,deadlineException:urgent?'Explicit user request: publish Adana remaining races before15:30':null,modelIncluded:true,modelMethod:cards.method,modelTrainedThrough:cards.trainedThrough,expiresAt:new Date(Math.min(...races.map(start))-10*60000).toISOString(),localImage:'image.jpg',imageSha256:images[0].sha256,imageUrl:images[0].url,images,caption,altText:city+' kalan koşular: yalnız henüz başlamamış koşuların model sıralaması ve geçmiş veri notları.'};
await writeFile(dir+'/manifest.json',JSON.stringify(manifest,null,2));await publish(id,'Prepare');
const latest=await json('data/program-cache/'+day+'.json'),current=latest.races.filter(r=>r.city===city&&races.some(x=>x.no===r.no));
if(analysisEntryFingerprint(current)!==fingerprint||current.some(r=>start(r)<=Date.now()+10*60000))throw Error('Remaining field changed or publication window expired');
for(let i=0;i<12;i++){await publish(id,'Publish');ledger=await json(dir+'/publication.json');if(ledger.status==='published_verified')break;if(ledger.status==='publishing_unknown')throw Error('Unknown outcome; no blind retry');await new Promise(r=>setTimeout(r,5000))}
console.log(JSON.stringify({status:ledger.status,url:ledger.permalink,raceNumbers:races.map(r=>r.no)}));
