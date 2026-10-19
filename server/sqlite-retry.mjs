import {setTimeout as delay} from 'node:timers/promises'

// Retry only transient contention. Validation and source failures remain visible.
export async function retrySqliteBusy(action,{attempts=3,wait=delay}={}){
 for(let attempt=0;;attempt++){
  try{return await action()}
  catch(error){
   if(attempt+1>=attempts||!(/database is (?:locked|busy)/i.test(error.message)||error.code==='SQLITE_BUSY'))throw error
   await wait(1000*(attempt+1))
  }
 }
}
