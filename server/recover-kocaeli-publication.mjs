import{readFile,writeFile,mkdir,copyFile}from'node:fs/promises';import{execFile}from'node:child_process';import{promisify}from'node:util';
import{buildRaceCardFacts}from'./instagram-news/race-card-facts.mjs';import{buildCityFacts}from'./instagram-news/facts.mjs';import{loadRankingModel}from'./ranking.mjs';
import{uploadImages,publish,sha}from'./instagram-agent-io.mjs';import{readPublicationCadence}from'./instagram-news/cadence.mjs';
const exec=promisify(execFile),day='2026-11-03',city='Kocaeli',id='race-cards-'+day+'-kocaeli',directory='data/instagram/'+id;
const json=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''));
await mkdir(directory,{recursive:true});let ledger=null;try{ledger=await json(directory+'/publication.json')}catch(e){if(e.code!=='ENOENT')throw e}
if(ledger?.status==='published_verified'){console.log(JSON.stringify({status:ledger.status,url:ledger.permalink}));process.exit(0)}
if(ledger)throw Error('Existing publication requires normal publisher recovery');
const config=await json('data/instagram/agent-config.json');if(!(await readPublicationCadence('data/instagram',day,new Date().toISOString(),config)).due)throw Error('Publication spacing not due');
const p=await json('data/program-cache/'+day+'.json'),facts=buildCityFacts(p,city),cards=buildRaceCardFacts(p,city,loadRankingModel({metadataOnly:true})?.metadata);
if(!facts||cards?.races.length!==9)throw Error('Full current city ranking missing');
const proof=await json('data/instagram/program-checks/'+day+'-'+city+'.json');if(!proof.confirmed||Date.now()-Date.parse(proof.checkedAt)>5*60000)throw Error('Fresh official confirmation missing');
const rendered=await exec(process.execPath,['server/instagram-news/render-race-cards.mjs','data/program-cache/'+day+'.json',city,directory,'0','9'],{windowsHide:true,timeout:90000,env:{...process.env,HORSERIDE_CHROMIUM_EXE:'D:/Tools/HorseRideChromium/chrome-headless-shell.exe'}});
if(JSON.parse(rendered.stdout).slideCount!==9)throw Error('Nine slides missing');
const images=await uploadImages(id,Array.from({length:9},(_,i)=>directory+'/slide-'+(i+1)+'.jpg'));await copyFile(directory+'/slide-1.jpg',directory+'/image.jpg');
const caption=(await readFile(directory+'/caption.txt','utf8'))+' #Kocaeli #KocaeliHipodromu';
const manifest={id,account:'ganyan_zekasi',instagramId:'17841441483231653',date:day,city,kind:'race_model_cards',part:1,factsSignature:sha(JSON.stringify({races:cards.races,method:cards.method,trainedThrough:cards.trainedThrough})),sourceUrl:facts.sourceUrl,modelIncluded:true,modelMethod:cards.method,modelTrainedThrough:cards.trainedThrough,expiresAt:new Date(Date.parse(day+'T17:15:00+03:00')-10*60000).toISOString(),localImage:'image.jpg',imageSha256:images[0].sha256,imageUrl:images[0].url,images,caption,altText:'Kocaeli: dokuz koşunun her biri için ayrı görsel, etkin modelin ilk dört sırası ve yarış öncesi veri notları.'};
await writeFile(directory+'/manifest.json',JSON.stringify(manifest,null,2));await publish(id,'Prepare');
for(let i=0;i<12;i++){await publish(id,'Publish');ledger=await json(directory+'/publication.json');if(ledger.status==='published_verified')break;if(ledger.status==='publishing_unknown')throw Error('Unknown publication outcome; no blind retry');await new Promise(r=>setTimeout(r,5000))}
console.log(JSON.stringify({status:ledger.status,url:ledger.permalink}));
