import {readFile,writeFile,mkdir,open,unlink,copyFile,readdir,rename} from 'node:fs/promises';
import {execFile,execFileSync} from 'node:child_process';import {promisify} from 'node:util';import {randomUUID,createHash} from 'node:crypto';
import {finalQualityApproved} from './history-final-quality.mjs';
import {localDay} from './maintenance-policy.mjs';import {isProcessRunning} from './process-liveness.mjs';
import {instagramOwnerActive,instagramProcessIdentity} from './instagram-owner.mjs';
import {requireDistinctHistoryMotion,recordHistoryMotion} from './history-diversity.mjs';
import {uploadImages,uploadVideo,publish} from './instagram-agent-io.mjs';
import {readPublicationCadence} from './instagram-news/cadence.mjs';
import {historyStoryPlan} from './history-story-plans.mjs';import {withHistoryEntities} from './history-entity-tags.mjs';
import {matchStoryVenue,venueStoryPlan,confirmVenueProgram} from './venue-history.mjs';
const exec=promisify(execFile),root='data/instagram',day=localDay(),lock=root+'/history.lock';
const json=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''));
const maybe=async p=>{try{return await json(p)}catch(e){if(e.code!=='ENOENT')throw e;return null}};
const atomic=async(p,value)=>{const tmp=p+'.'+process.pid+'.tmp';await writeFile(tmp,JSON.stringify(value,null,2));await rename(tmp,p)};
const preview=process.argv.includes('--render-only'),version='local-native-motion-v1',token=randomUUID();
function identity(pid){
 if(!Number.isSafeInteger(pid)||pid<1)return undefined;
 try{
  const script=`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}' -ErrorAction Stop;if(-not $p){'null'}else{@{start=([DateTimeOffset]$p.CreationDate).ToUnixTimeMilliseconds();history=($p.CommandLine -match 'run-history-reel\\.mjs')}|ConvertTo-Json -Compress}`;
  return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:8000}).trim());
 }catch{return undefined}
}
function alive(owner){
 if(!isProcessRunning(owner.pid))return false;
 const current=identity(owner.pid);
 if(current===null)return false;
 if(!current)return true;
 return current.history===true&&(!owner.startedAt||owner.startedAt===current.start);
}
await mkdir(root,{recursive:true});
const owner=await maybe(lock);
if(owner&&alive(owner)){console.log(JSON.stringify({status:'existing_history_owner'}));process.exit(0)}
if(owner)await unlink(lock);
const handle=await open(lock,'wx');await handle.writeFile(JSON.stringify({pid:process.pid,startedAt:identity(process.pid)?.start,token}));await handle.close();
let report={day,checkedAt:new Date().toISOString(),codexRequired:false,localRender:true,speechProvider:'Azure Speech F0',rendererVersion:version};
function pause(status,details={}){Object.assign(report,{status},details);throw Object.assign(Error(status),{quiet:true})}
try{
 const hold=await maybe(root+'/history-review-hold.json');if(hold?.enabled&&!preview)pause('paused_for_editorial_review');
 const config=await json(root+'/agent-config.json');if(!config.enabled)throw Error('publishing_disabled');
 if(!preview){const probe=await maybe('data/maintenance/unattended-native-history-selfcheck.json');if(probe?.status!=='passed'||probe.rendererVersion!==version||probe.interactive!==false)pause('waiting_for_unattended_native_validation')}
 const request=await maybe(root+'/history-extra-request.json');
 const extra=process.argv.includes('--extra')||(request?.day===day&&request.status==='pending');
 const catalog=await json(root+'/history-catalog.json'),series=await json(root+'/gazi-series/ledger.json');
 const published=[];
 for(const directory of await readdir(root,{withFileTypes:true})){
  if(!directory.isDirectory()||!directory.name.startsWith('history-'))continue;
  const publication=await maybe(root+'/'+directory.name+'/publication.json');
  if(publication?.status!=='published_verified')continue;
  const manifest=await maybe(root+'/'+directory.name+'/manifest.json');
  if(manifest?.kind!=='historical_reel')continue;
  published.push({directory:directory.name,publication,manifest});
  // Repair a series ledger after a process/PC stopped just after publishing.
  if(manifest.storySeries==='gazi'&&Number.isInteger(manifest.storyYear)&&!series.episodes.some(e=>e.year===manifest.storyYear)){
   series.episodes.push({year:manifest.storyYear,status:'published_verified',permalink:publication.permalink,publishedAt:publication.publishedAt,sourceUrls:manifest.sourceUrls,publicationId:manifest.id});
   await atomic(root+'/gazi-series/ledger.json',series);
  }
 }
 const date=new Date(day+'T12:00:00+03:00'),friday=date.getUTCDay()===5,lastFriday=new Date(date);
 lastFriday.setUTCDate(date.getUTCDate()-((date.getUTCDay()+2)%7));
 const lastFridayDay=lastFriday.toISOString().slice(0,10);
 const lastGaziDay=series.episodes.filter(e=>e.status==='published_verified'&&e.publishedAt).map(e=>localDay(new Date(e.publishedAt))).sort().at(-1)||'1900-01-01';
 const gaziDue=!extra&&(friday||lastGaziDay<lastFridayDay);
 const today=published.find(e=>localDay(new Date(e.publication.publishedAt))===day&&(!gaziDue||e.manifest.storySeries==='gazi'));
 if(today&&!extra&&!preview)pause('already_published',{url:today.publication.permalink,publicationId:today.directory});
 const daily=root+'/history-days/'+day+(extra?'-extra':'')+'.json';await mkdir(root+'/history-days',{recursive:true});
 let chosen=await maybe(daily),selected;
 const episodes=catalog.episodes.filter(e=>e.reviewed===true&&e.topic==='horse_racing_history'&&e.sources?.length);
 if(chosen){selected=episodes.find(e=>e.id===chosen.id);if(!selected)throw Error('saved_episode_missing')}
 else if(gaziDue){const next=Math.max(...series.episodes.filter(e=>e.status==='published_verified').map(e=>e.year),1926)+1;selected=episodes.find(e=>e.series==='gazi'&&e.year===next)}
 const program=gaziDue?{races:[]}:await maybe('data/program-cache/'+day+'.json');
 if(!program)pause('waiting_for_today_program');
 if(!selected&&!gaziDue){
  for(const e of episodes.filter(e=>e.series==='world'&&matchStoryVenue(e,program,day)).sort((a,b)=>(b.interestScore||0)-(a.interestScore||0))){
   const pub=await maybe(root+'/history-'+e.id+'/publication.json');
   if(!pub?.mediaId&&pub?.status!=='publishing_unknown'){selected=e;break}
  }
 }
 if(!selected)pause('source_catalog_exhausted_or_no_matching_venue');
 if(!chosen){chosen={id:selected.id,day};await atomic(daily,chosen)}
 const id='history-'+selected.id,dir=root+'/'+id;await mkdir(dir,{recursive:true});
 let publication=await maybe(dir+'/publication.json');
 if(publication?.status==='published_verified')pause('already_published',{url:publication.permalink,episode:selected.id});
 selected=withHistoryEntities(historyStoryPlan(selected));
 if(selected.series==='world'){
  const match=matchStoryVenue(selected,program,day);if(!match)throw Error('story_venue_not_in_upcoming_bulletin');
  const verification=await confirmVenueProgram(selected,program,day);
  selected={...venueStoryPlan(selected,match,day),venueVerification:verification};
 }
 selected.productionDay=day;
 const diversity=await requireDistinctHistoryMotion(selected);
 if(!diversity.ok)pause('waiting_for_distinct_story_scenes',{episode:selected.id,assetRequest:'data/instagram/native-renderer/asset-requests/'+selected.id+'.json'});
 let manifest=await maybe(dir+'/manifest.json');
 if(manifest&&(manifest.rendererVersion!==version||manifest.date!==day))throw Error('legacy_or_stale_prepared_manifest_requires_review');
 if(!manifest){
  await atomic(dir+'/episode.json',selected);await writeFile(dir+'/narration.txt',selected.narration);
  await exec('D:/Apps/HorseRide/.venv/Scripts/python.exe',['server/history-motion-native.py',dir,'--day',day],{windowsHide:true,timeout:540000,maxBuffer:30000,env:{...process.env,PYTHONUTF8:'1'}});
 }
 const rendered=await json(dir+'/render-report.json');
 if(rendered.rendererVersion!==version)throw Error('Unapproved historical renderer');
 report.voice=rendered.voice;report.episode=selected.id;report.motionMode=rendered.motionMode;
 if(preview)pause('rendered_preview',{directory:dir});
 // LOCAL_VIDEO_REVIEW_GATE: technical audit never substitutes for editorial approval.
 const localReview=await maybe(dir+'/local-video-review.json');
 const currentVideoSha=createHash('sha256').update(await readFile(dir+'/reel.mp4')).digest('hex');
 if(localReview?.version!=='local-video-review-v2'||localReview.hashes?.videoSha256!==currentVideoSha)pause('waiting_for_local_video_audit',{directory:dir});
 if(!['needs_editorial_review'].includes(localReview.status))pause('local_video_audit_blocked',{directory:dir,status:localReview.status});
 // LOCAL_VIDEO_AUDIO_HASH_GUARD: changed narration invalidates the audit as well.
 for(const [file,key] of [['narration.wav','voiceSha256'],['narration.txt','narrationSha256']]){
  const hash=createHash('sha256').update(await readFile(dir+'/'+file)).digest('hex');
  if(localReview.hashes?.[key]!==hash)pause('waiting_for_local_video_audit',{directory:dir,changed:file});
 }
 // HISTORY_CONTEXT_GATE: generic horse footage cannot count as historical context.
 const context=await maybe(dir+'/context-review.json');
 const contextManifest=await maybe(dir+'/context-manifest.json');
 if(context?.status!=='context_passed'||context.videoSha256!==currentVideoSha||!contextManifest)pause('waiting_for_history_context_review',{directory:dir});
 const manifestHash=createHash('sha256').update(await readFile(dir+'/context-manifest.json')).digest('hex');
 if(context.manifestSha256!==manifestHash)pause('waiting_for_history_context_review',{directory:dir,reason:'changed_storyboard'});
 const finalApproval=await maybe(dir+'/final-quality-approval.json');
 const fileSha=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
 if(!finalQualityApproved(finalApproval,{videoSha256:await fileSha(dir+'/reel.mp4'),voiceSha256:await fileSha(dir+'/narration.wav'),narrationSha256:await fileSha(dir+'/narration.txt')}))pause('waiting_for_final_quality_review',{episode:selected.id,directory:dir});
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
 if(hour<Number(config.historyPublishFromHour??11))pause('prepared_waiting_for_publication_hour');
 const cadence=await readPublicationCadence(root,day,new Date().toISOString(),{...config,maxFeedPostsPerDay:Number(config.maxFeedPostsPerDay||8)+1});
 if(!cadence.due)pause('waiting_for_feed_spacing',{nextAt:cadence.nextAt,reason:cadence.reason});
 const sharedOwner=await maybe(root+'/agent.lock');if(sharedOwner&&instagramOwnerActive(sharedOwner))pause('waiting_for_publisher');
 if(sharedOwner)await unlink(root+'/agent.lock');const shared=await open(root+'/agent.lock','wx');await shared.writeFile(JSON.stringify({pid:process.pid,startedAt:instagramProcessIdentity(process.pid)?.start}));await shared.close();
 try{
  if(!manifest){
   const [image]=await uploadImages(id,[dir+'/cover.jpg']),video=await uploadVideo(id,dir+'/reel.mp4');await copyFile(dir+'/cover.jpg',dir+'/image.jpg');
   const caption=selected.narration+'\n\n'+rendered.disclosure+'\nKaynaklar: '+selected.sources.join(' · ')+'\n\n'+rendered.credits+'\n\n'+selected.tags.join(' ');
   if(caption.length>2200)throw Error('caption_too_long');
   manifest={id,account:'ganyan_zekasi',instagramId:'17841441483231653',date:day,kind:'historical_reel',mediaType:'REELS',localImage:'image.jpg',imageSha256:image.sha256,imageUrl:image.url,localVideo:'reel.mp4',videoSha256:video.sha256,videoUrl:video.url,caption,sourceUrls:selected.sources,rendererVersion:version,storySeries:selected.series,storyYear:selected.year,voice:rendered.voice,expiresAt:selected.series==='world'?day+'T23:59:59+03:00':undefined};
   await atomic(dir+'/manifest.json',manifest);
  }
  await publish(id,'Prepare');if(selected.series==='world')await confirmVenueProgram(selected,program,day);
  for(let attempt=0;attempt<12;attempt++){
   await publish(id,'Publish');publication=await json(dir+'/publication.json');
   if(publication.status==='published_verified'||publication.status==='publishing_unknown')break;
   if(attempt<11)await new Promise(resolve=>setTimeout(resolve,5000));
  }
  report.status=publication.status;report.url=publication.permalink;
  if(publication.status==='published_verified')await recordHistoryMotion(selected.id,diversity.assets,publication.permalink);
  if(extra&&publication.status==='published_verified')await atomic(root+'/history-extra-request.json',{day,status:'fulfilled',id:selected.id,url:publication.permalink});
  if(selected.series==='gazi'&&publication.status==='published_verified'&&!series.episodes.some(e=>e.year===selected.year)){
   series.episodes.push({year:selected.year,status:'published_verified',permalink:publication.permalink,publishedAt:publication.publishedAt,sourceUrls:selected.sources,publicationId:id});await atomic(root+'/gazi-series/ledger.json',series);
  }
 }finally{const latest=await maybe(root+'/agent.lock');if(latest?.pid===process.pid)await unlink(root+'/agent.lock')}
}catch(error){if(!error.quiet){report.status='attention_required';report.error=String(error.message).slice(0,180);process.exitCode=1}}
finally{
 report.finishedAt=new Date().toISOString();await atomic(root+'/history-status.json',report);
 const current=await maybe(lock);if(current?.token===token)await unlink(lock);
 console.log(JSON.stringify(report));
}
