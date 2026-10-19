// A race row alone is not evidence that the bulletin's betting markets were
// parsed. Empty metadata must trigger official CSV verification, not certify
// that a whole meeting has no pick-six or pick-five.
export function attachOfficialMarketEvidence(races,sourceRaces){
 const meetings=new Set(sourceRaces.filter(r=>r.sixLegStarts?.length||r.fiveLegStarts?.length).map(r=>r.city))
 return races.map(r=>{const raw=sourceRaces.find(v=>v.city===r.city&&Number(v.no)===Number(r.no));return {...r,sixLegStarts:raw?.sixLegStarts||[],fiveLegStarts:raw?.fiveLegStarts||[],officialMarketsVerified:Boolean(raw)&&meetings.has(r.city)}})
}
