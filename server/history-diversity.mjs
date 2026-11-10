import {readFile,writeFile,mkdir} from 'node:fs/promises';
export function checkMotionDiversity(clips,used,episode){
 const prior=new Set(used.filter(x=>x.episode!==episode).flatMap(x=>x.assets));
 const assets=[...new Set(Object.values(clips).flatMap(c=>[c.sha256,...(c.sourceId?[c.sourceId]:[])]))];
 const repeated=assets.filter(id=>prior.has(id));
 const missingSourceIds=Object.entries(clips).filter(([,c])=>!c.sourceId).map(([role])=>role);
 const counts=new Map();for(const c of Object.values(clips))for(const id of [c.sha256,c.sourceId].filter(Boolean))counts.set(id,(counts.get(id)||0)+1);
 const repeatedWithinEpisode=[...counts].filter(([,n])=>n>1).map(([id])=>id);
 return {ok:repeated.length===0&&repeatedWithinEpisode.length===0&&missingSourceIds.length===0&&Object.keys(clips).length>=4,assets,repeated,repeatedWithinEpisode,missingSourceIds};
}
export async function requireDistinctHistoryMotion(episode){
 const base='data/instagram/native-renderer';let library,path=base+'/episodes/'+episode.id+'/motion-library.json';
 try{library=JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;path=base+'/motion-library.json';library=JSON.parse(await readFile(path,'utf8'))}
 let ledger={episodes:[]};try{ledger=JSON.parse(await readFile(base+'/motion-use-ledger.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const result=checkMotionDiversity(library.clips,ledger.episodes,episode.id);
 if(library.reviewed!==true){result.ok=false;result.needsReview=true}
 if(!result.ok){
  await mkdir(base+'/asset-requests',{recursive:true});
  await writeFile(base+'/asset-requests/'+episode.id+'.json',JSON.stringify({episode:episode.id,title:episode.title,year:episode.year,sources:episode.sources,status:result.needsReview?'needs_visual_review':'needs_distinct_story_scenes',requiredScenes:4,reason:result.needsReview?'New motion must pass visual review before publication':'Previously published footage must not be recycled',storySpecificLibrary:base+'/episodes/'+episode.id+'/motion-library.json'},null,2));
 }
 return {...result,library:path};
}
export async function recordHistoryMotion(episode,assets,permalink){
 const path='data/instagram/native-renderer/motion-use-ledger.json';let ledger={episodes:[]};try{ledger=JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 if(!ledger.episodes.some(e=>e.episode===episode)){ledger.episodes.push({episode,assets,permalink,recordedAt:new Date().toISOString()});await writeFile(path+'.tmp',JSON.stringify(ledger,null,2));const {rename}=await import('node:fs/promises');await rename(path+'.tmp',path)}
}
