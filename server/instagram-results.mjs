import {resultDetails} from './instagram-result-details.mjs'
export function instagramResults(selections,outcomes){
 const details=selections.map(s=>resultDetails(s,outcomes));
 const result={meetings:selections.length,settled:0,pending:0,excluded:0,couponWins:0,firstWins:0,surpriseWins:0,surpriseEvaluated:0,totalCost:0,details};
 for(const [i,d]of details.entries()){
  const statuses=[d.coupon.status,d.first.status,d.surprise.status];
  if(statuses.includes('excluded')){result.excluded++;continue}
  if(statuses.includes('pending')){result.pending++;continue}
  result.settled++;result.totalCost+=selections[i].ticket.cost;
  if(d.coupon.status==='won')result.couponWins++;
  if(d.first.status==='won')result.firstWins++;
  if(d.surprise.status!=='not_selected'){result.surpriseEvaluated++;if(d.surprise.status==='won')result.surpriseWins++}
 }
 return result;
}
