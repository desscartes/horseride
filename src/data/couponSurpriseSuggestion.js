import {validSurprise,surpriseCandidates} from './surprisePolicy.js'
export function surpriseSuggestionText(suggestion,short=false){
 if(!suggestion)return 'Alternatif aday hazırlanıyor.'
 if(!suggestion.available)return suggestion.reason
 return `${suggestion.status==='model_alternative'?'Alternatif':'Sürpriz adayı'}: ${suggestion.number}${short?'':' · '+suggestion.horseName}`
}
export function legSurpriseSuggestion(race,prediction){
 const runners=(race?.horses||[]).filter(h=>!h.outOfRace),ranked=[...runners].sort((a,b)=>Number(b.probability??b.baselineProbability??0)-Number(a.probability??a.baselineProbability??0)||Number(a.no)-Number(b.no))
 if(runners.length<3)return {available:false,reason:'Bu ayakta ilk iki aday dışında sürpriz önerilebilecek yeterli koşan at yok.'}
 const picks=(prediction?.picks||[]).filter(p=>runners.some(h=>h.name===p.horseName)),leaders=picks.length>=2?picks:ranked.map(h=>({horseName:h.name}))
 const verified=validSurprise({...race,horses:runners},prediction),allowed=surpriseCandidates({...race,horses:runners},leaders)
 let horse=verified&&runners.find(h=>h.name===verified.horseName)
 if(horse)return {available:true,number:Number(horse.no),horseName:horse.name,status:'evidence_supported',reason:verified.reason}
 horse=ranked.find(h=>allowed.includes(h.name))
 if(horse)return {available:true,number:Number(horse.no),horseName:horse.name,status:'market_outsider',reason:'AGF ve ana aday sıralamasında ilk ikinin dışında kalan alternatif; ek yarış kanıtı sınırlı olabilir.'}
 horse=ranked.find(h=>!leaders.slice(0,2).some(p=>p.horseName===h.name))
 return horse?{available:true,number:Number(horse.no),horseName:horse.name,status:'model_alternative',reason:'İlk iki aday dışındaki alternatif. AGF favorileri dışında kaldığı doğrulanmadığı için kesin sürpriz etiketi taşımaz.'}:{available:false,reason:'Güncel koşan atlar arasında uygun alternatif bulunamadı.'}
}
