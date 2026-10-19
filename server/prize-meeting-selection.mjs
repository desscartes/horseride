export function selectPrizeMeetings(meetings,{perPeriod=3,spreadMonths=false}={}){
 const counts=new Map(),selected=[]
 const take=row=>{const key=`${row.country}:${row.period}`;if((counts.get(key)||0)>=perPeriod)return;counts.set(key,(counts.get(key)||0)+1);selected.push(row)}
 if(!spreadMonths){for(const row of meetings)take(row);return selected}
 const months=new Map()
 for(const row of meetings){const key=`${row.date.slice(0,7)}:${row.country}:${row.period}`;if(!months.has(key))months.set(key,[]);months.get(key).push(row)}
 const buckets=[...months].sort(([a],[b])=>a.localeCompare(b)).map(([,rows])=>rows.sort((a,b)=>b.date.localeCompare(a.date)||a.city.localeCompare(b.city)))
 for(let round=0;buckets.some(rows=>rows.length>round);round++)for(const rows of buckets)if(rows[round])take(rows[round])
 return selected
}
