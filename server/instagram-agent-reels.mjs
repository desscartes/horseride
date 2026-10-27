import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {renderVertical} from './render-instagram-vertical.mjs';
import {uploadVideo,publish,sha} from './instagram-agent-io.mjs';
const json=async path=>JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));
export async function publishMeetingReels(root,day,drafts){
 const report=[];let count=0;
 for(const name of await readdir(root))if(name.startsWith('reel-meeting-'+day+'-'))try{const r=await json(root+'/'+name+'/publication.json');if(r.mediaId||r.status==='publishing_unknown')count++}catch{}
 for(const draft of drafts){
  if(Date.parse(draft.expiresAt)<=Date.now())continue;
  const parent=root+'/'+draft.id;let ledger,selection;try{ledger=await json(parent+'/publication.json');selection=await json(parent+'/selection.json')}catch{continue}
  if(ledger.status!=='published_verified')continue;
  const signature=d=>sha(JSON.stringify([d.entryFingerprint,d.ticket.legs,d.first,d.surprise]));
  if(signature(draft)!==signature(selection)){report.push({city:draft.city,status:'selection_changed'});continue}
  const id='reel-'+draft.id,directory=root+'/'+id;let entry;try{entry=await json(directory+'/publication.json')}catch{}
  if(entry?.mediaId)continue;if(entry?.status==='publishing_unknown'){report.push({city:draft.city,status:'requires_reconciliation'});continue}
  if(count>=2)continue;
  try{
   await mkdir(directory,{recursive:true});let manifest;try{manifest=await json(directory+'/manifest.json')}catch{}
   if(!manifest){
    const rendered=await renderVertical(selection,directory);await writeFile(directory+'/story-status.json',JSON.stringify({status:'prepared_only',reason:'story_publisher_not_enabled',files:rendered.frames},null,2));
    const image=await json(parent+'/manifest.json'),video=await uploadVideo(id,rendered.video);await copyFile(parent+'/image.jpg',directory+'/image.jpg');
    manifest={id,account:'ganyan_zekasi',instagramId:'17841441483231653',mediaType:'REELS',kind:'meeting_reel',expiresAt:selection.expiresAt,planSignature:signature(selection),localImage:'image.jpg',imageUrl:image.imageUrl,imageSha256:image.imageSha256,localVideo:'reel.mp4',videoUrl:video.url,videoSha256:video.sha256,caption:selection.caption,altText:image.altText};await writeFile(directory+'/manifest.json',JSON.stringify(manifest,null,2));
   }
   if(manifest.planSignature!==signature(draft)||Date.parse(manifest.expiresAt)<=Date.now())continue;
   await publish(id,'Prepare');await publish(id,'Publish');entry=await json(directory+'/publication.json');if(entry.status==='published_verified'){count++;report.push({city:draft.city,status:entry.status,url:entry.permalink})}else report.push({city:draft.city,status:entry.status});
  }catch{report.push({city:draft.city,status:'attention_required',details:directory+'/last-error.json'})}
 }
 return report;
}
