import{execFile}from'node:child_process';import{promisify}from'node:util';import{writeFile}from'node:fs/promises';import{acquireMediaUploadLock}from'./media-upload-lock.mjs';
const run=promisify(execFile),report={checkedAt:new Date().toISOString(),status:'starting',profile:process.env.USERPROFILE,localAppData:process.env.LOCALAPPDATA};
let release;try{
 release=await acquireMediaUploadLock(undefined,{timeout:20000});
 const result=await run('D:/Tools/HorseRideGit/cmd/git.exe',['-c','credential.interactive=false','push','origin','HEAD:refs/heads/instagram-media'],{cwd:'data/instagram/media-repo',windowsHide:true,timeout:30000,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
 report.status='passed';report.message=result.stderr.slice(0,500);
}catch(e){let msg=String(e.stderr||e.message);report.status='failed';report.code=e.code;report.killed=e.killed;report.authenticationFailure=/auth|credential|username|terminal prompts|permission|403/i.test(msg);report.nonFastForward=/non-fast-forward|fetch first|rejected/i.test(msg);report.message=msg.replace(/https:\/\/[^/\s]+@/g,'https://[redacted]@').replace(/gh[pousr]_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+/g,'[redacted]').slice(0,1800);
}finally{if(release)await release()}
await writeFile('data/maintenance/native-media-upload-probe.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
