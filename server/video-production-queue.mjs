import {readFile,writeFile,rename,open,unlink,stat,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export function decideQueue({item,library,production,publication,taskState,now=Date.now()}){
 if(!item||!['waiting','queued','running'].includes(item.status))return 'idle';
 if(!/^[a-z0-9-]{1,90}$/.test(item.episode)||!/^[a-f0-9]{64}$/.test(item.expectedDirectionHash)||![4,8].includes(item.sceneCount)||![49,65].includes(item.motionFrames))return 'invalid';
 if(!Number.isFinite(Date.parse(item.expiresAt))||!Number.isFinite(Date.parse(item.notBefore)))return 'invalid';
 if(publication?.status==='published_verified'||publication?.status==='publishing_unknown')return 'publication_already_exists';
 if(Date.parse(item.expiresAt)<now)return 'expired';
 if(Date.parse(item.notBefore)>now)return 'waiting';
 if(library?.motionDirectionHash===item.expectedDirectionHash&&Object.keys(library.clips||{}).length>=item.sceneCount)return 'rendered_pending_visual_review';
 if(taskState==='Running'||taskState==='Queued')return 'waiting';
 if(taskState!=='Ready')return 'task_unavailable';
 if(production?.episode!==item.episode)return 'different_episode_active';
 if(production.status==='failed')return 'production_failed';
 if(!library&&production.status!=='pending')return 'waiting';
 return 'dispatch';
}
export async function runQueue(app='D:/Apps/HorseRide'){
 const root=join(app,'data/maintenance'),path=join(root,'video-production-queue.json'),lock=path+'.lock';
 const maybe=async p=>{try{return JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''))}catch(e){if(e.code==='ENOENT')return null;throw e}};
 const atomic=async(p,value)=>{const tmp=p+'.'+process.pid+'.tmp';await writeFile(tmp,JSON.stringify(value,null,2));await rename(tmp,p)};
 const queue=await maybe(path);if(!queue?.items?.some(i=>['waiting','queued','running'].includes(i.status)))return {status:'idle'};
 await mkdir(root,{recursive:true});let handle;
 try{handle=await open(lock,'wx')}catch(e){if(e.code!=='EEXIST')throw e;const s=await stat(lock);if(Date.now()-s.mtimeMs<5*60000)return {status:'locked'};await unlink(lock);handle=await open(lock,'wx')}
 try{
  const item=queue.items.find(i=>['waiting','queued','running'].includes(i.status));
  if(decideQueue({item,taskState:'Unavailable'})==='invalid'){item.status='attention_required';item.reason='invalid';await atomic(path,queue);return {status:'invalid'}}
  const ps='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
  const common=['-NoProfile','-NonInteractive','-Command'];
  // Fixed task and commands only: queue content is never interpolated into shell code.
  const stateResult=await exec(ps,[...common,"$s=New-Object -ComObject Schedule.Service;$s.Connect();$s.GetFolder('\\').GetTask('HorseRide-Weekly-Video-Preparation').State"],{timeout:15000,windowsHide:true,maxBuffer:20000});
  const taskState=({2:'Queued',3:'Ready',4:'Running'})[Number(stateResult.stdout.trim())]||'Unavailable';
  const library=await maybe(join(app,'data/instagram/native-renderer/episodes',item.episode,'motion-library.json'));
  const production=await maybe(join(root,'weekly-video-production-request.json'));
  const publication=await maybe(join(app,'data/instagram','history-'+item.episode,'publication.json'));
  const action=decideQueue({item,library,production,publication,taskState});
  if(action==='dispatch'){
   await atomic(join(root,'weekly-video-production-request.json'),{status:'pending',episode:item.episode,sceneCount:item.sceneCount,motionFrames:item.motionFrames,expiresAt:item.expiresAt,purpose:'Queued local visual retake; no publication or automatic visual approval'});
   await exec(ps,[...common,"$s=New-Object -ComObject Schedule.Service;$s.Connect();$null=$s.GetFolder('\\').GetTask('HorseRide-Weekly-Video-Preparation').Run($null)"],{timeout:15000,windowsHide:true,maxBuffer:20000});
   item.status='queued';item.dispatchedAt=new Date().toISOString();
  }else if(action==='rendered_pending_visual_review'){item.status=action;item.completedAt=new Date().toISOString()}
  else if(!['waiting','idle'].includes(action)){item.status='attention_required';item.reason=action}
  queue.checkedAt=new Date().toISOString();queue.lastAction=action;queue.codexRequired=false;queue.publishing=false;
  await atomic(path,queue);return {status:action,episode:item.episode,taskState,publishing:false};
 }finally{await handle?.close();await unlink(lock).catch(()=>{})}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))runQueue().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1});
