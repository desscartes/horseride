// Only genuinely frozen pre-start pairs are evaluated. No payout or ROI is inferred.
export function evaluateCouponPairs(pairs,outcomes){
 const first=new Map(),excluded={},reject=k=>excluded[k]=(excluded[k]||0)+1
 for(const p of pairs){
  if(p.role!=='prospective_same_budget_shadow_benchmark'||!Number.isFinite(Date.parse(p.capturedAt))||!(Date.parse(p.capturedAt)<Date.parse(p.scheduledStart))){reject('invalid_capture');continue}
  const key=JSON.stringify([p.date,p.city,p.ordinal,p.budget]);if(!first.has(key)||p.capturedAt<first.get(key).capturedAt)first.set(key,p)
 }
 const rows=[]
 for(const p of first.values()){
  if(p.fields?.length!==6||new Set(p.fields.map(f=>f.raceNo)).size!==6||p.model?.legs?.length!==6||p.market?.legs?.length!==6||p.model.budget!==p.budget||p.market.budget!==p.budget){reject('missing_frozen_fields');continue}
  if([p.model,p.market].some(t=>!Number.isFinite(t.cost)||t.cost<=0||t.cost>p.budget)){reject('invalid_cost');continue}
  const resolved=[];let reason=null
  for(const f of p.fields){const result=outcomes.get(`${p.date}:${p.city}:${f.raceNo}`)
   if(!result){reason='result_pending';break}
   if(new Set(f.names).size!==f.names.length||result.size!==f.names.length||!f.names.every(n=>result.has(n))){reason='field_changed_or_incomplete';break}
   const winners=[...result].filter(([,finish])=>finish===1).map(([n])=>n);if(!winners.length){reason='no_winner';break}
   for(const t of [p.model,p.market]){const leg=t.legs.filter(l=>l.raceNo===f.raceNo);if(leg.length!==1||!leg[0].horses.length||!leg[0].horses.every(h=>f.names.includes(h.name))){reason='invalid_selection';break}}
   if(reason)break;resolved.push({raceNo:f.raceNo,winners})
  }
  if(reason){reject(reason);continue}
  const won=t=>resolved.every(r=>t.legs.find(l=>l.raceNo===r.raceNo).horses.some(h=>r.winners.includes(h.name)))
  rows.push({date:p.date,city:p.city,ordinal:p.ordinal,budget:p.budget,modelWon:won(p.model),marketWon:won(p.market),modelCost:p.model.cost,marketCost:p.market.cost})
 }
 const describe=a=>({pairs:a.length,modelWins:a.filter(r=>r.modelWon).length,marketWins:a.filter(r=>r.marketWon).length,modelSpend:a.reduce((n,r)=>n+r.modelCost,0),marketSpend:a.reduce((n,r)=>n+r.marketCost,0)})
 return {capturedPairs:first.size,settled:describe(rows),byBudget:Object.fromEntries([...new Set(rows.map(r=>r.budget))].map(b=>[b,describe(rows.filter(r=>r.budget===b))])),excluded,rows,roi:null,note:'First frozen pair per meeting/ordinal/budget. Equal budget caps, actual spend reported. Overlapping coupons are correlated; no ROI without official payout. Changed fields excluded.'}
}
