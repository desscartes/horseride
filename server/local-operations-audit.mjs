import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export function evaluateOperations({day,now,program,morning,night,comments,video,stock,health,policy}) {
 const issues=[];
 const add=(code,detail)=>issues.push({code,detail});
 if(!health?.apiHealthy)add('api_unhealthy_or_unknown','API sağlık kaydı olumlu değil veya yok.');
 else if(now-Date.parse(health.checkedAt)>10*60000)add('api_health_stale','API sağlık kaydı 10 dakikadan eski.');
 if(night?.day!==day||!night.finishedAt)add('nightly_not_completed','Bugünkü gece bakım/eğitim işinin tamamlanma kaydı yok.');
 if(morning?.day!==day)add('morning_missing','Bugünün sabah hazırlık raporu yok.');
 else {
  if(!morning.finishedAt)add('morning_incomplete',`Sabah hazırlığı tamamlanmadı; aşama: ${morning.phase||'bilinmiyor'}.`);
  for(const [name,s] of Object.entries(morning.stages||{}))if(s.status==='failed')add('morning_stage_failed',`${name}: ${s.error||'başarısız'}`);
 }
 if(program?.date!==day)add('program_wrong_day','Program hedef günle eşleşmiyor veya yok.');
 const races=program?.date===day?(program.races||[]):[];
 const cities=[...new Set(races.map(r=>r.city))];
 const upcoming=races.filter(r=>Date.parse(`${r.scheduledDate||day}T${String(r.time).replace('.',':')}:00+03:00`)>now);
 for(const city of new Set(upcoming.map(r=>r.city))){
  const stamp=program.cityFetchedAt?.[city]||program.fetchedAt;
  const age=now-Date.parse(stamp);
  if(!Number.isFinite(age)||age< -60000||age>120*60000)add('program_source_stale',`${city}: güncel kaynak doğrulaması gerekli.`);
 }
 let missingParents=0,missingIdentity=0;
 for(const r of races)for(const h of r.horses||[]){if(!h.sire||!h.dam)missingParents++;if(!h.horseId)missingIdentity++;}
 if(missingParents)add('parent_fields_missing',`${missingParents} atta anne veya baba alanı eksik.`);
 if(missingIdentity)add('horse_id_missing',`${missingIdentity} atta kaynak at kimliği eksik.`);
 const covered=new Map((comments?.day===day?comments.results||[]:[]).map(x=>[x.city,x.races]));
 for(const city of new Set(upcoming.map(r=>r.city))){
  const n=upcoming.filter(r=>r.city===city).length;
  if((covered.get(city)||0)<n)add('commentary_coverage_gap',`${city}: ${n} gelecek koşu için yorum kapsamı yetersiz.`);
 }
 const videoPublished=video?.day===day&&['published_verified','already_published'].includes(video.status);
 if(!videoPublished)add('history_not_published',`Bugünkü tarih videosu: ${video?.day===day?video.status:'rapor yok'}.`);
 if(!videoPublished&&['episode_rendered_pending_review','batch_rendered_pending_review'].includes(stock?.status))add('history_visual_review_pending',`Üretim tamamlandı fakat görsel inceleme/yayın bekliyor: ${stock.episode||'haftalık stok'}. Son üretim: ${stock.updatedAt||'bilinmiyor'}.`);
 if(stock?.status==='failed')add('weekly_video_failed','Haftalık sahne üretiminin son denemesi başarısız.');
 if(policy?.fullBatchEnabled!==true)add('weekly_video_paused','Haftalık tam üretim etkin değil.');
 return {day,checkedAt:new Date(now).toISOString(),codexRequired:false,paidCalls:false,status:issues.length?'attention_required':'healthy',issues,
  coverage:{meetings:cities.length,races:races.length,upcomingRaces:upcoming.length,cities,missingParents,missingIdentity},
  checksNotClaimed:['Kaynağa karşı anne-baba eşleşmesi','Canlı çekilen/pist/hava karşılaştırması','Yorum düğmesinin uçtan uca testi','Yeni modelin bağımsız testini yeniden çalıştırma'],
  safety:{jobsStarted:0,locksRemoved:0,modelsChanged:0,historicalForecastsChanged:0,socialPostsSent:0}};
}

export async function runAudit(root,now=new Date()){
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const clock=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now).replace(':',''));
 if(clock<630)return {status:'before_daily_audit_window',codexRequired:false};
 const load=async p=>{try{return JSON.parse((await readFile(resolve(root,p),'utf8')).replace(/^\uFEFF/,''))}catch(e){if(e.code==='ENOENT')return null;return {readError:e.name}}};
 const [program,morning,night,comments,video,stock,health,policy]=await Promise.all([
  `data/program-cache/${day}.json`,`data/maintenance/morning-${day}.json`,'data/maintenance/state.json','data/maintenance/commentary-watchdog.json','data/instagram/history-status.json','data/instagram/weekly-stock/status.json','data/maintenance/service-health.json','data/instagram/weekly-stock/policy.json'].map(load));
 const result=evaluateOperations({day,now:+now,program,morning,night,comments,video,stock,health,policy});
 const folder=resolve(root,'data/maintenance');await mkdir(folder,{recursive:true});
 const atomic=async(p,text)=>{const temp=p+`.${process.pid}.tmp`;await writeFile(temp,text);await rename(temp,p)};
 const content=JSON.stringify(result,null,2);
 await atomic(resolve(folder,`local-operations-audit-${day}.json`),content);
 await atomic(resolve(folder,'local-operations-audit.json'),content);
 const signature=createHash('sha256').update(JSON.stringify({day,issues:result.issues,coverage:result.coverage})).digest('hex');
 const previous=await load('data/maintenance/local-operations-alert.json');
 if(previous?.signature!==signature)await atomic(resolve(folder,'local-operations-alert.json'),JSON.stringify({signature,changedAt:result.checkedAt,status:result.status,issues:result.issues},null,2));
 const md=`# Yerel işletim denetimi — ${day}\n\nKontrol: ${result.checkedAt}. Codex veya ücretli servis çağrısı yok.\n\n${result.issues.map(x=>`- ${x.detail}`).join('\n')||'Açık işletim uyarısı yok.'}\n\nKaynakla kimlik eşleştirme ve canlı çekilen/hava/pist karşılaştırması bu salt okunur denetim tarafından doğrulanmış sayılmaz. Başarısız kontrol, raporun tamamlanmasıyla kapanmış sayılmaz.\n`;
 await atomic(resolve(folder,`local-operations-audit-${day}.md`),md);
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 runAudit(root).then(r=>console.log(JSON.stringify({day:r.day,status:r.status,issues:r.issues?.length,codexRequired:false}))).catch(e=>{console.error(e.message);process.exitCode=1});
}
