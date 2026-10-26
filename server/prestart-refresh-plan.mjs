import {raceStartISO} from './preparation-readiness.mjs'
export function prestartRefreshJob(program,date,now,state={}){
 if(program?.date!==date||!Array.isArray(program.races))return null
 const starts=program.races.map(r=>Date.parse(raceStartISO(r,date))).filter(t=>t>+now),nearest=Math.min(...starts)-+now
 const interval=nearest<=30*60000?10:30
 const age=now-Date.parse(program.fetchedAt);if(Number.isFinite(age)&&age>=0&&age<interval*60000)return null
 const imminent=program.races.some(r=>{const t=Date.parse(raceStartISO(r,date));return t>+now&&t-+now<=60*60000})
 if(!imminent)return null
 const id=`${date}:prestart-refresh-${Math.floor(+now/(interval*60000))}`,old=state[id];if(old?.status==='complete'||(old?.attempts||0)>=2)return null
 return {id,script:'server/run-prestart-readiness.mjs',args:[date],env:{},reason:'Race starts within 60 minutes; refresh entries, changes and race forecast'}
}
