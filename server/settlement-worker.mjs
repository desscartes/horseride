process.on('disconnect',()=>process.exit(0))
try{
 const {settleForecasts}=await import('./index.mjs')
 await settleForecasts()
 process.send?.({result:{completed:true}},()=>process.disconnect())
}catch(error){process.send?.({error:error.message},()=>process.disconnect())}
