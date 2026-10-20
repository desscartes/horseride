// Probability algebra under the existing model. This does not calibrate it.
export function pairModelCoverage(a,b){
 const p=a.estimatedChance,q=b.estimatedChance
 if(!Number.isFinite(p)||!Number.isFinite(q)||p<0||q<0||p>1||q>1)throw Error('Invalid model coverage')
 const key=(t,l)=>JSON.stringify([t.date,t.city,l.raceNo]),left=new Map((a.legs||[]).map(l=>[key(a,l),l])),right=new Map((b.legs||[]).map(l=>[key(b,l),l]))
 const shared=[...left.keys()].filter(k=>right.has(k))
 if(!shared.length)return {atLeastOne:p+q-p*q,both:p*q,basis:'model_race_independence',calibrated:false}
 let joint=1
 for(const k of new Set([...left.keys(),...right.keys()])){
  const x=left.get(k),y=right.get(k)
  if(!x||!y){joint*=(x||y).estimatedCoverage;continue}
  // Shared legs must refer to the same model snapshot distribution.
  const known=(l)=>l.horses?.every(h=>Number.isFinite(h.estimatedProbability)&&h.estimatedProbability>=0&&h.estimatedProbability<=1)&&Math.abs(l.horses.reduce((n,h)=>n+h.estimatedProbability,0)-l.estimatedCoverage)<1e-8
  if(x.modelVersion!==y.modelVersion||!known(x)||!known(y))return {atLeastOne:Math.max(p,q),both:Math.min(p,q),basis:'conservative_overlap_bound_missing_distribution',calibrated:false}
  let intersection=0
  for(const h of x.horses){const other=y.horses.find(v=>v.number===h.number);if(!other)continue
   if(Math.abs(h.estimatedProbability-other.estimatedProbability)>1e-8)return {atLeastOne:Math.max(p,q),both:Math.min(p,q),basis:'conservative_overlap_bound_conflicting_distribution',calibrated:false}
   intersection+=h.estimatedProbability
  }joint*=intersection
 }
 if(!Number.isFinite(joint)||joint>Math.min(p,q)+1e-8)throw Error('Inconsistent joint model coverage')
 return {atLeastOne:Math.max(0,Math.min(1,p+q-joint)),both:joint,basis:'shared_race_horse_intersection',calibrated:false}
}
