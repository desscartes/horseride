process.env.HORSERIDE_NO_LISTEN='1'
const {buildFreshProgramPayload}=await import('./index.mjs')
const {publishProgram}=await import('./served-program.mjs')
const date=process.argv[2]
try{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid program date')
 const payload=await buildFreshProgramPayload(new Date(`${date}T12:00:00`),'Tümü')
 publishProgram(date,payload)
 process.send?.({ok:true});process.disconnect?.()
}catch(error){process.send?.({ok:false,error:error.message});process.disconnect?.();process.exitCode=1}
