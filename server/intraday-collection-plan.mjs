export function collectionPlan(day){
 const jobs=[]
 const add=(id,time,script,args=[],env={})=>jobs.push({id:`${day}:${id}`,time,script,args,env})
 for(const hour of [5,7,9,11,13,15,17,19,21,23]){
  const h=String(hour).padStart(2,'0')
  add(`program-${h}`,`${h}:00`,'server/program-refresh.mjs',[day])
  add(`jockey-${h}`,`${h}:05`,'server/refresh-jockey-context.mjs',[day])
  add(`maternal-${h}`,`${h}:15`,'server/collect-program-maternal-lines.mjs',[day])
  if(hour>=5){add(`pedigree-${h}`,`${h}:30`,'server/collect-tjk-pedigree.mjs',[],{PEDIGREE_COUNTRIES:'TR,US',PEDIGREE_BATCH_SIZE:'50',PEDIGREE_CURRENT_ONLY:'1'});add(`workouts-${h}`,`${h}:45`,'server/collect-current-missing-workouts.mjs')}
 }
 for(const h of ['06','10','14','18','22'])add(`us-workouts-${h}`,`${h}:00`,'server/collect-equibase-workouts.mjs')
 for(const h of ['06','10','14','18','22'])add(`workout-usage-${h}`,`${h}:15`,'server/audit-workout-usage.mjs',[day])
 for(const h of ['06','10','18'])add(`gap-audit-${h}`,`${h}:30`,'server/audit-current-runner-gaps.mjs',[day])
 for(const h of ['06','08','10','12','14','16','18','20','22'])add(`readiness-${h}`,`${h}:45`,'server/audit-preparation-readiness.mjs',[day])
 for(const h of ['06','08','10','12','14','16','18','20','22'])add(`comments-${h}`,`${h}:35`,'server/refresh-fluent-commentaries.mjs')
 return jobs.sort((a,b)=>a.time.localeCompare(b.time)||a.id.localeCompare(b.id))
}
export function nextCollectionJob(day,minute,state={}){
 return collectionPlan(day).find(j=>{const [h,m]=j.time.split(':').map(Number),age=minute-h*60-m,old=state[j.id];return age>=0&&age<=60&&old?.status!=='complete'&&(old?.attempts||0)<2&&(!old?.lastAttemptAtMinute||minute-old.lastAttemptAtMinute>=30)})||null
}
