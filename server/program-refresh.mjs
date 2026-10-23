process.env.HORSERIDE_NO_LISTEN='1'
process.env.HORSERIDE_FAST_PROGRAM='1'
const {buildFreshProgramPayload,enrichPublishedProfiles}=await import('./index.mjs')
const {publishProgram}=await import('./served-program.mjs')
const {retrySqliteBusy}=await import('./sqlite-retry.mjs')
const date=process.argv[2]
try{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid program date')
 const payload=await retrySqliteBusy(()=>buildFreshProgramPayload(new Date(`${date}T12:00:00`),'Tümü'))
 publishProgram(date,payload)
 process.send?.({ok:true});process.disconnect?.()
 const {spawnSync}=await import('node:child_process')
 const jockeyRefresh=spawnSync(process.execPath,['--use-system-ca','server/refresh-jockey-context.mjs',date],{windowsHide:true,stdio:'inherit',timeout:180000,env:process.env})
 if(jockeyRefresh.status!==0)console.error('Jockey context refresh incomplete:',jockeyRefresh.error?.message||jockeyRefresh.status)
 const {captureApplicationTickets}=await import('./application-report-service.mjs')
 await Promise.all([retrySqliteBusy(()=>captureApplicationTickets(date)),retrySqliteBusy(()=>enrichPublishedProfiles(date))])
 const {refreshSurpriseEvidence}=await import('./refresh-surprise-evidence.mjs')
 refreshSurpriseEvidence(date)
}catch(error){console.error('Program refresh failed:',error.message);process.send?.({ok:false,error:error.message});process.disconnect?.();process.exitCode=1}
