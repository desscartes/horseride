import {pairModelCoverage} from './coupon-pair-coverage.mjs'
export function weekStart(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10)}
export function simulationAllowance(date,days){const week=weekStart(date),spent=days.filter(d=>d.week===week).reduce((n,d)=>n+d.spent,0),daysLeft=7-((new Date(date+'T12:00:00Z').getUTCDay()+6)%7);return {week,remaining:Math.max(0,1000-spent),daily:Math.floor(Math.max(0,1000-spent)/daysLeft),daysLeft}}
export function selectSimulationTickets(groups,budget){
 let best=null
 for(let a=0;a<groups.length;a++)for(let b=a+1;b<groups.length;b++)for(const x of groups[a])for(const y of groups[b]){
  const cost=x.cost+y.cost;if(cost>budget+0.001)continue
  const score=pairModelCoverage(x,y).atLeastOne
  if(!best||score>best.score||score===best.score&&cost<best.cost)best={tickets:[x,y],score,cost}
 }
 if(best)return best.tickets.sort((a,b)=>b.estimatedChance-a.estimatedChance)
 if(groups.length===1)return [...groups[0]].filter(t=>t.cost<=budget).sort((a,b)=>b.estimatedChance-a.estimatedChance||a.cost-b.cost).slice(0,1)
 return []
}
