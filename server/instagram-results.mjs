export function instagramResults(selections,outcomes){
 const result={meetings:selections.length,settled:0,pending:0,excluded:0,couponWins:0,firstWins:0,surpriseWins:0,surpriseEvaluated:0,totalCost:0}
 for(const s of selections){const races=new Map();let pending=false,changed=false
  for(const leg of s.ticket.legs){const finish=outcomes.get(`${s.date}:${s.city}:${leg.raceNo}`),field=s.fields?.find(f=>f.raceNo===leg.raceNo);if(!finish||![...finish.values()].includes(1)){pending=true;break}if(!field||finish.size!==field.names.length||!field.names.every(n=>finish.has(n))){changed=true;break}races.set(leg.raceNo,finish)}
  const chosen=[s.first,s.surprise].filter(Boolean)
  for(const pick of chosen){const finish=outcomes.get(`${s.date}:${s.city}:${pick.raceNo}`);if(!finish||!finish.has(pick.name))pending=true;else races.set(pick.raceNo,finish)}
  if(changed){result.excluded++;continue}if(pending){result.pending++;continue}
  result.settled++;result.totalCost+=s.ticket.cost
  if(s.ticket.legs.every(l=>l.horses.some(h=>races.get(l.raceNo).get(h.name)===1)))result.couponWins++
  if(races.get(s.first.raceNo).get(s.first.name)===1)result.firstWins++
  if(s.surprise){result.surpriseEvaluated++;if(races.get(s.surprise.raceNo).get(s.surprise.name)===1)result.surpriseWins++}
 }
 return result
}
