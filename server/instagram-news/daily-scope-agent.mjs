import{readFile,writeFile,readdir,mkdir,copyFile,rename}from'node:fs/promises';import{resolve}from'node:path';import{createHash}from'node:crypto';import{execFile}from'node:child_process';import{promisify}from'node:util';
import{collectScopeViews}from'./daily-scope-input.mjs';import{buildScopePlan,legacyPublications,raceStart}from'./daily-scope-plan.mjs';import{readPublicationCadence}from'./cadence.mjs';import{publish}from'../instagram-agent-io.mjs';
const exec=promisify(execFile),root='data/instagram',host='https://ganyan-zekasi.tailab9792.ts.net',read=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''));
const maybe=async p=>{try{return await read(p)}catch(e){if(e.code==='ENOENT')return null;throw e}},hash=b=>createHash('sha256').update(b).digest('hex');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusLabel=s=>({ready:'Hazır',no_upcoming_races:'Yaklaşan koşu bulunmuyor',waiting_for_complete_scope:'Bazı kaynaklar henüz doğrulanıyor',scope_capacity_exceeded:'Görsel kapasitesi aşıldı; tam liste bu sayfada',unverified_program:'Resmî program henüz doğrulanamadı',source_stale:'Kaynak henüz güncel doğrulanamadı',race_summary_or_source_incomplete:'Koşu verisi veya kaynak bağlantısı eksik'}[s]||'Doğrulama bekleniyor');
async function publications(){const list=[];for(const d of await readdir(root,{withFileTypes:true})){if(!d.isDirectory()||['retired','media-repo'].includes(d.name))continue;const p=await maybe(`${root}/${d.name}/publication.json`);if(p){const m=await maybe(`${root}/${d.name}/manifest.json`);if(m)list.push({id:d.name,manifest:m,publication:p})}}return list}
async function writeLivePage(p){
 const dir=`dist/daily-races/${p.date}`;await mkdir(dir,{recursive:true});
 const rows=p.rows.map(r=>`<section><h2>${esc(r.displayCity)} · ${r.raceNo}. koşu · ${esc(r.start)}${r.scheduledDate&&r.scheduledDate!==p.date?' · '+esc(r.scheduledDate):''}</h2><p>${esc(r.distance)} m · ${esc(r.surface)} · ${r.mode==='model'?'Etkin model sırası':r.mode==='past_form'?'Geçmiş form; model sırası değil':'Model sıralaması yok'}</p>${r.horses?.length?`<ol>${r.horses.map(h=>`<li><b>${h.no} ${esc(h.name)}</b><p>${[h.lastRun,h.workout,h.form].filter(Boolean).map(esc).join(' ')}</p></li>`).join('')}</ol>`:`<p>${esc(r.note)}</p>`}</section>`).join('');
 const html=`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)} · ${p.date}</title><style>body{font:16px/1.6 system-ui;background:#081b24;color:#eee9dc;max-width:950px;margin:32px auto;padding:20px}h1,h2{color:#9bd8bc}section{border-top:1px solid #48665c;padding:12px 0}.warn{color:#ffc78c}li{margin-bottom:14px}</style><h1>${esc(p.title)} · ${p.date}</h1><p>Güncelleme: ${esc(new Date(p.snapshotAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}))} TSİ. Bu sayfa güncel kaynak durumudur; yayımlanmış Instagram görsellerinin değiştirildiği anlamına gelmez.</p>${p.status!=='ready'?`<p class="warn">Tam dosya henüz doğrulanamadı: ${esc(statusLabel(p.status))}. ${p.missing.map(m=>esc(m.city)+': '+esc(statusLabel(m.reason))).join('; ')}</p>`:''}<p>${p.rows.length} yaklaşan koşu. Başlamış veya başlamasına on dakikadan az kalmış ${p.excludedStarted} koşu sıralamaya alınmadı. Model sıralaması kesin sonuç veya kazanma olasılığı değildir.</p>${rows}</html>`;
 await writeFile(`${dir}/${p.scope}.html`,html);return `${host}/daily-races/${p.date}/${p.scope}.html`;
}
async function stageImages(p,dir){
 const target=`dist/social/daily-races/${p.date}/${p.scope}`;await mkdir(target,{recursive:true});const images=[];
 for(let i=1;i<=p.slides.length;i++){const localName=`slide-${i}.png`,bytes=await readFile(`${dir}/${localName}`),sha256=hash(bytes),name=`slide-${i}-${sha256.slice(0,12)}.png`;await writeFile(`${target}/${name}`,bytes);const url=`${host}/social/daily-races/${p.date}/${p.scope}/${name}`;const response=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!response.ok||hash(Buffer.from(await response.arrayBuffer()))!==sha256)throw Error('Public source artwork verification failed');images.push({localName,sha256,url})}
 return images;
}
async function requestSourceRefresh(day){
 const path=`${root}/scope-source-refresh-${day}.json`,prior=await maybe(path);if(prior&&Date.now()-Date.parse(prior.at)<30*60000)return 'refresh_cooldown';
 const code="$s=New-Object -ComObject Schedule.Service;$s.Connect();$t=$s.GetFolder('\\').GetTask('HorseRide-Intraday-Collection');if($t.State -eq 3){$null=$t.Run($null);'requested_existing_collection_task'}else{'existing_collection_task_not_idle'}";
 const r=await exec('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-Command',code],{windowsHide:true,timeout:15000,maxBuffer:2000});await writeFile(path,JSON.stringify({at:new Date().toISOString(),status:r.stdout.trim()}));return r.stdout.trim();
}
export async function runDailyScopeAgent({day,program,report,config}){
 const pub=await publications(),status={date:day,mode:'daily_scopes',checkedAt:new Date().toISOString(),scopes:[],noExtraRaceFeedPosts:true};let refreshNeeded=false;
 for(const scope of ['domestic','foreign']){
  try{
   let current=await read(`data/program-cache/${day}.json`),plan=buildScopePlan(current,collectScopeViews(current),{scope});const liveUrl=await writeLivePage(plan),dir=`${root}/${plan.id}`;
   const prior=await maybe(`${dir}/publication.json`),legacy=legacyPublications(pub,day,scope);
   if(prior?.status==='published_verified'){status.scopes.push({scope,status:'published_verified',url:prior.permalink,liveUrl,lateUpdates:'application_only'});continue}
   if(prior?.mediaId||prior?.status==='publishing_unknown'){status.scopes.push({scope,status:'publication_reconciliation_required'});report.blocked.push({scope,reason:'group_publication_outcome_unknown'});continue}
   if(legacy.length){status.scopes.push({scope,status:'legacy_transition',legacyPosts:legacy.map(p=>({id:p.id,url:p.publication.permalink})),liveUrl,nextDayGrouped:true});continue}
   if(plan.status!=='ready'){status.scopes.push({scope,status:plan.status,missing:plan.missing,capacity:plan.capacity});report.blocked.push({scope,reason:plan.status,missing:plan.missing});if(plan.missing.some(m=>m.reason==='source_stale'))refreshNeeded=true;continue}
   const cadence=await readPublicationCadence(root,day,new Date().toISOString(),config);if(!cadence.due){status.scopes.push({scope,status:cadence.reason,nextAt:cadence.nextAt});continue}
   await mkdir(dir,{recursive:true});let manifest=await maybe(`${dir}/manifest.json`),entry=prior;
   if(manifest&&(manifest.factsSignature!==plan.factsSignature||Date.parse(manifest.expiresAt)<=Date.now())){
    if(entry&&!['container_created','ready'].includes(entry.status)){report.blocked.push({scope,reason:'group_revision_requires_reconciliation'});continue}
    await mkdir(`${root}/retired`,{recursive:true});await rename(dir,`${root}/retired/${plan.id}-${Date.now()}`);await mkdir(dir,{recursive:true});manifest=null;entry=null;
   }
   if(!manifest){
    await writeFile(`${dir}/plan.json`,JSON.stringify(plan,null,2));await exec(process.execPath,['server/instagram-news/render-daily-scope.mjs',resolve(`${dir}/plan.json`),resolve(dir)],{windowsHide:true,timeout:120000,maxBuffer:6000});
    const images=await stageImages(plan,dir);await copyFile(`${dir}/slide-1.png`,`${dir}/image.png`);
    const countries=plan.coverage.map(c=>`${c.city}: ${c.races} koşu${c.mode==='model'?` (model verisi ${c.trainedThrough})`:c.mode==='past_form'?' (geçmiş form; model değil)':' (model yok)'}`).join('\n');
    const caption=`${plan.title} | ${day.split('-').reverse().join('.')}\n${plan.rows.length} koşu, ${plan.coverage.length} hipodrom tek gönderide. Model bulunan koşularda ilk dört sıra ve kısa veri notu; diğerleri açıkça belirtilir.\n\n${countries}\n\n${plan.excludedStarted?`Başlamış / on dakikadan az kalmış ${plan.excludedStarted} koşu dahil edilmedi.\n`:''}Görseller ${new Date(plan.snapshotAt).toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'})} TSİ kaynaklarının anlık görüntüsüdür. Çekilenler, sonradan eklenen programlar ve uzun yorumlar ek gönderi yerine güncel dosyada:\n${liveUrl}\n\nSıralama kesin sonuç veya kazanma olasılığı değildir. Kaynak: TJK programı ve doğrulanmış geçmiş kayıtlar.\n\n#GanyanZekası #AtYarışı #YarışAnalizi`;
    if(caption.length>2200)throw Error('Grouped caption exceeds limit');
    manifest={id:plan.id,account:'ganyan_zekasi',instagramId:'17841441483231653',date:day,kind:'daily_race_scope',scope,cities:plan.coverage.map(c=>c.city),coverage:plan.coverage,raceCount:plan.rows.length,factsSignature:plan.factsSignature,expiresAt:plan.expiresAt,localImage:'image.png',imageSha256:images[0].sha256,imageUrl:images[0].url,images,caption,altText:`${plan.title}: hipodrom ve koşu bazında kısa model sırası / veri notları.`,liveUrl};
    await writeFile(`${dir}/snapshot.json`,JSON.stringify(plan,null,2));await writeFile(`${dir}/manifest.json`,JSON.stringify(manifest,null,2));
   }
   await publish(plan.id,'Prepare');
   current=await read(`data/program-cache/${day}.json`);const latest=buildScopePlan(current,collectScopeViews(current),{scope});
   if(latest.status!=='ready'||latest.factsSignature!==manifest.factsSignature){report.blocked.push({scope,reason:'group_last_minute_revalidation_failed'});continue}
   const before=await readPublicationCadence(root,day,new Date().toISOString(),config);if(!before.due){status.scopes.push({scope,status:before.reason});continue}
   await publish(plan.id,'Publish');entry=await read(`${dir}/publication.json`);
   if(entry.status==='published_verified'){report.published.push({scope,kind:'daily_race_scope',url:entry.permalink});status.scopes.push({scope,status:entry.status,url:entry.permalink,liveUrl,races:plan.rows.length,slides:plan.slides.length})}
   else status.scopes.push({scope,status:'container_pending'});
  }catch(e){report.blocked.push({scope,reason:'daily_scope_failed',detail:String(e.message).slice(0,180)});status.scopes.push({scope,status:'failed'})}
 }
 if(refreshNeeded)try{status.sourceRefresh=await requestSourceRefresh(day)}catch(e){status.sourceRefresh='existing_collection_task_unavailable'}
 await writeFile(`${root}/daily-scopes-${day}.json`,JSON.stringify(status,null,2));report.dailyScopes=status;report.mode='daily_scopes';report.status=report.published.length?'published':status.scopes.every(s=>['published_verified','legacy_transition'].includes(s.status))?'daily_scopes_complete_or_transition':'waiting_for_daily_scopes';
}
