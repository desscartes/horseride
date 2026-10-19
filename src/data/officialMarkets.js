export function marketOrdinals(text,legCount,fallback=1){
 const normalized=String(text).normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').toUpperCase()
 return [...new Set([...normalized.matchAll(new RegExp(`(?:\\b([12])\\s*\\.\\s*)?\\b${legCount}\\s*['’]?\\s*LI\\s+GANYAN\\b`,'g'))].map(m=>m[1]?Number(m[1]):fallback))]
}
export function parseOfficialMarkets(text){
 let raceNo=null;const starts=[]
 for(const line of String(text).split(/\r?\n/)){
  const header=line.match(/(?:^|;)\s*(\d+)\s*\.\s*Ko[şs]u\b/i)
  if(header)raceNo=Number(header[1])
  if(!raceNo)continue
  for(const legCount of [6,5])for(const ordinal of marketOrdinals(line,legCount,starts.filter(s=>s.legCount===legCount).length+1))starts.push({legCount,ordinal,raceNo})
 }
 return [...new Map(starts.map(s=>[`${s.legCount}:${s.ordinal}`,s])).values()]
}
export function officialStarts(races,legCount){
 const field=legCount===6?'sixLegStarts':'fiveLegStarts'
 return races.flatMap(r=>(r[field]||[]).map(ordinal=>({legCount,ordinal:Number(ordinal),raceNo:Number(r.no)}))).sort((a,b)=>a.ordinal-b.ordinal)
}
export function officialMarketAllowed(race,legCount){return legCount!==5&&legCount!==6||Boolean(race?.[legCount===6?'sixLegStarts':'fiveLegStarts']?.length)}
