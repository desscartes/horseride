import{mkdirSync,writeFileSync}from'node:fs';import{resolve,join}from'node:path';
export function deferForecastRow(row,{directory=resolve('data/forecast-write-spool'),now=()=>new Date()}={}){
 const spooledAt=now().toISOString();
 if(row.capturedAt>=row.start||spooledAt>=row.start)throw Error('Post-start forecast cannot enter deferred history');
 mkdirSync(directory,{recursive:true});
 try{writeFileSync(join(directory,row.id+'.json'),JSON.stringify({...row,spooledAt}),{flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e}
}
