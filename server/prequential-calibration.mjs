// Retrospective rolling-origin diagnostic: fit temperatures on strictly earlier dates only.
const grid=[1,.75,1.25,1.5,2]
export function temperatureScale(p,t){const q=p.map(v=>Math.pow(Math.max(v,1e-12),1/t)),sum=q.reduce((a,b)=>a+b,0);return q.map(v=>v/sum)}
const loss=(p,y)=>-p.reduce((s,v,i)=>s+y[i]*Math.log(Math.max(v,1e-12)),0)
const brier=(p,y)=>p.reduce((s,v,i)=>s+(v-y[i])**2,0)
export function rollingCalibration(rows,{minimumRaces=100,minimumDays=7}={}){
 const results=[],history=new Map(),excluded={insufficientEarlierData:0}
 for(const day of [...new Set(rows.map(r=>r.date))].sort()){
  const today=rows.filter(r=>r.date===day)
  for(const r of today){const key=JSON.stringify([r.country,r.modelVersion]),past=history.get(key)||[]
   if(past.length<minimumRaces||new Set(past.map(x=>x.date)).size<minimumDays){excluded.insufficientEarlierData++;continue}
   const temperature=grid.reduce((best,t)=>{const l=past.reduce((s,x)=>s+loss(temperatureScale(x.p,t),x.y),0);return l<best.loss?{t,loss:l}:best},{t:1,loss:Infinity}).t
   const q=temperatureScale(r.p,temperature)
   results.push({date:r.date,country:r.country,modelVersion:r.modelVersion,temperature,fitThrough:past.at(-1).date,fitRaces:past.length,baseLogLoss:loss(r.p,r.y),calibratedLogLoss:loss(q,r.y),baseBrier:brier(r.p,r.y),calibratedBrier:brier(q,r.y)})
  }
  // Hold the complete target date out before appending any of its outcomes.
  for(const r of today){const key=JSON.stringify([r.country,r.modelVersion]);if(!history.has(key))history.set(key,[]);history.get(key).push(r)}
 }
 const mean=k=>results.length?results.reduce((s,r)=>s+r[k],0)/results.length:null
 return {role:'retrospective_rolling_origin_diagnostic',activated:false,minimumRaces,minimumDays,temperatures:grid,scoredRaces:results.length,scoredDays:new Set(results.map(r=>r.date)).size,excluded,baseLogLoss:mean('baseLogLoss'),calibratedLogLoss:mean('calibratedLogLoss'),baseBrier:mean('baseBrier'),calibratedBrier:mean('calibratedBrier'),rows:results,note:'Temperature preserves ranking. Same-day outcomes excluded. Previously inspected archive is not new prospective proof; results availability time was not reconstructed.'}
}
