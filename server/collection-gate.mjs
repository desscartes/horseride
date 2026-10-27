import {registerCollectionWaiter} from './collection-queue.mjs'
import {mkdirSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs'
import {join} from 'node:path'
import {isProcessRunning} from './process-liveness.mjs'
export function tryCollectionGate({directory='data/maintenance',pid=process.pid,inheritedOwner=process.env.HORSERIDE_COLLECTION_OWNER,alive=isProcessRunning}={}){
 mkdirSync(directory,{recursive:true});const path=join(directory,'collection-gate.lock')
 let old;try{old=JSON.parse(readFileSync(path,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 if(old){if(String(old.pid)===inheritedOwner&&alive(old.pid))return {acquired:true,inherited:true,owner:old.pid,release:()=>{}};if(alive(old.pid))return {acquired:false};try{const current=JSON.parse(readFileSync(path,'utf8'));if(current.pid!==old.pid||current.startedAt!==old.startedAt)return {acquired:false};unlinkSync(path)}catch(e){if(e.code!=='ENOENT')throw e}}
 for(const name of ['morning.lock','daily.lock','intelligence-training.lock','intraday-collection.lock']){try{const o=JSON.parse(readFileSync(join(directory,name),'utf8'));if(o.pid!==pid&&alive(o.pid))return {acquired:false}}catch(e){if(e.code!=='ENOENT')throw e}}
 const startedAt=new Date().toISOString();try{writeFileSync(path,JSON.stringify({pid,startedAt}),{flag:'wx'})}catch(e){if(e.code==='EEXIST')return {acquired:false};throw e}
 return {acquired:true,inherited:false,owner:pid,release:()=>{try{const o=JSON.parse(readFileSync(path,'utf8'));if(o.pid===pid&&o.startedAt===startedAt)unlinkSync(path)}catch(e){if(e.code!=='ENOENT')throw e}}}
}
export async function acquireCollectionGate(){
 // Nested children already belong to their parent's owner; never enqueue them behind it.
 if(process.env.HORSERIDE_COLLECTION_OWNER){const inherited=tryCollectionGate();if(inherited.acquired&&inherited.inherited)return inherited;if(inherited.acquired){inherited.release()}}
 const waiter=registerCollectionWaiter();process.once('exit',waiter.release)
 try{for(;;){if(waiter.isNext()){const gate=tryCollectionGate();if(gate.acquired){if(!gate.inherited){process.env.HORSERIDE_COLLECTION_OWNER=String(gate.owner);process.once('exit',()=>gate.release())}return gate}}await new Promise(r=>setTimeout(r,15000))}}
 finally{waiter.release();process.removeListener('exit',waiter.release)}
}
