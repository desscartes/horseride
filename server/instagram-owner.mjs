import {execFileSync} from 'node:child_process';
import {isProcessRunning} from './process-liveness.mjs';
export function instagramProcessIdentity(pid){
 if(!Number.isSafeInteger(pid)||pid<1)return undefined;
 try{
  const script=`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}' -ErrorAction Stop;if(-not $p){'null'}else{@{start=([DateTimeOffset]$p.CreationDate).ToUnixTimeMilliseconds();instagram=(($p.CommandLine -like '*run-instagram-agent.mjs*') -or ($p.CommandLine -like '*run-history-reel.mjs*'))}|ConvertTo-Json -Compress}`;
  return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:8000}).trim());
 }catch{return undefined}
}
export function instagramOwnerActive(owner,{running=isProcessRunning,identity=instagramProcessIdentity}={}){
 if(!Number.isSafeInteger(owner?.pid)||owner.pid<1)return true;
 if(!running(owner.pid))return false;
 const current=identity(owner.pid);
 if(current===null)return false;
 if(!current)return true; // Access denied must not break another live job's lock.
 return current.instagram===true&&(!owner.startedAt||owner.startedAt===current.start);
}
