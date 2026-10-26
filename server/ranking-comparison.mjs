const groups=[['jockey','jokey ve at–jokey birlikteliği',/^(jockey|partnership)/i],['workout','idman',/^(workout|workouts|officialWorkout)/i],['form','önceki yarış performansı',/^(form|history|winRate|placeRate|recent|sameSurface|sameDistance|sameTrack|adjustedSpeed|speedEvidence|pastField|fieldRating)/i],['weight','kilo ve start',/^(weight|gate|pastWeight)/i],['pedigree','soy',/^(pedigree|sire|dam)/i],['trainer','antrenör',/^trainer/i]]
// Group replacement sensitivity is descriptive, not SHAP or causal attribution.
// It never changes scores, feature vectors, selections or training contracts.
export function rankingComparison(names,first,second,score,rivalName){
 if(names.length!==first.length||first.length!==second.length||![...first,...second].every(Number.isFinite))return null
 const baseline=score(first),rival=score(second);if(!Number.isFinite(baseline)||baseline<=rival)return null
 const effects=groups.map(([id,label,match])=>{let changed=false;const swapped=first.map((v,i)=>match.test(names[i])?(changed ||= v!==second[i],second[i]):v);return {id,label,scoreEffect:changed?baseline-score(swapped):0}}).filter(e=>Number.isFinite(e.scoreEffect)&&Math.abs(e.scoreEffect)>1e-9)
 return {kind:'group_replacement_sensitivity',rivalName,scoreGap:baseline-rival,supportingGroups:effects.filter(e=>e.scoreEffect>0).sort((a,b)=>b.scoreEffect-a.scoreEffect).slice(0,2),riskGroups:effects.filter(e=>e.scoreEffect<0).sort((a,b)=>a.scoreEffect-b.scoreEffect).slice(0,1),causal:false,additive:false}
}
export function comparisonText(horse){const c=horse.rankingComparison;if(c?.kind!=='group_replacement_sensitivity'||!c.supportingGroups?.length)return '';return `${c.rivalName} ile sayısal karşılaştırmada öne çıkan girdiler: ${c.supportingGroups.map(g=>g.label).join(' ve ')}. Bu başlıklar rakibin değerleriyle değiştirildiğinde puan farkı azalıyor; etki nedensel veya kazanma garantisi değildir.`}
