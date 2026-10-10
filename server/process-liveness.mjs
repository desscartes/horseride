import {execFileSync} from 'node:child_process'
function windowsProcessExists(pid){
  const script=`try { Get-Process -Id ${pid} -ErrorAction Stop | Out-Null; 'alive' } catch { if ($_.CategoryInfo.Category -eq 'ObjectNotFound') { 'missing' } else { 'unknown' } }`
  const output=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:5000}).trim()
  return output==='missing'?false:true
}
export function isProcessRunning(pid,{probe=process.kill,platform=process.platform,windowsProbe=windowsProcessExists}={}){
  if(!Number.isSafeInteger(pid)||pid<=0)return true // Malformed ownership stays protected.
  try{probe(pid,0);return true}catch(error){
    if(error.code==='ESRCH')return false
    if(error.code==='EPERM'&&platform==='win32')try{return windowsProbe(pid)}catch{return true}
    return true
  }
}
