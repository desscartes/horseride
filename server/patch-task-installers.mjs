import {readFile,writeFile,copyFile} from 'node:fs/promises';
const ig='server/install-instagram-agent.ps1',early='server/install-early-pipeline.ps1';
for(const file of [ig,early]){
 let s=await readFile(file,'utf8');if(s.includes('Preserve unattended Password principal'))continue;
 await copyFile(file,file+'.before-unattended-20261102');
 if(file===ig){
  s=s.replace("-ExecutionTimeLimit (New-TimeSpan -Minutes 10) -Hidden","-ExecutionTimeLimit (New-TimeSpan -Hours 1) -WakeToRun -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 2) -Hidden");
  s=s.replace("Register-ScheduledTask -TaskName 'HorseRide-Instagram-Agent'",`# Preserve unattended Password principal and Windows-stored credential.\n$existing=Get-ScheduledTask -TaskName 'HorseRide-Instagram-Agent' -ErrorAction SilentlyContinue\nif($existing -and $existing.Principal.LogonType -eq 'Password'){\n Set-ScheduledTask -TaskName $existing.TaskName -Action $action -Settings $settings | Out-Null\n return\n}\nRegister-ScheduledTask -TaskName 'HorseRide-Instagram-Agent'`);
 } else {
  s=s.replace('-ExecutionTimeLimit (New-TimeSpan -Hours 4) -Hidden','-ExecutionTimeLimit (New-TimeSpan -Hours 4) -WakeToRun -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 2) -Hidden');
  s=s.replace('    Register-ScheduledTask -TaskName $task.Name',`    # Preserve unattended Password principal and Windows-stored credential.\n    $existing=Get-ScheduledTask -TaskName $task.Name -ErrorAction SilentlyContinue\n    if($existing -and $existing.Principal.LogonType -eq 'Password'){\n        Set-ScheduledTask -TaskName $task.Name -Action $action -Settings $settings -Trigger $trigger | Out-Null\n        continue\n    }\n    Register-ScheduledTask -TaskName $task.Name`);
 }
 await writeFile(file,s);
}
