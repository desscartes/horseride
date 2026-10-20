import {horseIdentityV2} from './racing-identity.mjs'
export function auditTrainingContract(data){
 const counts={},examples=[],seen=new Set(),names=data.featureNames||[],add=(code,key)=>{counts[code]=(counts[code]||0)+1;if(examples.length<25)examples.push({code,key})}
 if(!names.length||new Set(names).size!==names.length)add('invalid_feature_schema','features')
 for(const r of data.races||[]){
  const key=JSON.stringify([r.date,r.city,r.no]),n=r.horses?.length||0
  if(seen.has(key))add('duplicate_race',key);seen.add(key)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!r.city||!Number.isInteger(Number(r.no))||Number(r.no)<1)add('invalid_race_identity',key)
  if(n<2||r.features?.length!==n||r.labels?.length!==n||r.baseline?.length!==n)add('runner_alignment',key)
  const ids=(r.horses||[]).map(h=>horseIdentityV2(h));if(ids.some(id=>!id)||new Set(ids).size!==ids.length)add('ambiguous_runner_identity',key)
  if((r.features||[]).some(f=>!Array.isArray(f)||f.length!==names.length||f.some(v=>!Number.isFinite(v))))add('invalid_feature_values',key)
  if(!(r.labels||[]).some(v=>v>0)||(r.labels||[]).some(v=>!Number.isFinite(v)||v<0))add('invalid_outcome_labels',key)
 }
 return {races:data.races?.length||0,features:names.length,passed:Object.keys(counts).length===0,counts,examples,note:'Schema, runner alignment and identity checks only; a passing audit does not establish source provenance, pre-race availability or model accuracy.'}
}
