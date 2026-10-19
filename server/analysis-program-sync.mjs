// A queued refresh may include slow, unrelated days. Once another collector has
// published matching entries, commentary can proceed without waiting for that
// queue. The background refresh still completes and all later entry guards stay.
export async function waitForAnalysisProgram({matches,refresh,timeoutMs=20000,pollMs=250}){
 if(matches())return
 let settled=false,failure
 Promise.resolve().then(refresh).catch(error=>{failure=error}).finally(()=>{settled=true})
 const deadline=Date.now()+timeoutMs
 for(;;){
  if(matches())return
  if(settled&&failure)throw failure
  if(Date.now()>=deadline)throw Object.assign(Error('Güncel program hazırlanıyor; hazır yorumlar korunuyor.'),{code:'program_sync_pending',status:503})
  await new Promise(resolve=>setTimeout(resolve,pollMs))
 }
}
