import {readFile,writeFile,rename,readdir,mkdir,open,unlink,stat,appendFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';import {fileURLToPath} from 'node:url';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {legacyPublications,raceStart} from './instagram-news/daily-scope-plan.mjs';
const exec=promisify(execFile);
export const dayAt=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
const at=(day,clock)=>Date.parse(`${day}T${clock}+03:00`);
const verified=p=>p?.status==='published_verified'&&/^\d+$/.test(p.mediaId||'')&&/^https:\/\/www\.instagram\.com\//.test(p.permalink||'');
export function deliveryPlan({day,now,program,publications=[],history={},agent={},stock={},libraries=[],config={},nextGazi,dailyPolicy={},dailyEngine={},dailyStock=[],rollingStock={}}){
 const rows=[],alerts=[];const friday=new Date(day+'T12:00:00+03:00').getUTCDay()===5;
 const historical=publications.filter(x=>verified(x.publication)&&Number.isFinite(Date.parse(x.publication.publishedAt||x.publication.verifiedAt))&&dayAt(Date.parse(x.publication.publishedAt||x.publication.verifiedAt))===day&&x.manifest.kind==='historical_reel'&&(!friday||x.manifest.storySeries==='gazi'));
 const due=at(day,`${String(config.historyPublishFromHour??11).padStart(2,'0')}:00:00`);
 const video={id:friday?'friday_gazi':'daily_history',kind:'video',dueAt:due,deadlineAt:due+15*60000,phase:historical.length?'published':now<due?'scheduled':now>due+15*60000?'overdue':'due',permalink:historical[0]?.publication.permalink,blocker:history.day===day?history.status:null};rows.push(video);
 if(video.phase!=='published'&&now>=at(day,'09:00:00')){
  const key=s=>String(s).toLocaleLowerCase('tr-TR').replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
  const chosen=libraries.filter(x=>!x.published&&x.integrity===true&&x.library.reviewed===true&&(friday?x.id===nextGazi:history.episode?x.id===history.episode:x.episode?.venueAliases?.some(a=>(program?.races||[]).some(r=>key(r.city).startsWith(key(a))))));
  if(!dailyPolicy.enabled&&!chosen.length)alerts.push({code:'video_no_reviewed_stock',severity:'critical',subject:video.id,reason:'Yayın öncesi kullanılabilir, incelenmiş video stoku yok. Görsel kontrolü otomatik geçilmez.'});
  if(dailyPolicy.enabled){
   const blocked=['source_bank_empty','program_missing','quality_revision_required','speech_revision_required','story_revision_required','publication_reconciliation_required','failed'];
   if(blocked.includes(dailyEngine.status))alerts.push({code:'daily_video_'+dailyEngine.status,severity:'critical',subject:video.id,reason:dailyEngine.reason||dailyEngine.error||'Günlük video akışında tamamlanmamış aşama var.'});
   if(dailyEngine.day!==day||!dailyEngine.checkedAt||now-Date.parse(dailyEngine.checkedAt)>15*60000)alerts.push({code:'daily_video_worker_stale',severity:'critical',subject:video.id,reason:'Yerel günlük üretimden son 15 dakikada güncel durum alınamadı.'});
  }
 }
 if(dailyPolicy.enabled&&dailyStock.length<7)alerts.push({code:'daily_video_source_stock_low',severity:'critical',subject:'daily_history',reason:`Kullanılmamış kaynaklı hikâye paketi ${dailyStock.length}; hedef en az 7. Stok tükenmeden kaynak hazırlığı gerekiyor.`});
 if(dailyPolicy.enabled&&dailyEngine.day===day&&dailyEngine.status==='replacement_waiting_for_removal')alerts.push({code:'rejected_video_replacement_waiting',severity:'critical',subject:'daily_history',reason:'Kullanıcının reddettiği eski Reels kaldırılmadan yeni dosya yayımlanamaz. Yeni videonun kalite kontrolleri ayrıca zorunludur.'});
 if(dailyPolicy.enabled)for(const row of rollingStock.days||[]){
  if(row.day<=day)continue;
  if(['source_package_missing','preflight_revision_required','quality_revision_required','story_revision_required','failed'].includes(row.status))alerts.push({code:'video_future_preflight_blocked',severity:'critical',subject:row.day,reason:`${row.day}: ${row.series==='gazi'?'Sıradaki Gazi '+row.requiredYear+' bölümü: ':''}${row.status}. Ön hazırlık tamamlanmadan hazır video sayılmaz.`});
 }
 if(!program?.races?.length&&now>=at(day,'06:30:00'))alerts.push({code:'program_missing',severity:'critical',reason:'Bugünün programı yok; koşu gönderilerinin kapsamı doğrulanamıyor.'});
 const cities=[...new Set((program?.races||[]).map(r=>r.city))];
 if(config.racePublicationMode==='daily_scopes'){
  for(const scope of ['domestic','foreign']){
   const meetings=(program?.meetings||[]).filter(m=>m.foreign===(scope==='foreign')),races=(program?.races||[]).filter(r=>meetings.some(m=>m.city===r.city));if(!races.length)continue;
   const starts=races.map(r=>raceStart(r,day)).filter(Number.isFinite),future=starts.filter(t=>t>now+10*60000);if(!starts.length)continue;
   const first=Math.min(...(future.length?future:starts)),cutoff=first-10*60000,target=first-90*60000;
   const found=publications.filter(x=>x.manifest.date===day&&x.manifest.kind==='daily_race_scope'&&x.manifest.scope===scope),complete=found.find(x=>verified(x.publication)),unknown=found.some(x=>x.publication.status==='publishing_unknown');
   const legacy=legacyPublications(publications,day,scope),transition=!complete&&legacy.length>0;
   const state=agent.dailyScopes?.date===day?agent.dailyScopes.scopes.find(s=>s.scope===scope):null;
   rows.push({id:'race_scope:'+scope,scope,kind:'race_scope',dueAt:target,deadlineAt:cutoff,firstStartAt:first,raceCount:races.length,upcomingRaces:future.length,phase:complete?'published':unknown?'uncertain':transition?'legacy_transition':now>=cutoff?'missed':now>=target?'due':'scheduled',permalinks:complete?[complete.publication.permalink]:[],legacyPosts:transition?legacy.map(p=>p.id):[],blocker:unknown?'publication_outcome_unknown':state?.status||null});
   if(transition)alerts.push({code:'daily_scope_legacy_transition',severity:'notice',subject:scope,reason:'Bugün eski düzende yarış gönderileri zaten yayımlanmış. Aynı içerik yeniden gönderilmiyor; sonraki gün tek toplu gönderi kullanılacak.'});
  }
 }else{
 for(const city of cities){
  const races=program.races.filter(r=>r.city===city);const starts=races.map(r=>at(r.scheduledDate||day,String(r.time).replace('.',':')+':00')).filter(Number.isFinite);if(!starts.length)continue;
  const first=Math.min(...starts),cutoff=first-10*60000,target=first-90*60000;
  const all=publications.filter(x=>x.manifest.date===day&&['race_model_cards','foreign_race_model_cards'].includes(x.manifest.kind)&&x.manifest.city===city);
  const parts=Math.ceil(races.length/10),found=new Set(all.filter(x=>verified(x.publication)).map(x=>x.manifest.part||1));
  const complete=Array.from({length:parts},(_,i)=>i+1).every(p=>found.has(p));
  const unknown=all.some(x=>x.publication?.status==='publishing_unknown');
  const blocked=(agent.day===day?agent.blocked||[]:[]).filter(b=>b.city===city);
  rows.push({id:'race:'+city,city,kind:'race',dueAt:target,deadlineAt:cutoff,firstStartAt:first,parts,verifiedParts:found.size,permalinks:all.filter(x=>verified(x.publication)).map(x=>x.publication.permalink),phase:complete?'published':unknown?'uncertain':now>=cutoff?'missed':now>=target?'due':'scheduled',blocker:unknown?'publication_outcome_unknown':blocked.map(b=>b.reason).join(',')||null});
 }
 }
 for(const row of rows)if(['overdue','missed','uncertain'].includes(row.phase))alerts.push({code:'publication_'+row.phase,severity:'critical',subject:row.id,reason:row.blocker||'Beklenen gönderinin doğrulanmış yayın kaydı yok.'});
 if(stock.status==='failed')alerts.push({code:'video_generation_failed',severity:'critical',subject:stock.episode,reason:stock.error||'Yerel sahne üretimi başarısız.'});
 const recoverable=rows.some(r=>['due','overdue'].includes(r.phase)&&!['paused_for_editorial_review','waiting_for_distinct_story_scenes'].includes(r.blocker));
 return {day,checkedAt:new Date(now).toISOString(),status:alerts.length?'attention_required':'healthy',rows,alerts,recoverPublisher:recoverable,codexRequired:false,unreviewedMediaAutoApproved:false};
}
export function recoveryAllowed({state,lastAttempt,now,needed}){return !!needed&&state===3&&(!lastAttempt||now-Date.parse(lastAttempt)>5*60000)}
const maybe=async p=>{try{return JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''))}catch(e){if(e.code==='ENOENT')return null;throw e}};
const atomic=async(p,v)=>{const tmp=p+'.'+process.pid+'.tmp';await writeFile(tmp,JSON.stringify(v,null,2));await rename(tmp,p)};
async function nativeTasks(start){
 const fixed="$s=New-Object -ComObject Schedule.Service;$s.Connect();$f=$s.GetFolder('\\');";
 const code=start?fixed+"$null=$f.GetTask('HorseRide-Instagram-Agent').Run($null);'started'":fixed+"@('HorseRide-Instagram-Agent','HorseRide-Weekly-Video-Preparation')|ForEach-Object{$t=$f.GetTask($_);@{name=$_.ToString();state=[int]$t.State;lastRun=$t.LastRunTime.ToUniversalTime().ToString('o');lastResult=$t.LastTaskResult;enabled=$t.Enabled}}|ConvertTo-Json -Compress";
 const r=await exec('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-Command',code],{windowsHide:true,timeout:15000,maxBuffer:30000});return start?r.stdout.trim():JSON.parse(r.stdout.replace(/^\uFEFF/,''));
}
export async function runWatchdog(app='D:/Apps/HorseRide'){
 const maintenance=join(app,'data/maintenance'),root=join(app,'data/instagram'),lock=join(maintenance,'publication-watchdog.lock');await mkdir(maintenance,{recursive:true});let handle;
 try{handle=await open(lock,'wx')}catch(e){if(e.code!=='EEXIST')throw e;if(Date.now()-(await stat(lock)).mtimeMs<2*60000)return {status:'already_running'};await unlink(lock);handle=await open(lock,'wx')}
 try{
  const now=Date.now(),day=dayAt(now),[config,program,history,agent,stock]=await Promise.all([maybe(join(root,'agent-config.json')),maybe(join(app,`data/program-cache/${day}.json`)),maybe(join(root,'history-status.json')),maybe(join(root,'agent-status.json')),maybe(join(root,'weekly-stock/status.json'))]);
  if(!config?.enabled)return {status:'publishing_disabled'};
  const publications=[];for(const d of await readdir(root,{withFileTypes:true})){if(!d.isDirectory()||['media-repo','retired'].includes(d.name))continue;const publication=await maybe(join(root,d.name,'publication.json'));if(publication){const manifest=await maybe(join(root,d.name,'manifest.json'));if(manifest)publications.push({id:d.name,publication,manifest})}}
  const series=await maybe(join(root,'gazi-series/ledger.json'));const nextYear=Math.max(1926,...(series?.episodes||[]).filter(x=>x.status==='published_verified').map(x=>x.year))+1;
  const catalog=await maybe(join(root,'history-catalog.json'));
  const ledger=await maybe(join(root,'native-renderer/motion-use-ledger.json'));
  const used=new Set((ledger?.episodes||[]).flatMap(x=>x.assets||[]));
  const libraries=[];try{for(const d of await readdir(join(root,'native-renderer/episodes'),{withFileTypes:true})){if(!d.isDirectory())continue;const folder=resolve(root,'native-renderer/episodes',d.name),library=await maybe(join(folder,'motion-library.json'));if(library){
   const published=publications.some(p=>p.id==='history-'+d.name&&verified(p.publication));let integrity=false;
   if(!published&&library.reviewed===true){try{const seen=new Set();integrity=Object.keys(library.clips||{}).length>=4;for(const c of Object.values(library.clips||{})){const p=resolve(folder,c.file);if(!p.startsWith(folder+'\\')||!c.sourceId||seen.has(c.sourceId)||used.has(c.sourceId)||used.has(c.sha256))throw Error('Source/path validation failed');seen.add(c.sourceId);if(createHash('sha256').update(await readFile(p)).digest('hex')!==c.sha256)throw Error('Clip hash changed')}}catch{integrity=false}}
   libraries.push({id:d.name,library,published,integrity,episode:catalog?.episodes?.find(e=>e.id===d.name)});
  }}}catch(e){if(e.code!=='ENOENT')throw e}
  const dailyPolicy=await maybe(join(root,'daily-history-policy.json'))||{},dailyEngine=await maybe(join(maintenance,'daily-history-engine.json'))||{};
  const dailyStock=[];const usedEpisodeIds=new Set(publications.filter(p=>verified(p.publication)).map(p=>p.manifest.episodeId));
  for(const entry of await readdir(root,{withFileTypes:true})){if(!entry.isDirectory()||!entry.name.startsWith('history-'))continue;const pack=await maybe(join(root,entry.name,'story-package.json'));if(pack?.sourceReviewed&&pack.editorialStory?.version==='specific-reported-story-v1'&&!usedEpisodeIds.has(pack.id))dailyStock.push(pack.id)}
  const activeHistory=dailyPolicy.enabled&&dailyEngine.day===day?{...history,...dailyEngine}:history||{};
  const rollingStock=await maybe(join(maintenance,'history-rolling-stock.json'))||{};
  const report=deliveryPlan({day,now,program,history:activeHistory,agent:agent||{},stock:stock||{},libraries,config,publications,nextGazi:'gazi-'+nextYear,dailyPolicy,dailyEngine,dailyStock,rollingStock});
  report.pid=process.pid;report.context=process.argv.find(a=>a.startsWith('--context='))?.slice(10)||'manual';
  const tomorrow=new Date(Date.parse(day+'T12:00:00+03:00')+86400000).getUTCDay();
  if(tomorrow===5&&now>=at(day,'12:00:00')&&!libraries.some(x=>x.id==='gazi-'+nextYear&&!x.published&&x.integrity&&x.library.reviewed===true))report.alerts.push({code:'friday_gazi_preflight_missing',severity:'critical',reason:'Yarınki Gazi videosunun incelenmiş sahneleri hazır değil; yayın saatine bırakılmamalı.'});
  const sourceCandidates=(catalog?.episodes||[]).filter(e=>e.reviewed&&e.sources?.length&&(e.interestingStory||e.id==='gazi-'+nextYear)&&!publications.some(p=>p.id==='history-'+e.id&&verified(p.publication)));
  report.sourceInventory={reviewedUnusedStories:sourceCandidates.length,weeklyTarget:7,currentProductionPlanned:stock?.planned||0};
  if(sourceCandidates.length<7)report.alerts.push({code:'weekly_story_source_shortage',severity:'warning',reason:`Haftalık kaynak havuzunda ${7-sourceCandidates.length} hikâye eksik. Eksik içerik uydurulmayacak.`});
  const prior=await maybe(join(maintenance,'publication-recovery-state.json'))||{};
  prior.remoteChecks ||= {};
  const toVerify=publications.find(p=>verified(p.publication)&&/^[a-z0-9-]{1,90}$/.test(p.id)&&report.rows.some(r=>r.permalink===p.publication.permalink||r.permalinks?.includes(p.publication.permalink))&&now-Date.parse(p.publication.verifiedAt||'1970-01-01')>6*3600000&&(!Object.hasOwn(prior.remoteChecks,p.id)||now-Date.parse(prior.remoteChecks[p.id])>30*60000));
  if(toVerify){
   prior.remoteChecks[toVerify.id]=new Date(now).toISOString();await atomic(join(maintenance,'publication-recovery-state.json'),prior);
   try{await exec('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(app,'server/publish-instagram-introduction.ps1'),'-PublicationId',toVerify.id,'-Mode','Verify'],{timeout:60000,windowsHide:true,maxBuffer:100000});report.remoteVerification={id:toVerify.id,status:'verified_read_only'}}
   catch{report.alerts.push({code:'publication_remote_verification_failed',severity:'critical',subject:toVerify.id,reason:'Instagram üzerindeki gönderi yeniden doğrulanamadı; körlemesine tekrar yayın yapılmadı.'})}
  }
  try{
   report.tasks=await nativeTasks(false);const publisher=report.tasks.find(t=>t.name==='HorseRide-Instagram-Agent');
   if(publisher?.state===4&&now-Date.parse(publisher.lastRun)>15*60000)report.alerts.push({code:'publisher_stalled',severity:'critical',reason:'Yayın görevi 15 dakikadan uzun süredir çalışıyor; başka kopya başlatılmadı.'});
   if(publisher?.enabled===false)report.alerts.push({code:'publisher_disabled',severity:'critical',reason:'Windows yayın görevi devre dışı.'});
   if(recoveryAllowed({state:publisher?.state,lastAttempt:prior.lastAttempt,now,needed:report.recoverPublisher})){
    prior.lastAttempt=new Date(now).toISOString();await atomic(join(maintenance,'publication-recovery-state.json'),prior);
    report.recovery=await nativeTasks(true); // Same task, existing preflight/locks/freshness checks, never a direct Publish.
   }
  }catch(e){report.alerts.push({code:'native_recovery_unavailable',severity:'critical',reason:String(e.message).slice(0,160)})}
  report.status=report.alerts.length?'attention_required':'healthy';
  const signature=JSON.stringify(report.alerts.map(a=>[a.code,a.subject]));const previous=await maybe(join(maintenance,'publication-watchdog-latest.json'));
  if(signature!==JSON.stringify((previous?.alerts||[]).map(a=>[a.code,a.subject])))await appendFile(join(maintenance,'publication-delivery-events.jsonl'),JSON.stringify({at:report.checkedAt,alerts:report.alerts})+'\n');
  if(report.alerts.some(a=>a.severity==='critical')&&(!prior.lastNotification||now-Date.parse(prior.lastNotification)>30*60000)){
   prior.lastNotification=new Date(now).toISOString();
   try{await exec('C:/Windows/System32/msg.exe',['desscartes','/TIME:60','Ganyan Zekası: paylaşım akışında eksik veya engel var. D:\\Apps\\HorseRide\\Paylasim-Durumu.cmd dosyasını açın.'],{timeout:8000,windowsHide:true,maxBuffer:2000});report.localNotification='sent_to_local_windows_session'}catch{report.localNotification='no_reachable_windows_session';}
   await atomic(join(maintenance,'publication-recovery-state.json'),prior);
  }
  report.notificationLimit='Windows bildirimi oturum açıkken ulaşabilir; kapalı oturumda kalıcı yerel alarm dosyası tutulur.';
  await atomic(join(maintenance,`publication-delivery-${day}.json`),report);await atomic(join(maintenance,'publication-watchdog-latest.json'),report);
  await writeFile(join(maintenance,'publication-alert-current.txt'),report.alerts.length?report.alerts.map(a=>`${a.code}: ${a.subject||''} ${a.reason}`).join('\r\n'):'Beklenen yayınlarda şu an gecikme veya engel yok.','utf8');
  return {status:report.status,contracts:report.rows.length,alerts:report.alerts.length,recovery:report.recovery||null,codexRequired:false};
 }finally{await handle?.close();await unlink(lock).catch(()=>{})}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))runWatchdog().then(r=>console.log(JSON.stringify(r))).catch(async e=>{const reason=String(e.message).slice(0,200);console.error(reason);try{await atomic('D:/Apps/HorseRide/data/maintenance/publication-watchdog-failure.json',{at:new Date().toISOString(),status:'failed',reason});await writeFile('D:/Apps/HorseRide/data/maintenance/publication-alert-current.txt','Yayın denetimi çalışamadı: '+reason,'utf8')}catch{}process.exitCode=1});
