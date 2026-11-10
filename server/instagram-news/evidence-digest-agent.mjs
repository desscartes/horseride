import{readFile,writeFile,mkdir,copyFile,rename}from'node:fs/promises';import{execFile}from'node:child_process';import{promisify}from'node:util';import{buildEvidenceDigest}from'./evidence-digest.mjs';import{loadRankingModel}from'../ranking.mjs';import{uploadImages,publish,sha}from'../instagram-agent-io.mjs';import{readPublicationCadence}from'./cadence.mjs';import{analysisEntryFingerprint}from'../analysis-entry-policy.mjs';
const evidenceSignature=rows=>sha(JSON.stringify(rows.map(r=>({city:r.city,no:r.no,method:r.rankingMethod,evidence:r.rankingEvidence,horses:r.horses.filter(h=>!h.outOfRace).map(h=>({no:h.no,score:h.rankingScore,comparison:h.rankingComparison,performance:h.performanceEvidence,pastRuns:h.horsePerformance?.pastRuns,workouts:h.workouts}))}))));
const exec=promisify(execFile),json=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''));
export async function publishEvidenceDigest({day,report,config}){
 const root='data/instagram',id='evidence-rich-'+day+'-tr',dir=root+'/'+id;
 try{
 let old=null;try{old=await json(dir+'/publication.json')}catch(e){if(e.code!=='ENOENT')throw e}if(old?.status==='published_verified'||old?.mediaId)return;if(old?.status==='publishing_unknown')throw Error('Unknown outcome requires reconciliation');
 const cadence=await readPublicationCadence(root,day,new Date().toISOString(),config);if(!cadence.due)return;
 const program=await json('data/program-cache/'+day+'.json'),model=loadRankingModel({metadataOnly:true})?.metadata,digest=buildEvidenceDigest(program,model);if(!digest){report.blocked.push({reason:'evidence_digest_no_current_future_races'});return}
 await mkdir(dir,{recursive:true});let manifest=null;try{manifest=await json(dir+'/manifest.json')}catch(e){if(e.code!=='ENOENT')throw e}
 const fingerprint=analysisEntryFingerprint(digest.races.map(r=>r.entryRace));
 if(manifest&&(manifest.entryFingerprint!==fingerprint||Date.parse(manifest.expiresAt)<=Date.now())){
  if(old&&!['container_created','ready'].includes(old.status))throw Error('Prepared publication outcome needs reconciliation');
  await mkdir(root+'/retired',{recursive:true});await rename(dir,root+'/retired/'+id+'-'+Date.now());await mkdir(dir,{recursive:true});manifest=null;old=null;
 }
 if(!manifest){
  await writeFile(dir+'/digest.json',JSON.stringify(digest,null,2));await exec(process.execPath,['server/instagram-news/render-evidence-digest.mjs',dir+'/digest.json',dir],{windowsHide:true,timeout:90000,maxBuffer:5000});
  const images=await uploadImages(id,digest.races.map((_,i)=>dir+'/slide-'+(i+1)+'.jpg'));await copyFile(dir+'/slide-1.jpg',dir+'/image.jpg');
  manifest={id,account:'ganyan_zekasi',instagramId:'17841441483231653',date:day,kind:'evidence_rich_model_comments',entryFingerprint:fingerprint,modelEvidenceSignature:evidenceSignature(digest.races.map(r=>r.entryRace)),metadataSignature:sha(JSON.stringify(model)),races:digest.races.map(r=>({city:r.city,no:r.raceNo})),expiresAt:new Date(Math.min(...digest.races.map(r=>Date.parse(`${r.scheduledDate??day}T${r.start.replace('.',':')}:00+03:00`)))-10*60000).toISOString(),localImage:'image.jpg',imageSha256:images[0].sha256,imageUrl:images[0].url,images,caption:await readFile(dir+'/caption.txt','utf8'),altText:'Erişilen Türkiye verileri içinde kapsamı en geniş koşuların somut veri sayıları ve atlara özgü yorumları.'};await writeFile(dir+'/manifest.json',JSON.stringify(manifest,null,2));
 }
 await publish(id,'Prepare');
 const latest=await json('data/program-cache/'+day+'.json'),rows=manifest.races.map(x=>latest.races.find(r=>r.city===x.city&&r.no===x.no));if(rows.some(r=>!r)||analysisEntryFingerprint(rows)!==manifest.entryFingerprint)throw Error('Evidence inputs changed before publication');
 if(evidenceSignature(rows)!==manifest.modelEvidenceSignature||sha(JSON.stringify(loadRankingModel({metadataOnly:true})?.metadata))!==manifest.metadataSignature)throw Error('Serving model or evidence changed before publication');
 if(rows.some(r=>{const t=Date.parse(latest.cityFetchedAt?.[r.city]??latest.fetchedAt);return !Number.isFinite(t)||t>Date.now()||Date.now()-t>120*60000}))throw Error('Evidence source became stale');
 await publish(id,'Publish');const state=await json(dir+'/publication.json');if(state.status==='published_verified')report.published.push({kind:'evidence_rich_model_comments',url:state.permalink});
 }catch(error){try{await mkdir(dir,{recursive:true});await writeFile(dir+'/error.json',JSON.stringify({at:new Date().toISOString(),code:error.code,message:String(error.message).slice(0,200),stderr:String(error.stderr??'').replace(/https:\/\/[^/\s]+@/g,'https://[redacted]@').replace(/gh[pousr]_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+/g,'[redacted]').slice(0,2500)},null,2))}catch{};report.blocked.push({reason:'evidence_digest_failed',detail:String(error.message).slice(0,160)})}
}
