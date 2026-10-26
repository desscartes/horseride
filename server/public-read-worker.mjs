import {parentPort} from 'node:worker_threads'
process.env.HORSERIDE_NO_LISTEN='1'
parentPort.on('message',async({id,kind,options})=>{
 try{
  let value
  if(kind==='report'){const m=await import('./application-report-service.mjs');value=m.applicationReport(options)}
  else if(kind==='simulation'){const m=await import('./simulation-service.mjs');value=m.simulationReport()}
  else if(kind==='horse'){const m=await import('./database.mjs');value={name:options.name,historyKind:'saved_program_predictions',entries:m.findHorseHistory(options.name)}}
  else throw Error('Unknown public read')
  parentPort.postMessage({id,value})
 }catch(e){parentPort.postMessage({id,error:e.message})}
})
