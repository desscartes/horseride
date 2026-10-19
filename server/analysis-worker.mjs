process.on('disconnect',()=>process.exit(0))
const [date,city,priority,mode]=process.argv.slice(2)
try{
 const {getOrCreateDailyAnalysis,getValidDailyAnalysis}=await import('./index.mjs')
 const result=mode==='cache-only'?{record:getValidDailyAnalysis(date,city),cached:true}:await getOrCreateDailyAnalysis(date,city,progress=>process.send?.({progress}),Number(priority)||null)
 process.send?.({result},()=>process.disconnect())
}catch(error){process.send?.({error:error.message,code:error.code,status:error.status},()=>process.disconnect())}
