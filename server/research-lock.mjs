import {readFile,writeFile,unlink} from 'node:fs/promises'
import {isProcessRunning} from './process-liveness.mjs'
// Caller must already own the shared collection gate. Unknown/live owners stay protected.
export async function claimResearchLock(path,owner,{alive=isProcessRunning}={}){
 let previous
 try{previous=await readFile(path,'utf8')}catch(e){if(e.code!=='ENOENT')throw e}
 if(previous!==undefined){
  const old=JSON.parse(previous)
  if(alive(old.pid))throw Error(`Research lock owner is still active: ${old.pid}`)
  if(await readFile(path,'utf8')!==previous)throw Error('Research lock ownership changed')
  await unlink(path)
 }
 const token=JSON.stringify({...owner,startedAt:new Date().toISOString()})
 await writeFile(path,token,{flag:'wx'})
 return async()=>{try{if(await readFile(path,'utf8')===token)await unlink(path)}catch(e){if(e.code!=='ENOENT')throw e}}
}
