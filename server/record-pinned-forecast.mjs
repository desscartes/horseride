import {createHash} from 'node:crypto'
export function recordIntelligenceForecast({date,race,trial,bundle,save,fingerprint,now=()=>new Date().toISOString()}){
 if(trial.rankingMethod!==bundle.metadata.method)return
 const registeredAt=bundle.metadata.prospectiveRegisteredAt
 if(!registeredAt)return save({date,races:[trial],source:'shadow_intelligence',modelVersion:bundle.metadata.method,inputHash:fingerprint([race])})
 const capturedAt=now();if(Date.parse(capturedAt)<Date.parse(registeredAt))return
 const scores=r=>[r.rankingMethod,(r.horses||[]).map(h=>[h.no,h.name,h.probability])]
 const namespace=(role)=>createHash('sha256').update(JSON.stringify([role,registeredAt,fingerprint([race]),scores(race),scores(trial)])).digest('hex')
 // A new study gets genuinely new pre-start captures, even if the underlying
 // program hash was already seen before registration. Never rewrite old rows.
 save({date,races:[race],source:'numeric',modelVersion:race.rankingMethod,inputHash:namespace('pinned-control'),capturedAt})
 return save({date,races:[trial],source:'shadow_intelligence',modelVersion:bundle.metadata.method,inputHash:namespace('pinned-candidate'),capturedAt})
}
