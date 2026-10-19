export const maidenTrainingNames=['observedMaidenStarts','observedMaidenSeconds','observedMaidenTopThree','observedCareerWins','maidenLastThreeImproving','maidenNoObservedHistory','raceWinnerPrizeLog','missingRaceWinnerPrize','priorSameCurrencyPrizeRatio','missingPriorPrizeComparison']
export function winnerPrize(race){
 const entry=race.prizeMoney?.prizes?.find(p=>p.position===1)
 return entry&&Number.isFinite(entry.amount)&&entry.amount>0&&['TRY','USD','GBP','EUR'].includes(entry.currency)?entry:null
}
export function maidenTrainingFeatures(race,past){
 const maiden=past.filter(r=>r.klass.family.startsWith('maiden')),last=[...past].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3),prize=winnerPrize(race)
 const comparable=prize?past.filter(r=>r.prize?.currency===prize.currency):[]
 const mean=comparable.length?comparable.reduce((s,r)=>s+r.prize.amount,0)/comparable.length:null
 return [maiden.length,maiden.filter(r=>r.finish===2).length,maiden.filter(r=>r.finish<=3).length,past.filter(r=>r.finish===1).length,+(last.length===3&&last[0].finish<last[1].finish&&last[1].finish<last[2].finish),+!past.length,prize?Math.log1p(prize.amount):0,+!prize,mean?prize.amount/mean:0,+!mean]
}
