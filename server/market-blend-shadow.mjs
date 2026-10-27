import {verifiedPrestartProbabilityRecord} from './probability-quality.mjs'
export const blendStudy={id:'fixed-half-market-v1',modelWeight:0.5,marketWeight:0.5,role:'shadow_only',minimumDays:21,minimumRaces:300}
export function marketBlendShadow(row){
 if(!verifiedPrestartProbabilityRecord(row))return null
 const horses=row.race.horses.filter(h=>!h.outOfRace),picks=row.market?.picks||[],names=new Set(horses.map(h=>h.name))
 if(!horses.length||names.size!==horses.length||row.market?.source!=='market_prestart'||!Number.isFinite(Date.parse(row.market.capturedAt))||Date.parse(row.market.capturedAt)>Date.parse(row.capturedAt)||picks.length!==horses.length||new Set(picks.map(h=>h.horseName)).size!==horses.length||!picks.every(h=>names.has(h.horseName)&&Number.isFinite(h.marketShare)&&h.marketShare>=0)||!horses.every(h=>Number.isFinite(h.probability)&&h.probability>=0&&h.probability<=100))return null
 const ps=horses.reduce((n,h)=>n+h.probability,0),ms=picks.reduce((n,h)=>n+h.marketShare,0);if(ps<=0||ms<=0)return null
 return {...blendStudy,capturedAt:row.capturedAt,baseModelVersion:row.modelVersion,picks:horses.map(h=>({horseName:h.name,probability:50*(h.probability/ps+picks.find(m=>m.horseName===h.name).marketShare/ms)}))}
}
