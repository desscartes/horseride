import {foreignHorseIdentity} from './foreign-data.mjs'
export function sanitiseWinnerTarget(race){
 return {...race,environment:null,weatherForecast:null,horses:race.horses.map(h=>({...h,sourceData:h.sourceData?.tjk?{...h.sourceData,tjk:{...h.sourceData.tjk,raceEnvironment:undefined}}:h.sourceData}))}
}
export function buildWinnerOnlyTarget(race,results,{date,city,programUrl,resultUrl}={}){
 const horses=race.horses.filter(h=>!h.outOfRace),byNo=new Map(horses.map(h=>[h.no,h])),winners=[...(results||[])].filter(([,r])=>r.finishPosition===1)
 if(horses.length<4||byNo.size!==horses.length||!results||results.size<Math.min(4,horses.length)||winners.length!==1)return null
 for(const [no,r]of results){const h=byNo.get(no),name=String(r.sourceName||'').replace(/\(\d+\)/g,'');if(!h||!name||foreignHorseIdentity(name)!==foreignHorseIdentity(h.name))return null}
 return sanitiseWinnerTarget({...race,date,city,foreign:true,horses,winnerOnly:true,winnerNo:winners[0][0],results:horses.map(h=>[h.no,results.has(h.no)?results.get(h.no):{finishPosition:null,knownNonWinner:true}]),winnerEvidence:{programUrl,resultUrl,observedAt:new Date().toISOString(),target:'winner_identity_only',missingFinishingPositions:horses.filter(h=>!results.has(h.no)).length,historyEligible:false,unverifiedTargetEnvironmentExcluded:true}})
}
export function mergeWinnerTargets(rows,targets,date){
 const key=r=>JSON.stringify([r.date||date,r.city,Number(r.no)])
 const merged=new Map(targets.filter(r=>r.date===date&&r.winnerOnly&&r.winnerEvidence?.historyEligible===false).map(r=>[key(r),{...sanitiseWinnerTarget(r),results:new Map(r.results)}]))
 for(const r of rows)merged.set(key(r),r)
 return [...merged.values()]
}
