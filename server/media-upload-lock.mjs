import{open,readFile,unlink,mkdir}from'node:fs/promises';import{dirname}from'node:path';import{randomUUID}from'node:crypto';
import{isProcessRunning}from'./process-liveness.mjs';
export async function acquireMediaUploadLock(path='data/instagram/media-upload.lock',{timeout=120000}={}){
 await mkdir(dirname(path),{recursive:true});const token=randomUUID(),until=Date.now()+timeout;
 for(;;){
  try{const h=await open(path,'wx');await h.writeFile(JSON.stringify({pid:process.pid,token}));await h.close();return async()=>{try{const o=JSON.parse(await readFile(path,'utf8'));if(o.token===token)await unlink(path)}catch(e){if(e.code!=='ENOENT')throw e}}}
  catch(e){if(e.code!=='EEXIST')throw e}
  try{const o=JSON.parse(await readFile(path,'utf8'));if(!isProcessRunning(o.pid)){await unlink(path);continue}}catch(e){if(e.code==='ENOENT')continue;throw e}
  if(Date.now()>=until)throw Error('Media upload already owned; no parallel Git mutation');
  await new Promise(r=>setTimeout(r,500));
 }
}
