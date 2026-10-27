import {programWithJockeyEvidence} from './jockey-evidence.mjs'
import {publishCompletedResults} from './instagram-agent-results.mjs'
import {readFile,writeFile,mkdir,open,unlink,readdir,copyFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {isProcessRunning} from './process-liveness.mjs'
import {localDay} from './maintenance-policy.mjs'
import {instagramMeetingPlan,instagramMeetingPolicy} from './instagram-meeting-plan.mjs'
import {renderMeeting,uploadImages,publish,sha,verifyConnection} from './instagram-agent-io.mjs'
process.chdir(fileURLToPath(new URL('../',import.meta.url)))
const root='data/instagram',lock=root+'/agent.lock',statusPath=root+'/agent-status.json',json=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,'')),now=()=>new Date().toISOString(),day=localDay()
await mkdir(root,{recursive:true})
let old;try{old=await json(lock)}catch(e){if(e.code!=='ENOENT')throw e}
if(old){if(isProcessRunning(old.pid)){console.log('Instagram agent already running');process.exit(0)}await unlink(lock)}
const owned={pid:process.pid,at:now()},handle=await open(lock,'wx');await handle.writeFile(JSON.stringify(owned));await handle.close()
const report={checkedAt:now(),day,mode:'automatic_meeting_publication',published:[],blocked:[],paidAiRequested:false}
try{
 const config=await json(root+'/agent-config.json');if(config.enabled!==true)throw Error('Instagram agent disabled')
 let connection=await json('data/maintenance/instagram-connection.json')
 if(Date.now()-Date.parse(connection.checkedAt)>86400000){await verifyConnection();connection=await json('data/maintenance/instagram-connection.json')}
 if(!connection.valid||connection.account!=='ganyan_zekasi'||!(connection.expiresAtUnix*1000>Date.now()+600000)){report.blocked.push({reason:'reauthorization_required'});throw Error('Instagram credential expired or near expiry')}
 const program=await programWithJockeyEvidence(await json('data/program-cache/'+day+'.json')),readiness=await json('data/maintenance/preparation-readiness-'+day+'.json'),plan=instagramMeetingPlan(program,readiness,{now:now()});report.blocked.push(...plan.blocked)
 let already=0
 for(const name of await readdir(root))if(name.startsWith('meeting-'+day+'-'))try{const entry=await json(root+'/'+name+'/publication.json');if(['published','published_verified','publishing_unknown'].includes(entry.status))already++}catch{}
 for(const draft of plan.drafts){
  const directory=root+'/'+draft.id;let entry=null;try{entry=await json(directory+'/publication.json')}catch(e){if(e.code!=='ENOENT')throw e}
  if(entry?.mediaId)continue
  if(entry?.status==='publishing_unknown'){report.blocked.push({city:draft.city,reason:'publish_outcome_requires_reconciliation'});continue}
  if(already>=instagramMeetingPolicy.maxMeetingPostsPerDay){report.blocked.push({city:draft.city,reason:'daily_post_limit'});continue}
  await mkdir(directory,{recursive:true})
  const signature=sha(JSON.stringify([draft.entryFingerprint,draft.ticket.legs,draft.first,draft.surprise]));let manifest
  try{manifest=await json(directory+'/manifest.json')}catch(e){if(e.code!=='ENOENT')throw e}
  if(manifest&&manifest.planSignature!==signature){report.blocked.push({city:draft.city,reason:'prepared_selection_changed'});continue}
  if(!manifest){const paths=await renderMeeting(draft,directory),images=await uploadImages(draft.id,paths);await copyFile(paths[0],directory+'/image.jpg');manifest={id:draft.id,account:'ganyan_zekasi',instagramId:'17841441483231653',date:day,city:draft.city,kind:'meeting',planSignature:signature,entryFingerprint:draft.entryFingerprint,expiresAt:draft.expiresAt,localImage:'image.jpg',imageSha256:images[0].sha256,imageUrl:images[0].url,images,caption:draft.caption,altText:draft.city+' yarış öncesi model analizi: bütçeli kupon, ilk aday ve sürpriz adayı.'};if(manifest.caption.length>2200)throw Error('Caption exceeds platform limit');await writeFile(directory+'/manifest.json',JSON.stringify(manifest,null,2));await writeFile(directory+'/selection.json',JSON.stringify(draft,null,2))}
  await publish(draft.id,'Prepare')
  // Re-read both inputs immediately before the irreversible publication request.
  const latest=instagramMeetingPlan(await programWithJockeyEvidence(await json('data/program-cache/'+day+'.json')),await json('data/maintenance/preparation-readiness-'+day+'.json'),{now:now()}).drafts.find(d=>d.id===draft.id)
  if(!latest||sha(JSON.stringify([latest.entryFingerprint,latest.ticket.legs,latest.first,latest.surprise]))!==signature){report.blocked.push({city:draft.city,reason:'last_minute_revalidation_failed'});continue}
  await publish(draft.id,'Publish');entry=await json(directory+'/publication.json');if(entry.status==='published_verified'){report.published.push({city:draft.city,url:entry.permalink});already++}
 }
 report.resultPosts=await publishCompletedResults(root,day)
 report.status=report.published.length?'published':report.blocked.length?'waiting_for_eligible_program':'no_due_meeting'
}catch(e){report.status='attention_required';report.error=String(e.message).slice(0,200);process.exitCode=1}
finally{report.finishedAt=now();await writeFile(statusPath,JSON.stringify(report,null,2));try{if((await json(lock)).pid===process.pid)await unlink(lock)}catch{}console.log(JSON.stringify(report))}
